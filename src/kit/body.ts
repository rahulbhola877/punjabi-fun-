// @ts-nocheck -- vendored from the punjab-characters kit (unused locals only); keep in sync with vendor/.
import * as THREE from 'three';
import type { Rig } from './rig';
import { MeshBuilder, col, shade } from './meshBuilder';
import type { OutfitDef, BottomKind, HemLen } from './outfits';
import { jawTaper } from './face';
import { addBeard, addDupatta, addFaceJewellery, addGlasses, addHair, addHeadwear, type HeadCtx } from './headwear';

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export interface BuildColors { skin: string; hair: string; }

/** Leg radius profile [hip, knee, calf, ankle] per bottom kind (metres @ s = 1) */
const LEG_PROFILE: Record<BottomKind, [number, number, number, number]> = {
  pajama: [0.105, 0.092, 0.086, 0.078], patiala: [0.108, 0.105, 0.092, 0.046], salwar: [0.108, 0.094, 0.078, 0.042], churidar: [0.1, 0.082, 0.06, 0.04],
  trousers: [0.098, 0.082, 0.078, 0.072], jeans: [0.092, 0.07, 0.066, 0.058], shorts: [0.1, 0.08, 0.06, 0.04], chadra: [0.082, 0.06, 0.056, 0.038],
  lehenga: [0.082, 0.06, 0.056, 0.038], skirt: [0.085, 0.062, 0.058, 0.038], leggings: [0.088, 0.062, 0.058, 0.04],
};
const SKIN_LEG: [number, number, number, number] = [0.085, 0.06, 0.056, 0.036];

export function buildBodyGeometry(rig: Rig, o: OutfitDef, colors: BuildColors, opts: { hair?: string } = {}) {
  const mb = new MeshBuilder(rig);
  const s = rig.dims.s, D = rig.dims, bd = rig.body, W = rig.world;
  const skin = col(colors.skin), hair = col(colors.hair);
  const top = o.top, outer = o.outer;
  const topC = col(top.color), trimC = col(top.trim ?? top.color);
  const botC = col(o.bottom.color);
  const kid = bd.age === 'kid', fem = bd.sex === 'f';
  const limb = bd.limb;

  // ------------------------------------------------ torso profile table
  const sh = D.shoulderX;
  const [cRx, cRz] = bd.chest, [wRx, wRz] = bd.waist, [hRx, hRz] = bd.hip;
  const bust = fem && !kid ? 1.1 : 1;
  const table: { y: number; rx: number; rz: number }[] = [
    { y: D.neckY + 0.014 * s, rx: 0.057 * s * limb ** 0.3, rz: 0.057 * s * limb ** 0.3 },
    { y: D.neckY - 0.012 * s, rx: 0.1 * s, rz: 0.075 * s },
    { y: D.shoulderY - 0.004 * s, rx: sh * 0.82, rz: cRz * s * 0.82 },
    { y: D.shoulderY - 0.05 * s, rx: cRx * s * 1.0, rz: cRz * s * 0.98 * bust },
    { y: D.chestY + 0.0 * s, rx: cRx * s * 0.98, rz: cRz * s * bust },
    { y: lerp(D.chestY, D.spineY, 0.6), rx: lerp(cRx, wRx, 0.65) * s, rz: lerp(cRz, wRz, 0.6) * s },
    { y: D.spineY, rx: wRx * s, rz: wRz * s },
    { y: D.hipsY + 0.01 * s, rx: hRx * s * 0.98, rz: hRz * s * 0.98 },
    { y: D.hipsY - 0.07 * s, rx: hRx * s * 1.0, rz: hRz * s * 1.0 },
  ];
  const torso = (y: number) => {
    if (y >= table[0].y) return { rx: table[0].rx, rz: table[0].rz };
    for (let i = 0; i < table.length - 1; i++) {
      const a = table[i], b = table[i + 1];
      if (y <= a.y && y >= b.y) { const t = (a.y - y) / (a.y - b.y); return { rx: lerp(a.rx, b.rx, t), rz: lerp(a.rz, b.rz, t) }; }
    }
    const l = table[table.length - 1];
    return { rx: l.rx, rz: l.rz };
  };

  const skirtW = (p: THREE.Vector3): [number, number][] => {
    const k = Math.min(1, Math.max(0, (D.hipsY - 0.02 * s - p.y) / (D.hipsY - D.kneeY))) * 0.78;
    const sL = Math.min(1, Math.max(0, (p.x + 0.1 * s) / (0.2 * s)));
    const arr: [number, number][] = [[rig.index['Hips'], 1 - k], [rig.index['UpperLeg_L'], k * sL], [rig.index['UpperLeg_R'], k * (1 - sL)]];
    return arr.filter((a) => a[1] > 1e-4);
  };
  const torsoW = (p: THREE.Vector3) => (p.y >= D.hipsY - 0.03 * s ? mb.weights(p, ['Hips', 'Spine', 'Chest', 'Neck']) : skirtW(p));

  // ------------------------------------------------ head
  const hc = D.headCenter, hr = D.headR;
  {
    const g = new THREE.SphereGeometry(1, 28, 18);
    const pa = g.getAttribute('position') as THREE.BufferAttribute;
    for (let i = 0; i < pa.count; i++) pa.setX(i, pa.getX(i) * jawTaper(pa.getY(i)));
    mb.geom(g, new THREE.Matrix4().compose(hc, new THREE.Quaternion(), hr), skin, 'Head');
    g.dispose();
    // nose, ears
    mb.ellipsoid(V(hc.x, hc.y - hr.y * 0.2, hc.z + hr.z * 0.93), [hr.x * 0.15, hr.y * 0.15, hr.z * 0.16], shade(skin, -0.025), 'Head', { seg: 8, rings: 6 });
    for (const m of [1, -1]) mb.ellipsoid(V(hc.x + m * hr.x * 0.99, hc.y - hr.y * 0.04, hc.z - hr.z * 0.04), [hr.x * 0.15, hr.y * 0.19, hr.z * 0.13], shade(skin, -0.03), 'Head', { seg: 8, rings: 6 });
    // neck
    const nr = 0.05 * s * limb ** 0.3 * (kid ? 0.95 : 1);
    mb.loft([
      { c: V(0, D.neckY - 0.03 * s, 0), rx: nr * 1.1, rz: nr * 1.05, color: skin },
      { c: V(0, D.neckY + 0.03 * s, 0.004 * s), rx: nr, rz: nr, color: skin },
      { c: V(0, rig.world['Head'].a.y + 0.045 * s, 0.01 * s), rx: nr * 0.95, rz: nr * 0.95, color: skin },
    ], ['Chest', 'Neck', 'Head'], { seg: 9 });
  }

  // ------------------------------------------------ torso garment
  const hemY = (len: HemLen): number => {
    switch (len) {
      case 'crop': return D.spineY + 0.015 * s;
      case 'hip': return D.hipsY - 0.07 * s;
      case 'thigh': return D.hipsY - 0.22 * s;
      case 'knee': return D.kneeY + 0.07 * s;
      case 'calf': return D.kneeY - 0.17 * s;
    }
  };
  const loose: Record<string, number> = { kurta: 1.12, kameez: 1.06, chola: 1.1, hoodie: 1.1, shirt: 1.0, tee: 1.0, uniform: 1.0, jersey: 1.03, choli: 0.99, kurti: 1.04 };
  const isLong = (l: HemLen) => l === 'thigh' || l === 'knee' || l === 'calf';
  {
    const lo = (loose[top.kind] ?? 1) * (fem && top.kind === 'kameez' ? 1.08 : 1);
    const y0 = hemY(top.len);
    const rings: { c: THREE.Vector3; rx: number; rz: number; color: THREE.Color }[] = [];
    const add = (y: number, rx: number, rz: number, c: THREE.Color) => rings.push({ c: V(0, y, 0), rx, rz, color: c });
    const tuckedY = D.hipsY - 0.07 * s;
    const bodyEnd = Math.max(y0, tuckedY);
    for (const t of table) {
      if (t.y < bodyEnd - 1e-4) break;
      const k = t.y < D.shoulderY - 0.05 * s ? lo : 1;
      add(t.y, t.rx * k + (t.y < D.shoulderY - 0.05 * s ? 0.004 * s : 0), t.rz * k + (t.y < D.shoulderY - 0.05 * s ? 0.004 * s : 0), topC);
    }
    if (top.kind === 'choli' || top.len === 'crop') {
      // bare midriff handled by choli ending at y0; add cap below
      const t = torso(y0);
      add(y0, t.rx * lo, t.rz * lo, topC);
    } else if (isLong(top.len)) {
      const bt = torso(tuckedY);
      const fl = (y: number) => { const f = (tuckedY - y) / (tuckedY - D.kneeY); return 1 + (fem ? 0.34 : 0.22) * Math.max(0, Math.min(1.4, f)); };
      const steps = top.len === 'thigh' ? 2 : 4;
      for (let i = 1; i <= steps; i++) {
        const y = lerp(tuckedY, y0, i / steps);
        const f = fl(y);
        add(y, bt.rx * lo * f * 1.02, bt.rz * lo * f * 1.0, topC);
      }
      // trim hem band
      if (top.trim && (top.kind === 'kameez' || top.kind === 'kurta' || top.kind === 'chola')) {
        const last = rings[rings.length - 1];
        rings.push({ c: V(0, y0 + 0.03 * s, 0), rx: last.rx * 0.995, rz: last.rz * 0.995, color: topC });
        rings.push({ c: V(0, y0 + 0.03 * s, 0), rx: last.rx * 0.998, rz: last.rz * 0.998, color: trimC });
        rings.push({ c: V(0, y0, 0), rx: last.rx, rz: last.rz, color: trimC });
      }
    } else {
      // short top: tucked into the trousers
      const bt = torso(D.hipsY - 0.02 * s);
      if (top.tucked) {
        const yy = Math.max(y0, D.hipsY - 0.02 * s);
        if (rings[rings.length - 1].c.y > yy + 1e-4) add(yy, bt.rx, bt.rz, topC);
        rings.push({ c: V(0, yy, 0), rx: bt.rx, rz: bt.rz, color: botC });
      }
    }
    // body below shirt hem down to the crotch (trousers / skin) for short tops
    if (!isLong(top.len) && top.len !== 'crop') {
      const last = rings[rings.length - 1];
      const yEnd = D.hipsY - 0.085 * s;
      const bt = torso(yEnd);
      const lowC = ['skirt', 'lehenga', 'chadra'].includes(o.bottom.kind) ? skin : botC;
      if (!top.tucked) {
        // untucked hem hangs slightly past waistband
        const yy = D.hipsY - 0.07 * s;
        if (last.c.y > yy + 1e-4) rings.push({ c: V(0, yy, 0), rx: bt.rx * 1.03, rz: bt.rz * 1.03, color: topC });
        rings.push({ c: V(0, yy, 0), rx: bt.rx * 1.0, rz: bt.rz * 1.0, color: lowC });
      }
      rings.push({ c: V(0, yEnd, 0), rx: bt.rx * 0.96, rz: bt.rz * 0.96, color: lowC });
    } else if (top.len === 'crop') {
      // skin midriff down to the lehenga waist
      const yEnd = D.hipsY - 0.02 * s;
      rings.push({ c: V(0, y0, 0), rx: torso(y0).rx * 0.985, rz: torso(y0).rz * 0.985, color: skin });
      rings.push({ c: V(0, yEnd, 0), rx: torso(yEnd).rx, rz: torso(yEnd).rz, color: skin });
      rings.push({ c: V(0, D.hipsY - 0.085 * s, 0), rx: torso(D.hipsY - 0.085 * s).rx * 0.96, rz: torso(D.hipsY - 0.085 * s).rz * 0.96, color: botC });
    } else {
      // long tops cap at the bottom with their own colour
    }
    mb.loft(rings, torsoW, { seg: 14, capStart: true, capEnd: true });
  }

  // ------------------------------------------------ outer garment (waistcoat / blazer / cardigan / apron)
  const outerHem = outer?.len ? hemY(outer.len) : D.hipsY - 0.07 * s;
  if (outer && outer.kind !== 'apron') {
    const oc = col(outer.color), ot = col(outer.trim ?? outer.color);
    const rings: { c: THREE.Vector3; rx: number; rz: number; color: THREE.Color }[] = [];
    const off = 0.013 * s;
    for (const t of table) {
      if (t.y < outerHem - 1e-4) break;
      const k = t.y < D.shoulderY - 0.05 * s ? 1.06 : 1;
      rings.push({ c: V(0, t.y, 0), rx: t.rx * k + off, rz: t.rz * k + off, color: oc });
    }
    const bt = torso(D.hipsY - 0.07 * s);
    if (outerHem < D.hipsY - 0.07 * s) {
      const steps = 2;
      for (let i = 1; i <= steps; i++) {
        const y = lerp(D.hipsY - 0.07 * s, outerHem, i / steps);
        const f = 1 + 0.1 * (i / steps);
        rings.push({ c: V(0, y, 0), rx: (bt.rx + off) * f, rz: (bt.rz + off) * f, color: oc });
      }
    } else {
      const t = torso(outerHem);
      rings.push({ c: V(0, outerHem, 0), rx: t.rx + off, rz: t.rz + off, color: oc });
    }
    if (outer.trim && outer.kind === 'waistcoat') {
      const last = rings[rings.length - 1];
      rings.push({ c: V(0, last.c.y, 0), rx: last.rx, rz: last.rz, color: ot });
      rings.push({ c: V(0, last.c.y + 0.02 * s, 0), rx: last.rx * 0.998, rz: last.rz * 0.998, color: ot });
      // swap order so trim sits at the hem
      const n = rings.length;
      const tmp = rings[n - 1]; rings[n - 1] = rings[n - 2]; rings[n - 2] = tmp;
    }
    mb.loft(rings, torsoW, { seg: 14, capStart: true, capEnd: true });
    // opening: inner garment strip at the front
    const innerC = topC;
    const stripTopY = D.neckY - 0.015 * s, stripBotY = outer.kind === 'blazer' ? D.spineY - 0.02 * s : Math.max(outerHem + 0.04 * s, D.spineY - 0.08 * s);
    const tt = torso((stripTopY + stripBotY) / 2);
    const stripW = outer.kind === 'blazer' ? 0.05 * s : 0.04 * s;
    const frontZ = (y: number) => torso(y).rz + off * 1.02;
    const sp: THREE.Vector3[] = [];
    for (let i = 0; i <= 5; i++) { const y = lerp(stripTopY, stripBotY, i / 5); sp.push(V(0, y, frontZ(y) + 0.001 * s)); }
    mb.path(sp, (t) => stripW * (outer!.kind === 'blazer' ? 1 - 0.55 * t : outer!.kind === 'waistcoat' ? 1.5 - 1.2 * t : 1 - 0.5 * t), () => 0.003 * s, () => (outer!.kind === 'blazer' ? col('#f6f6f4') : innerC), torsoW, { seg: 4, samples: 6, ref: V(1, 0, 0) });
    void tt;
    if (outer.kind === 'blazer') {
      // lapels
      for (const m of [1, -1]) {
        const pts = [V(m * 0.03 * s, stripTopY, frontZ(stripTopY) + 0.004 * s), V(m * 0.075 * s, lerp(stripTopY, stripBotY, 0.45), frontZ(lerp(stripTopY, stripBotY, 0.45)) * 0.99 + 0.004 * s), V(m * 0.035 * s, stripBotY, frontZ(stripBotY) + 0.004 * s)];
        mb.path(pts, () => 0.017 * s, () => 0.004 * s, () => shade(oc, -0.03), torsoW, { seg: 4, samples: 6, ref: V(1, 0, 0) });
      }
    } else {
      // buttons
      for (let i = 0; i < 4; i++) { const y = lerp(stripTopY - 0.05 * s, stripBotY + 0.01 * s, i / 3); mb.ellipsoid(V(0.0, y, frontZ(y) + 0.006 * s), [0.007 * s, 0.007 * s, 0.004 * s], outer.kind === 'waistcoat' ? col('#e3bd45') : ot, torsoW, { seg: 6, rings: 4 }); }
    }
  }
  if (outer && outer.kind === 'apron') {
    const ac = col(outer.color), at = col(outer.trim ?? outer.color);
    const yT = D.chestY + 0.07 * s, yB = outerHem + 0.03 * s;
    const rows = 4;
    for (let i = 0; i < rows; i++) {
      const y0 = lerp(yT, yB, i / rows), y1 = lerp(yT, yB, (i + 1) / rows);
      const t0 = torso(y0), t1 = torso(Math.max(y1, D.hipsY - 0.07 * s));
      const g = new THREE.CylinderGeometry(1, 1, 1, 14, 1, true, -1.15, 2.3);
      const m = new THREE.Matrix4().compose(V(0, (y0 + y1) / 2, 0), new THREE.Quaternion(), V((t0.rx + t1.rx) / 2 + 0.014 * s, y0 - y1, (t0.rz + t1.rz) / 2 + 0.014 * s));
      mb.geom(g, m, i === 0 ? at : ac, torsoW);
      g.dispose();
    }
    // neck strap
    for (const m of [1, -1]) {
      mb.path([V(m * 0.045 * s, yT, torso(yT).rz + 0.012 * s), V(m * 0.05 * s, D.neckY - 0.01 * s, 0.03 * s), V(m * 0.035 * s, D.neckY + 0.012 * s, -0.04 * s)], () => 0.009 * s, () => 0.003 * s, () => at, torsoW, { seg: 4, samples: 6, ref: V(1, 0, 0) });
    }
  }

  // ------------------------------------------------ arms + hands
  const sleeveFrac = Math.max(top.sleeve, outer?.sleeve ?? 0);
  const sleeveCol = outer?.sleeve ? col(outer.color) : topC;
  const sleeveTrim = col(top.kind === 'kameez' || top.kind === 'kurta' || top.kind === 'chola' ? (top.trim ?? top.color) : top.color);
  const sleeveK = ['kurta', 'kameez', 'chola'].includes(top.kind) ? 1.28 : top.kind === 'hoodie' ? 1.22 : 1.1;
  for (const sd of ['L', 'R'] as const) {
    const m = sd === 'L' ? 1 : -1;
    const a = W[`UpperArm_${sd}`].a, el = W[`LowerArm_${sd}`].a, wr = W[`Hand_${sd}`].a;
    const pts = [a.clone().add(V(-m * 0.014 * s, 0.004 * s, 0)), a, el, wr];
    const rS = [0.056, 0.047, 0.036].map((r) => r * s * limb);
    const tp = (t: number) => 0.82 + 0.18 * Math.min(1, t / 0.3); // taper into the shoulder so there is no winged lobe
    const radius = (t: number) => (t < 0.5 ? lerp(rS[0], rS[1], t / 0.5) : lerp(rS[1], rS[2], (t - 0.5) / 0.5)) * tp(t);
    const sl = sleeveFrac;
    const isSleeve = (t: number) => (sl >= 0.99 ? true : t < sl - 1e-3);
    const bks = sl > 0.05 && sl < 0.99 ? [sl] : [];
    mb.path(pts, (t) => (isSleeve(t) ? radius(t) * sleeveK * (sleeveK > 1.25 ? lerp(0.95, 1.08, t) : 1) + 0.004 * s : radius(t)), (t) => (isSleeve(t) ? radius(t) * sleeveK * (sleeveK > 1.25 ? lerp(0.95, 1.08, t) : 1) + 0.004 * s : radius(t)),
      (t) => (isSleeve(t) ? sleeveCol : skin), { Chest: 0.5, [`Shoulder_${sd}`]: 0.3, [`UpperArm_${sd}`]: 1, [`LowerArm_${sd}`]: 1, [`Hand_${sd}`]: 0.6 } as any,
      { seg: 9, samples: 12, capStart: true, capEnd: true, breaks: bks });
    // shoulder ball
    mb.ellipsoid(pts[0].clone(), (() => { const r0 = (isSleeve(0) ? radius(0) * sleeveK * (sleeveK > 1.25 ? 0.95 : 1) + 0.004 * s : radius(0)) * 1.0; return [r0, r0 * 0.96, r0] as [number, number, number]; })(), sl > 0.05 ? sleeveCol : skin, { Chest: 0.4, [`UpperArm_${sd}`]: 1 } as any, { seg: 9, rings: 7 });
    // cuffs / trim on sleeve ends of long ethnic sleeves
    if (sl > 0.95 && (top.kind === 'kurta' || top.kind === 'kameez' || top.kind === 'chola') && top.trim) {
      mb.torus(wr.clone().lerp(el, 0.05), rS[2] * sleeveK * 1.0 + 0.004 * s, rS[2] * sleeveK * 1.0 + 0.004 * s, 0.006 * s, sleeveTrim, `LowerArm_${sd}`, [0, 0, -m * 0.54]);
    }
    // hand (palm + fingers + thumb) in bone space
    const bw = rig.byName[`Hand_${sd}`].matrixWorld;
    const bf = rig.byName[`Fingers_${sd}`].matrixWorld;
    const bt = rig.byName[`Thumb_${sd}`].matrixWorld;
    const place = (bm: THREE.Matrix4, c: THREE.Vector3, r: THREE.Vector3) => new THREE.Matrix4().multiplyMatrices(bm, new THREE.Matrix4().compose(c, new THREE.Quaternion(), r));
    const sg = new THREE.SphereGeometry(1, 10, 7);
    mb.geom(sg, place(bw, V(0, -0.04 * s, 0), V(0.031 * s * limb ** 0.5, 0.045 * s, 0.017 * s)), skin, `Hand_${sd}`);
    // Four fingers (index on the thumb side, then middle, ring, little), two
    // segments each, so hands read as hands rather than mittens.
    const fs = new THREE.SphereGeometry(1, 7, 5);
    const fw = s * limb ** 0.5, fc = shade(skin, -0.01);
    ([[0.07, -1.5], [0.078, -0.5], [0.072, 0.5], [0.058, 1.5]] as const).forEach(([len, k]) => {
      const L = len * s, x = -m * k * 0.0148 * fw;
      mb.geom(fs, place(bf, V(x, -0.012 * s - L * 0.27, 0.001 * s), V(0.0071 * fw, L * 0.31, 0.0068 * s)), fc, `Fingers_${sd}`);
      mb.geom(fs, place(bf, V(x * 1.05, -0.012 * s - L * 0.74, 0.002 * s), V(0.0061 * fw, L * 0.28, 0.0058 * s)), fc, `Fingers_${sd}`);
    });
    fs.dispose();
    mb.geom(sg, place(bt, V(0, -0.02 * s, 0.004 * s), V(0.012 * s, 0.027 * s, 0.012 * s)), skin, `Thumb_${sd}`);
    sg.dispose();
    // kara (steel bangle) on the right wrist for Sikh men & women
    const sikh = ['dastar', 'patka', 'nihang', 'rumal', 'police'].includes(o.head.kind);
    if (sd === 'R' && sikh) {
      mb.torus(el.clone().lerp(wr, 0.93), 0.031 * s * limb ** 0.5, 0.031 * s * limb ** 0.5, 0.0055 * s, col('#cfd5dc'), `LowerArm_${sd}`, [0, 0, -m * 0.54]);
    }
    if (sd === 'R' && o.extras.includes('kalava')) {
      for (const k of [0.9, 0.86]) mb.torus(el.clone().lerp(wr, k), 0.029 * s * limb ** 0.5, 0.029 * s * limb ** 0.5, 0.0032 * s, col(k > 0.88 ? '#d12a1f' : '#f0b429'), `LowerArm_${sd}`, [0, 0, -m * 0.54]);
    }
    if (o.extras.includes('bangles') || o.extras.includes('choora')) {
      const choora = o.extras.includes('choora');
      const n = choora ? 8 : 5;
      for (let i = 0; i < n; i++) {
        const t = 0.9 - i * (choora ? 0.045 : 0.03);
        const cc = choora ? (i % 2 ? col('#f7f1e4') : col('#c4122f')) : [col('#e3b83e'), col('#d6222f'), col('#e3b83e'), col('#1fa35a'), col('#e3b83e')][i];
        mb.torus(el.clone().lerp(wr, t), (0.034 - i * 0.0005) * s * limb ** 0.4, (0.034 - i * 0.0005) * s * limb ** 0.4, 0.0042 * s, cc, `LowerArm_${sd}`, [0, 0, -m * 0.54], 10, 4);
      }
    }
  }

  // ------------------------------------------------ bottoms: legs, skirts
  const prof = LEG_PROFILE[o.bottom.kind];
  const skirtKinds: BottomKind[] = ['skirt', 'lehenga', 'chadra'];
  const legsBare = skirtKinds.includes(o.bottom.kind);
  const hemT: Record<BottomKind, number> = { shorts: 0.3, skirt: 0, lehenga: 0, chadra: 0, pajama: 1, patiala: 1, salwar: 1, churidar: 1, trousers: 1, jeans: 1, leggings: 1 };
  const botTrim = col(o.bottom.trim ?? o.bottom.color);
  for (const sd of ['L', 'R'] as const) {
    const up = W[`UpperLeg_${sd}`].a, kn = W[`LowerLeg_${sd}`].a, an = W[`Foot_${sd}`].a;
    const pts = [up.clone().add(V(0, 0.015 * s, 0)), up, kn, an.clone().add(V(0, -0.012 * s, 0))];
    const k = limb ** 0.5 * (kid ? 0.95 : 1);
    const interp = (p: number[], t: number) => (t < 0.5 ? lerp(p[0], p[1], t / 0.5) : lerp(p[1], p[2], 0) + (t < 0.75 ? lerp(p[1], p[2], (t - 0.5) / 0.25) - p[1] : lerp(p[2], p[3], (t - 0.75) / 0.25) - p[1]));
    const ht = legsBare ? 0 : hemT[o.bottom.kind];
    const cloth = (t: number) => (ht >= 1 ? true : t < ht - 1e-3);
    const r = (t: number) => (cloth(t) ? interp(LEG_PROFILE[o.bottom.kind], t) : interp(SKIN_LEG, t)) * s * k * (0.62 + 0.38 * Math.min(1, t / 0.22));
    const bks = ht > 0 && ht < 1 ? [ht] : [];
    mb.path(pts, r, (t) => r(t) * 0.97, (t) => (cloth(t) ? botC : skin), { Hips: 0.5, [`UpperLeg_${sd}`]: 1, [`LowerLeg_${sd}`]: 1, [`Foot_${sd}`]: 0.6 } as any, { seg: 10, samples: 14, capStart: true, capEnd: true, breaks: bks });
    // hem band for salwar / churidar (gathered ankle), trouser cuff
    if (!legsBare && ['salwar', 'patiala', 'churidar'].includes(o.bottom.kind) && o.bottom.trim) {
      mb.torus(an.clone().lerp(kn, 0.1), 0.05 * s * k, 0.05 * s * k, 0.007 * s, botTrim, `LowerLeg_${sd}`, [0, 0, 0], 12, 4);
    }
    // shoes
    addShoe(mb, rig, o, sd, skin);
  }
  // skirt-like lower garments
  if (legsBare) {
    const kind = o.bottom.kind;
    const bt = torso(D.hipsY - 0.02 * s);
    const yTop = D.spineY - 0.01 * s;
    const yEnd = kind === 'lehenga' ? 0.055 * s : kind === 'chadra' ? D.kneeY - 0.2 * s : D.kneeY + 0.1 * s;
    const bw = (kind === 'lehenga' ? 0.36 : kind === 'chadra' ? 0.2 : 0.2) * s;
    const rings: { c: THREE.Vector3; rx: number; rz: number; color: THREE.Color }[] = [];
    const n = 6;
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const y = lerp(yTop, yEnd, t);
      const wTop = torso(D.hipsY - 0.02 * s);
      const rxx = lerp(wRx * s * 1.03, wTop.rx * 1.04, Math.min(1, t * 3)) + (bw - wTop.rx * 1.04) * Math.pow(Math.max(0, (t - 0.25) / 0.75), 1.15);
      const rzz = lerp(wRz * s * 1.03, wTop.rz * 1.04, Math.min(1, t * 3)) + (bw * 0.95 - wTop.rz * 1.04) * Math.pow(Math.max(0, (t - 0.25) / 0.75), 1.15);
      rings.push({ c: V(0, y, 0), rx: Math.max(rxx, wRx * s), rz: Math.max(rzz, wRz * s), color: botC });
    }
    if (o.bottom.trim) {
      const last = rings[rings.length - 1];
      rings.push({ c: V(0, last.c.y + 0.045 * s, 0), rx: last.rx * 0.995, rz: last.rz * 0.995, color: botC });
      rings.push({ c: V(0, last.c.y + 0.045 * s, 0), rx: last.rx * 0.997, rz: last.rz * 0.997, color: botTrim });
      rings.push({ c: V(0, last.c.y + 0.002 * s, 0), rx: last.rx * 1.0, rz: last.rz * 1.0, color: botTrim });
    }
    mb.loft(rings, torsoW, { seg: 16, capStart: true, capEnd: false });
    void bt;
  }

  // ------------------------------------------------ accessories on body
  const ex = o.extras;
  const fr = (y: number) => torso(y).rz + 0.016 * s;
  if (ex.includes('belt')) {
    const y = D.hipsY + 0.012 * s, t = torso(y);
    mb.loft([
      { c: V(0, y + 0.017 * s, 0), rx: t.rx + 0.008 * s, rz: t.rz + 0.008 * s, color: col('#16161a') },
      { c: V(0, y + 0.017 * s, 0), rx: t.rx + 0.012 * s, rz: t.rz + 0.012 * s, color: col('#16161a') },
      { c: V(0, y - 0.017 * s, 0), rx: t.rx + 0.012 * s, rz: t.rz + 0.012 * s, color: col('#16161a') },
      { c: V(0, y - 0.017 * s, 0), rx: t.rx + 0.008 * s, rz: t.rz + 0.008 * s, color: col('#16161a') },
    ], ['Hips', 'Spine'], { seg: 14 });
    mb.box(V(0, y, t.rz + 0.014 * s), [0.04 * s, 0.032 * s, 0.008 * s], col('#d9b43a'), ['Hips', 'Spine']);
  }
  if (ex.includes('sash')) {
    const y = D.hipsY + 0.04 * s, t = torso(y);
    const c1 = col(o.id === 'nihang' ? '#f2a007' : o.id === 'sewadar' ? '#2455a8' : o.outer?.color ?? '#f2b705');
    mb.loft([
      { c: V(0, y + 0.035 * s, 0), rx: t.rx + 0.016 * s, rz: t.rz + 0.016 * s, color: c1 },
      { c: V(0, y - 0.035 * s, 0), rx: t.rx + 0.018 * s, rz: t.rz + 0.018 * s, color: c1 },
    ], ['Hips', 'Spine'], { seg: 14 });
    mb.path([V(0.09 * s, y, t.rz + 0.016 * s), V(0.1 * s, y - 0.12 * s, t.rz + 0.02 * s), V(0.1 * s, y - 0.26 * s, t.rz + 0.016 * s)], () => 0.022 * s, () => 0.004 * s, () => shade(c1, -0.03), skirtW, { seg: 4, samples: 6, ref: V(1, 0, 0) });
  }
  if (ex.includes('badge')) {
    const y = D.chestY + 0.07 * s;
    mb.ellipsoid(V(0.075 * s, y, fr(y)), [0.019 * s, 0.022 * s, 0.006 * s], col('#e3bd45'), 'Chest', { seg: 8, rings: 5 });
    mb.box(V(-0.075 * s, y - 0.01 * s, fr(y) - 0.002 * s), [0.05 * s, 0.014 * s, 0.006 * s], col('#e8e8e0'), 'Chest');
  }
  if (ex.includes('epaulettes')) {
    for (const m of [1, -1]) mb.box(V(m * 0.1 * s, D.shoulderY + 0.012 * s, 0.0), [0.06 * s, 0.01 * s, 0.045 * s], col('#2a2a30'), 'Chest', [0, 0, -m * 0.18]);
  }
  if (ex.includes('whistle')) {
    const y0 = D.shoulderY, yb = D.chestY + 0.0 * s;
    mb.path([V(-0.04 * s, D.neckY + 0.01 * s, 0.03 * s), V(-0.1 * s, D.shoulderY - 0.03 * s, torso(D.shoulderY).rz + 0.01 * s), V(-0.1 * s, yb, fr(yb))], () => 0.0035 * s, () => 0.0035 * s, () => col('#f0f0ea'), 'Chest', { seg: 4, samples: 6 });
    void y0;
  }
  if (ex.includes('tie')) {
    const yT = D.neckY - 0.02 * s, yB = D.spineY + 0.05 * s;
    const tc = col(o.id === 'school' ? '#b01f2f' : o.id === 'business_f' ? '#e8c9a0' : o.head.color);
    mb.ellipsoid(V(0, yT, torso(yT).rz + 0.02 * s), [0.017 * s, 0.014 * s, 0.01 * s], tc, 'Chest', { seg: 6, rings: 5 });
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= 4; i++) { const y = lerp(yT - 0.01 * s, yB, i / 4); pts.push(V(0, y, torso(y).rz + (outer?.kind === 'blazer' ? 0.028 : 0.016) * s)); }
    mb.path(pts, (t) => 0.014 * s * (0.6 + 1.1 * Math.sin(Math.PI * Math.min(1, t * 0.9 + 0.1) * 0.7)), () => 0.004 * s, () => tc, ['Chest', 'Spine'], { seg: 4, samples: 6, ref: V(1, 0, 0), capEnd: true });
  }
  if (ex.includes('gatra')) {
    const pts: THREE.Vector3[] = [];
    const n = 6;
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const x = lerp(-0.1 * s, 0.17 * s, t), y = lerp(D.shoulderY + 0.008 * s, D.hipsY - 0.02 * s, t);
      const tt = torso(y);
      const z = tt.rz * 1.12 * Math.sqrt(Math.max(0.05, 1 - (x / (tt.rx * 1.02)) ** 2)) + 0.026 * s;
      pts.push(V(x, y, z));
    }
    mb.path(pts, () => 0.016 * s, () => 0.004 * s, () => col('#1b1b20'), ['Chest', 'Spine', 'Hips'], { seg: 4, samples: 10, ref: V(0.7, 0.7, 0), capStart: true, capEnd: true });
    // kirpan in its sheath
    mb.box(V(0.2 * s, D.hipsY - 0.1 * s, 0.02 * s), [0.024 * s, 0.2 * s, 0.026 * s], col('#2a2a30'), 'Hips', [0.1, 0, -0.35]);
    mb.box(V(0.19 * s, D.hipsY + 0.0 * s, 0.025 * s), [0.03 * s, 0.03 * s, 0.03 * s], col('#cfd5dc'), 'Hips', [0.1, 0, -0.35]);
  }
  if (ex.includes('necklace')) {
    const y = D.shoulderY - 0.03 * s;
    mb.torus(V(0, y, 0.02 * s), 0.085 * s, 0.075 * s, 0.0055 * s, col('#e3b83e'), ['Chest', 'Neck'], [0.35, 0, 0], 16, 4);
    mb.ellipsoid(V(0, y - 0.03 * s, 0.092 * s), [0.014 * s, 0.018 * s, 0.006 * s], col('#d6222f'), 'Chest', { seg: 6, rings: 5 });
  }
  if (ex.includes('mangalsutra') && !kid) {
    const y = D.shoulderY - 0.03 * s;
    mb.torus(V(0, y - 0.006 * s, 0.022 * s), 0.083 * s, 0.073 * s, 0.0034 * s, col('#161616'), ['Chest', 'Neck'], [0.38, 0, 0], 18, 4);
    mb.torus(V(0, y - 0.045 * s, 0.075 * s), 0.016 * s, 0.016 * s, 0.003 * s, col('#e3b83e'), 'Chest', [0.2, 0, 0], 12, 4);
    mb.ellipsoid(V(0, y - 0.07 * s, 0.098 * s), [0.007 * s, 0.01 * s, 0.004 * s], col('#e3b83e'), 'Chest', { seg: 6, rings: 4 });
  }
  if (ex.includes('cross')) {
    const y = D.shoulderY - 0.03 * s;
    mb.torus(V(0, y, 0.02 * s), 0.07 * s, 0.062 * s, 0.002 * s, col('#e3b83e'), ['Chest', 'Neck'], [0.4, 0, 0], 16, 3);
    const zc = torso(D.chestY + 0.07 * s).rz + 0.008 * s;
    mb.box(V(0, D.chestY + 0.095 * s, zc), [0.008 * s, 0.036 * s, 0.004 * s], col('#e3b83e'), 'Chest');
    mb.box(V(0, D.chestY + 0.105 * s, zc), [0.024 * s, 0.008 * s, 0.004 * s], col('#e3b83e'), 'Chest');
  }
  if (ex.includes('medal')) {
    const y = D.chestY + 0.06 * s;
    mb.ellipsoid(V(0.07 * s, y, fr(y) + 0.004 * s), [0.014 * s, 0.014 * s, 0.004 * s], col('#e3bd45'), 'Chest', { seg: 8, rings: 5 });
  }

  // ------------------------------------------------ head details
  const ctx: HeadCtx = { mb, rig, skin, hair, o, torso };
  const style = o.hair ?? (bd.sex === 'f' ? 'braid' : 'short');
  const covered = ['dastar', 'patka', 'nihang', 'rumal', 'police', 'pagri'].includes(o.head.kind) || o.dupatta?.mode === 'head' || o.dupatta?.mode === 'hijab';
  addHair(ctx, style, covered, ['topi', 'gandhi', 'cap'].includes(o.head.kind));
  addHeadwear(ctx);
  addBeard(ctx);
  if (bd.glasses || o.extras.includes('glasses')) addGlasses(ctx);
  addFaceJewellery(ctx);
  addDupatta(ctx);

  return mb.build();
}

function addShoe(mb: MeshBuilder, rig: Rig, o: OutfitDef, sd: 'L' | 'R', skin: THREE.Color) {
  const s = rig.dims.s, D = rig.dims;
  const an = rig.world[`Foot_${sd}`].a, toe = rig.world[`Toes_${sd}`].a, tip = rig.world[`Toes_${sd}`].b;
  const k = o.shoes.kind;
  const c = col(o.shoes.color), tr = col(o.shoes.trim ?? o.shoes.color);
  const W = { [`Foot_${sd}`]: 1, [`Toes_${sd}`]: 1 } as any;
  const heel = an.z - 0.055 * s, front = tip.z + 0.045 * s;
  const zc = (heel + front) / 2, rz = (front - heel) / 2;
  const x = an.x;
  const ay = D.ankleY;
  const bare = k === 'sandal';
  const footColor = bare ? skin : c;
  const widthK = 0.054 * s * (rig.body.limb ** 0.3);
  // main shoe body
  mb.ellipsoid(V(x, ay * 0.52, zc), [widthK, ay * 0.56, rz], footColor, W, { seg: 10, rings: 7 });
  if (k === 'sneaker' || k === 'school' || k === 'formal' || k === 'heels') {
    // sole
    mb.ellipsoid(V(x, ay * 0.1, zc), [widthK * 1.03, ay * 0.12, rz * 1.02], k === 'sneaker' ? col('#ffffff') : col('#222226'), W, { seg: 10, rings: 4 });
  }
  if (k === 'sneaker') mb.ellipsoid(V(x, ay * 0.7, zc + rz * 0.45), [widthK * 0.7, ay * 0.3, rz * 0.35], tr, W, { seg: 8, rings: 5 });
  if (k === 'jutti') {
    mb.ellipsoid(V(x, ay * 0.62, zc + rz * 0.38), [widthK * 0.92, ay * 0.42, rz * 0.55], tr, W, { seg: 8, rings: 5 });
    mb.ellipsoid(V(x, ay * 0.82, front + 0.012 * s), [0.017 * s, 0.017 * s, 0.03 * s], c, W, { seg: 6, rings: 5, rot: [0.5, 0, 0] });
  }
  if (k === 'boots') {
    mb.cylinder(V(x, ay * 0.6, an.z - 0.005 * s), V(x, D.kneeY * 0.5, an.z - 0.01 * s), widthK * 0.98, widthK * 1.05, c, [`LowerLeg_${sd}`, `Foot_${sd}`], 9, true);
  }
  if (k === 'school') mb.cylinder(V(x, ay * 0.7, an.z - 0.005 * s), V(x, ay * 1.7, an.z - 0.005 * s), widthK * 0.82, widthK * 0.82, col('#f4f4f4'), [`LowerLeg_${sd}`, `Foot_${sd}`], 8, true);
  if (k === 'heels') mb.cylinder(V(x, ay * 0.2, heel + 0.012 * s), V(x, ay * 0.7, heel + 0.012 * s), 0.008 * s, 0.014 * s, c, W, 6, true);
  if (bare) {
    mb.ellipsoid(V(x, ay * 0.2, zc), [widthK * 1.02, ay * 0.14, rz * 1.02], col(o.shoes.color), W, { seg: 10, rings: 4 });
    mb.torus(V(x, ay * 0.62, zc + rz * 0.2), widthK * 0.95, 0.03 * s, 0.004 * s, col(o.shoes.color), W, [Math.PI / 2 + 1.2, 0, 0], 8, 4);
  }
}
