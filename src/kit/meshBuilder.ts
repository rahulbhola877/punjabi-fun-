// @ts-nocheck -- vendored from the punjab-characters kit (unused locals only); keep in sync with vendor/.
import * as THREE from 'three';
import type { Rig } from './rig';

/** Weight spec: single bone | list of candidate bones (auto envelope) | biased candidates | custom fn */
export type WeightSpec =
  | string
  | string[]
  | Record<string, number>
  | ((p: THREE.Vector3) => [number, number][]);

export interface Ring {
  c: THREE.Vector3;
  rx: number;
  rz: number;
  color: THREE.Color;
}

const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _ab = new THREE.Vector3(), _ap = new THREE.Vector3();

function distToSeg(p: THREE.Vector3, a: THREE.Vector3, b: THREE.Vector3): number {
  _ab.subVectors(b, a);
  _ap.subVectors(p, a);
  const l2 = _ab.lengthSq();
  let t = l2 > 1e-12 ? _ap.dot(_ab) / l2 : 0;
  t = Math.max(0, Math.min(1, t));
  _a.copy(a).addScaledVector(_ab, t);
  return _a.distanceTo(p);
}

export const col = (c: string | number | THREE.Color) => (c instanceof THREE.Color ? c.clone() : new THREE.Color(c as any));
export const shade = (c: THREE.Color | string, k: number) => {
  const o = col(c);
  o.offsetHSL(0, 0, k);
  return o;
};

/** Accumulates vertex-coloured, skinned geometry (single draw call for the whole outfit). */
export class MeshBuilder {
  pos: number[] = [];
  colr: number[] = [];
  skinI: number[] = [];
  skinW: number[] = [];
  idx: number[] = [];
  constructor(public rig: Rig) {}

  get vertexCount() { return this.pos.length / 3; }

  weights(p: THREE.Vector3, spec: WeightSpec): [number, number][] {
    if (typeof spec === 'function') return spec(p);
    if (typeof spec === 'string') return [[this.rig.index[spec], 1]];
    let names: string[]; let bias: Record<string, number> = {};
    if (Array.isArray(spec)) names = spec; else { names = Object.keys(spec); bias = spec; }
    if (names.length === 1) return [[this.rig.index[names[0]], 1]];
    const arr: [number, number][] = [];
    for (const n of names) {
      const seg = this.rig.world[n];
      const d = distToSeg(p, seg.a, seg.b);
      const w = (bias[n] ?? 1) / Math.pow(d * d + 2e-5, 1.5);
      arr.push([this.rig.index[n], w]);
    }
    arr.sort((x, y) => y[1] - x[1]);
    const top = arr.slice(0, 3);
    const sum = top.reduce((s, t) => s + t[1], 0);
    return top.map(([i, w]) => [i, w / sum]);
  }

  vertex(p: THREE.Vector3, c: THREE.Color, w: WeightSpec): number {
    const n = this.vertexCount;
    this.pos.push(p.x, p.y, p.z);
    this.colr.push(c.r, c.g, c.b);
    const ws = this.weights(p, w);
    for (let k = 0; k < 4; k++) {
      if (k < ws.length) { this.skinI.push(ws[k][0]); this.skinW.push(ws[k][1]); }
      else { this.skinI.push(0); this.skinW.push(0); }
    }
    return n;
  }

  /** Add any three.js geometry transformed by `m`. */
  geom(g: THREE.BufferGeometry, m: THREE.Matrix4, color: THREE.Color | string | ((p: THREE.Vector3) => THREE.Color), w: WeightSpec) {
    const pa = g.getAttribute('position') as THREE.BufferAttribute;
    const base = this.vertexCount;
    const p = new THREE.Vector3();
    const flip = m.determinant() < 0;
    const cc = typeof color === 'function' ? color : (() => { const k = col(color as any); return () => k; })();
    for (let i = 0; i < pa.count; i++) {
      p.fromBufferAttribute(pa, i).applyMatrix4(m);
      this.vertex(p, cc(p), w);
    }
    const ix = g.index;
    const tri = (a: number, b: number, c: number) => {
      if (flip) this.idx.push(base + a, base + c, base + b); else this.idx.push(base + a, base + b, base + c);
    };
    if (ix) for (let i = 0; i < ix.count; i += 3) tri(ix.getX(i), ix.getX(i + 1), ix.getX(i + 2));
    else for (let i = 0; i < pa.count; i += 3) tri(i, i + 1, i + 2);
  }

  ellipsoid(c: THREE.Vector3, r: [number, number, number], color: THREE.Color | string | ((p: THREE.Vector3) => THREE.Color), w: WeightSpec,
    opts: { seg?: number; rings?: number; rot?: [number, number, number]; phi?: [number, number]; theta?: [number, number] } = {}) {
    const seg = opts.seg ?? 10, rings = opts.rings ?? 7;
    const g = new THREE.SphereGeometry(1, seg, rings, opts.phi?.[0] ?? 0, opts.phi?.[1] ?? Math.PI * 2, opts.theta?.[0] ?? 0, opts.theta?.[1] ?? Math.PI);
    const m = new THREE.Matrix4().compose(c, new THREE.Quaternion().setFromEuler(new THREE.Euler(...(opts.rot ?? [0, 0, 0]))), new THREE.Vector3(...r));
    this.geom(g, m, color, w);
    g.dispose();
  }

  box(c: THREE.Vector3, size: [number, number, number], color: THREE.Color | string | ((p: THREE.Vector3) => THREE.Color), w: WeightSpec, rot: [number, number, number] = [0, 0, 0]) {
    const g = new THREE.BoxGeometry(1, 1, 1);
    const m = new THREE.Matrix4().compose(c, new THREE.Quaternion().setFromEuler(new THREE.Euler(...rot)), new THREE.Vector3(...size));
    this.geom(g, m, color, w);
    g.dispose();
  }

  torus(c: THREE.Vector3, rx: number, rz: number, tube: number, color: THREE.Color | string, w: WeightSpec, rot: [number, number, number] = [0, 0, 0], seg = 14, tseg = 5) {
    // torus lies in XY by default -> rotate so it lies in XZ (horizontal ring)
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2, 0, 0));
    const q2 = new THREE.Quaternion().setFromEuler(new THREE.Euler(...rot));
    q2.multiply(q);
    // scale in local ring plane: x -> rx, y(before rotation) -> rz ; tube thickness scaled uniformly by min
    const m = new THREE.Matrix4().compose(c, q2, new THREE.Vector3(rx, rz, Math.min(rx, rz)));
    const g2 = new THREE.TorusGeometry(1, tube / Math.min(rx, rz), tseg, seg);
    this.geom(g2, m, color, w);
    g2.dispose();
  }

  cylinder(a: THREE.Vector3, b: THREE.Vector3, r0: number, r1: number, color: THREE.Color | string, w: WeightSpec, seg = 8, cap = true) {
    const len = a.distanceTo(b);
    const g = new THREE.CylinderGeometry(r1, r0, len, seg, 1, !cap);
    const dir = b.clone().sub(a).normalize();
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    const m = new THREE.Matrix4().compose(a.clone().add(b).multiplyScalar(0.5), q, new THREE.Vector3(1, 1, 1));
    this.geom(g, m, color, w);
    g.dispose();
  }

  /** Lofted tube through rings (elliptical cross-sections). */
  loft(rings: Ring[], w: WeightSpec, o: { seg?: number; capStart?: boolean; capEnd?: boolean; ref?: THREE.Vector3; closed?: boolean } = {}) {
    const seg = o.seg ?? 10;
    const n = rings.length;
    if (n < 2) return;
    const ref0 = o.ref ?? new THREE.Vector3(1, 0, 0);
    const dirs: THREE.Vector3[] = [];
    for (let i = 0; i < n; i++) {
      let i0 = i, i1 = i;
      while (i0 > 0 && rings[i0].c.distanceTo(rings[i].c) < 1e-6) i0--;
      while (i1 < n - 1 && rings[i1].c.distanceTo(rings[i].c) < 1e-6) i1++;
      if (i0 === i) { let k = i; while (k < n - 1 && rings[k].c.distanceTo(rings[i].c) < 1e-6) k++; i1 = Math.max(i1, k); }
      const d = rings[i1].c.clone().sub(rings[i0].c);
      if (d.lengthSq() < 1e-12) d.copy(dirs[i - 1] ?? new THREE.Vector3(0, -1, 0));
      dirs.push(d.normalize());
    }
    const base = this.vertexCount;
    const ringVerts: THREE.Vector3[][] = [];
    for (let i = 0; i < n; i++) {
      const wv = dirs[i];
      let ref = ref0;
      if (Math.abs(ref.dot(wv)) > 0.95) ref = new THREE.Vector3(0, 0, 1);
      const u = ref.clone().addScaledVector(wv, -ref.dot(wv)).normalize();
      const v = new THREE.Vector3().crossVectors(wv, u).normalize();
      const arr: THREE.Vector3[] = [];
      for (let j = 0; j < seg; j++) {
        const t = (j / seg) * Math.PI * 2;
        arr.push(rings[i].c.clone().addScaledVector(u, Math.cos(t) * rings[i].rx).addScaledVector(v, Math.sin(t) * rings[i].rz));
      }
      ringVerts.push(arr);
      for (let j = 0; j < seg; j++) this.vertex(arr[j], rings[i].color, w);
    }
    for (let i = 0; i < n - 1; i++) {
      for (let j = 0; j < seg; j++) {
        const j1 = (j + 1) % seg;
        const a = base + i * seg + j, b = base + i * seg + j1, c = base + (i + 1) * seg + j, d = base + (i + 1) * seg + j1;
        this.idx.push(a, b, c, b, d, c);
      }
    }
    const cap = (i: number, start: boolean) => {
      const cen = this.vertex(rings[i].c, rings[i].color, w);
      const vs: number[] = [];
      for (let j = 0; j < seg; j++) vs.push(this.vertex(ringVerts[i][j], rings[i].color, w));
      for (let j = 0; j < seg; j++) {
        const j1 = (j + 1) % seg;
        if (start) this.idx.push(cen, vs[j1], vs[j]); else this.idx.push(cen, vs[j], vs[j1]);
      }
    };
    if (o.capStart) cap(0, true);
    if (o.capEnd) cap(n - 1, false);
  }

  /** Simple helper: build rings along a polyline with radius/colour profile functions. */
  path(points: THREE.Vector3[], rx: (t: number) => number, rz: (t: number) => number, color: (t: number) => THREE.Color, w: WeightSpec,
    o: { seg?: number; capStart?: boolean; capEnd?: boolean; ref?: THREE.Vector3; breaks?: number[]; samples?: number } = {}) {
    const curve = new THREE.CatmullRomCurve3(points, false, 'centripetal');
    const N = o.samples ?? Math.max(4, points.length * 2);
    const ts: number[] = [];
    for (let i = 0; i <= N; i++) ts.push(i / N);
    const rings: Ring[] = [];
    const bks = o.breaks ?? [];
    const all = [...ts, ...bks].sort((a, b) => a - b);
    for (const t of all) {
      const isBreak = bks.includes(t);
      const c = curve.getPoint(t);
      if (isBreak) {
        rings.push({ c, rx: rx(t - 1e-4), rz: rz(t - 1e-4), color: color(t - 1e-4) });
        rings.push({ c: c.clone(), rx: rx(t + 1e-4), rz: rz(t + 1e-4), color: color(t + 1e-4) });
      } else rings.push({ c, rx: rx(t), rz: rz(t), color: color(t) });
    }
    this.loft(rings, w, o);
  }

  build(): THREE.BufferGeometry {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.colr, 3));
    g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(this.skinI, 4));
    g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(this.skinW, 4));
    g.setIndex(this.idx);
    g.computeVertexNormals();
    g.computeBoundingSphere();
    return g;
  }
}
