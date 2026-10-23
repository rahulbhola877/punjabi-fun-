import * as THREE from 'three';
import type { Rig } from './rig';
import { MeshBuilder, col, shade } from './meshBuilder';
import { jawTaper } from './face';
import type { OutfitDef, HairStyle } from './outfits';

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

export interface HeadCtx {
  mb: MeshBuilder; rig: Rig; skin: THREE.Color; hair: THREE.Color; o: OutfitDef;
  torso: (y: number) => { rx: number; rz: number };
}

/** Point on head ellipsoid. yn = -1..1, a = angle around (0 = front). */
export function headPoint(rig: Rig, yn: number, a: number, k = 1): THREE.Vector3 {
  const hc = rig.dims.headCenter, hr = rig.dims.headR;
  const r = Math.sqrt(Math.max(0, 1 - yn * yn));
  return V(hc.x + r * Math.sin(a) * hr.x * jawTaper(yn) * k, hc.y + yn * hr.y * k, hc.z + r * Math.cos(a) * hr.z * k);
}

// ------------------------------------------------------------------ turbans
export function addHeadwear(c: HeadCtx) {
  const { mb, rig, o } = c;
  const hc = rig.dims.headCenter, hr = rig.dims.headR, s = rig.dims.s;
  const kind = o.head.kind;
  if (kind === 'none') return;
  const base = col(o.head.color);
  const trim = col(o.head.trim ?? o.head.color);
  const H = 'Head';

  const bands = (n: number, y0: number, dy: number, f0: number, df: number, tube: number, zBack: number, tilt: number, c1: THREE.Color, c2: THREE.Color) => {
    for (let i = 0; i < n; i++) {
      const y = hc.y + hr.y * (y0 + dy * i);
      const f = f0 - df * i;
      const yaw = (i % 2 ? 1 : -1) * 0.1;
      mb.torus(V(hc.x, y, hc.z - hr.z * zBack * i), hr.x * f, hr.z * f * 1.02, tube, i % 2 ? c2 : c1, H, [tilt, yaw, (i % 2 ? 1 : -1) * 0.08], 16, 6);
    }
  };

  if (kind === 'dastar' || kind === 'police') {
    // dome
    mb.ellipsoid(V(hc.x, hc.y + hr.y * 0.4, hc.z - hr.z * 0.05), [hr.x * 1.19, hr.y * 0.98, hr.z * 1.2], base, H, { seg: 16, rings: 9, theta: [0, 1.5] });
    // Game addition: a dastar slopes down at the back and covers the head to
    // the nape (front edge on the forehead, back edge low on the neck), with
    // the kesh showing dark just under its edge. Without it the back of the
    // head showed bare skin, as if he were bald.
    mb.ellipsoid(V(hc.x, hc.y - hr.y * 0.02, hc.z - hr.z * 0.42), [hr.x * 1.12, hr.y * 0.82, hr.z * 0.82], shade(base, -0.02), H, { seg: 16, rings: 9 });
    mb.ellipsoid(V(hc.x, hc.y - hr.y * 0.62, hc.z - hr.z * 0.62), [hr.x * 0.78, hr.y * 0.26, hr.z * 0.42], c.hair, H, { seg: 12, rings: 6 });
    const tube = 0.018 * s * (hr.x / (0.095 * s));
    bands(5, 0.5, 0.19, 1.19, 0.07, tube, 0.04, 0.07, base, shade(base, -0.045));
    // front crossing pleats (the pointed "peak")
    mb.ellipsoid(V(hc.x - hr.x * 0.38, hc.y + hr.y * 0.78, hc.z + hr.z * 0.98), [hr.x * 0.62, hr.y * 0.1, hr.z * 0.3], shade(base, 0.03), H, { seg: 8, rings: 5, rot: [0.4, 0, 0.42] });
    mb.ellipsoid(V(hc.x + hr.x * 0.38, hc.y + hr.y * 0.78, hc.z + hr.z * 0.98), [hr.x * 0.62, hr.y * 0.1, hr.z * 0.3], shade(base, -0.03), H, { seg: 8, rings: 5, rot: [0.4, 0, -0.42] });
    // thin trim fold at the forehead edge
    mb.torus(V(hc.x, hc.y + hr.y * 0.52, hc.z - hr.z * 0.03), hr.x * 1.2, hr.z * 1.2, 0.0085 * s, trim, H, [0.08, 0, 0], 16, 5);
    if (kind === 'police') {
      const gold = col('#e3bd45');
      mb.ellipsoid(V(hc.x, hc.y + hr.y * 0.62, hc.z + hr.z * 1.16), [0.022 * s, 0.026 * s, 0.008 * s], gold, H, { seg: 8, rings: 6, rot: [0.2, 0, 0] });
      mb.ellipsoid(V(hc.x, hc.y + hr.y * 0.62, hc.z + hr.z * 1.19), [0.012 * s, 0.014 * s, 0.006 * s], col('#a0102a'), H, { seg: 8, rings: 6, rot: [0.2, 0, 0] });
      // upright fan (turla) on top
      mb.ellipsoid(V(hc.x, hc.y + hr.y * 1.18, hc.z - hr.z * 0.22), [hr.x * 0.5, hr.y * 0.42, 0.012 * s], shade(base, 0.02), H, { seg: 10, rings: 6, rot: [-0.25, 0, 0] });
    }
    if (o.head.tail) {
      // flowing shamla tail on Cape bones
      const pts = [V(hc.x, hc.y + hr.y * 0.8, hc.z - hr.z * 1.05), V(hc.x, hc.y - hr.y * 0.2, hc.z - hr.z * 1.3), rig.world['Cape_1'].a.clone().add(V(0, 0.02 * s, -0.04 * s)), rig.world['Cape_2'].a.clone().add(V(0, 0, -0.03 * s)), rig.world['Cape_3'].a.clone().add(V(0, 0, -0.03 * s)), rig.world['Cape_3'].b.clone().add(V(0, 0, -0.03 * s))];
      mb.path(pts, () => 0.05 * s, () => 0.005 * s, (t) => (t > 0.85 ? trim : t > 0.0 ? base : base), ['Head', 'Neck', 'Cape_1', 'Cape_2', 'Cape_3'], { seg: 6, ref: V(1, 0, 0), samples: 14, capEnd: true, breaks: [0.85] });
    }
  } else if (kind === 'patka' || kind === 'rumal') {
    mb.ellipsoid(V(hc.x, hc.y + hr.y * 0.1, hc.z - hr.z * 0.02), [hr.x * 1.1, hr.y * 1.08, hr.z * 1.1], base, H, { seg: 16, rings: 10, theta: [0, 1.47] });
    // forehead band
    mb.torus(V(hc.x, hc.y + hr.y * 0.4, hc.z - hr.z * 0.02), hr.x * 1.095, hr.z * 1.1, 0.011 * s, shade(base, -0.04), H, [0.16, 0, 0], 16, 5);
    // diagonal wraps
    mb.ellipsoid(V(hc.x - hr.x * 0.3, hc.y + hr.y * 0.78, hc.z + hr.z * 0.55), [hr.x * 0.75, 0.012 * s, hr.z * 0.5], shade(base, 0.04), H, { seg: 8, rings: 4, rot: [0.5, 0, 0.45] });
    mb.ellipsoid(V(hc.x + hr.x * 0.3, hc.y + hr.y * 0.78, hc.z + hr.z * 0.55), [hr.x * 0.75, 0.012 * s, hr.z * 0.5], shade(base, -0.04), H, { seg: 8, rings: 4, rot: [0.5, 0, -0.45] });
    // joora (top-knot bump)
    mb.ellipsoid(V(hc.x, hc.y + hr.y * 1.02, hc.z + hr.z * 0.2), [hr.x * 0.55, hr.y * 0.34, hr.z * 0.5], shade(base, 0.02), H, { seg: 10, rings: 7 });
    mb.ellipsoid(V(hc.x, hc.y + hr.y * 1.3, hc.z + hr.z * 0.22), [hr.x * 0.14, hr.y * 0.12, hr.z * 0.14], base, H, { seg: 6, rings: 4 });
    if (kind === 'rumal') {
      mb.ellipsoid(V(hc.x, hc.y + hr.y * 0.25, hc.z - hr.z * 1.0), [0.03 * s, 0.03 * s, 0.026 * s], shade(base, -0.05), H, { seg: 8, rings: 6 });
      mb.ellipsoid(V(hc.x + 0.03 * s, hc.y + hr.y * 0.05, hc.z - hr.z * 1.0), [0.014 * s, 0.045 * s, 0.01 * s], base, H, { seg: 6, rings: 5, rot: [0, 0, 0.3] });
      mb.ellipsoid(V(hc.x - 0.03 * s, hc.y + hr.y * 0.05, hc.z - hr.z * 1.0), [0.014 * s, 0.045 * s, 0.01 * s], base, H, { seg: 6, rings: 5, rot: [0, 0, -0.3] });
    }
  } else if (kind === 'nihang') {
    // tall conical dumala
    const n = 9;
    mb.ellipsoid(V(hc.x, hc.y + hr.y * 0.28, hc.z - hr.z * 0.04), [hr.x * 1.2, hr.y * 0.98, hr.z * 1.2], base, H, { seg: 16, rings: 8, theta: [0, 1.5] });
    for (let i = 0; i < n; i++) {
      const y = hc.y + hr.y * (0.4 + 0.2 * i);
      const f = 1.22 - 0.038 * i;
      mb.torus(V(hc.x, y, hc.z - hr.z * 0.02 * i), hr.x * f, hr.z * f * 1.02, 0.02 * s, i % 2 ? shade(base, -0.05) : base, H, [0.06, (i % 2 ? 1 : -1) * 0.1, 0], 16, 6);
    }
    mb.ellipsoid(V(hc.x, hc.y + hr.y * (0.4 + 0.2 * n) - 0.02 * s, hc.z - hr.z * 0.15), [hr.x * 0.95, hr.y * 0.3, hr.z * 0.95], base, H, { seg: 14, rings: 6, theta: [0, 1.57] });
    mb.torus(V(hc.x, hc.y + hr.y * 0.44, hc.z - hr.z * 0.03), hr.x * 1.23, hr.z * 1.23, 0.011 * s, trim, H, [0.08, 0, 0], 16, 5);
    mb.torus(V(hc.x, hc.y + hr.y * 1.4, hc.z - hr.z * 0.06), hr.x * 1.12, hr.z * 1.12, 0.009 * s, trim, H, [0.04, 0, 0], 16, 5);
  } else if (kind === 'cap') {
    const navy = base;
    mb.ellipsoid(V(hc.x, hc.y + hr.y * 0.28, hc.z - hr.z * 0.04), [hr.x * 1.12, hr.y * 0.78, hr.z * 1.14], navy, H, { seg: 16, rings: 8, theta: [0, 1.57] });
    mb.cylinder(V(hc.x, hc.y + hr.y * 0.28, hc.z - hr.z * 0.04), V(hc.x, hc.y + hr.y * 0.52, hc.z - hr.z * 0.04), hr.x * 1.12, hr.x * 1.12, navy, H, 16, false);
    mb.torus(V(hc.x, hc.y + hr.y * 0.52, hc.z - hr.z * 0.03), hr.x * 1.12, hr.z * 1.14, 0.007 * s, col(o.head.trim ?? '#d9b43a'), H, [0.12, 0, 0], 16, 5);
    // visor
    mb.ellipsoid(V(hc.x, hc.y + hr.y * 0.5, hc.z + hr.z * 1.0), [hr.x * 0.95, 0.007 * s, hr.z * 0.55], shade(navy, -0.05), H, { seg: 12, rings: 4, rot: [0.2, 0, 0] });
    mb.ellipsoid(V(hc.x, hc.y + hr.y * 0.8, hc.z + hr.z * 1.0), [0.018 * s, 0.02 * s, 0.006 * s], col('#e3bd45'), H, { seg: 8, rings: 6, rot: [0.3, 0, 0] });
  } else if (kind === 'topi') {
    // snug crocheted prayer cap (taqiyah)
    const ty = hc.y + hr.y * 0.52;
    mb.ellipsoid(V(hc.x, ty, hc.z - hr.z * 0.03), [hr.x * 0.92, hr.y * 0.6, hr.z * 0.95], base, H, { seg: 20, rings: 10, theta: [0, 1.52] });
    mb.torus(V(hc.x, ty, hc.z - hr.z * 0.03), hr.x * 0.9, hr.z * 0.93, 0.0105 * s, trim, H, [0.1, 0, 0], 20, 5);
    for (let i = 1; i <= 3; i++) {
      const k = Math.cos(i * 0.4);
      mb.torus(V(hc.x, ty + hr.y * 0.6 * Math.sin(i * 0.4), hc.z - hr.z * 0.03), hr.x * 0.92 * k, hr.z * 0.95 * k, 0.0042 * s, i % 2 ? trim : shade(base, -0.05), H, [0.0, 0, 0], 18, 4);
    }
  } else if (kind === 'gandhi') {
    // folded Gandhi cap: boat-shaped, peaked front and back
    const gy = hc.y + hr.y * 0.58;
    mb.ellipsoid(V(hc.x, gy, hc.z - hr.z * 0.02), [hr.x * 0.9, hr.y * 0.5, hr.z * 1.12], base, H, { seg: 22, rings: 10, theta: [0, 1.52] });
    mb.ellipsoid(V(hc.x, gy + hr.y * 0.08, hc.z + hr.z * 0.86), [hr.x * 0.5, hr.y * 0.16, hr.z * 0.3], shade(base, 0.02), H, { seg: 10, rings: 6, rot: [-0.3, 0, 0] });
    mb.ellipsoid(V(hc.x, gy + hr.y * 0.08, hc.z - hr.z * 0.9), [hr.x * 0.5, hr.y * 0.16, hr.z * 0.3], shade(base, 0.02), H, { seg: 10, rings: 6, rot: [0.3, 0, 0] });
    mb.torus(V(hc.x, gy, hc.z - hr.z * 0.02), hr.x * 0.9, hr.z * 1.05, 0.009 * s, shade(base, -0.06), H, [0.12, 0, 0], 22, 5);
  } else if (kind === 'pagri') {
    // loose, voluminous Punjabi pagri with a stiff turla fan
    mb.ellipsoid(V(hc.x, hc.y + hr.y * 0.44, hc.z - hr.z * 0.07), [hr.x * 1.3, hr.y * 1.02, hr.z * 1.32], base, H, { seg: 18, rings: 10, theta: [0, 1.5] });
    const tube = 0.02 * s * (hr.x / (0.095 * s));
    bands(6, 0.5, 0.17, 1.29, 0.055, tube, 0.05, 0.1, base, shade(base, -0.05));
    mb.torus(V(hc.x, hc.y + hr.y * 0.58, hc.z + hr.z * 0.02), hr.x * 1.2, hr.z * 1.22, 0.012 * s, shade(base, 0.04), H, [0.55, 0.3, 0.15], 18, 6);
    mb.torus(V(hc.x, hc.y + hr.y * 0.5, hc.z - hr.z * 0.03), hr.x * 1.26, hr.z * 1.28, 0.0085 * s, trim, H, [0.08, 0, 0], 18, 5);
    mb.ellipsoid(V(hc.x, hc.y + hr.y * 1.38, hc.z - hr.z * 0.3), [hr.x * 0.55, hr.y * 0.5, 0.013 * s], shade(base, 0.03), H, { seg: 10, rings: 6, rot: [-0.3, 0, 0] });
    mb.ellipsoid(V(hc.x, hc.y + hr.y * 1.38, hc.z - hr.z * 0.3 - 0.012 * s), [hr.x * 0.5, hr.y * 0.3, 0.004 * s], trim, H, { seg: 10, rings: 4, rot: [-0.3, 0, 0] });
    // loose tail over the back of the neck
    mb.path([V(hc.x, hc.y + hr.y * 0.1, hc.z - hr.z * 1.28), V(hc.x, hc.y - hr.y * 0.6, hc.z - hr.z * 1.4), V(hc.x + 0.01 * s, hc.y - hr.y * 1.5, hc.z - hr.z * 1.3)], () => 0.045 * s, () => 0.006 * s, (u) => (u > 0.9 ? trim : base), { Head: 1, Neck: 0.5 }, { seg: 6, samples: 8, ref: V(1, 0, 0), capEnd: true });
  }
  if (o.extras.includes('headband')) {
    mb.torus(V(hc.x, hc.y + hr.y * 0.44, hc.z - hr.z * 0.03), hr.x * 1.2, hr.z * 1.2, 0.01 * s, col('#ffffff'), H, [0.17, 0, 0], 16, 5);
  }
  if (o.extras.includes('chakkar')) {
    // steel chakkar rings on the front of the dumala
    const steel = col('#cfd5dc');
    mb.torus(V(hc.x, hc.y + hr.y * 1.1, hc.z + hr.z * 1.05), 0.06 * s, 0.06 * s, 0.006 * s, steel, H, [Math.PI / 2 - 0.3, 0, 0], 20, 4);
    mb.torus(V(hc.x, hc.y + hr.y * 1.1, hc.z + hr.z * 1.07), 0.04 * s, 0.04 * s, 0.005 * s, steel, H, [Math.PI / 2 - 0.3, 0, 0], 18, 4);
  }
}

function maleHair(c: HeadCtx, style: HairStyle, underCap = false) {
  const { mb, rig, hair } = c;
  const hc = rig.dims.headCenter, hr = rig.dims.headR;
  const H = 'Head', pi = Math.PI;
  const elder = rig.body.age === 'elder';
  let st: HairStyle = style === 'short' ? 'crop' : style;
  if (st === 'balding' && !elder) st = 'crop';
  const sh = (d: number) => shade(hair, d);
  if (st === 'balding') {
    // horseshoe of grey hair round the sides and back, bare crown
    mb.ellipsoid(V(hc.x, hc.y - hr.y * 0.02, hc.z - hr.z * 0.05), [hr.x * 1.035, hr.y * 1.03, hr.z * 1.04], sh(0), H, { seg: 20, rings: 6, phi: [pi / 2 + 0.95, pi * 2 - 1.9], theta: [pi * 0.38, pi * 0.2] });
    return;
  }
  if (underCap) {
    // only the sides and back show below a topi / Gandhi cap / peaked cap
    mb.ellipsoid(V(hc.x, hc.y + hr.y * 0.1, hc.z - hr.z * 0.06), [hr.x * 1.04, hr.y * 1.03, hr.z * 1.04], sh(-0.02), H, { seg: 20, rings: 8, phi: [pi / 2 + 0.55, pi * 2 - 1.1], theta: [pi * 0.26, pi * 0.32] });
    return;
  }
  // top cap (hairline: open face wedge) + short back/nape
  mb.ellipsoid(V(hc.x, hc.y + hr.y * 0.04, hc.z - hr.z * 0.05), [hr.x * 1.045, hr.y * 1.05, hr.z * 1.05], sh(0), H, { seg: 20, rings: 10, phi: [pi / 2 + 0.5, pi * 2 - 1.0], theta: [0, pi * 0.5] });
  mb.ellipsoid(V(hc.x, hc.y - hr.y * 0.02, hc.z - hr.z * 0.08), [hr.x * 1.04, hr.y * 1.02, hr.z * 1.04], sh(-0.03), H, { seg: 16, rings: 6, phi: [pi * 1.5 - 1.0, 2.0], theta: [pi * 0.48, pi * 0.2] });
  // front hairline across the top of the forehead
  mb.ellipsoid(V(hc.x, hc.y + hr.y * 0.8, hc.z + hr.z * 0.54), [hr.x * 0.68, hr.y * 0.16, hr.z * 0.46], sh(0.01), H, { seg: 12, rings: 6, rot: [1.0, 0, 0] });
  if (st === 'sidepart') {
    mb.ellipsoid(V(hc.x - hr.x * 0.12, hc.y + hr.y * 0.9, hc.z + hr.z * 0.3), [hr.x * 0.74, hr.y * 0.15, hr.z * 0.6], sh(0.02), H, { seg: 14, rings: 6, rot: [0.45, 0, 0.16] });
    mb.ellipsoid(V(hc.x + hr.x * 0.46, hc.y + hr.y * 0.82, hc.z + hr.z * 0.55), [hr.x * 0.3, hr.y * 0.09, hr.z * 0.26], sh(-0.04), H, { seg: 8, rings: 5, rot: [0.9, 0, -0.5] });
  }
}
// ------------------------------------------------------------------ hair, beard, glasses
export function addHair(c: HeadCtx, style: HairStyle, covered: boolean, underCap = false) {
  const { mb, rig, hair } = c;
  const hc = rig.dims.headCenter, hr = rig.dims.headR, s = rig.dims.s;
  const H = 'Head';
  const sex = rig.body.sex, kid = rig.body.age === 'kid';
  if (covered && sex === 'm') return; // hair hidden under turban
  if (sex === 'f' && c.o.dupatta?.mode === 'hijab') return; // hair fully wrapped
  if (sex === 'm') { maleHair(c, style, underCap); return; }
  const hairShade = shade(hair, 0.0);

  // skull cap with open face wedge
  if (sex === 'f' || !covered) {
    const alpha = 0.78;
    mb.ellipsoid(V(hc.x, hc.y + hr.y * 0.03, hc.z - hr.z * 0.04), [hr.x * 1.045, hr.y * 1.04, hr.z * 1.05], hairShade, H, { seg: 18, rings: 10, phi: [Math.PI / 2 + alpha, Math.PI * 2 - 2 * alpha], theta: [0, Math.PI * 0.6] });
    // fringe / front hairline across forehead (centre-parted)
    for (const m of [1, -1]) mb.ellipsoid(V(hc.x + m * hr.x * 0.4, hc.y + hr.y * 0.66, hc.z + hr.z * 0.72), [hr.x * 0.58, hr.y * 0.3, hr.z * 0.5], hairShade, H, { seg: 10, rings: 6, rot: [0.7, 0, m * -0.45] });
  }

  if (sex === 'f') {
    if (style === 'braid') {
      const w = rig.world;
      const pts = [V(hc.x, hc.y - hr.y * 0.25, hc.z - hr.z * 0.95), w['Braid_1'].a.clone(), w['Braid_2'].a.clone(), w['Braid_3'].a.clone(), w['Braid_3'].b.clone()];
      const r0 = 0.03 * s * (kid ? 0.85 : 1);
      // plaited look: alternate shades along the length
      mb.path(pts, (t) => r0 * (1 - 0.3 * t), (t) => r0 * (1 - 0.3 * t) * 0.95, (t) => (Math.floor(t * 12) % 2 ? shade(hair, 0.045) : shade(hair, -0.02)), ['Head', 'Braid_1', 'Braid_2', 'Braid_3'], { seg: 7, samples: 18, capEnd: true });
      // paranda tassel
      const end = w['Braid_3'].b;
      mb.ellipsoid(end.clone().add(V(0, -0.012 * s, 0)), [0.016 * s, 0.016 * s, 0.016 * s], col('#d9a21f'), 'Braid_3', { seg: 6, rings: 5 });
      for (const dx of [-0.012, 0, 0.012]) mb.cylinder(end.clone().add(V(dx * s, -0.02 * s, 0)), end.clone().add(V(dx * s * 1.6, -0.1 * s, 0)), 0.003 * s, 0.006 * s, col(dx === 0 ? '#e0306f' : '#f2b705'), 'Braid_3', 5, true);
    } else if (style === 'bun') {
      mb.ellipsoid(V(hc.x, hc.y + hr.y * 0.1, hc.z - hr.z * 1.12), [0.065 * s * (hr.x / (0.095 * s)), 0.058 * s, 0.055 * s], hairShade, H, { seg: 12, rings: 8 });
      mb.torus(V(hc.x, hc.y + hr.y * 0.1, hc.z - hr.z * 1.08), 0.05 * s, 0.05 * s, 0.01 * s, shade(hair, 0.05), H, [Math.PI / 2, 0, 0], 12, 4);
    } else if (style === 'loose') {
      mb.ellipsoid(V(hc.x, hc.y - hr.y * 0.8, hc.z - hr.z * 0.6), [hr.x * 1.08, hr.y * 1.05, hr.z * 0.6], hairShade, { Head: 1, Neck: 1, Chest: 0.6 }, { seg: 14, rings: 9 });
    } else if (style === 'pigtails') {
      for (const m of [1, -1]) {
        const a = V(hc.x + m * hr.x * 0.98, hc.y - hr.y * 0.1, hc.z - hr.z * 0.1);
        const b = V(hc.x + m * hr.x * 1.1, hc.y - hr.y * 1.1, hc.z - hr.z * 0.15);
        const e = V(hc.x + m * hr.x * 1.12, hc.y - hr.y * 1.9, hc.z - hr.z * 0.1);
        mb.path([a, b, e], (t) => 0.026 * s * (1 - 0.35 * t), (t) => 0.026 * s * (1 - 0.35 * t), (t) => (Math.floor(t * 8) % 2 ? shade(hair, 0.045) : shade(hair, -0.02)), { Head: 1, Neck: 0.4 }, { seg: 7, samples: 10, capEnd: true });
        mb.ellipsoid(a.clone().lerp(b, 0.12), [0.02 * s, 0.02 * s, 0.02 * s], col('#e0306f'), H, { seg: 6, rings: 5 });
        mb.ellipsoid(e.clone().add(V(0, -0.01 * s, 0)), [0.018 * s, 0.018 * s, 0.018 * s], col('#e0306f'), H, { seg: 6, rings: 5 });
      }
    }
  }
}

export function addBeard(c: HeadCtx) {
  const { mb, rig, hair } = c;
  const hr = rig.dims.headR, hc = rig.dims.headCenter, s = rig.dims.s;
  if (rig.body.sex !== 'm' || rig.body.age === 'kid') return;
  const sikhHead = ['dastar', 'patka', 'nihang', 'rumal', 'police'].includes(c.o.head.kind);
  const mode = c.o.facial ?? (sikhHead ? 'full' : 'moustache');
  if (mode === 'none') return;
  const elder = rig.body.age === 'elder';
  const bc = elder ? col('#e9e6df') : hair.clone();
  const W = ['Head'];
  const rowPts = (yBase: number, depth: number, k: number, ext: number) => {
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= 12; i++) {
      const a = -1.4 + (2.8 * i) / 12;
      const cosA = Math.cos(a);
      const yn = yBase - depth * cosA * cosA;
      const p = headPoint(rig, yn, a, k);
      p.y -= ext * cosA * cosA * s;
      p.z += ext * 0.35 * cosA * cosA * s;
      pts.push(p);
    }
    return pts;
  };
  const full = mode === 'full' || mode === 'sunnah' || mode === 'trim';
  const thickK = mode === 'trim' ? 0.55 : 1, extK = mode === 'trim' ? 0.3 : 1;
  const thick = 0.021 * s * thickK;
  const bshade = (t: number) => shade(bc, Math.sin(t * 40) * 0.012);
  if (full) mb.path(rowPts(-0.3, 0.62, 0.97, 0.026 * extK), (t) => thick * (0.75 + 0.5 * Math.sin(Math.PI * t)), (t) => thick * (0.75 + 0.5 * Math.sin(Math.PI * t)), bshade, W, { seg: 7, samples: 26, capStart: true, capEnd: true });
  // fuller lower row
  if (full) mb.path(rowPts(-0.52, 0.5, 0.95, 0.045 * extK), (t) => thick * (0.55 + 0.75 * Math.sin(Math.PI * t)), (t) => thick * (0.5 + 0.8 * Math.sin(Math.PI * t)), bshade, W, { seg: 7, samples: 26, capStart: true, capEnd: true });
  // sideburns up to the ears
  if (full) for (const m of [1, -1]) {
    const a = headPoint(rig, 0.05, m * 1.45, 0.98), b = headPoint(rig, -0.35, m * 1.42, 0.98);
    mb.cylinder(a, b, 0.012 * s, 0.016 * s, bc, W, 6, true);
  }
  if (mode === 'stubble') {
    const g = new THREE.SphereGeometry(1, 26, 12, Math.PI / 2 - 1.2, 2.4, Math.PI * 0.55, Math.PI * 0.4);
    const pa = g.getAttribute('position') as THREE.BufferAttribute;
    for (let i = 0; i < pa.count; i++) pa.setX(i, pa.getX(i) * jawTaper(pa.getY(i)));
    mb.geom(g, new THREE.Matrix4().compose(hc, new THREE.Quaternion(), V(hr.x * 1.012, hr.y * 1.012, hr.z * 1.012)), c.skin.clone().lerp(bc, 0.42), 'Head');
    return;
  }
  if (mode === 'sunnah') return; // shaved upper lip
  // twirled Punjabi moustache (flatter when the beard is trimmed)
  const tw = mode === 'full' || mode === 'moustache' ? 1 : 0.3;
  const y0 = hc.y - hr.y * 0.39;
  const zf = (x: number, y: number) => {
    const yn = (y - hc.y) / hr.y;
    return hc.z + hr.z * Math.sqrt(Math.max(0.02, 1 - ((x - hc.x) / (hr.x * jawTaper(yn))) ** 2 - yn * yn));
  };
  for (const m of [1, -1]) {
    const xs = [0.004, 0.022, 0.042, 0.058, 0.066], ys = [0, -0.003, 0.0, 0.012, 0.027].map((v) => v * tw), dz = [0.01, 0.008, 0.002, -0.006, -0.012];
    const pts = xs.map((x, i) => {
      const X = hc.x + m * x * s, Y = y0 + ys[i] * s;
      return V(X, Y, zf(X, Y) + dz[i] * s + 0.004 * s);
    });
    mb.path(pts, (t) => 0.0125 * s * (1 - 0.8 * t) + 0.002 * s, (t) => 0.0105 * s * (1 - 0.8 * t) + 0.002 * s, () => shade(bc, 0.0), W, { seg: 6, samples: 8, capStart: true, capEnd: true });
  }
}

export function addGlasses(c: HeadCtx) {
  const { mb, rig } = c;
  const hr = rig.dims.headR, hc = rig.dims.headCenter, s = rig.dims.s;
  const eyeX = hr.x * 0.42, eyeY = hc.y + hr.y * 0.04;
  const frame = col('#2b2b30');
  const z = hc.z + hr.z * 0.93;
  for (const m of [1, -1]) {
    mb.torus(V(hc.x + m * eyeX, eyeY, z + 0.01 * s), 0.027 * s, 0.025 * s, 0.0026 * s, frame, 'Head', [Math.PI / 2, 0, 0], 16, 4);
    mb.cylinder(V(hc.x + m * (eyeX + 0.026 * s), eyeY + 0.004 * s, z + 0.008 * s), V(hc.x + m * hr.x * 0.99, eyeY + 0.004 * s, hc.z + hr.z * 0.15), 0.0022 * s, 0.0022 * s, frame, 'Head', 4, false);
  }
  mb.cylinder(V(hc.x - eyeX + 0.026 * s, eyeY + 0.006 * s, z + 0.01 * s), V(hc.x + eyeX - 0.026 * s, eyeY + 0.006 * s, z + 0.01 * s), 0.002 * s, 0.002 * s, frame, 'Head', 4, false);
}

export function addFaceJewellery(c: HeadCtx) {
  const { mb, rig, o } = c;
  const hr = rig.dims.headR, hc = rig.dims.headCenter, s = rig.dims.s;
  const gold = col('#e3b83e');
  if (o.extras.includes('earrings')) {
    for (const m of [1, -1]) {
      const p = V(hc.x + m * hr.x * 1.0, hc.y - hr.y * 0.22, hc.z - 0.02 * s);
      mb.ellipsoid(p, [0.008 * s, 0.008 * s, 0.008 * s], gold, 'Head', { seg: 6, rings: 5 });
      mb.torus(p.clone().add(V(0, -0.016 * s, 0)), 0.013 * s, 0.013 * s, 0.0025 * s, gold, 'Head', [0, 0, Math.PI / 2], 10, 4);
    }
  }
  if (o.extras.includes('tikka')) {
    const p = headPoint(rig, 0.52, 0, 1.0); p.z += 0.003 * s;
    mb.ellipsoid(p.clone().add(V(0, -0.02 * s, 0.002 * s)), [0.011 * s, 0.014 * s, 0.006 * s], gold, 'Head', { seg: 8, rings: 6 });
    mb.ellipsoid(p.clone().add(V(0, -0.02 * s, 0.006 * s)), [0.005 * s, 0.006 * s, 0.004 * s], col('#c4122f'), 'Head', { seg: 6, rings: 4 });
    // chain along the parting
    const pts = [headPoint(rig, 0.52, 0, 1.0), headPoint(rig, 0.82, 0, 1.02), headPoint(rig, 1.0, 0, 1.03)];
    mb.path(pts, () => 0.0028 * s, () => 0.0028 * s, () => gold, 'Head', { seg: 4, samples: 4 });
  }
  if (o.extras.includes('bindi')) {
    const p = headPoint(rig, 0.31, 0, 1.0); p.z += 0.002 * s;
    mb.ellipsoid(p, [0.0075 * s, 0.0075 * s, 0.004 * s], col('#c4122f'), 'Head', { seg: 8, rings: 6 });
  }
  if (o.extras.includes('tilak')) {
    const p = headPoint(rig, 0.45, 0, 1.0); p.z += 0.002 * s;
    mb.ellipsoid(p, [0.0062 * s, 0.021 * s, 0.0035 * s], col('#d8321f'), 'Head', { seg: 8, rings: 6 });
    mb.ellipsoid(p.clone().add(V(0, 0.0, -0.001 * s)), [0.016 * s, 0.0045 * s, 0.003 * s], col('#f2b84a'), 'Head', { seg: 8, rings: 4 });
    mb.ellipsoid(p.clone().add(V(0, 0.0125 * s, -0.001 * s)), [0.014 * s, 0.0035 * s, 0.003 * s], col('#f2b84a'), 'Head', { seg: 8, rings: 4 });
  }
  if (o.extras.includes('sindoor') && rig.body.age !== 'kid') {
    const pts = [headPoint(rig, 0.7, 0, 1.06), headPoint(rig, 0.88, 0, 1.075), headPoint(rig, 1.0, 0, 1.09)];
    mb.path(pts, () => 0.0035 * s, () => 0.0035 * s, () => col('#c8101e'), 'Head', { seg: 4, samples: 6 });
  }
  if (o.extras.includes('nose_pin')) {
    const p = V(hc.x + hr.x * 0.115, hc.y - hr.y * 0.3, hc.z + hr.z * 0.93);
    mb.ellipsoid(p, [0.0055 * s, 0.0055 * s, 0.0055 * s], gold, 'Head', { seg: 6, rings: 4 });
  }
}

// ------------------------------------------------------------------ dupatta
export function addDupatta(c: HeadCtx) {
  const { mb, rig, o } = c;
  const d = o.dupatta;
  if (!d) return;
  const s = rig.dims.s, D = rig.dims, w = rig.world;
  const base = col(d.color), trim = col(d.trim);
  const wide = d.wide ? 1.6 : 1;
  const stripe = (t: number, n = 24): THREE.Color => {
    if (d.pattern === 'phulkari') {
      const k = Math.floor(t * n);
      if (t < 0.05 || t > 0.95) return trim;
      return k % 6 === 0 ? trim : k % 6 === 3 ? shade(base, 0.07) : k % 6 === 4 ? shade(trim, -0.1) : base;
    }
    return Math.floor(t * 14) % 7 === 0 ? trim : base;
  };
  const stripeBreaks = () => (d.pattern === 'phulkari' ? Array.from({ length: 23 }, (_, i) => (i + 1) / 24).concat([0.05, 0.95]) : Array.from({ length: 13 }, (_, i) => (i + 1) / 14).filter((_, i) => i % 7 === 6 || i % 7 === 0));
  const hc = D.headCenter, hr = D.headR;
  const torso = c.torso;
  const W = ['Chest', 'Spine', 'Neck', 'Hips'];
  const thick = 0.0055 * s;

  const frontRibbon = (m: number, hem: number) => {
    const yN = D.neckY, yS = D.shoulderY, yC = D.chestY, ySp = D.spineY;
    const tc = torso(yC + 0.06 * s), tw = torso(ySp), th = torso(D.hipsY - 0.02 * s);
    const pts = [
      V(m * 0.05 * s, yN + 0.006 * s, -0.062 * s),
      V(m * 0.115 * s * 1.0, yS + 0.012 * s, 0.0),
      V(m * tc.rx * 0.62, yC + 0.06 * s, tc.rz * 0.8 + 0.022 * s),
      V(m * tw.rx * 0.6, ySp, tw.rz * 0.92 + 0.022 * s),
      V(m * th.rx * 0.66, D.hipsY - hem * s, th.rz * 0.95 + 0.026 * s),
    ];
    mb.path(pts, () => 0.04 * s * wide, () => thick, (t) => stripe(t), W, { seg: 6, samples: 18, ref: V(1, 0, 0), breaks: stripeBreaks() });
  };
  if (d.mode === 'drape') {
    // diagonal sash from left shoulder to right hip + back tail
    const yS = D.shoulderY, tw = torso(D.spineY);
    const pts = [V(0.06 * s, D.neckY + 0.006 * s, -0.06 * s), V(0.12 * s, yS + 0.012 * s, 0), V(0.05 * s, D.chestY + 0.02 * s, torso(D.chestY).rz + 0.022 * s), V(-0.07 * s, D.spineY, tw.rz + 0.022 * s), V(-0.13 * s, D.hipsY - 0.12 * s, torso(D.hipsY).rz * 0.9 + 0.026 * s)];
    mb.path(pts, () => 0.05 * s, () => thick, (t) => stripe(t), W, { seg: 6, samples: 18, ref: V(1, 0, 0), breaks: stripeBreaks() });
  } else if (d.mode !== 'hijab') {
    frontRibbon(1, 0.22);
    frontRibbon(-1, 0.3);
  }
  // back tail on Cape bones
  const backPts = [V(0, D.neckY + 0.005 * s, -0.065 * s), V(0, D.chestY + 0.05 * s, -torso(D.chestY).rz - 0.02 * s), w['Cape_1'].a.clone().add(V(0, 0, -0.012 * s)), w['Cape_2'].a.clone().add(V(0, 0, -0.012 * s)), w['Cape_3'].a.clone().add(V(0, 0, -0.012 * s)), w['Cape_3'].b.clone().add(V(0, 0, -0.012 * s))];
  mb.path(backPts, () => 0.09 * s * wide, () => thick, (t) => stripe(t), ['Chest', 'Neck', 'Cape_1', 'Cape_2', 'Cape_3'], { seg: 6, samples: 18, ref: V(1, 0, 0), capEnd: true, breaks: stripeBreaks() });

  if (d.mode === 'head' || d.mode === 'hijab') {
    // hood over the hair, open at the face; trim along the opening
    const hij = d.mode === 'hijab';
    const edge = hij ? 0.78 : 0.95;
    const cc = (p: THREE.Vector3) => {
      const ang = Math.abs(Math.atan2(p.x - hc.x, p.z - hc.z));
      return ang < edge + 0.12 && p.y > hc.y - hr.y * 0.2 || Math.abs(ang - edge) < 0.1 ? trim : base;
    };
    mb.ellipsoid(V(hc.x, hc.y + hr.y * 0.02, hc.z - hr.z * 0.05), [hr.x * 1.16, hr.y * 1.12, hr.z * 1.17], (p) => (Math.abs(Math.abs(Math.atan2(p.x - hc.x, p.z - hc.z)) - (edge + 0.04)) < 0.1 ? trim : base), 'Head',
      { seg: 22, rings: 12, phi: [Math.PI / 2 + edge + 0.02, Math.PI * 2 - 2 * edge - 0.04], theta: [0, Math.PI * (hij ? 0.9 : 0.78)] });
    void cc;
    // shoulders cover
    mb.ellipsoid(V(hc.x, D.neckY - 0.02 * s, -0.025 * s), [(hij ? 0.155 : 0.13) * s, (hij ? 0.085 : 0.06) * s, (hij ? 0.115 : 0.1) * s], base, { Neck: 1, Chest: 1, Head: 0.3 }, { seg: 12, rings: 8, theta: [0, 1.9] });
  }
}
