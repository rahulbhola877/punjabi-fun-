import { Color3, Mesh, PBRMaterial, Scene, Texture, TransformNode, VertexData } from "../babylon";
import data from "./assets/spaceAssets.json";

/** Original Tunyard assets, static geometry with their baked material maps.
 * Wind and other Three.js animation do not survive the static bake. */
export type SpaceAssetKind = keyof typeof data.assets;
type BakedGroup = (typeof data.assets)[SpaceAssetKind][number]["groups"][number];

interface SceneAssets {
  templates: Map<SpaceAssetKind, TransformNode>;
  materials: Map<string, PBRMaterial>;
  textures: Map<number, Texture>;
}
const cache = new WeakMap<Scene, SceneAssets>();
function floats(encoded: string): Float32Array {
  const binary = atob(encoded), bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Float32Array(bytes.buffer);
}
function materialKey(g: BakedGroup): string {
  return [g.texture, g.normalTexture, g.alphaTest, g.opacity, g.doubleSided, g.roughness, g.metalness].join(":");
}
function sceneAssets(scene: Scene): SceneAssets {
  let result = cache.get(scene);
  if (!result) { result = { templates: new Map(), materials: new Map(), textures: new Map() }; cache.set(scene, result); }
  return result;
}
function texture(scene: Scene, assets: SceneAssets, id: number): Texture {
  let t = assets.textures.get(id);
  if (!t) { t = new Texture(`${import.meta.env.BASE_URL}tunyard/space/${id}.png`, scene); assets.textures.set(id, t); }
  return t;
}
function getMaterial(scene: Scene, assets: SceneAssets, group: BakedGroup): PBRMaterial {
  const key = materialKey(group);
  let mat = assets.materials.get(key);
  if (!mat) {
    mat = new PBRMaterial(`space-${key}`, scene);
    mat.albedoColor = Color3.White();
    mat.roughness = group.roughness;
    mat.metallic = group.metalness;
    mat.alpha = group.opacity;
    mat.backFaceCulling = !group.doubleSided;
    if (group.texture !== null) {
      const t = texture(scene, assets, group.texture);
      if (group.alphaTest > 0) { t.hasAlpha = true; mat.useAlphaFromAlbedoTexture = true; mat.transparencyMode = PBRMaterial.PBRMATERIAL_ALPHATEST; mat.alphaCutOff = group.alphaTest; }
      mat.albedoTexture = t;
    }
    if (group.normalTexture !== null) {
      const normal = texture(scene, assets, group.normalTexture);
      normal.gammaSpace = false;
      mat.bumpTexture = normal;
    }
    assets.materials.set(key, mat);
  }
  return mat;
}

/**
 * Place a cached original Tunyard asset in a Babylon scene. Instances share
 * their source geometry and materials; the scene owns every GPU resource.
 * The returned root can be disposed independently. Source positions are
 * converted from Three's right-handed frame by mirroring X.
 */
export function addSpaceAsset(scene: Scene, kind: SpaceAssetKind, x: number, y: number, z: number, scale = 1, yaw = 0): TransformNode {
  const assets = sceneAssets(scene);
  let template = assets.templates.get(kind);
  if (!template) {
    template = new TransformNode(`space-${kind}-template`, scene);
    const groups = new Map<string, { group: BakedGroup; part: string; positions: number[]; normals: number[]; uvs: number[]; colors: number[]; indices: number[] }>();
    for (const mesh of data.assets[kind]) {
      const p = floats(mesh.position), n = floats(mesh.normal), uv = floats(mesh.uv);
      // The rover wheels need their own hubs so they roll with the distance
      // travelled. Other assets remain merged by material as before.
      const wheel = kind === "rover" ? /^lpv-rover-wheel-([fmr])([rl])-mesh$/.exec(mesh.name) : null;
      const part = wheel ? `wheel-${wheel[1]}${wheel[2]}` : "body";
      const pivotX = wheel ? (wheel[2] === "r" ? -0.95 : 0.95) : 0;
      const pivotY = wheel ? 0.31 : 0;
      const pivotZ = wheel ? ({ f: 1.05, m: -0.15, r: -1.1 } as Record<string, number>)[wheel[1]!]! : 0;
      for (const group of mesh.groups) {
        const key = `${part}:${materialKey(group)}`;
        let target = groups.get(key);
        if (!target) { target = { group, part, positions: [], normals: [], uvs: [], colors: [], indices: [] }; groups.set(key, target); }
        const c = Color3.FromHexString(`#${group.color}`);
        for (let i = group.start; i < group.start + group.count; i++) {
          target.indices.push(target.positions.length / 3);
          target.positions.push(-p[i * 3]! - pivotX, p[i * 3 + 1]! - pivotY, p[i * 3 + 2]! - pivotZ);
          target.normals.push(-n[i * 3]!, n[i * 3 + 1]!, n[i * 3 + 2]!);
          target.uvs.push(uv[i * 2]!, uv[i * 2 + 1]!);
          target.colors.push(c.r, c.g, c.b, 1);
        }
      }
    }
    const pivots = new Map<string, TransformNode>();
    for (const [key, source] of groups) {
      let parent = template;
      if (source.part !== "body") {
        let pivot = pivots.get(source.part);
        if (!pivot) {
          pivot = new TransformNode(source.part, scene); pivot.parent = template;
          const tag = source.part.slice(-2);
          pivot.position.set(tag[1] === "r" ? -0.95 : 0.95, 0.31, ({ f: 1.05, m: -0.15, r: -1.1 } as Record<string, number>)[tag[0]!]!);
          pivots.set(source.part, pivot);
        }
        parent = pivot;
      }
      const mesh = new Mesh(`space-${kind}-${key}`, scene), v = new VertexData();
      v.positions = source.positions; v.normals = source.normals; v.uvs = source.uvs; v.colors = source.colors; v.indices = source.indices;
      v.applyToMesh(mesh); mesh.parent = parent; mesh.material = getMaterial(scene, assets, source.group); mesh.isPickable = false;
    }
    template.setEnabled(false);
    assets.templates.set(kind, template);
  }
  const instance = template.clone(`space-${kind}`, null, false)!;
  instance.setEnabled(true);
  instance.position.set(x, y, z);
  instance.scaling.setAll(scale);
  instance.rotation.y = yaw;
  return instance;
}
