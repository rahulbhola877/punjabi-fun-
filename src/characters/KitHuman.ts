/**
 * Bridge from the user's punjab-characters kit (Three.js, src/kit) to the
 * game's Babylon scene. The kit builds the body, face, skeleton and baked
 * clips in code; here they become one Babylon skinned body mesh and a face
 * mesh with morph targets on a Babylon skeleton. Every frame the kit's own
 * mixer runs on its Three bones and their local matrices are copied over.
 *
 * Three is right-handed, Babylon left-handed: like Babylon's glTF loader the
 * converted rig hangs under a node mirrored on X (z-flip + half turn), so the
 * data is copied as-is and the character faces +Z like the game's people.
 */
import { Matrix, Mesh, Skeleton, Bone, TransformNode, VertexData, type Scene, type Material } from "../babylon";
import { MorphTarget } from "@babylonjs/core/Morph/morphTarget";
import { MorphTargetManager } from "@babylonjs/core/Morph/morphTargetManager";
import type * as THREE from "three";
import { Character, type ColorOverrides } from "../kit/character";
import type { Archetype, BuildTweak } from "../kit/rig";
import { B, BONE_COUNT } from "./HumanBuilder";

export interface KitLook {
  archetype: Archetype;
  outfit: string;
  colors?: ColorOverrides;
  build?: BuildTweak;
}

/** Kit bone for each of the game's 17 bone slots (props attach to hands). */
const SLOT_NAMES: Record<number, string> = {
  [B.hips]: "Hips", [B.spine]: "Spine", [B.chest]: "Chest", [B.neck]: "Neck", [B.head]: "Head",
  [B.uArmL]: "UpperArm_L", [B.fArmL]: "LowerArm_L", [B.handL]: "Hand_L",
  [B.uArmR]: "UpperArm_R", [B.fArmR]: "LowerArm_R", [B.handR]: "Hand_R",
  [B.thighL]: "UpperLeg_L", [B.shinL]: "LowerLeg_L", [B.footL]: "Foot_L",
  [B.thighR]: "UpperLeg_R", [B.shinR]: "LowerLeg_R", [B.footR]: "Foot_R",
};

type Internal = { _markAsDirtyAndDecompose(): void };

function toBabylonMesh(name: string, src: THREE.SkinnedMesh, scene: Scene, skel: Skeleton, boneIndex: Map<THREE.Bone, number>, mat: Material): Mesh {
  const g = src.geometry;
  const pos = g.attributes.position!.array as Float32Array;
  const nrm = g.attributes.normal!.array as Float32Array;
  const col = g.attributes.color;
  const n = pos.length / 3;
  const vd = new VertexData();
  vd.positions = Float32Array.from(pos);
  vd.normals = Float32Array.from(nrm);
  if (col) {
    const c = col.array as Float32Array, k = col.itemSize;
    const out = new Float32Array(n * 4);
    for (let i = 0; i < n; i++) { out[i * 4] = c[i * k]!; out[i * 4 + 1] = c[i * k + 1]!; out[i * 4 + 2] = c[i * k + 2]!; out[i * 4 + 3] = 1; }
    vd.colors = out;
  }
  vd.indices = g.index ? Uint32Array.from(g.index.array as ArrayLike<number>) : Uint32Array.from({ length: n }, (_, i) => i);
  // Skin indices refer to the kit skeleton's bone order; map them to ours.
  const si = g.attributes.skinIndex!.array as ArrayLike<number>, sw = g.attributes.skinWeight!.array as ArrayLike<number>;
  const order = src.skeleton.bones.map((b) => boneIndex.get(b)!);
  const mi = new Float32Array(n * 4), mw = new Float32Array(n * 4);
  for (let i = 0; i < n * 4; i++) { mi[i] = order[si[i]!]!; mw[i] = sw[i]!; }
  vd.matricesIndices = mi;
  vd.matricesWeights = mw;
  const m = new Mesh(name, scene);
  vd.applyToMesh(m, true);
  m.skeleton = skel;
  m.numBoneInfluencers = 4;
  m.material = mat;
  m.alwaysSelectAsActiveMesh = false;
  // Face morphs (blink, smile, talk...): the kit stores them as offsets.
  const morphs = g.morphAttributes.position;
  if (morphs?.length) {
    const mgr = new MorphTargetManager(scene);
    const names = Object.entries(src.morphTargetDictionary ?? {}).sort((a, b) => a[1] - b[1]).map((e) => e[0]);
    morphs.forEach((attr, i) => {
      const d = attr.array as Float32Array;
      const p = new Float32Array(pos.length);
      for (let j = 0; j < p.length; j++) p[j] = pos[j]! + (g.morphTargetsRelative ? d[j]! : d[j]! - pos[j]!);
      const t = new MorphTarget(names[i] ?? `m${i}`, 0, scene);
      t.setPositions(p);
      mgr.addTarget(t);
    });
    m.morphTargetManager = mgr;
  }
  return m;
}

/** A kit character living in the Babylon scene; shaped like BuiltHuman for the code that attaches props or seats people. */
export class KitHuman {
  readonly root: TransformNode;
  readonly mesh: Mesh;
  readonly face: Mesh;
  readonly skeleton: Skeleton;
  /** Game bone slots (B.*) → Babylon bones (hands for props). */
  readonly bones: Bone[];
  /** Hip height / 0.92: seats and riders use `0.92 * scale` for the hip. */
  readonly scale: number;
  readonly ch: Character;
  private pairs: Array<[THREE.Bone, Bone]> = [];
  private tmp = new Matrix();
  /** Head turn toward something (radians, + to the character's left as the game measures yaw). */
  look = 0;
  private neckHead: THREE.Bone[] | null = null;
  private saved: Array<[number, number, number, number]> = [[0, 0, 0, 1], [0, 0, 0, 1]];

  constructor(scene: Scene, name: string, look: KitLook, mat: Material) {
    this.ch = new Character({ archetype: look.archetype, outfit: look.outfit, colors: look.colors ?? {}, build: look.build });
    this.root = new TransformNode(name, scene);
    const flip = new TransformNode(`${name}_flip`, scene);
    flip.parent = this.root;
    flip.scaling.set(-1, 1, 1);
    this.skeleton = new Skeleton(`${name}_skel`, `${name}_skel`, scene);
    const index = new Map<THREE.Bone, number>();
    const kitBones = this.ch.rig.bones;
    for (const kb of kitBones) kb.updateMatrix();
    for (const kb of kitBones) {
      const parent = kb.parent && index.has(kb.parent as THREE.Bone) ? this.skeleton.bones[index.get(kb.parent as THREE.Bone)!]! : null;
      const local = Matrix.FromArray(kb.matrix.elements);
      const bb = new Bone(kb.name, this.skeleton, parent, local, local.clone(), local.clone());
      index.set(kb, this.skeleton.bones.length - 1);
      this.pairs.push([kb, bb]);
    }
    this.mesh = toBabylonMesh(`${name}_body`, this.ch.body, scene, this.skeleton, index, mat);
    this.face = toBabylonMesh(`${name}_face`, this.ch.face, scene, this.skeleton, index, mat);
    this.mesh.parent = flip;
    this.face.parent = flip;
    const byName = new Map(this.skeleton.bones.map((b) => [b.name, b]));
    this.bones = Array.from({ length: BONE_COUNT }, (_, i) => byName.get(SLOT_NAMES[i]!)!);
    this.scale = this.ch.rig.dims.hipsY / 0.92;
    this.ch.play("idle", { fade: 0 });
    this.sync(0);
  }

  /** Run the kit's mixer and face, then copy bone poses and face weights across. */
  sync(dt: number): void {
    this.ch.update(dt);
    // Turn the neck and head on top of whatever the clip did, then put the clip's pose back.
    const turn = Math.abs(this.look) > 0.01;
    if (turn) {
      this.neckHead ??= ["Neck", "Head"].map((n) => this.pairs.find(([kb]) => kb.name === n)![0]);
      this.neckHead.forEach((b, i) => {
        const q = b.quaternion;
        this.saved[i] = [q.x, q.y, q.z, q.w];
        // The body is mirrored on x, so the kit's +y turn is the game's -yaw.
        b.rotateY(-this.look * (i ? 0.6 : 0.4));
      });
    }
    for (const [kb, bb] of this.pairs) {
      kb.updateMatrix();
      Matrix.FromArrayToRef(kb.matrix.elements, 0, this.tmp);
      bb.getLocalMatrix().copyFrom(this.tmp);
      (bb as unknown as Internal)._markAsDirtyAndDecompose();
    }
    if (turn) this.neckHead!.forEach((b, i) => { const [x, y, z, w] = this.saved[i]!; b.quaternion.set(x, y, z, w); });
    const inf = this.ch.face.morphTargetInfluences, mgr = this.face.morphTargetManager;
    if (inf && mgr) for (let i = 0; i < mgr.numTargets; i++) mgr.getTarget(i).influence = inf[i] ?? 0;
  }

  dispose(): void {
    this.ch.dispose();
    this.root.dispose(false, false);
    this.skeleton.dispose();
  }
}
