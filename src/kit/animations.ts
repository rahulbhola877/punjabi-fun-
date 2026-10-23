// @ts-nocheck -- vendored from the punjab-characters kit (unused locals only); keep in sync with vendor/.
import * as THREE from 'three';
import type { Rig } from './rig';
import { EXPRESSIONS, FACE_MORPHS, GAIN } from './face';

const { sin, cos, PI, abs, max, min } = Math;
const TAU = PI * 2;
const sm = (x: number) => { const t = Math.max(0, Math.min(1, x)); return t * t * (3 - 2 * t); };
/** 0 -> 1 between a..b, hold to c, back to 0 by d */
const env = (t: number, a: number, b: number, c: number, d: number) => sm((t - a) / (b - a)) * (1 - sm((t - c) / (d - c)));
const ramp = (t: number, a: number, b: number) => sm((t - a) / (b - a));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

export type Vec3Tuple = [number, number, number];

export class Pose {
  r: Record<string, Vec3Tuple> = {};
  q: Record<string, THREE.Quaternion> = {};
  hips: Vec3Tuple = [0, 0, 0]; // metres @ s = 1 (scaled by s when baked)
  add(name: string, x = 0, y = 0, z = 0) {
    const c = this.r[name] ?? (this.r[name] = [0, 0, 0]);
    c[0] += x; c[1] += y; c[2] += z;
    return this;
  }
  /** Left gets (x,y,z). Right gets the mirror (x,-y,-z) unless given explicitly. */
  lr(base: string, x = 0, y = 0, z = 0, rx?: number, ry?: number, rz?: number) {
    this.add(`${base}_L`, x, y, z);
    this.add(`${base}_R`, rx ?? x, ry ?? -y, rz ?? -z);
    return this;
  }
  side(base: string, side: 'L' | 'R', x = 0, y = 0, z = 0) {
    // specify in "left-handed" terms, mirrored automatically for the right
    if (side === 'L') this.add(`${base}_L`, x, y, z); else this.add(`${base}_R`, x, -y, -z);
    return this;
  }
}

export interface ClipDef {
  name: string;
  label: string;
  duration: number;       // seconds (at tempo 1)
  loop: boolean;
  category: 'locomotion' | 'greeting' | 'combat' | 'daily' | 'emote' | 'dance';
  expr: string;           // face expression while playing
  talk?: number;
  chew?: number;
  /** extra props equipped while this clip plays */
  props?: { R?: string; L?: string };
  grounded?: boolean;     // auto-keep the lowest foot on the floor
  /** skip the arm-through-body guard (whole-arm turnover strokes like swimming) */
  noGuard?: boolean;
  sample: (p: number, c: Ctx) => Pose;
}

export interface Ctx {
  rig: Rig; s: number; thigh: number; shin: number; upA: number; loA: number;
  stride: number; hunch: number; tempo: number; kid: boolean; elder: boolean; fem: boolean;
  chestWorld: THREE.Vector3;
  shoulder: { L: THREE.Vector3; R: THREE.Vector3 };
  mouth: THREE.Vector3; headTop: THREE.Vector3; eye: THREE.Vector3;
}

export function makeCtx(rig: Rig): Ctx {
  const s = rig.dims.s, b = rig.body;
  const chestWorld = rig.world['Chest'].a.clone();
  const sh = (m: number) => V(m * b.shoulder * s, 0.18 * b.torsoK * s, 0);
  const hc = rig.dims.headCenter, hr = rig.dims.headR;
  const loc = (w: THREE.Vector3) => w.clone().sub(chestWorld);
  return {
    rig, s,
    thigh: rig.tail['UpperLeg_L'].length(), shin: rig.tail['LowerLeg_L'].length(),
    upA: rig.tail['UpperArm_L'].length(), loA: rig.tail['LowerArm_L'].length(),
    stride: b.stride, hunch: b.hunch, tempo: b.tempo, kid: b.age === 'kid', elder: b.age === 'elder', fem: b.sex === 'f',
    chestWorld,
    shoulder: { L: sh(1), R: sh(-1) },
    mouth: loc(V(hc.x, hc.y - hr.y * 0.56, hc.z + hr.z * 0.96)),
    headTop: loc(V(hc.x, hc.y + hr.y * 0.9, hc.z)),
    eye: loc(V(hc.x, hc.y + hr.y * 0.05, hc.z + hr.z)),
  };
}

/** Two-bone IK for an arm. Target is the wrist position in Chest-local space (metres, already scaled). */
export function armIK(p: Pose, c: Ctx, side: 'L' | 'R', target: THREE.Vector3, hint: THREE.Vector3) {
  const P0 = c.shoulder[side];
  const a = c.upA, b = c.loA;
  const dv = target.clone().sub(P0);
  let d = dv.length();
  const dir = dv.clone().divideScalar(d || 1);
  d = Math.max(abs(a - b) + 1e-3, Math.min(a + b - 2e-3, d));
  const T = P0.clone().addScaledVector(dir, d);
  const cosA = (a * a + d * d - b * b) / (2 * a * d);
  const A = Math.acos(Math.max(-1, Math.min(1, cosA)));
  let h = hint.clone().addScaledVector(dir, -hint.dot(dir));
  if (h.lengthSq() < 1e-6) h.set(0, -1, 0).addScaledVector(dir, dir.y);
  h.normalize();
  const E = P0.clone().addScaledVector(dir, a * cos(A)).addScaledVector(h, a * sin(A));
  const u = E.clone().sub(P0).normalize();
  const f = T.clone().sub(E).normalize();
  const phi = Math.acos(Math.max(-1, Math.min(1, u.dot(f))));
  const zl = f.clone().addScaledVector(u, -f.dot(u));
  if (zl.lengthSq() < 1e-6) zl.copy(h).negate();
  zl.normalize();
  const yl = u.clone().negate();
  const xl = new THREE.Vector3().crossVectors(yl, zl).normalize();
  const m4 = new THREE.Matrix4().makeBasis(xl, yl, zl);
  p.q[`UpperArm_${side}`] = new THREE.Quaternion().setFromRotationMatrix(m4);
  p.q[`LowerArm_${side}`] = new THREE.Quaternion().setFromAxisAngle(V(1, 0, 0), -phi);
}

/** Convenience: IK with target given relative to the shoulder in "mirrored" coordinates. */
const ik = (p: Pose, c: Ctx, side: 'L' | 'R', x: number, y: number, z: number, hx = 0.6, hy = -1, hz = -0.2) => {
  const m = side === 'L' ? 1 : -1;
  const sh = c.shoulder[side];
  armIK(p, c, side, V(sh.x - m * x * c.s, sh.y + y * c.s, sh.z + z * c.s), V(m * hx, hy, hz));
};
/** target in chest-local coordinates (x mirrored automatically: +x = away from the body centreline on that side) */
const ikc = (p: Pose, c: Ctx, side: 'L' | 'R', x: number, y: number, z: number, hx = 0.6, hy = -1, hz = -0.2) => {
  const m = side === 'L' ? 1 : -1;
  armIK(p, c, side, V(m * x * c.s, y * c.s, z * c.s), V(m * hx, hy, hz));
};

// ---------------------------------------------------------------- shared helpers
const relaxArms = (p: Pose, k = 1) => {
  p.lr('UpperArm', 0.04 * k, 0, -0.3 * k);
  p.lr('LowerArm', -0.16 * k, 0, -0.02);
  p.lr('Fingers', 0, 0, -0.38);
  p.lr('Thumb', 0, 0, -0.15);
};
const fist = (p: Pose, side: 'L' | 'R', k = 1) => {
  p.side('Fingers', side, 0, 0, -1.5 * k);
  p.side('Thumb', side, 0.2 * k, 0, -0.8 * k);
};
const flat = (p: Pose, side: 'L' | 'R') => {
  p.side('Fingers', side, 0, 0, 0.05);
  p.side('Thumb', side, 0, 0, 0.1);
};


type A3 = [number, number, number];
const relaxCache = new WeakMap<Ctx, Pose>();
const relaxPose = (c: Ctx) => { let r = relaxCache.get(c); if (!r) { r = new Pose(); relaxArms(r); relaxCache.set(c, r); } return r; };

/**
 * Place a hand: wrist solved with 2-bone IK, hand orientation set absolutely.
 * x is "mirrored": +x = away from the body centre line on that side.
 * tip = fingertip target (chest space, metres @ s=1), dir = finger direction, nrm = palm normal.
 */
function H(p: Pose, c: Ctx, side: 'L' | 'R', tip: A3, dir: A3, nrm: A3 = [-1, 0, 0], hint: A3 = [0.6, -1, -0.2], reach = 0.15, blend = 1) {
  const m = side === 'L' ? 1 : -1;
  const d = V(m * dir[0], dir[1], dir[2]).normalize();
  // wrist in world-sign chest coordinates (s = 1)
  const w: A3 = [m * tip[0] - d.x * reach, tip[1] - d.y * reach, tip[2] - d.z * reach];
  Hw(p, c, side, w, dir, nrm, hint, blend, true);
}
/** Same as H but the wrist target is given directly. raw=true: x already in world sign. */
function Hw(p: Pose, c: Ctx, side: 'L' | 'R', wrist: A3, dir: A3, nrm: A3 = [-1, 0, 0], hint: A3 = [0.6, -1, -0.2], blend = 1, raw = false) {
  const m = side === 'L' ? 1 : -1, s = c.s;
  const w = raw ? V(wrist[0] * s, wrist[1] * s, wrist[2] * s) : V(m * wrist[0] * s, wrist[1] * s, wrist[2] * s);
  armIK(p, c, side, w, V(m * hint[0], hint[1], hint[2]));
  const qU = p.q[`UpperArm_${side}`], qL = p.q[`LowerArm_${side}`];
  const d = V(m * dir[0], dir[1], dir[2]).normalize();
  const n = V(m * nrm[0], nrm[1], nrm[2]);
  n.addScaledVector(d, -n.dot(d));
  if (n.lengthSq() < 1e-6) n.set(-m, 0, 0).addScaledVector(d, d.x * m);
  n.normalize();
  const yl = d.clone().negate();
  const xl = n.clone().multiplyScalar(-m);
  const zl = new THREE.Vector3().crossVectors(xl, yl).normalize();
  const qAbs = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(xl, yl, zl));
  p.q[`Hand_${side}`] = qU.clone().multiply(qL).invert().multiply(qAbs);
  if (blend < 1) {
    const rp = relaxPose(c);
    for (const b of ['UpperArm', 'LowerArm', 'Hand']) {
      const nm = `${b}_${side}`;
      p.q[nm] = boneQuat(nm, rp, c.rig).slerp(p.q[nm], blend);
    }
  }
}

const legIK = (p: Pose, side: 'L' | 'R', thigh: number, knee: number, foot = 0, abd = 0, twist = 0) => {
  p.side('UpperLeg', side, thigh, twist, abd);
  p.side('LowerLeg', side, knee);
  p.side('Foot', side, foot);
};

/**
 * Running arms (game addition): each wrist follows an arc from beside the hip
 * (arm back) to in front of the lower chest (arm forward), elbows bent and
 * pointing back and out, hands loosely closed. fwd: -1 = back .. 1 = forward.
 * back / front: [x, y, z] wrist targets in chest space (x away from the body).
 */
const runArm = (p: Pose, c: Ctx, side: 'L' | 'R', fwd: number, back: A3, front: A3) => {
  const u = (fwd + 1) / 2, lift = 0.03 * (1 - fwd * fwd);
  const wrist: A3 = [lerp(back[0], front[0], u), lerp(back[1], front[1], u) - lift, lerp(back[2], front[2], u)];
  // Knuckles lead forward on the way up, hang down beside the hip at the back; palm toward the body.
  Hw(p, c, side, wrist, [lerp(0.05, -0.35, u), lerp(-1, 0.15, u), lerp(-0.25, 1, u)], [-1, 0, 0], [0.45, -0.25, -1]);
  p.side('Fingers', side, 0, 0, -1.3); p.side('Thumb', side, 0.25, 0, -0.7);
};

function boneQuat(name: string, pose: Pose, rig: Rig): THREE.Quaternion {
  const ov = pose.q[name];
  if (ov) return ov;
  const d = pose.r[name];
  if (!d) return rig.rest[name].clone();
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(d[0], d[1], d[2], 'XZY'));
  return q.multiply(rig.rest[name]);
}

/** Lift/lower the hips so the lowest foot sits on the floor. Returns dy (<= 0). */
function groundOffset(pose: Pose, c: Ctx): number {
  const rig = c.rig;
  let lowest = Infinity;
  const hq = boneQuat('Hips', pose, rig);
  for (const sd of ['L', 'R']) {
    const qu = boneQuat(`UpperLeg_${sd}`, pose, rig);
    const ql = boneQuat(`LowerLeg_${sd}`, pose, rig);
    const v1 = V(0, -c.thigh, 0).applyQuaternion(qu);
    const v2 = V(0, -c.shin, 0).applyQuaternion(qu.clone().multiply(ql));
    const hipOff = rig.tail['Hips'] && rig.byName[`UpperLeg_${sd}`].position.clone().applyQuaternion(hq);
    const y = hipOff.y + v1.y + v2.y;
    // toe-down compensation is ignored (foot treated as flat)
    lowest = Math.min(lowest, y);
  }
  const rest = rig.byName['UpperLeg_L'].position.y - c.thigh - c.shin;
  return -(lowest - rest);
}

// ---------------------------------------------------------------- clips
const clips: ClipDef[] = [];
const def = (d: ClipDef) => clips.push(d);

// ---- idle
def({
  name: 'idle', label: 'Idle (breathing)', duration: 3.6, loop: true, category: 'locomotion', expr: 'neutral', grounded: true,
  sample: (t, c) => {
    const p = new Pose(); const th = t * TAU;
    relaxArms(p);
    p.add('Spine', 0.02 * sin(th), 0.03 * sin(th), 0.01 * sin(th));
    p.add('Chest', 0.03 * sin(th - 0.4), 0, 0);
    p.add('Head', 0.03 * sin(th - 0.8), 0.12 * sin(th), 0.03 * sin(th));
    p.add('Hips', 0, 0.02 * sin(th), 0.02 * sin(th));
    p.lr('UpperArm', 0.03 * sin(th - 0.5), 0, 0.01 * sin(th));
    legIK(p, 'L', 0.03, 0.06); legIK(p, 'R', -0.02, 0.05);
    p.add('Shoulder_L', 0, 0, 0.02 * sin(th)); p.add('Shoulder_R', 0, 0, -0.02 * sin(th));
    return p;
  },
});

// ---- walk
def({
  name: 'walk', label: 'Walk', duration: 1.1, loop: true, category: 'locomotion', expr: 'neutral', grounded: true,
  sample: (t, c) => {
    const p = new Pose(); const th = t * TAU; const A = 0.46 * c.stride;
    relaxArms(p, 0.8);
    const leg = (side: 'L' | 'R', ph: number) => {
      const f = sin(ph);
      const thigh = -A * f + 0.04;
      const swing = max(0, cos(ph));
      const knee = 0.1 + 0.85 * c.stride * Math.pow(swing, 1.3) * 0.9 + 0.08 * max(0, -cos(ph + 0.4));
      const foot = -(thigh + knee) * 0.9 + 0.16 * sin(ph - 0.7) * c.stride;
      legIK(p, side, thigh, knee, foot, side === 'L' ? 0.03 : -0.03);
      p.side('Toes', side, 0.25 * max(0, -sin(ph - 0.3)) * c.stride);
    };
    leg('L', th); leg('R', th + PI);
    // Arms swing from the shoulder opposite to the legs, a little more back than
    // forward; the elbow bends as the arm comes forward (lagging the shoulder a
    // touch) and the hands hang loose, fingers softly curled toward the thigh.
    const B = 0.3 * c.stride;
    const armL = sin(th), armR = -sin(th);
    p.lr('UpperArm', B * armL + 0.06, 0, 0.03, B * armR + 0.06, 0, -0.03);
    p.add('LowerArm_L', -0.14 - 0.18 * max(0, -sin(th - 0.35)), 0, 0); p.add('LowerArm_R', -0.14 - 0.18 * max(0, sin(th - 0.35)), 0, 0);
    p.lr('Hand', 0.12 + 0.08 * sin(th - 0.5), 0, 0.06, 0.12 - 0.08 * sin(th - 0.5), 0, -0.06);
    p.lr('Fingers', 0, 0, -0.45); p.lr('Thumb', 0.1, 0, -0.22);
    p.add('Spine', 0.03, 0.16 * sin(th) * c.stride, 0.02 * sin(th));
    p.add('Chest', 0.02, 0.1 * sin(th) * c.stride, 0);
    p.add('Head', 0, -0.18 * sin(th) * c.stride, -0.02 * sin(th));
    p.add('Hips', 0, -0.2 * sin(th) * c.stride, 0.05 * sin(th));
    p.hips[1] += 0.012 * cos(2 * th); p.hips[0] += 0.015 * sin(th);
    p.add('Cape_1', 0.06 * sin(th - 0.5), 0, 0); p.add('Cape_2', 0.1 * sin(th - 1.0), 0, 0); p.add('Cape_3', 0.12 * sin(th - 1.5), 0, 0);
    p.add('Braid_1', 0.06 * sin(2 * th - 0.4), 0, 0.12 * sin(th)); p.add('Braid_2', 0.1 * sin(2 * th - 0.9), 0, 0.15 * sin(th - 0.5)); p.add('Braid_3', 0.12 * sin(2 * th - 1.4), 0, 0.15 * sin(th - 1.0));
    return p;
  },
});

// ---- run
def({
  name: 'run', label: 'Run', duration: 0.66, loop: true, category: 'locomotion', expr: 'focus', grounded: true,
  sample: (t, c) => {
    const p = new Pose(); const th = t * TAU; const A = 0.84 * min(1.05, c.stride + 0.1);
    const leg = (side: 'L' | 'R', ph: number) => {
      const thigh = -A * sin(ph) + 0.1;
      const swing = max(0, cos(ph));
      const knee = 0.25 + 1.45 * Math.pow(swing, 1.1);
      const foot = -(thigh + knee) * 0.6 + 0.3 * sin(ph - 0.6);
      legIK(p, side, thigh, knee, foot, side === 'L' ? 0.04 : -0.04);
    };
    leg('L', th); leg('R', th + PI);
    runArm(p, c, 'L', -sin(th - 0.25), [0.2, -0.16, -0.24], [0.1, 0.06, 0.3]);
    runArm(p, c, 'R', sin(th - 0.25), [0.2, -0.16, -0.24], [0.1, 0.06, 0.3]);
    p.add('Spine', 0.28, 0.3 * sin(th), 0.04 * sin(th)); p.add('Chest', 0.1, 0.2 * sin(th), 0);
    p.add('Head', -0.2, -0.3 * sin(th), 0);
    p.add('Hips', 0.05, -0.3 * sin(th), 0.07 * sin(th));
    p.hips[1] += 0.035 * (1 + cos(2 * th)) * 0.5 * c.stride; p.hips[0] += 0.012 * sin(th);
    p.add('Cape_1', -0.25 + 0.1 * sin(th), 0, 0); p.add('Cape_2', -0.35 + 0.15 * sin(th - 0.8), 0, 0); p.add('Cape_3', -0.4 + 0.2 * sin(th - 1.6), 0, 0);
    p.add('Braid_1', -0.3 + 0.1 * sin(2 * th), 0, 0); p.add('Braid_2', -0.4 + 0.15 * sin(2 * th - 0.8), 0, 0); p.add('Braid_3', -0.4 + 0.2 * sin(2 * th - 1.6), 0, 0);
    return p;
  },
});

// ---- jog (game addition): the everyday "run" between a walk and a sprint.
// Shorter stride than the sprint, a light bounce, elbows bent at ~90 degrees
// swinging close to the body, hands loosely closed, a slight lean forward.
def({
  name: 'jog', label: 'Jog', duration: 0.74, loop: true, category: 'locomotion', expr: 'neutral', grounded: true,
  sample: (t, c) => {
    const p = new Pose(); const th = t * TAU; const A = 0.56 * min(1.05, c.stride + 0.1);
    const leg = (side: 'L' | 'R', ph: number) => {
      const thigh = -A * sin(ph) + 0.08;
      const swing = max(0, cos(ph));
      const knee = 0.2 + 1.05 * Math.pow(swing, 1.2);
      const foot = -(thigh + knee) * 0.7 + 0.22 * sin(ph - 0.6);
      legIK(p, side, thigh, knee, foot, side === 'L' ? 0.035 : -0.035);
    };
    leg('L', th); leg('R', th + PI);
    runArm(p, c, 'L', -sin(th - 0.25), [0.2, -0.2, -0.14], [0.13, 0.04, 0.2]);
    runArm(p, c, 'R', sin(th - 0.25), [0.2, -0.2, -0.14], [0.13, 0.04, 0.2]);
    p.add('Spine', 0.14, 0.2 * sin(th), 0.03 * sin(th)); p.add('Chest', 0.04, 0.12 * sin(th), 0);
    p.add('Head', -0.1, -0.2 * sin(th), 0);
    p.add('Hips', 0.02, -0.22 * sin(th), 0.05 * sin(th));
    p.hips[1] += 0.025 * (1 + cos(2 * th)) * 0.5 * c.stride; p.hips[0] += 0.012 * sin(th);
    p.add('Cape_1', -0.12 + 0.08 * sin(th), 0, 0); p.add('Cape_2', -0.18 + 0.12 * sin(th - 0.8), 0, 0); p.add('Cape_3', -0.2 + 0.15 * sin(th - 1.6), 0, 0);
    p.add('Braid_1', -0.15 + 0.1 * sin(2 * th), 0, 0); p.add('Braid_2', -0.2 + 0.12 * sin(2 * th - 0.8), 0, 0); p.add('Braid_3', -0.2 + 0.15 * sin(2 * th - 1.6), 0, 0);
    return p;
  },
});

// ---- swim (game addition): front crawl, body flat in the water. Arms turn
// over in opposite phase (pull under the chest, recover over the back), legs
// flutter, the body rolls with each stroke and the head turns to breathe.
def({
  name: 'swim', label: 'Swim (front crawl)', duration: 1.5, loop: true, category: 'locomotion', expr: 'focus', grounded: false, noGuard: true,
  sample: (t, c) => {
    const p = new Pose(); const th = t * TAU;
    void c;
    p.add('Hips', 1.38, 0.18 * sin(th), 0);
    p.add('Spine', -0.05, 0.12 * sin(th), 0); p.add('Chest', -0.05, 0.08 * sin(th), 0);
    // Each hand (chest space: +y = ahead of the swimmer, +z = down into the water)
    // reaches out in front, pulls back under the chest to the hip, then recovers
    // over the water with the elbow high and bent.
    const arm = (side: 'L' | 'R', a: number) => {
      a -= Math.floor(a);
      if (a < 0.5) {
        const u = a / 0.5, k = sin(PI * u);
        ikc(p, c, side, 0.15 - 0.07 * k, lerp(0.68, -0.28, sm(u)), 0.06 + 0.26 * k, 1, 0, -0.6);
      } else {
        const u = (a - 0.5) / 0.5, k = sin(PI * u);
        ikc(p, c, side, 0.2 + 0.1 * k, lerp(-0.28, 0.68, sm(u)), 0.02 - 0.16 * k, 0.6, 0, -1);
      }
    };
    arm('L', t); arm('R', t + 0.5);
    p.lr('Fingers', 0, 0, -0.15); p.lr('Thumb', 0, 0, -0.1);
    for (const [side, ph] of [['L', 0], ['R', PI]] as const) legIK(p, side, 0.18 * sin(2 * th + ph) - 0.04, 0.12 + 0.18 * max(0, sin(2 * th + ph)), 0.5, side === 'L' ? 0.04 : -0.04);
    // Head up and forward; turns to breathe on every other stroke.
    p.add('Neck', -0.35, 0, 0);
    p.add('Head', -0.45, 0.55 * max(0, sin(th - 0.4)) ** 2, 0);
    return p;
  },
});

// ---- tread water (game addition): upright, head above the surface, legs
// cycling slowly underneath and the hands sculling out to the sides.
def({
  name: 'tread', label: 'Tread water', duration: 2.0, loop: true, category: 'locomotion', expr: 'neutral', grounded: false,
  sample: (t, c) => {
    const p = new Pose(); const th = t * TAU;
    void c;
    for (const [side, ph] of [['L', 0], ['R', PI]] as const) legIK(p, side, -0.55 + 0.3 * sin(th + ph), 1.0 + 0.35 * sin(th + ph + 0.8), 0.3, side === 'L' ? 0.12 : -0.12);
    // Hands out in front at chest depth, sculling in and out, palms turning with each sweep.
    for (const sd of ['L', 'R'] as const) {
      const sc = sin(2 * th + (sd === 'L' ? 0 : 0.6));
      Hw(p, c, sd, [0.3 + 0.1 * sc, -0.24, 0.24 + 0.03 * cos(2 * th)], [0.25, -0.15, 1], [-0.5 * sc, -1, 0], [0.8, -0.6, -0.4]);
    }
    p.lr('Fingers', 0, 0, -0.15); p.lr('Thumb', 0, 0, -0.1);
    p.add('Spine', 0.05 + 0.02 * sin(2 * th)); p.add('Head', -0.08, 0.2 * sin(th * 0.5), 0);
    p.hips[1] += 0.02 * sin(2 * th);
    return p;
  },
});

// ---- jump
def({
  name: 'jump', label: 'Jump', duration: 1.0, loop: false, category: 'locomotion', expr: 'happy', props: { R: 'none', L: 'none' }, grounded: false,
  sample: (t, c) => {
    const p = new Pose();
    const crouch = env(t, 0.0, 0.2, 0.2, 0.3) + env(t, 0.82, 0.9, 0.9, 1.0) * 0.8;
    const air = env(t, 0.26, 0.4, 0.62, 0.8);
    const k = crouch;
    legIK(p, 'L', -0.9 * k - 0.5 * air, 1.7 * k + 0.9 * air, 0.0, 0.05);
    legIK(p, 'R', -0.9 * k - 0.2 * air, 1.7 * k + 0.5 * air, 0.0, -0.05);
    p.add('Spine', 0.4 * k - 0.1 * air); p.add('Head', -0.2 * k);
    relaxArms(p);
    p.lr('UpperArm', 0.6 * k - 2.6 * air, 0, -0.1 * k - 0.5 * air);
    p.lr('LowerArm', -0.8 * k - 0.4 * air);
    const drop = -(0.3 * k) * c.thigh * 0.9;
    p.hips[1] = drop + 0.42 * air * (1 - 0.0) * 1.0;
    p.add('Hips', 0.15 * k);
    return p;
  },
});

// ---- talk
def({
  name: 'talk', label: 'Talk (gesturing)', duration: 4.0, loop: true, category: 'daily', expr: 'neutral', talk: 1, props: { R: 'none', L: 'none' }, grounded: true,
  sample: (t, c) => {
    const p = new Pose(); const th = t * TAU;
    relaxArms(p);
    const g1 = max(0, sin(th * 2)), g2 = max(0, sin(th * 2 + 2.1));
    for (const [sd, g] of [['R', g1], ['L', g2 * 0.8]] as ['L' | 'R', number][]) {
      p.side('UpperArm', sd, -0.5 * g, 0, 0.1 * g);
      p.side('LowerArm', sd, -1.0 * g - 0.1, 0, 0);
      p.side('Hand', sd, -0.2 * g, 0, 0);
      p.side('Fingers', sd, 0, 0, 0.0 * g - 0.38 * (1 - g));
    }
    p.add('Spine', 0.02 * sin(th * 2), 0.07 * sin(th), 0); p.add('Head', 0.06 * sin(th * 4), 0.15 * sin(th), 0.05 * sin(th * 2));
    legIK(p, 'L', 0.04, 0.06); legIK(p, 'R', -0.03, 0.05);
    return p;
  },
});

// ---- bhangra
def({
  name: 'bhangra', label: 'Bhangra dance', duration: 1.6, loop: true, category: 'dance', expr: 'laugh', props: { R: 'none', L: 'none' }, grounded: true,
  sample: (t, c) => {
    const p = new Pose(); const th = t * TAU * 2; // two beats per loop
    relaxArms(p);
    const beat = 0.5 + 0.5 * cos(th * 2);
    const alt = sin(th); // which arm is up
    // classic: one arm high overhead, the other bent at the hip; shoulders shimmy
    for (const [sd, k] of [['L', alt], ['R', -alt]] as ['L' | 'R', number][]) {
      const up = sm(0.5 + 0.5 * k);
      ikc(p, c, sd, lerp(0.14, 0.08, up), lerp(-0.12, 0.5, up), lerp(0.06, 0.1, up), 0.6, lerp(-1, 0.1, up), lerp(-0.3, -0.3, up));
      p.side('Fingers', sd, 0, 0, lerp(-0.8, 0.0, up));
      p.side('Hand', sd, 0, lerp(0, 0.6, up) * sin(th * 4), 0);
    }
    const hop = 0.5 + 0.5 * cos(th * 2 + PI); // 0 low, 1 high
    const ld = sin(th);
    legIK(p, 'L', -0.45 * max(0, ld) - 0.1, 0.55 * max(0, ld) + 0.35 * (1 - hop), 0, 0.15);
    legIK(p, 'R', -0.45 * max(0, -ld) - 0.1, 0.55 * max(0, -ld) + 0.35 * (1 - hop), 0, -0.15);
    p.add('Spine', 0.1, 0.25 * sin(th), 0.12 * sin(th)); p.add('Chest', 0, 0.15 * sin(th + 0.4), 0.05 * sin(th * 2));
    p.add('Head', 0, -0.25 * sin(th), 0.15 * sin(th)); p.add('Hips', 0, -0.2 * sin(th), 0.08 * sin(th));
    p.add('Shoulder_L', 0, 0, 0.15 * sin(th * 4)); p.add('Shoulder_R', 0, 0, -0.15 * sin(th * 4));
    p.hips[1] = 0.05 * hop - 0.03;
    p.add('Cape_1', 0.15 * sin(th - 0.5), 0, 0.2 * sin(th)); p.add('Cape_2', 0.2 * sin(th - 1), 0, 0.25 * sin(th - 0.6)); p.add('Cape_3', 0.25 * sin(th - 1.5), 0, 0.25 * sin(th - 1.2));
    p.add('Braid_1', 0.1 * sin(th * 2), 0, 0.2 * sin(th)); p.add('Braid_2', 0.15 * sin(th * 2 - 0.8), 0, 0.3 * sin(th - 0.6)); p.add('Braid_3', 0.2 * sin(th * 2 - 1.5), 0, 0.3 * sin(th - 1.2));
    return p;
  },
});

// ---- hit reaction
def({
  name: 'hit_react', label: 'Hit reaction', duration: 1.0, loop: false, category: 'combat', expr: 'pain', props: { R: 'none', L: 'none' }, grounded: true,
  sample: (t, c) => {
    const p = new Pose();
    const hit = env(t, 0.0, 0.1, 0.18, 0.7);
    relaxArms(p);
    p.add('Spine', -0.35 * hit, 0.3 * hit); p.add('Chest', -0.15 * hit); p.add('Neck', -0.2 * hit); p.add('Head', -0.3 * hit, -0.2 * hit);
    p.lr('UpperArm', -0.7 * hit, 0, 0.5 * hit); p.lr('LowerArm', -0.5 * hit);
    legIK(p, 'L', 0.0 - 0.3 * hit, 0.3 * hit + 0.05); legIK(p, 'R', 0.2 * hit, 0.35 * hit + 0.05);
    p.hips[2] = -0.06 * hit;
    return p;
  },
});

// ---- die
def({
  name: 'die', label: 'Knocked out (fall)', duration: 2.6, loop: false, category: 'combat', expr: 'pain', props: { R: 'none', L: 'none' }, grounded: false,
  sample: (t, c) => {
    const p = new Pose();
    relaxArms(p);
    const hit = env(t, 0.0, 0.12, 0.2, 0.3);
    const stag = ramp(t, 0.1, 0.4);
    const fall = ramp(t, 0.35, 0.72);
    const hipsY = c.rig.dims.hipsY / c.s;
    p.add('Spine', -0.3 * hit * (1 - fall)); p.add('Head', -0.3 * hit * (1 - fall) + 0.2 * fall);
    const bend = 0.8 * stag * (1 - fall) + 0.3 * fall;
    legIK(p, 'L', -0.4 * stag * (1 - fall) - 0.2 * fall, bend, 0, 0.06 * fall);
    legIK(p, 'R', 0.1 * stag * (1 - fall) - 0.05 * fall, bend * 0.8, 0, -0.1 * fall);
    p.add('Hips', -1.5 * fall, 0, 0);
    p.lr('UpperArm', -0.6 * (1 - fall) + 0.2 * fall, 0, 0.6 * fall); p.lr('LowerArm', -0.4 * (1 - fall));
    p.hips[1] = (-(hipsY - 0.13) * fall) - 0.1 * stag * (1 - fall) + 0.06 * sin(fall * PI) * 0;
    p.hips[2] = -0.12 * fall - 0.04 * stag;
    p.add('Neck', 0.2 * fall);
    return p;
  },
});

// ---- sit
def({
  name: 'sit', label: 'Sit on chair', duration: 3.6, loop: true, category: 'daily', expr: 'neutral', grounded: true,
  sample: (t, c) => {
    const p = new Pose(); const th = t * TAU;
    relaxArms(p);
    legIK(p, 'L', -1.5, 1.55, -0.05, 0.06); legIK(p, 'R', -1.5, 1.55, -0.05, -0.06);
    for (const sd of ['L', 'R'] as const) ikc(p, c, sd, 0.13, -0.28, 0.2, 0.5, -1, 0);
    p.lr('Fingers', 0, 0, -0.3);
    p.add('Spine', 0.02 + 0.02 * sin(th)); p.add('Head', 0.03 * sin(th - 0.7), 0.15 * sin(th), 0);
    p.add('Hips', 0.0);
    return p;
  },
});

// ---- riding a scooter / motorbike (game addition): hips stay on the seat, hands on the bars
def({
  name: 'ride', label: 'Ride two-wheeler', duration: 2.4, loop: true, category: 'daily', expr: 'focus', grounded: false,
  sample: (t, c) => {
    const p = new Pose(); const th = t * TAU;
    legIK(p, 'L', -1.3, 1.35, -0.25, 0.14); legIK(p, 'R', -1.3, 1.35, -0.25, -0.14);
    for (const sd of ['L', 'R'] as const) ikc(p, c, sd, 0.27, -0.06, 0.55, 0.8, -1, -0.3);
    p.lr('Fingers', 0, 0, -1.2); p.lr('Thumb', 0.2, 0, -0.7);
    p.add('Spine', 0.2); p.add('Head', -0.14 + 0.02 * sin(th), 0.06 * sin(th * 0.5), 0);
    return p;
  },
});

// ---- driving a car / auto / tractor (game addition): hands on the wheel
def({
  name: 'drive', label: 'Drive (steering wheel)', duration: 3, loop: true, category: 'daily', expr: 'focus', grounded: false,
  sample: (t, c) => {
    const p = new Pose(); const th = t * TAU;
    legIK(p, 'L', -1.4, 1.05, -0.3, 0.1); legIK(p, 'R', -1.4, 1.05, -0.3, -0.1);
    for (const sd of ['L', 'R'] as const) ikc(p, c, sd, 0.17, -0.12, 0.36, 0.9, -1, -0.2);
    p.lr('Fingers', 0, 0, -1.2); p.lr('Thumb', 0.2, 0, -0.7);
    p.add('Spine', 0.04); p.add('Head', -0.05, 0.08 * sin(th * 0.5), 0);
    return p;
  },
});

// ---- sitting on a bench or a bus seat with the hips kept where they are (game addition)
def({
  name: 'seated', label: 'Seated (hips fixed)', duration: 3.6, loop: true, category: 'daily', expr: 'neutral', grounded: false,
  sample: (t, c) => {
    const p = new Pose(); const th = t * TAU;
    relaxArms(p);
    legIK(p, 'L', -1.5, 1.55, -0.05, 0.06); legIK(p, 'R', -1.5, 1.55, -0.05, -0.06);
    for (const sd of ['L', 'R'] as const) ikc(p, c, sd, 0.13, -0.28, 0.2, 0.5, -1, 0);
    p.lr('Fingers', 0, 0, -0.3);
    p.add('Spine', 0.02 + 0.02 * sin(th)); p.add('Head', 0.03 * sin(th - 0.7), 0.15 * sin(th), 0);
    return p;
  },
});

// ---- sat sri akal (namaste greeting)
def({
  name: 'sat_sri_akal', label: 'Sat Sri Akal (greeting)', duration: 3.2, loop: false, category: 'greeting', expr: 'greet', talk: 0.6, props: { R: 'none', L: 'none' }, grounded: true,
  sample: (t, c) => {
    const p = new Pose();
    const up = env(t, 0.0, 0.28, 0.8, 1.0);
    const bow = env(t, 0.2, 0.4, 0.68, 0.86);
    relaxArms(p);
    for (const sd of ['L', 'R'] as const) H(p, c, sd, [0.014, 0.25, 0.3], [0, 0.8, 0.6], [-1, 0, 0], [0.6, -1, 0.35], 0.15, up);
    p.lr('Fingers', 0, 0, lerp(-0.38, 0.02, up)); p.lr('Thumb', 0, 0, lerp(-0.15, 0.1, up));
    p.add('Spine', 0.1 * bow + 0.02); p.add('Chest', 0.04 * bow); p.add('Neck', 0.04 * bow); p.add('Head', 0.1 * bow + 0.03 * sin(t * TAU * 2) * up);
    legIK(p, 'L', 0.03, 0.05); legIK(p, 'R', -0.02, 0.05);
    return p;
  },
});

// ---- wave
def({
  name: 'wave', label: 'Wave hello', duration: 2.0, loop: true, category: 'greeting', expr: 'happy', talk: 0.4, props: { R: 'none' }, grounded: true,
  sample: (t, c) => {
    const p = new Pose(); const th = t * TAU;
    relaxArms(p);
    const w = sin(th * 3);
    Hw(p, c, 'R', [0.3, 0.34, 0.1], [0.12 + 0.55 * w, 1, 0.08], [0, 0, 1], [0.9, -0.6, -0.3]);
    p.side('Fingers', 'R', 0, 0, 0.04); p.side('Thumb', 'R', 0, 0, 0.15);
    p.add('Spine', 0.02, 0.06 * sin(th), 0.03 * sin(th)); p.add('Head', 0, 0.12 * sin(th), 0.1);
    legIK(p, 'L', 0.03, 0.05); legIK(p, 'R', -0.02, 0.05);
    return p;
  },
});

// ---- salute
def({
  name: 'salute', label: 'Salute (police)', duration: 2.4, loop: false, category: 'greeting', expr: 'proud', props: { R: 'none' }, grounded: true,
  sample: (t, c) => {
    const p = new Pose();
    const k = env(t, 0.0, 0.25, 1.6, 2.0);
    relaxArms(p);
    H(p, c, 'R', [0.075, c.eye.y / c.s + 0.06, c.eye.z / c.s + 0.02], [-0.7, 0.25, 0.35], [-0.2, -0.85, 0.45], [1, 0.1, -0.7], 0.15, k);
    p.side('Fingers', 'R', 0, 0, lerp(-0.38, 0.03, k)); p.side('Thumb', 'R', 0, 0, lerp(-0.15, 0.1, k));
    p.add('Spine', -0.04 * k, 0, 0); p.add('Head', -0.04 * k, 0, 0);
    legIK(p, 'L', 0.0, 0.03); legIK(p, 'R', 0.0, 0.03);
    return p;
  },
});

// ---- clap
def({
  name: 'clap', label: 'Clap', duration: 0.9, loop: true, category: 'emote', expr: 'happy', props: { R: 'none', L: 'none' }, grounded: true,
  sample: (t, c) => {
    const p = new Pose(); const th = t * TAU * 2;
    relaxArms(p);
    const open = 0.5 + 0.5 * cos(th);
    const x = lerp(0.012, 0.17, open * open);
    for (const sd of ['L', 'R'] as const) H(p, c, sd, [x, 0.15, 0.3], [-0.05 - 0.4 * open, 0.35, 0.9], [-1, 0, 0], [0.5, -1, -0.3], 0.15);
    p.lr('Fingers', 0, 0, 0.04);
    p.add('Spine', 0.02, 0, 0); p.add('Head', 0.02, 0.1 * sin(th * 0.5), 0.05 * sin(th * 0.5));
    p.hips[1] = 0.01 * sin(th);
    legIK(p, 'L', 0.03, 0.08); legIK(p, 'R', -0.02, 0.06);
    return p;
  },
});

// ---- cry
def({
  name: 'cry', label: 'Cry', duration: 2.4, loop: true, category: 'emote', expr: 'cry', props: { R: 'none', L: 'none' }, grounded: true,
  sample: (t, c) => {
    const p = new Pose(); const th = t * TAU; const sob = sin(th * 4);
    relaxArms(p);
    for (const sd of ['L', 'R'] as const) H(p, c, sd, [0.035, c.eye.y / c.s + 0.015, c.eye.z / c.s + 0.01], [-0.25, 0.95, 0.15], [-0.6, 0, 0.8], [0.9, -0.6, -0.3], 0.12);
    p.lr('Fingers', 0, 0, -0.5);
    p.add('Spine', 0.16 + 0.03 * sob); p.add('Chest', 0.08); p.add('Head', 0.22 + 0.04 * sob);
    p.add('Shoulder_L', 0, 0, 0.08 + 0.05 * sob); p.add('Shoulder_R', 0, 0, -0.08 - 0.05 * sob);
    legIK(p, 'L', 0.03, 0.05); legIK(p, 'R', -0.02, 0.05);
    return p;
  },
});

// ---- angry shout
def({
  name: 'angry', label: 'Shout / angry', duration: 1.4, loop: true, category: 'emote', expr: 'shout', talk: 1, props: { R: 'none', L: 'none' }, grounded: true,
  sample: (t, c) => {
    const p = new Pose(); const th = t * TAU * 2;
    relaxArms(p);
    const s1 = max(0, sin(th));
    H(p, c, 'R', [0.1, 0.32 + 0.06 * s1, 0.3 + 0.08 * s1], [0, 0.7, 0.7], [-1, 0, 0], [0.8, -0.5, 0], 0.1);
    H(p, c, 'L', [0.14, 0.1, 0.34], [0, 0.4, 0.9], [-1, 0, 0], [0.8, -1, 0], 0.1);
    fist(p, 'R'); fist(p, 'L');
    p.add('Spine', 0.12 + 0.05 * s1); p.add('Chest', 0.05); p.add('Head', 0.1 - 0.12 * s1, 0.0, 0.0);
    legIK(p, 'L', -0.18, 0.3, 0, 0.12); legIK(p, 'R', 0.12, 0.25, 0, -0.12);
    return p;
  },
});

// ---- eat
def({
  name: 'eat', label: 'Eat (roti)', duration: 3.6, loop: true, category: 'daily', expr: 'eat', chew: 1, props: { R: 'roti', L: 'thali' }, grounded: true,
  sample: (t, c) => {
    const p = new Pose();
    relaxArms(p);
    const toMouth = env(t, 0.05, 0.25, 0.4, 0.55);
    const mz = c.mouth.z / c.s, my = c.mouth.y / c.s;
    H(p, c, 'L', [0.04, -0.1, 0.34], [0.05, 0.05, 1], [0, 1, 0], [0.5, -1, 0], 0.14);
    p.side('Fingers', 'L', 0, 0, 0.1);
    const tip: A3 = [0.0, lerp(-0.07, my - 0.015, toMouth), lerp(0.3, mz + 0.045, toMouth)];
    const dir: A3 = [lerp(0.05, -0.1, toMouth), lerp(0.1, 0.8, toMouth), lerp(1, -0.35, toMouth)];
    H(p, c, 'R', tip, dir, [lerp(-1, -0.3, toMouth), lerp(0.2, 0.85, toMouth), lerp(0, -0.4, toMouth)], [0.5, -1, 0.1], 0.12);
    p.side('Fingers', 'R', 0, 0, -0.7); p.side('Thumb', 'R', 0.1, 0, -0.45);
    p.add('Spine', 0.1 + 0.03 * toMouth); p.add('Head', 0.14 - 0.04 * toMouth + 0.03 * sin(t * TAU * 8) * (1 - toMouth), 0, 0);
    legIK(p, 'L', 0.03, 0.06); legIK(p, 'R', -0.02, 0.05);
    return p;
  },
});

// ---- drink chai
def({
  name: 'drink_chai', label: 'Drink chai', duration: 4.0, loop: true, category: 'daily', expr: 'happy', props: { R: 'chai' }, grounded: true,
  sample: (t, c) => {
    const p = new Pose();
    relaxArms(p);
    const sip = env(t, 0.1, 0.3, 0.55, 0.72);
    const mz = c.mouth.z / c.s, my = c.mouth.y / c.s;
    const tip: A3 = [lerp(0.04, 0.0, sip), lerp(0.04, my - 0.01, sip), lerp(0.3, mz + 0.07, sip)];
    const dir: A3 = [lerp(-0.3, -0.1, sip), lerp(0.4, 0.95, sip), lerp(0.9, 0.2, sip)];
    H(p, c, 'R', tip, dir, [-1, 0, 0], [0.5, -1, 0.1], 0.12);
    p.side('Fingers', 'R', 0, 0, -0.5); p.side('Thumb', 'R', 0.1, 0, -0.3);
    H(p, c, 'L', [0.1, -0.3, 0.24], [-0.6, -0.3, 0.7], [0, 1, 0], [0.8, -1, 0.1], 0.12);
    p.add('Head', -0.15 * sip + 0.03 * sin(t * TAU * 2), 0.1 * sin(t * TAU) * (1 - sip), 0); p.add('Spine', 0.02 - 0.05 * sip);
    legIK(p, 'L', 0.03, 0.06); legIK(p, 'R', -0.02, 0.05);
    return p;
  },
});

// ---- morning routine (game additions): brushing / chewing a datun at the
// gate, gargling and spitting, and an uncle's stretches in the park.
def({
  name: 'brush', label: 'Brush teeth / datun', duration: 2.4, loop: true, category: 'daily', expr: 'neutral', grounded: true,
  sample: (t, c) => {
    const p = new Pose(); const th = t * TAU;
    relaxArms(p);
    const mz = c.mouth.z / c.s, my = c.mouth.y / c.s;
    // The brush (or neem twig) goes side to side across the teeth, quick little strokes.
    const scrub = 0.025 * sin(th * 6);
    H(p, c, 'R', [scrub, my - 0.03, mz + 0.09], [-0.95, 0.15, 0.25], [0, 1, 0], [0.5, -1, 0.1], 0.1);
    p.side('Fingers', 'R', 0, 0, -1.2); p.side('Thumb', 'R', 0.2, 0, -0.6);
    // Other hand on the hip.
    H(p, c, 'L', [0.2, -0.33, 0.02], [0.2, -0.6, 0.3], [-1, 0, 0], [1, 0, -0.6], 0.1);
    p.add('Spine', 0.06); p.add('Head', 0.05 + 0.03 * sin(th * 2), 0.12 * sin(th * 0.5), 0);
    legIK(p, 'L', 0.03, 0.06); legIK(p, 'R', -0.02, 0.05);
    return p;
  },
});
def({
  name: 'gargle', label: 'Gargle and spit', duration: 4.0, loop: true, category: 'daily', expr: 'neutral', grounded: true,
  sample: (t, c) => {
    const p = new Pose();
    relaxArms(p);
    // Sip from the lota, head back and gargle, then lean over and spit.
    const back = env(t, 0.15, 0.25, 0.6, 0.7), spit = env(t, 0.72, 0.8, 0.86, 0.95), sip = env(t, 0.0, 0.06, 0.12, 0.2);
    const mz = c.mouth.z / c.s, my = c.mouth.y / c.s;
    H(p, c, 'R', [0.06 - 0.06 * sip, lerp(-0.05, my - 0.02, sip), lerp(0.25, mz + 0.07, sip)], [lerp(-0.3, -0.1, sip), lerp(0.3, 0.95, sip), lerp(0.9, 0.2, sip)], [-1, 0, 0], [0.5, -1, 0.1], 0.12);
    p.side('Fingers', 'R', 0, 0, -0.9); p.side('Thumb', 'R', 0.1, 0, -0.4);
    p.add('Head', -0.55 * back + 0.06 * back * Math.sin(t * TAU * 12) + 0.35 * spit, 0, 0);
    p.add('Neck', -0.2 * back + 0.1 * spit, 0, 0);
    p.add('Spine', 0.02 - 0.05 * back + 0.35 * spit);
    legIK(p, 'L', 0.03, 0.06); legIK(p, 'R', -0.02, 0.05);
    return p;
  },
});
def({
  name: 'stretch', label: 'Morning stretches', duration: 4.0, loop: true, category: 'daily', expr: 'serene', grounded: true,
  sample: (t, c) => {
    const p = new Pose(); const th = t * TAU;
    void c;
    // Arms up overhead and a slow side bend one way, then the other.
    const up = 0.6 + 0.4 * Math.abs(sin(th));
    p.lr('UpperArm', -2.6 * up, 0, -0.25 * up, -2.6 * up, 0, 0.25 * up);
    p.lr('LowerArm', -0.2, 0, 0);
    p.lr('Fingers', 0, 0, 0.05);
    p.add('Spine', 0, 0, 0.28 * sin(th)); p.add('Chest', 0, 0, 0.15 * sin(th));
    p.add('Head', -0.1, 0, 0.1 * sin(th));
    legIK(p, 'L', 0.0, 0.03, 0, 0.12); legIK(p, 'R', 0.0, 0.03, 0, -0.12);
    return p;
  },
});

// ---- giddha
def({
  name: 'giddha', label: 'Giddha (clap & sway)', duration: 2.0, loop: true, category: 'dance', expr: 'happy', props: { R: 'none', L: 'none' }, grounded: true,
  sample: (t, c) => {
    const p = new Pose(); const th = t * TAU;
    relaxArms(p);
    const cl = 0.5 + 0.5 * cos(th * 4);
    const x = lerp(0.012, 0.2, cl * cl);
    for (const sd of ['L', 'R'] as const) H(p, c, sd, [x, 0.2 + 0.07 * sin(th * 2), 0.28], [-0.1 - 0.4 * cl, 0.5, 0.85], [-1, 0, 0], [0.5, -1, -0.3], 0.15);
    p.lr('Fingers', 0, 0, 0.04);
    const step = sin(th * 2);
    legIK(p, 'L', -0.3 * max(0, step) - 0.05, 0.5 * max(0, step) + 0.2, 0, 0.1 + 0.15 * max(0, -step));
    legIK(p, 'R', -0.3 * max(0, -step) - 0.05, 0.5 * max(0, -step) + 0.2, 0, -0.1 - 0.15 * max(0, step));
    p.add('Spine', 0.03, 0.2 * sin(th), 0.12 * sin(th)); p.add('Head', 0, -0.15 * sin(th), 0.22 * sin(th)); p.add('Hips', 0, -0.2 * sin(th), 0.1 * sin(th));
    p.hips[0] = 0.04 * sin(th); p.hips[1] = 0.02 * cos(th * 4) - 0.02;
    p.add('Cape_1', 0.1 * sin(th - 0.5), 0, 0.25 * sin(th)); p.add('Cape_2', 0.15 * sin(th - 1), 0, 0.3 * sin(th - 0.8)); p.add('Cape_3', 0.2 * sin(th - 1.5), 0, 0.3 * sin(th - 1.5));
    p.add('Braid_1', 0, 0, 0.3 * sin(th)); p.add('Braid_2', 0, 0, 0.4 * sin(th - 0.7)); p.add('Braid_3', 0, 0, 0.4 * sin(th - 1.4));
    return p;
  },
});

// ---- fight idle (guard)
const guard = (p: Pose, c: Ctx, th: number, k = 1) => {
  relaxArms(p);
  H(p, c, 'L', [0.09, 0.27, 0.32], [-0.1, 0.55, 0.85], [-1, 0, 0], [0.5, -1, -0.1], 0.1);
  H(p, c, 'R', [0.07, 0.23 + 0.015 * sin(th * 2), 0.29], [-0.1, 0.55, 0.85], [-1, 0, 0], [0.5, -1, -0.1], 0.1);
  fist(p, 'L'); fist(p, 'R');
  p.add('Spine', 0.12 * k, 0.28 * k); p.add('Chest', 0.05, 0.1); p.add('Head', 0.04, -0.3 * k, 0);
  p.add('Hips', 0, -0.3 * k, 0);
  legIK(p, 'L', -0.38 * k, 0.5 * k + 0.05 * sin(th * 2), 0, 0.2); legIK(p, 'R', 0.3 * k, 0.5 * k + 0.05 * sin(th * 2 + 1), 0, -0.2);
};
def({
  name: 'fight_idle', label: 'Fight stance', duration: 1.2, loop: true, category: 'combat', expr: 'focus', props: { R: 'none', L: 'none' }, grounded: true,
  sample: (t, c) => { const p = new Pose(); guard(p, c, t * TAU); p.hips[1] = 0.01 * sin(t * TAU * 2); return p; },
});

// ---- punch combo (jab, cross, hook)
def({
  name: 'punch', label: 'Punch combo', duration: 1.5, loop: false, category: 'combat', expr: 'shout', props: { R: 'none', L: 'none' }, grounded: true,
  sample: (t, c) => {
    const p = new Pose();
    guard(p, c, 0);
    const jab = env(t, 0.1, 0.2, 0.24, 0.38);
    const cross = env(t, 0.42, 0.52, 0.56, 0.72);
    const hook = env(t, 0.76, 0.86, 0.9, 1.0);
    const fx = (side: 'L' | 'R', k: number, tip: A3, dir: A3, hint: A3) => {
      if (k <= 0.001) return;
      const base: Record<string, THREE.Quaternion> = {};
      for (const b of ['UpperArm', 'LowerArm', 'Hand']) base[b] = p.q[`${b}_${side}`];
      H(p, c, side, tip, dir, [-1, 0, 0], hint, 0.1);
      for (const b of ['UpperArm', 'LowerArm', 'Hand']) p.q[`${b}_${side}`] = base[b].clone().slerp(p.q[`${b}_${side}`], k);
    };
    fx('L', jab, [0.03, 0.26, 0.64], [0, 0, 1], [0.5, -1, 0]);
    fx('R', cross, [0.0, 0.24, 0.64], [0, 0, 1], [0.5, -1, 0]);
    fx('L', hook, [0.28, 0.26, 0.4], [-0.75, 0, 0.65], [0.6, -0.2, -0.8]);
    p.add('Spine', 0, -0.15 * jab + 0.5 * cross - 0.5 * hook, 0); p.add('Hips', 0, 0.4 * cross - 0.5 * hook, 0); p.add('Chest', 0.05 * (jab + cross), 0, 0);
    p.add('UpperLeg_R', -0.1 * cross); p.add('LowerLeg_R', 0.1 * cross);
    p.add('Spine', 0.12 * cross);
    return p;
  },
});

// ---- kick
def({
  name: 'kick', label: 'Kick', duration: 1.5, loop: false, category: 'combat', expr: 'shout', props: { R: 'none', L: 'none' }, grounded: true,
  sample: (t, c) => {
    const p = new Pose();
    guard(p, c, 0, 1 - env(t, 0.1, 0.3, 0.8, 0.95));
    const chamber = env(t, 0.1, 0.34, 0.4, 0.6), ext = env(t, 0.38, 0.5, 0.56, 0.8);
    legIK(p, 'R', 0, 0);
    p.r['UpperLeg_R'] = [-1.3 * chamber - 0.5 * ext, 0.0, -0.6 * ext - 0.15 * chamber];
    p.r['LowerLeg_R'] = [1.9 * chamber * (1 - ext) + 0.15 * ext, 0, 0];
    p.r['Foot_R'] = [0.3 * ext, 0, 0];
    const sup = max(chamber, ext);
    p.r['UpperLeg_L'] = [-0.1 * sup, 0, 0.0]; p.r['LowerLeg_L'] = [0.35 * sup + 0.1, 0, 0]; p.r['Foot_L'] = [0.0, 0, 0];
    p.add('Spine', -0.3 * ext - 0.05 * chamber, 0, -0.15 * ext); p.add('Hips', -0.12 * ext, 0.3 * ext, 0.1 * ext);
    const k = max(chamber, ext);
    H(p, c, 'L', [0.34, 0.24, 0.12], [0.5, 0.3, 0.8], [-1, 0, 0], [0.8, -0.4, 0], 0.1, k * 0.9);
    H(p, c, 'R', [0.18, 0.1, 0.3], [0.1, 0.4, 0.9], [-1, 0, 0], [0.6, -1, 0], 0.1, k * 0.9);
    return p;
  },
});

// ---- block
def({
  name: 'block', label: 'Block', duration: 1.2, loop: true, category: 'combat', expr: 'focus', props: { R: 'none', L: 'none' }, grounded: true,
  sample: (t, c) => {
    const p = new Pose(); const th = t * TAU;
    guard(p, c, th, 0.8);
    const ey = c.eye.y / c.s;
    H(p, c, 'L', [0.06, ey + 0.1, 0.33], [-0.15, 1, 0.15], [-0.2, 0, 1], [0.9, 0.2, 0], 0.12);
    H(p, c, 'R', [0.05, ey + 0.06, 0.3], [-0.15, 1, 0.15], [-0.2, 0, 1], [0.9, 0.2, 0], 0.12);
    p.add('Spine', 0.1); p.add('Head', 0.15);
    p.hips[1] = -0.03 + 0.008 * sin(th * 2);
    return p;
  },
});

// ---- victory
def({
  name: 'victory', label: 'Victory cheer', duration: 1.4, loop: true, category: 'emote', expr: 'laugh', props: { R: 'none', L: 'none' }, grounded: true,
  sample: (t, c) => {
    const p = new Pose(); const th = t * TAU;
    relaxArms(p);
    const hop = max(0, sin(th * 2));
    for (const sd of ['L', 'R'] as const) { H(p, c, sd, [0.15 + 0.03 * sin(th * 2), 0.62, 0.1], [0.1, 1, 0.1], [-1, 0, 0], [0.9, 0.2, -0.3], 0.1); fist(p, sd); }
    legIK(p, 'L', -0.4 * hop - 0.05, 0.7 * hop + 0.15, 0, 0.1); legIK(p, 'R', -0.2 * hop, 0.5 * hop + 0.15, 0, -0.1);
    p.add('Spine', -0.1 - 0.05 * hop); p.add('Head', -0.2);
    p.hips[1] = 0.14 * hop - 0.04;
    return p;
  },
});

// ---- pray (ardas)
def({
  name: 'pray', label: 'Ardas (prayer)', duration: 5.0, loop: true, category: 'greeting', expr: 'serene', props: { R: 'none', L: 'none' }, grounded: true,
  sample: (t, c) => {
    const p = new Pose(); const th = t * TAU;
    relaxArms(p);
    for (const sd of ['L', 'R'] as const) H(p, c, sd, [0.014, 0.25, 0.3], [0, 0.8, 0.6], [-1, 0, 0], [0.6, -1, 0.35], 0.15);
    p.lr('Fingers', 0, 0, 0.02); p.lr('Thumb', 0, 0, 0.1);
    p.add('Spine', 0.1 + 0.015 * sin(th)); p.add('Chest', 0.05); p.add('Head', 0.26 + 0.02 * sin(th));
    legIK(p, 'L', 0.0, 0.03); legIK(p, 'R', 0.0, 0.03);
    return p;
  },
});

// ---- namaste (same pose as Sat Sri Akal, own clip so UIs can label it)
def({ ...clips.find((c) => c.name === 'sat_sri_akal')!, name: 'namaste', label: 'Namaste (greeting)' });
// ---- salaam: right hand over the heart with a respectful nod
def({
  name: 'salaam', label: 'Salaam (hand on heart)', duration: 2.8, loop: false, category: 'greeting', expr: 'greet', talk: 0.5, props: { R: 'none', L: 'none' }, grounded: true,
  sample: (t, c) => {
    const p = new Pose();
    const up = env(t, 0.05, 0.3, 0.78, 1.0);
    const bow = env(t, 0.2, 0.42, 0.62, 0.82);
    relaxArms(p);
    H(p, c, 'R', [-0.05, 0.1, 0.19], [-0.92, 0.36, 0.1], [0, 0, -1], [0.7, -1, 0.35], 0.15, up);
    p.side('Fingers', 'R', 0, 0, lerp(-0.38, 0.03, up)); p.side('Thumb', 'R', 0, 0, lerp(-0.15, 0.1, up));
    p.add('Spine', 0.07 * bow + 0.02); p.add('Chest', 0.03 * bow); p.add('Neck', 0.05 * bow); p.add('Head', 0.14 * bow + 0.02 * sin(t * TAU * 2) * up, 0.1 * bow, 0);
    legIK(p, 'L', 0.03, 0.05); legIK(p, 'R', -0.02, 0.05);
    return p;
  },
});
// ---- dua: open palms raised at chest height
def({
  name: 'dua', label: 'Dua (open-palm prayer)', duration: 5.0, loop: true, category: 'greeting', expr: 'serene', props: { R: 'none', L: 'none' }, grounded: true,
  sample: (t, c) => {
    const p = new Pose(); const th = t * TAU;
    relaxArms(p);
    for (const sd of ['L', 'R'] as const) H(p, c, sd, [0.075, 0.13, 0.36], [0, 0.22, 1], [0, 1, 0], [0.6, -1, 0.3], 0.15);
    p.lr('Fingers', 0, 0, 0.06); p.lr('Thumb', 0, 0, 0.12);
    p.add('Spine', 0.06 + 0.012 * sin(th)); p.add('Head', 0.22 + 0.025 * sin(th));
    legIK(p, 'L', 0.0, 0.03); legIK(p, 'R', 0.0, 0.03);
    return p;
  },
});
// ---- point
def({
  name: 'point', label: 'Point / direct', duration: 2.0, loop: true, category: 'daily', expr: 'focus', talk: 0.5, props: { R: 'none' }, grounded: true,
  sample: (t, c) => {
    const p = new Pose(); const th = t * TAU;
    relaxArms(p);
    H(p, c, 'R', [0.06, 0.24 + 0.01 * sin(th * 2), 0.66], [0, 0.04, 1], [-1, 0, 0], [0.6, -1, 0], 0.15);
    p.side('Fingers', 'R', 0, 0, 0.0); p.side('Thumb', 'R', 0, 0, 0.1);
    p.add('Spine', 0.04, -0.15); p.add('Head', 0, 0.1 * sin(th), 0);
    legIK(p, 'L', 0.05, 0.06); legIK(p, 'R', -0.04, 0.05);
    return p;
  },
});

// ---- laugh
def({
  name: 'laugh', label: 'Laugh', duration: 1.6, loop: true, category: 'emote', expr: 'laugh', props: { L: 'none' }, grounded: true,
  sample: (t, c) => {
    const p = new Pose(); const th = t * TAU * 3;
    relaxArms(p);
    const j = sin(th);
    p.add('Spine', -0.18 + 0.05 * j); p.add('Chest', -0.1 + 0.04 * j); p.add('Head', -0.25 + 0.06 * j);
    H(p, c, 'L', [0.0, 0.0, 0.26], [-1, -0.1, 0.35], [0, 1, 0], [0.8, -1, 0], 0.1);
    p.side('Fingers', 'L', 0, 0, -0.3);
    p.add('Shoulder_L', 0, 0, 0.1 + 0.05 * j); p.add('Shoulder_R', 0, 0, -0.1 - 0.05 * j);
    p.hips[1] = 0.012 * j;
    legIK(p, 'L', 0.05, 0.1); legIK(p, 'R', -0.04, 0.08);
    return p;
  },
});

// ---- shrug
def({
  name: 'shrug', label: 'Shrug (pata nahi)', duration: 2.0, loop: false, category: 'emote', expr: 'smirk', props: { R: 'none', L: 'none' }, grounded: true,
  sample: (t, c) => {
    const p = new Pose();
    const k = env(t, 0.1, 0.4, 1.4, 1.8);
    relaxArms(p);
    p.lr('Shoulder', 0, 0, 0.25 * k); p.add('Shoulder_R', 0, 0, -0.5 * k);
    p.lr('UpperArm', -0.2 * k, 0, 0.45 * k); p.lr('LowerArm', -1.0 * k); p.lr('Hand', -0.2 * k, 0, 0);
    p.lr('Fingers', 0, 0, 0.0 * k);
    p.add('Head', 0, 0, 0.2 * k); p.add('Neck', 0, 0, 0.05 * k);
    legIK(p, 'L', 0.03, 0.06); legIK(p, 'R', -0.02, 0.05);
    return p;
  },
});

export const CLIP_DEFS = clips;
export const CLIP_NAMES = clips.map((c) => c.name);


// ---------------------------------------------------------------- arm guard (anatomy limits + torso collision)
export interface ArmAudit { pen: number; flexMin: number; flexMax: number; wrist: number; twist: number }
interface TorsoRow { y: number; rx: number; rz: number }
const torsoCache = new WeakMap<Ctx, TorsoRow[]>();
function torsoRows(c: Ctx): TorsoRow[] {
  let t = torsoCache.get(c);
  if (t) return t;
  const rig = c.rig, D = rig.dims, bd = rig.body, s = c.s, cy = c.chestWorld.y;
  const [cRx, cRz] = bd.chest, [wRx, wRz] = bd.waist, [hRx, hRz] = bd.hip;
  const bust = bd.sex === 'f' && bd.age !== 'kid' ? 1.1 : 1;
  t = [
    { y: D.shoulderY - cy + 0.012 * s, rx: D.shoulderX * 0.82, rz: cRz * s * 0.82 },
    { y: D.shoulderY - cy - 0.05 * s, rx: cRx * s, rz: cRz * s * bust },
    { y: D.chestY - cy, rx: cRx * s * 0.98, rz: cRz * s * bust },
    { y: D.spineY - cy, rx: wRx * s, rz: wRz * s },
    { y: D.hipsY - cy, rx: hRx * s, rz: hRz * s },
  ];
  torsoCache.set(c, t);
  return t;
}
function torsoAt(c: Ctx, y: number): { rx: number; rz: number } | null {
  const t = torsoRows(c);
  if (y > t[0].y || y < t[t.length - 1].y) return null;
  for (let i = 0; i < t.length - 1; i++) {
    if (y <= t[i].y && y >= t[i + 1].y) {
      const k = (t[i].y - y) / (t[i].y - t[i + 1].y);
      return { rx: lerp(t[i].rx, t[i + 1].rx, k), rz: lerp(t[i].rz, t[i + 1].rz, k) };
    }
  }
  return null;
}
interface ArmSample { p: THREE.Vector3; r: number; kind: 'up' | 'elbow' | 'fore' | 'wrist' | 'hand'; f: number }
function armFK(pose: Pose, c: Ctx, side: 'L' | 'R') {
  const rig = c.rig;
  const qU = boneQuat(`UpperArm_${side}`, pose, rig), qL = boneQuat(`LowerArm_${side}`, pose, rig), qH = boneQuat(`Hand_${side}`, pose, rig);
  const P0 = c.shoulder[side];
  const E = P0.clone().add(V(0, -c.upA, 0).applyQuaternion(qU));
  const qUL = qU.clone().multiply(qL);
  const W = E.clone().add(V(0, -c.loA, 0).applyQuaternion(qUL));
  const qUH = qUL.clone().multiply(qH);
  const T = W.clone().add(V(0, -0.15 * c.s, 0).applyQuaternion(qUH));
  return { P0, E, W, T, qU, qL, qH, qUL, qUH };
}
function armSamples(fk: ReturnType<typeof armFK>, c: Ctx): ArmSample[] {
  const s = c.s, { P0, E, W, T } = fk, L = c.upA + c.loA;
  const at = (a: THREE.Vector3, b: THREE.Vector3, t: number) => a.clone().lerp(b, t);
  const f = (p: THREE.Vector3) => Math.max(0.25, p.distanceTo(P0) / L);
  const out: ArmSample[] = [];
  const add = (p: THREE.Vector3, r: number, kind: ArmSample['kind']) => out.push({ p, r, kind, f: f(p) });
  add(at(P0, E, 0.45), 0.034 * s, 'up'); add(at(P0, E, 0.8), 0.034 * s, 'up'); add(E, 0.034 * s, 'elbow');
  add(at(E, W, 0.35), 0.03 * s, 'fore'); add(at(E, W, 0.7), 0.028 * s, 'fore'); add(W, 0.026 * s, 'wrist');
  add(at(W, T, 0.45), 0.03 * s, 'hand'); add(T, 0.012 * s, 'hand');
  return out;
}
/** penetration depth (m) of a sphere into the torso + outward push direction */
function torsoPen(c: Ctx, p: THREE.Vector3, r: number): { pen: number; n: THREE.Vector3 } {
  const t = torsoAt(c, p.y);
  if (!t) return { pen: 0, n: V(0, 0, 0) };
  const m = 0.008 * c.s;
  const a = t.rx + m + r, b = t.rz + m + r;
  const q = Math.sqrt((p.x / a) ** 2 + (p.z / b) ** 2);
  if (q >= 1) return { pen: 0, n: V(0, 0, 0) };
  const pen = (1 - q) * Math.min(a, b);
  const n = V(p.x / (a * a), 0, p.z / (b * b));
  if (n.lengthSq() < 1e-9) n.set(0, 0, 1); n.normalize();
  return { pen, n };
}
/** split q into twist about local Y (hand/bone axis) and the remaining swing */
function swingTwistY(q: THREE.Quaternion) {
  const tw = new THREE.Quaternion(0, q.y, 0, q.w);
  if (tw.lengthSq() < 1e-9) tw.set(0, 0, 0, 1); else tw.normalize();
  const swing = q.clone().multiply(tw.clone().invert());
  const sa = 2 * Math.acos(Math.min(1, Math.abs(swing.w)));
  let ta = 2 * Math.atan2(tw.y, tw.w); if (ta > Math.PI) ta -= TAU; if (ta < -Math.PI) ta += TAU;
  return { tw, swing, swingAngle: sa, twistAngle: ta };
}
function elbowFlex(qL: THREE.Quaternion) {
  const w = Math.max(-1, Math.min(1, qL.w));
  let ang = 2 * Math.atan2(qL.x, qL.w); // rotation about X
  if (ang > Math.PI) ang -= TAU; if (ang < -Math.PI) ang += TAU;
  void w;
  return -ang;                                                 // flexion = positive
}
export function auditArm(pose: Pose, c: Ctx, side: 'L' | 'R'): ArmAudit {
  const fk = armFK(pose, c, side);
  let pen = 0;
  for (const sm of armSamples(fk, c)) pen = Math.max(pen, torsoPen(c, sm.p, sm.r).pen);
  const qL = fk.qL;
  const twist = 2 * Math.acos(Math.min(1, Math.sqrt(qL.w * qL.w + qL.x * qL.x))) ; void twist;
  const swing = Math.hypot(qL.y, qL.z) * 2;
  const wr = swingTwistY(fk.qH).swingAngle;
  const fl = elbowFlex(qL);
  return { pen: pen / c.s, flexMin: fl, flexMax: fl, wrist: wr, twist: swing };
}
export function guardArms(pose: Pose, c: Ctx) {
  for (const side of ['L', 'R'] as const) guardArm(pose, c, side);
}
function guardArm(pose: Pose, c: Ctx, side: 'L' | 'R') {
  const s = c.s;
  let fk = armFK(pose, c, side);
  const absHand = fk.qUH.clone();
  // ---- 1. elbow hinge limits (flexion 0..2.6 rad, almost no side-swing)
  let qL = fk.qL.clone();
  let fl = elbowFlex(qL);
  const swing = Math.hypot(qL.y, qL.z) * 2;
  let changed = false;
  if (fl < 0.02 || fl > 2.6 || swing > 0.3) {
    fl = Math.max(0.02, Math.min(2.6, fl));
    qL = new THREE.Quaternion().setFromAxisAngle(V(1, 0, 0), -fl);
    pose.q[`LowerArm_${side}`] = qL; changed = true;
    fk = armFK(pose, c, side);
  }
  // ---- 2. torso collision: (a) swing the elbow around the shoulder-wrist axis (smallest angle that clears),
  //         (b) if the wrist/hand itself is inside the body, nudge the wrist target out and repeat
  const hit = (pp: Pose, parts: ('arm' | 'end')[]) => {
    const f = armFK(pp, c, side);
    let tot = 0; let worst: { pen: number; n: THREE.Vector3 } = { pen: 0, n: V(0, 0, 0) };
    for (const sm of armSamples(f, c)) {
      const isEnd = sm.kind === 'wrist' || sm.kind === 'hand';
      if (isEnd ? !parts.includes('end') : !parts.includes('arm')) continue;
      const r = torsoPen(c, sm.p, sm.r);
      tot += r.pen;
      if (r.pen > worst.pen) worst = r;
    }
    return { tot, worst, f };
  };
  const eps = 0.002 * s;
  if (hit(pose, ['arm', 'end']).tot > 0.003 * s) {
    const W = fk.W.clone();
    const origE = fk.E.clone();
    const tmp = new Pose();
    const solve = (Wt: THREE.Vector3, ang: number) => {
      const dir = Wt.clone().sub(fk.P0).normalize();
      let h = origE.clone().sub(fk.P0); h.addScaledVector(dir, -h.dot(dir));
      if (h.lengthSq() < 1e-6) h.set(side === 'L' ? 1 : -1, -0.5, 0.2);
      h.normalize().applyAxisAngle(dir, ang);
      armIK(tmp, c, side, Wt, h);
      tmp.q[`Hand_${side}`] = tmp.q[`UpperArm_${side}`].clone().multiply(tmp.q[`LowerArm_${side}`]).invert().multiply(absHand);
      return { hint: h };
    };
    const angs: number[] = [0];
    for (let k = 1; k <= 20; k++) angs.push(0.1 * k, -0.1 * k);
    // Score = penetration plus how far the wrist moved (game fix: when nothing cleared the
    // body completely the pushes ran on and a cup meant for the mouth ended up held out sideways).
    const W0 = W.clone();
    let best: { ang: number; tot: number; W: THREE.Vector3 } = { ang: 0, tot: Infinity, W: W.clone() };
    for (let push = 0; push < 10; push++) {
      let found = false;
      for (const ang of angs) {
        solve(W, ang);
        const h = hit(tmp, ['arm', 'end']);
        const cost = h.tot + 0.5 * W.distanceTo(W0) + 0.004 * s * Math.abs(ang);
        if (cost < best.tot) best = { ang, tot: cost, W: W.clone() };
        if (h.tot < eps) { found = true; break; }
      }
      if (found) break;
      // wrist or hand still inside the chest: move wrist target along the outward normal
      solve(W, 0);
      const he = hit(tmp, ['end']);
      if (he.worst.pen < eps) { // only the arm is the problem and swivel cannot fix it: push wrist anyway
        const ha = hit(tmp, ['arm']);
        W.addScaledVector(ha.worst.n, ha.worst.pen + 0.01 * s);
      } else W.addScaledVector(he.worst.n, he.worst.pen + 0.01 * s);
    }
    solve(best.W, best.ang);
    pose.q[`UpperArm_${side}`] = tmp.q[`UpperArm_${side}`].clone();
    pose.q[`LowerArm_${side}`] = tmp.q[`LowerArm_${side}`].clone();
    changed = true;
  }
  if (!changed) {
    const st0 = swingTwistY(fk.qH);
    if (st0.swingAngle > 1.1) pose.q[`Hand_${side}`] = new THREE.Quaternion().slerp(st0.swing, 1.1 / st0.swingAngle).multiply(st0.tw);
    return;
  }
  // ---- 3. keep the hand's world orientation, but limit wrist deflection
  const qUL = boneQuat(`UpperArm_${side}`, pose, c.rig).clone().multiply(boneQuat(`LowerArm_${side}`, pose, c.rig));
  const qH = qUL.invert().multiply(absHand);
  const st = swingTwistY(qH);
  let sw = st.swing;
  if (st.swingAngle > 1.1) sw = new THREE.Quaternion().slerp(st.swing, 1.1 / st.swingAngle);
  pose.q[`Hand_${side}`] = sw.multiply(st.tw);
}

// ---------------------------------------------------------------- baking
export interface BakeOptions { fps?: number; bakeFace?: boolean; names?: string[]; guard?: boolean }

export function faceWeights(d: ClipDef, phase: number): Record<string, number> {
  const w: Record<string, number> = {};
  const e = EXPRESSIONS[d.expr] ?? {};
  for (const k of Object.keys(e)) w[k] = (e as any)[k] * (GAIN[k] ?? 1);
  if (d.talk) w['open'] = max(w['open'] ?? 0, d.talk * (0.15 + 0.45 * abs(sin(phase * TAU * 6) * sin(phase * TAU * 2.3 + 1))));
  if (d.chew) w['chew'] = d.chew * (0.5 + 0.5 * sin(phase * TAU * 9));
  return w;
}


// ---- seated versions of the everyday gestures (game addition): the upper body
// of talk / eat / laugh / argue / point / wave / greet / clap, legs bent on the
// seat and the hips left where the game puts them (a sofa, a manji, a chair).
const SEAT_LEGS = ['UpperLeg_L', 'UpperLeg_R', 'LowerLeg_L', 'LowerLeg_R', 'Foot_L', 'Foot_R'];
for (const src of ['talk', 'eat', 'laugh', 'angry', 'point', 'wave', 'sat_sri_akal', 'salaam', 'clap', 'drink_chai']) {
  const d = clips.find((c) => c.name === src);
  if (!d) continue;
  def({
    ...d, name: `seated_${src}`, label: `${d.label} (seated)`, grounded: false,
    sample: (t, c) => {
      const p = d.sample(t, c);
      for (const b of SEAT_LEGS) { delete p.r[b]; delete p.q[b]; }
      p.hips = [0, 0, 0];
      legIK(p, 'L', -1.5, 1.55, -0.05, 0.06); legIK(p, 'R', -1.5, 1.55, -0.05, -0.06);
      return p;
    },
  });
}

export function bakeClips(rig: Rig, opts: BakeOptions = {}): THREE.AnimationClip[] {
  const fps = opts.fps ?? 24;
  const c = makeCtx(rig);
  const out: THREE.AnimationClip[] = [];
  const boneNames = rig.bones.map((b) => b.name);
  const hipsRest = rig.byName['Hips'].position.clone();
  for (const d of clips) {
    if (opts.names && !opts.names.includes(d.name)) continue;
    const dur = d.duration / rig.body.tempo;
    const n = Math.max(2, Math.round(dur * fps) + 1);
    const times = new Float32Array(n);
    const q: Record<string, number[]> = {}; for (const b of boneNames) q[b] = [];
    const hp: number[] = [];
    const morph: Record<string, number[]> = {}; for (const m of FACE_MORPHS) morph[m] = [];
    for (let i = 0; i < n; i++) {
      const ph = d.loop ? i / (n - 1) : i / (n - 1);
      times[i] = (i / (n - 1)) * dur;
      const pose = d.sample(ph, c);
      if (opts.guard !== false && !d.noGuard && !(globalThis as any).__noguard) guardArms(pose, c);
      // hip height
      let gy = 0;
      if (d.grounded) gy = groundOffset(pose, c);
      for (const b of boneNames) {
        const quat = boneQuat(b, pose, rig);
        // spine lean (hunch) for elders etc.
        if (c.hunch && (b === 'Spine' || b === 'Chest' || b === 'Neck')) {
          const k = b === 'Spine' ? 0.5 : b === 'Chest' ? 0.35 : 0.15;
          quat.premultiply(new THREE.Quaternion().setFromAxisAngle(V(1, 0, 0), c.hunch * k));
        }
        if (c.hunch && b === 'Head') quat.premultiply(new THREE.Quaternion().setFromAxisAngle(V(1, 0, 0), -c.hunch * 0.35));
        q[b].push(quat.x, quat.y, quat.z, quat.w);
      }
      hp.push(hipsRest.x + pose.hips[0] * c.s, hipsRest.y + gy + pose.hips[1] * c.s, hipsRest.z + pose.hips[2] * c.s);
      if (opts.bakeFace) {
        const fw = faceWeights(d, ph);
        for (const m of FACE_MORPHS) morph[m].push(fw[m] ?? 0);
      }
    }
    const tracks: THREE.KeyframeTrack[] = [];
    for (const b of boneNames) tracks.push(new THREE.QuaternionKeyframeTrack(`${b}.quaternion`, Array.from(times), q[b]));
    tracks.push(new THREE.VectorKeyframeTrack('Hips.position', Array.from(times), hp));
    if (opts.bakeFace) for (const m of FACE_MORPHS) tracks.push(new THREE.NumberKeyframeTrack(`Face.morphTargetInfluences[${m}]`, Array.from(times), morph[m]));
    const clip = new THREE.AnimationClip(d.name, dur, tracks);
    out.push(clip);
  }
  return out;
}

/** Developer audit: worst arm penetration (cm), elbow flexion range and wrist deflection for every clip. */
export function auditClips(rig: Rig, useGuard: boolean) {
  const c = makeCtx(rig);
  const rows: Record<string, { pen: number; fMin: number; fMax: number; wrist: number; swing: number }> = {};
  for (const d of clips) {
    const r = { pen: 0, fMin: 9, fMax: -9, wrist: 0, swing: 0 };
    const n = 48;
    for (let i = 0; i <= n; i++) {
      const pose = d.sample(i / n, c);
      if (useGuard) guardArms(pose, c);
      for (const sd of ['L', 'R'] as const) {
        const a = auditArm(pose, c, sd);
        r.pen = Math.max(r.pen, a.pen * 100); r.fMin = Math.min(r.fMin, a.flexMin); r.fMax = Math.max(r.fMax, a.flexMax); r.wrist = Math.max(r.wrist, a.wrist); r.swing = Math.max(r.swing, a.twist);
      }
    }
    rows[d.name] = r;
  }
  return rows;
}

export function debugArm(rig: Rig, clip: string, ph: number, side: 'L' | 'R' = 'L') {
  const c = makeCtx(rig); const d = clips.find((x) => x.name === clip)!;
  const pose = d.sample(ph, c); const fk = armFK(pose, c, side);
  const r = (v: THREE.Vector3) => [v.x, v.y, v.z].map((n) => +(n / c.s).toFixed(3));
  return { P0: r(fk.P0), E: r(fk.E), W: r(fk.W), T: r(fk.T), rows: torsoRows(c).map((q) => [q.y, q.rx, q.rz].map((n) => +(n / c.s).toFixed(3))), s: c.s, chestY: c.chestWorld.y };
}
