import * as THREE from 'three';

export type Archetype = 'male' | 'female' | 'uncle' | 'aunty' | 'boy' | 'girl';
export const ARCHETYPES: Archetype[] = ['male', 'female', 'uncle', 'aunty', 'boy', 'girl'];

export interface BodySpec {
  id: Archetype;
  label: string;
  sex: 'm' | 'f';
  age: 'adult' | 'elder' | 'kid';
  s: number;            // overall scale (1 = 1.75 m man)
  legK: number;         // leg length multiplier
  torsoK: number;       // torso length multiplier
  armK: number;         // arm length multiplier
  headK: number;        // head size multiplier
  shoulder: number;     // shoulder joint half width (m @ s=1)
  chest: [number, number];  // rx, rz
  waist: [number, number];
  hip: [number, number];
  limb: number;         // limb thickness multiplier
  skin: string;
  hair: string;
  tempo: number;        // animation speed multiplier (elders are slower)
  stride: number;       // stride amplitude multiplier
  hunch: number;        // forward lean (rad) applied in all clips
  glasses?: boolean;
}

export const BODIES: Record<Archetype, BodySpec> = {
  male:   { id: 'male',   label: 'Man (Jatt / Singh)', sex: 'm', age: 'adult', s: 1.00, legK: 1.0,  torsoK: 1.0,  armK: 1.0,  headK: 1.1,  shoulder: 0.205, chest: [0.185, 0.115], waist: [0.155, 0.10], hip: [0.165, 0.105], limb: 1.0,  skin: '#c68a5a', hair: '#15110e', tempo: 1.0,  stride: 1.0,  hunch: 0 },
  female: { id: 'female', label: 'Woman (Kaur)',       sex: 'f', age: 'adult', s: 0.93, legK: 1.0,  torsoK: 0.98, armK: 0.97, headK: 1.1, shoulder: 0.17,  chest: [0.15, 0.105],  waist: [0.115, 0.088], hip: [0.17, 0.11],   limb: 0.85, skin: '#d29a6a', hair: '#120d0b', tempo: 1.0,  stride: 0.95, hunch: 0 },
  uncle:  { id: 'uncle',  label: 'Uncle ji',           sex: 'm', age: 'elder', s: 0.96, legK: 0.97, torsoK: 1.0,  armK: 1.0,  headK: 1.1,  shoulder: 0.2,   chest: [0.19, 0.13],   waist: [0.18, 0.125],  hip: [0.17, 0.115],  limb: 1.0,  skin: '#b87d52', hair: '#e9e6df', tempo: 0.72, stride: 0.7,  hunch: 0.16, glasses: true },
  aunty:  { id: 'aunty',  label: 'Aunty ji',           sex: 'f', age: 'elder', s: 0.89, legK: 0.97, torsoK: 0.98, armK: 0.95, headK: 1.1, shoulder: 0.17,  chest: [0.16, 0.12],   waist: [0.15, 0.115],  hip: [0.18, 0.12],   limb: 0.9,  skin: '#c48c5e', hair: '#bdb8b0', tempo: 0.75, stride: 0.72, hunch: 0.12, glasses: true },
  boy:    { id: 'boy',    label: 'Boy (Munda)',        sex: 'm', age: 'kid',   s: 0.66, legK: 0.9,  torsoK: 0.95, armK: 0.92, headK: 1.36,  shoulder: 0.17,  chest: [0.15, 0.105],  waist: [0.14, 0.1],    hip: [0.145, 0.1],   limb: 0.95, skin: '#cf9566', hair: '#15110e', tempo: 1.18, stride: 0.85, hunch: 0 },
  girl:   { id: 'girl',   label: 'Girl (Kudi)',        sex: 'f', age: 'kid',   s: 0.63, legK: 0.9,  torsoK: 0.95, armK: 0.92, headK: 1.38, shoulder: 0.16,  chest: [0.14, 0.1],    waist: [0.13, 0.095],  hip: [0.14, 0.1],    limb: 0.9,  skin: '#d9a273', hair: '#120d0b', tempo: 1.18, stride: 0.85, hunch: 0 },
};

/** Body tweaks on top of an archetype (game addition), e.g. the hero's stocky build. */
export type BuildTweak = Partial<Pick<BodySpec, 'legK' | 'torsoK' | 'armK' | 'headK' | 'shoulder' | 'chest' | 'waist' | 'hip' | 'limb'>>;
/** Broad chest and shoulders, a bit of a belly, thicker limbs and slightly shorter legs. */
export const STOCKY: BuildTweak = { legK: 0.95, armK: 0.98, headK: 1.13, shoulder: 0.225, chest: [0.21, 0.135], waist: [0.19, 0.13], hip: [0.178, 0.112], limb: 1.14 };

export const SIDES = ['L', 'R'] as const;
export type Side = 'L' | 'R';

export const BONE_NAMES: string[] = [
  'Hips', 'Spine', 'Chest', 'Neck', 'Head',
  ...SIDES.flatMap((s) => [`Shoulder_${s}`, `UpperArm_${s}`, `LowerArm_${s}`, `Hand_${s}`, `Fingers_${s}`, `Thumb_${s}`]),
  ...SIDES.flatMap((s) => [`UpperLeg_${s}`, `LowerLeg_${s}`, `Foot_${s}`, `Toes_${s}`]),
  'Braid_1', 'Braid_2', 'Braid_3', 'Cape_1', 'Cape_2', 'Cape_3',
];

export interface Rig {
  body: BodySpec;
  root: THREE.Bone;
  bones: THREE.Bone[];
  byName: Record<string, THREE.Bone>;
  index: Record<string, number>;
  tail: Record<string, THREE.Vector3>;      // child offset in bone local space
  rest: Record<string, THREE.Quaternion>;   // rest quaternion per bone
  skeleton: THREE.Skeleton;
  world: Record<string, { a: THREE.Vector3; b: THREE.Vector3 }>; // bind pose segments (mesh space)
  dims: {
    hipsY: number; headCenter: THREE.Vector3; headR: THREE.Vector3; neckY: number; chestY: number; spineY: number;
    ankleY: number; kneeY: number; hipX: number; shoulderY: number; shoulderX: number; s: number;
  };
}

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

export function buildRig(body: BodySpec): Rig {
  const s = body.s;
  const byName: Record<string, THREE.Bone> = {};
  const tail: Record<string, THREE.Vector3> = {};
  const rest: Record<string, THREE.Quaternion> = {};
  const bones: THREE.Bone[] = [];

  const add = (name: string, parent: string | null, pos: THREE.Vector3, tl: THREE.Vector3, restEuler?: [number, number, number]) => {
    const b = new THREE.Bone();
    b.name = name;
    b.position.copy(pos);
    if (restEuler) b.quaternion.setFromEuler(new THREE.Euler(restEuler[0], restEuler[1], restEuler[2], 'XYZ'));
    rest[name] = b.quaternion.clone();
    tail[name] = tl.clone();
    byName[name] = b;
    bones.push(b);
    if (parent) byName[parent].add(b);
  };

  const thigh = 0.43 * body.legK * s, shin = 0.42 * body.legK * s, ankle = 0.085 * s;
  const hipDrop = 0.03 * s;
  const hipsY = thigh + shin + ankle + hipDrop;
  const spineO = 0.10 * body.torsoK * s, chestO = 0.20 * body.torsoK * s, neckO = 0.23 * body.torsoK * s, headO = 0.06 * s;
  const hipX = body.hip[0] * 0.56;

  add('Hips', null, V(0, hipsY, 0), V(0, spineO, 0));
  add('Spine', 'Hips', V(0, spineO, 0), V(0, chestO, 0));
  add('Chest', 'Spine', V(0, chestO, 0), V(0, neckO, 0));
  add('Neck', 'Chest', V(0, neckO, 0), V(0, headO, 0));
  const headR = V(0.095 * body.headK * s * (body.sex === 'f' ? 0.96 : 1), 0.115 * body.headK * s, 0.105 * body.headK * s);
  add('Head', 'Neck', V(0, headO, 0), V(0, headR.y * 1.9, 0));

  const upA = 0.29 * body.armK * s, loA = 0.26 * body.armK * s, hand = 0.085 * s;
  const shY = 0.18 * body.torsoK * s;
  for (const sd of SIDES) {
    const m = sd === 'L' ? 1 : -1;
    add(`Shoulder_${sd}`, 'Chest', V(m * 0.03 * s, shY, 0), V(m * (body.shoulder * s - 0.03 * s), 0, 0));
    add(`UpperArm_${sd}`, `Shoulder_${sd}`, V(m * (body.shoulder * s - 0.03 * s), 0, 0), V(0, -upA, 0), [0, 0, m * 0.42]);
    add(`LowerArm_${sd}`, `UpperArm_${sd}`, V(0, -upA, 0), V(0, -loA, 0), [0, 0, m * 0.06]);
    add(`Hand_${sd}`, `LowerArm_${sd}`, V(0, -loA, 0), V(0, -hand, 0));
    add(`Fingers_${sd}`, `Hand_${sd}`, V(0, -hand, 0), V(0, -0.075 * s, 0));
    add(`Thumb_${sd}`, `Hand_${sd}`, V(-m * 0.022 * s, -0.025 * s, 0.026 * s), V(0, -0.045 * s, 0.018 * s));
    // legs
    add(`UpperLeg_${sd}`, 'Hips', V(m * hipX, -hipDrop, 0), V(0, -thigh, 0));
    add(`LowerLeg_${sd}`, `UpperLeg_${sd}`, V(0, -thigh, 0), V(0, -shin, 0));
    add(`Foot_${sd}`, `LowerLeg_${sd}`, V(0, -shin, 0), V(0, -0.05 * s, 0.12 * s));
    add(`Toes_${sd}`, `Foot_${sd}`, V(0, -0.05 * s, 0.12 * s), V(0, 0, 0.06 * s));
  }
  // secondary chains: braid (paranda) and cloth tail (dupatta / shawl / turban tail)
  add('Braid_1', 'Head', V(0, headR.y * 0.75, -headR.z * 0.92), V(0, -0.13 * s, -0.012 * s));
  add('Braid_2', 'Braid_1', V(0, -0.13 * s, -0.012 * s), V(0, -0.13 * s, -0.008 * s));
  add('Braid_3', 'Braid_2', V(0, -0.13 * s, -0.008 * s), V(0, -0.12 * s, 0));
  add('Cape_1', 'Chest', V(0, 0.13 * body.torsoK * s, -body.chest[1] * s * 0.95), V(0, -0.18 * s, -0.01 * s));
  add('Cape_2', 'Cape_1', V(0, -0.18 * s, -0.01 * s), V(0, -0.18 * s, -0.01 * s));
  add('Cape_3', 'Cape_2', V(0, -0.18 * s, -0.01 * s), V(0, -0.18 * s, 0));

  const root = byName['Hips'];
  root.updateMatrixWorld(true);
  const skeleton = new THREE.Skeleton(bones);
  const index: Record<string, number> = {};
  bones.forEach((b, i) => (index[b.name] = i));
  const world: Rig['world'] = {};
  for (const b of bones) {
    const a = new THREE.Vector3().setFromMatrixPosition(b.matrixWorld);
    const bb = tail[b.name].clone().applyMatrix4(b.matrixWorld);
    world[b.name] = { a, b: bb };
  }
  const headW = world['Head'].a;
  const headCenter = headW.clone().add(V(0, headR.y * 0.92, 0.004 * s));
  const dims = {
    hipsY, headCenter, headR, neckY: world['Neck'].a.y, chestY: world['Chest'].a.y, spineY: world['Spine'].a.y,
    ankleY: ankle, kneeY: world['LowerLeg_L'].a.y, hipX, shoulderY: world['Shoulder_L'].a.y, shoulderX: body.shoulder * s, s,
  };
  return { body, root, bones, byName, index, tail, rest, skeleton, world, dims };
}
