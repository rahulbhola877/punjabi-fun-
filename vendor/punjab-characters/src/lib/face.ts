import * as THREE from 'three';
import type { Rig } from './rig';

/** Shape of the head ellipsoid (shared by head mesh and face-feature placement). */
export function jawTaper(yn: number): number {
  // yn: -1 (chin) .. 1 (crown). narrows the lower face
  const t = Math.max(0, (-yn - 0.25) / 0.75);
  return 1 - 0.2 * Math.pow(t, 1.4);
}

export const FACE_MORPHS = [
  'blink', 'squint', 'wide_eyes', 'brow_up', 'brow_angry', 'brow_sad',
  'smile', 'smile_open', 'frown', 'open', 'round', 'chew', 'shout',
] as const;
export type FaceMorph = (typeof FACE_MORPHS)[number];

export const EXPRESSIONS: Record<string, Partial<Record<FaceMorph, number>>> = {
  neutral: {},
  happy: { smile: 1, brow_up: 0.15, squint: 0.15 },
  greet: { smile: 0.85, brow_up: 0.35, squint: 0.2 },
  laugh: { smile_open: 1, squint: 0.75, brow_up: 0.3 },
  angry: { brow_angry: 1, frown: 0.7, squint: 0.3 },
  shout: { brow_angry: 1, shout: 1, squint: 0.35 },
  sad: { brow_sad: 1, frown: 1 },
  cry: { brow_sad: 1, open: 0.55, frown: 0.6, squint: 0.7 },
  surprised: { brow_up: 1, round: 1, wide_eyes: 1 },
  pain: { brow_sad: 0.9, squint: 0.9, open: 0.5, frown: 0.5 },
  eat: { smile: 0.2, brow_up: 0.1 },
  smirk: { smile: 0.5, brow_angry: 0.25, squint: 0.3 },
  focus: { brow_angry: 0.45, squint: 0.2 },
  proud: { smile: 0.5, brow_up: 0.25 },
  serene: { blink: 1, smile: 0.3 },
};
export const EXPRESSION_NAMES = Object.keys(EXPRESSIONS);

interface FaceParams {
  lid: number; brow: number; angry: number; sad: number; smile: number; open: number; width: number;
}
const BASE: FaceParams = { lid: 1, brow: 0, angry: 0, sad: 0, smile: 0.12, open: 0, width: 1 };
const MORPH_DEF: Record<FaceMorph, Partial<FaceParams>> = {
  blink: { lid: 0.07 },
  squint: { lid: 0.52 },
  wide_eyes: { lid: 1.3 },
  brow_up: { brow: 1 },
  brow_angry: { angry: 1 },
  brow_sad: { sad: 1 },
  smile: { smile: 1 },
  smile_open: { smile: 1, open: 0.7 },
  frown: { smile: -0.9 },
  open: { open: 0.65 },
  round: { open: 0.75, width: 0.55, smile: 0 },
  chew: { open: 0.38, smile: 0.2 },
  shout: { open: 1.0, smile: -0.25, width: 1.2 },
};

export interface FaceOptions { eye: string; brow: string; lip: string; kid: boolean; female: boolean; }

export function buildFace(rig: Rig, fo: FaceOptions): THREE.SkinnedMesh {
  const hc = rig.dims.headCenter, hr = rig.dims.headR;
  const eyeScale = fo.kid ? 1.18 : fo.female ? 1.04 : 1.0;
  const surfaceZ = (x: number, y: number) => {
    const yn = (y - hc.y) / hr.y;
    const rx = hr.x * jawTaper(yn);
    const q = 1 - ((x - hc.x) / rx) ** 2 - yn * yn;
    return hc.z + hr.z * Math.sqrt(Math.max(0.02, q));
  };
  const D0 = 0.0042, DS = 0.0007;
  const P = (x: number, y: number, layer: number) => new THREE.Vector3(x, y, surfaceZ(x, y) + D0 + DS * layer);

  const eyeX = hr.x * 0.42, eyeY = hc.y + hr.y * 0.04;
  const eRx = 0.0155 * rig.dims.s * eyeScale * (hr.x / (0.095 * rig.dims.s)), eRy = 0.0135 * rig.dims.s * eyeScale * (hr.y / (0.115 * rig.dims.s));
  const mouthY = hc.y - hr.y * 0.56;
  const mouthW = hr.x * 0.24;
  const browY = eyeY + hr.y * 0.27 * (fo.kid ? 1.05 : 1);
  const unit = rig.dims.s;

  type Layer = { gen: (p: FaceParams) => THREE.Vector3[]; color: THREE.Color; tris: number[]; };
  const layers: Layer[] = [];
  const eyeColor = new THREE.Color(fo.eye), browColor = new THREE.Color(fo.brow), lipColor = new THREE.Color(fo.lip);
  const N = 14;

  const fan = (cx: number, cy: number, rx: number, ry: (p: FaceParams) => number, layer: number, color: THREE.Color, offx = 0, offy = 0): Layer => {
    const tris: number[] = [];
    for (let i = 0; i < N; i++) tris.push(0, 1 + i, 1 + ((i + 1) % N));
    return {
      color, tris,
      gen: (p) => {
        const r = ry(p);
        const out = [P(cx, cy, layer)];
        for (let i = 0; i < N; i++) {
          const t = (i / N) * Math.PI * 2;
          out.push(P(cx + offx + Math.cos(t) * rx, cy + offy * Math.max(0.2, Math.min(1, ry(p) / eRy)) + Math.sin(t) * r, layer));
        }
        return out;
      },
    };
  };

  for (const m of [1, -1]) {
    const cx = hc.x + m * eyeX;
    layers.push(fan(cx, eyeY, eRx * 1.14, (p) => eRy * (0.2 + 0.98 * p.lid), 0, new THREE.Color('#2a1a14')));
    layers.push(fan(cx, eyeY, eRx, (p) => eRy * p.lid, 1, new THREE.Color('#f6f2ec')));
    layers.push(fan(cx, eyeY, eRy * 0.98, (p) => eRy * 0.98 * Math.min(1, p.lid * 1.15), 2, eyeColor));
    layers.push(fan(cx, eyeY, eRy * 0.5, (p) => eRy * 0.5 * Math.min(1, p.lid * 1.15), 3, new THREE.Color('#0a0605')));
    layers.push(fan(cx, eyeY, eRy * 0.2, (p) => eRy * 0.2 * Math.min(1, p.lid * 1.1), 4, new THREE.Color('#ffffff'), eRy * 0.3, eRy * 0.3));
  }

  // eyebrows
  const bw = hr.x * 0.26, bth = 0.0085 * unit * (fo.female ? 0.75 : 1.15) * (fo.kid ? 0.9 : 1);
  const BN = 6;
  for (const m of [1, -1]) {
    const tris: number[] = [];
    for (let i = 0; i < BN - 1; i++) {
      const a = i * 2, b = i * 2 + 1, c = (i + 1) * 2, d = (i + 1) * 2 + 1;
      tris.push(a, b, c, b, d, c);
    }
    layers.push({
      color: browColor, tris,
      gen: (p) => {
        const out: THREE.Vector3[] = [];
        for (let i = 0; i < BN; i++) {
          const t = i / (BN - 1); // 0 inner .. 1 outer
          const x = hc.x + m * (eyeX - bw * 0.95 + 2 * bw * t * 0.95);
          const dy = p.brow * 0.012 * unit + (-p.angry * (0.02 * (1 - t) - 0.004 * t) + p.sad * (0.016 * (1 - t) - 0.007 * t)) * unit + 0.005 * unit * Math.sin(Math.PI * t) * (1 - 0.7 * p.angry);
          const dx = -m * p.angry * 0.004 * unit * (1 - t);
          const y = browY + dy;
          out.push(P(x + dx, y + bth / 2, 1), P(x + dx, y - bth / 2, 1));
        }
        return out;
      },
    });
  }

  // mouth: lips, inner dark, teeth
  const MN = 11;
  const mouthCurve = (p: FaceParams, u: number) => {
    const w = mouthW * p.width;
    const x = hc.x + u * w;
    const c = mouthY + p.smile * 0.0125 * unit * (u * u - 0.35) * 1.3 + 0.0015 * unit;
    const gap = p.open * 0.024 * unit;
    const shape = Math.pow(Math.max(0, 1 - u * u), 0.75);
    const up = c + 0.0038 * unit + gap * 0.34 * shape;
    const lo = c - 0.0038 * unit - gap * 0.66 * shape;
    return { x, up, lo };
  };
  const stripTris = (n: number) => {
    const t: number[] = [];
    for (let i = 0; i < n - 1; i++) { const a = i * 2, b = i * 2 + 1, c = (i + 1) * 2, d = (i + 1) * 2 + 1; t.push(a, b, c, b, d, c); }
    return t;
  };
  layers.push({
    color: lipColor, tris: stripTris(MN),
    gen: (p) => { const o: THREE.Vector3[] = []; for (let i = 0; i < MN; i++) { const u = (i / (MN - 1)) * 2 - 1; const m = mouthCurve(p, u); o.push(P(m.x, m.up, 1), P(m.x, m.lo, 1)); } return o; },
  });
  layers.push({
    color: new THREE.Color('#2e0b0d'), tris: stripTris(MN),
    gen: (p) => { const o: THREE.Vector3[] = []; for (let i = 0; i < MN; i++) { const u = (i / (MN - 1)) * 2 - 1; const m = mouthCurve(p, u); const mid = (m.up + m.lo) / 2, h = (m.up - m.lo) / 2; const k = Math.max(0, 1 - 0.16 * unit / Math.max(h, 1e-4)); const hh = h * 0.78 * (h > 0.0045 * unit ? 1 : 0.4); void k; o.push(P(m.x * 0.995 + (hc.x - m.x) * 0.005, mid + hh, 2), P(m.x * 0.995 + (hc.x - m.x) * 0.005, mid - hh, 2)); } return o; },
  });
  layers.push({
    color: new THREE.Color('#f5efe6'), tris: stripTris(MN),
    gen: (p) => { const o: THREE.Vector3[] = []; for (let i = 0; i < MN; i++) { const u = (i / (MN - 1)) * 2 - 1; const m = mouthCurve(p, u); const mid = (m.up + m.lo) / 2, h = (m.up - m.lo) / 2; const hh = h * 0.78 * (h > 0.0045 * unit ? 1 : 0.4); const top = mid + hh; const teeth = Math.max(0, Math.min(hh * 0.9, 0.006 * unit * Math.max(0, p.open * 1.6))); o.push(P(m.x * 0.995 + (hc.x - m.x) * 0.005, top, 3), P(m.x * 0.995 + (hc.x - m.x) * 0.005, top - teeth, 3)); } return o; },
  });

  // assemble base + morph targets
  const gens = (p: FaceParams) => layers.map((l) => l.gen(p));
  const baseL = gens(BASE);
  const pos: number[] = [], colors: number[] = [], idx: number[] = [];
  let off = 0;
  baseL.forEach((verts, li) => {
    for (const v of verts) { pos.push(v.x, v.y, v.z); colors.push(layers[li].color.r, layers[li].color.g, layers[li].color.b); }
    for (const t of layers[li].tris) idx.push(off + t);
    off += verts.length;
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  const headIdx = rig.index['Head'];
  const nv = pos.length / 3;
  g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(new Array(nv).fill(0).flatMap(() => [headIdx, 0, 0, 0]), 4));
  g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(new Array(nv).fill(0).flatMap(() => [1, 0, 0, 0]), 4));
  g.setIndex(idx);
  g.computeVertexNormals();
  // normals: face the camera direction (+Z) for stable flat shading
  const na = g.getAttribute('normal') as THREE.BufferAttribute;
  for (let i = 0; i < na.count; i++) na.setXYZ(i, 0, 0.2, 1);
  g.morphTargetsRelative = true;
  const morphs: THREE.BufferAttribute[] = [];
  for (const name of FACE_MORPHS) {
    const p: FaceParams = { ...BASE, ...MORPH_DEF[name] } as FaceParams;
    const arr: number[] = [];
    gens(p).forEach((verts, li) => verts.forEach((v, vi) => { const b = baseL[li][vi]; arr.push(v.x - b.x, v.y - b.y, v.z - b.z); }));
    const attr = new THREE.Float32BufferAttribute(arr, 3);
    attr.name = name;
    morphs.push(attr);
  }
  g.morphAttributes.position = morphs;
  g.computeBoundingSphere();

  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const mesh = new THREE.SkinnedMesh(g, mat);
  mesh.name = 'Face';
  mesh.updateMorphTargets();
  return mesh;
}

/** Smoothly drives face morphs: expression + auto blink + talking / chewing. */
/** exaggeration so emotions read at game-camera distance */
export const GAIN: Partial<Record<string, number>> = { smile: 1.5, smile_open: 1.4, open: 1.3, shout: 1.2, round: 1.2, frown: 1.4, brow_up: 1.6, brow_angry: 1.5, brow_sad: 1.5, squint: 1.1 };

export class FaceController {
  private cur: Record<string, number> = {};
  private goal: Record<string, number> = {};
  private blinkT = 1 + Math.random() * 3;
  private blink = 0;
  expression = 'neutral';
  intensity = 1;
  talk = 0;     // 0..1 mouth flapping amount
  chew = 0;     // 0..1 chewing amount
  blinkEnabled = true;
  private time = Math.random() * 10;
  constructor(public mesh: THREE.SkinnedMesh) { for (const m of FACE_MORPHS) { this.cur[m] = 0; this.goal[m] = 0; } }

  set(name: string, intensity = 1) {
    this.expression = EXPRESSIONS[name] ? name : 'neutral';
    this.intensity = intensity;
    for (const m of FACE_MORPHS) this.goal[m] = 0;
    const e = EXPRESSIONS[this.expression];
    for (const k of Object.keys(e) as FaceMorph[]) this.goal[k] = (e[k] ?? 0) * intensity * (GAIN[k] ?? 1);
  }

  update(dt: number) {
    this.time += dt;
    const k = 1 - Math.exp(-dt * 14);
    // blink
    this.blinkT -= dt;
    if (this.blinkEnabled && this.blinkT <= 0 && this.blink === 0) { this.blink = 0.0001; }
    if (this.blink > 0) {
      this.blink += dt / 0.16;
      if (this.blink >= 1) { this.blink = 0; this.blinkT = 1.5 + Math.random() * 4; }
    }
    const blinkV = this.blink > 0 ? Math.sin(Math.PI * this.blink) : 0;
    const infl = this.mesh.morphTargetInfluences!;
    const dict = this.mesh.morphTargetDictionary!;
    for (const m of FACE_MORPHS) {
      let g = this.goal[m];
      if (m === 'open' && this.talk > 0) g = Math.max(g, this.talk * (0.15 + 0.45 * Math.abs(Math.sin(this.time * 11) * Math.sin(this.time * 4.3 + 1))));
      if (m === 'chew' && this.chew > 0) g = Math.max(g, this.chew * (0.5 + 0.5 * Math.sin(this.time * 12)));
      this.cur[m] += (g - this.cur[m]) * k;
      let v = this.cur[m];
      if (m === 'blink') v = Math.max(v, blinkV);
      infl[dict[m]] = Math.min(1.7, Math.max(0, v));
    }
  }
}
