import re, sys
def rd(p): return open(p).read()
def wr(p, t): open(p, 'w').write(t)
def rep(t, old, new, cnt=1):
    assert old in t, 'MISSING: ' + old[:80]
    return t.replace(old, new, cnt)

# ------------------------------------------------------------------ outfits.ts types
p = 'src/lib/outfits.ts'; t = rd(p)
t = rep(t, "'rumal' | 'cap' | 'none';", "'rumal' | 'cap' | 'topi' | 'gandhi' | 'pagri' | 'none';")
t = rep(t, "'pigtails' | 'short';", "'pigtails' | 'short' | 'crop' | 'sidepart' | 'balding';")
t = rep(t, "| 'dhol_sticks' | 'phone';", "| 'dhol_sticks' | 'phone' | 'tasbih';")
t = rep(t, "| 'bindi' | 'headband';", "| 'bindi' | 'headband'\n  | 'tilak' | 'sindoor' | 'mangalsutra' | 'cross' | 'kalava' | 'glasses';")
t = rep(t, "export interface OutfitDef {", """export type Community = 'sikh' | 'hindu' | 'muslim' | 'christian' | 'universal';
export type Facial = 'full' | 'trim' | 'sunnah' | 'stubble' | 'moustache' | 'none';
export const COMMUNITY_LABEL: Record<Community, string> = { sikh: 'Sikh', hindu: 'Hindu', muslim: 'Muslim', christian: 'Christian', universal: 'Everyday / all communities' };
export interface OutfitDef {""")
t = rep(t, "  id: string;\n  label: string;", "  id: string;\n  /** community this outfit is typically associated with (drives greeting + UI filter) */\n  community?: Community;\n  /** male facial hair style (default: full beard + twirled moustache for Sikh headwear, moustache otherwise) */\n  facial?: Facial;\n  label: string;")
t = rep(t, "mode: 'shoulders' | 'head' | 'drape';", "mode: 'shoulders' | 'head' | 'drape' | 'hijab';")
wr(p, t)

# ------------------------------------------------------------------ headwear.ts
p = 'src/lib/headwear.ts'; t = rd(p)

# new head kinds
new_heads = """  } else if (kind === 'topi') {
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
  if (o.extras.includes('headband')) {"""
t = rep(t, "  }\n  if (o.extras.includes('headband')) {", new_heads)

# male hair
male_hair = """
function maleHair(c: HeadCtx, style: HairStyle) {
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
  // top cap (hairline: open face wedge) + short back/nape
  mb.ellipsoid(V(hc.x, hc.y + hr.y * 0.04, hc.z - hr.z * 0.05), [hr.x * 1.045, hr.y * 1.05, hr.z * 1.05], sh(0), H, { seg: 20, rings: 10, phi: [pi / 2 + 0.5, pi * 2 - 1.0], theta: [0, pi * 0.5] });
  mb.ellipsoid(V(hc.x, hc.y - hr.y * 0.02, hc.z - hr.z * 0.08), [hr.x * 1.04, hr.y * 1.02, hr.z * 1.04], sh(-0.03), H, { seg: 16, rings: 6, phi: [pi * 1.5 - 1.0, 2.0], theta: [pi * 0.48, pi * 0.2] });
  // front hairline across the top of the forehead
  mb.ellipsoid(V(hc.x, hc.y + hr.y * 0.82, hc.z + hr.z * 0.52), [hr.x * 0.7, hr.y * 0.19, hr.z * 0.5], sh(0.01), H, { seg: 12, rings: 6, rot: [0.9, 0, 0] });
  if (st === 'sidepart') {
    mb.ellipsoid(V(hc.x - hr.x * 0.12, hc.y + hr.y * 1.0, hc.z + hr.z * 0.2), [hr.x * 0.8, hr.y * 0.2, hr.z * 0.66], sh(0.025), H, { seg: 14, rings: 6, rot: [0.3, 0, 0.18] });
    mb.ellipsoid(V(hc.x + hr.x * 0.5, hc.y + hr.y * 0.86, hc.z + hr.z * 0.5), [hr.x * 0.36, hr.y * 0.11, hr.z * 0.3], sh(-0.04), H, { seg: 8, rings: 5, rot: [0.9, 0, -0.5] });
  }
}
// ------------------------------------------------------------------ hair, beard, glasses
export function addHair("""
t = rep(t, "\n// ------------------------------------------------------------------ hair, beard, glasses\nexport function addHair(", male_hair)
t = rep(t, "  if (covered && sex === 'm') return; // hair hidden under turban\n", "  if (covered && sex === 'm') return; // hair hidden under turban\n  if (sex === 'm') { maleHair(c, style); return; }\n")

# facial hair modes
t = rep(t, "  if (rig.body.sex !== 'm' || rig.body.age === 'kid') return;\n  const elder = rig.body.age === 'elder';",
"""  if (rig.body.sex !== 'm' || rig.body.age === 'kid') return;
  const sikhHead = ['dastar', 'patka', 'nihang', 'rumal', 'police'].includes(c.o.head.kind);
  const mode = c.o.facial ?? (sikhHead ? 'full' : 'moustache');
  if (mode === 'none') return;
  const elder = rig.body.age === 'elder';""")
t = rep(t, "  const thick = 0.021 * s;\n", "  const full = mode === 'full' || mode === 'sunnah' || mode === 'trim';\n  const thickK = mode === 'trim' ? 0.55 : 1, extK = mode === 'trim' ? 0.3 : 1;\n  const thick = 0.021 * s * thickK;\n")
t = rep(t, "mb.path(rowPts(-0.3, 0.62, 0.97, 0.026), ", "if (full) mb.path(rowPts(-0.3, 0.62, 0.97, 0.026 * extK), ")
t = rep(t, "  mb.path(rowPts(-0.52, 0.5, 0.95, 0.045), ", "  if (full) mb.path(rowPts(-0.52, 0.5, 0.95, 0.045 * extK), ")
t = rep(t, "  for (const m of [1, -1]) {\n    const a = headPoint(rig, 0.05, m * 1.45, 0.98)", "  if (full) for (const m of [1, -1]) {\n    const a = headPoint(rig, 0.05, m * 1.45, 0.98)")
t = rep(t, "  // twirled Punjabi moustache\n", """  if (mode === 'stubble') {
    const g = new THREE.SphereGeometry(1, 26, 12, Math.PI / 2 - 1.2, 2.4, Math.PI * 0.55, Math.PI * 0.4);
    const pa = g.getAttribute('position') as THREE.BufferAttribute;
    for (let i = 0; i < pa.count; i++) pa.setX(i, pa.getX(i) * jawTaper(pa.getY(i)));
    mb.geom(g, new THREE.Matrix4().compose(hc, new THREE.Quaternion(), V(hr.x * 1.012, hr.y * 1.012, hr.z * 1.012)), c.skin.clone().lerp(bc, 0.42), 'Head');
    return;
  }
  if (mode === 'sunnah') return; // shaved upper lip
  // twirled Punjabi moustache (flatter when the beard is trimmed)
  const tw = mode === 'full' || mode === 'moustache' ? 1 : 0.3;
""")
t = rep(t, "    const xs = [0.004, 0.022, 0.042, 0.058, 0.066], ys = [0, -0.003, 0.0, 0.012, 0.027], dz = [0.01, 0.008, 0.002, -0.006, -0.012];",
           "    const xs = [0.004, 0.022, 0.042, 0.058, 0.066], ys = [0, -0.003, 0.0, 0.012, 0.027].map((v) => v * tw), dz = [0.01, 0.008, 0.002, -0.006, -0.012];")

# face marks
t = rep(t, "  if (o.extras.includes('nose_pin')) {", """  if (o.extras.includes('bindi')) {
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
    const pts = [headPoint(rig, 0.66, 0, 1.01), headPoint(rig, 0.86, 0, 1.04), headPoint(rig, 1.0, 0, 1.06)];
    mb.path(pts, () => 0.0035 * s, () => 0.0035 * s, () => col('#c8101e'), 'Head', { seg: 4, samples: 6 });
  }
  if (o.extras.includes('nose_pin')) {""")

# dupatta: finer phulkari, hijab
t = rep(t, "const stripe = (t: number, n = 9): THREE.Color => {\n    if (d.pattern === 'phulkari') {\n      const k = Math.floor(t * n);\n      return k % 3 === 0 ? trim : k % 3 === 1 ? shade(base, 0.05) : base;\n    }",
"const stripe = (t: number, n = 24): THREE.Color => {\n    if (d.pattern === 'phulkari') {\n      const k = Math.floor(t * n);\n      if (t < 0.05 || t > 0.95) return trim;\n      return k % 6 === 0 ? trim : k % 6 === 3 ? shade(base, 0.07) : k % 6 === 4 ? shade(trim, -0.1) : base;\n    }")
t = rep(t, "Array.from({ length: 8 }, (_, i) => (i + 1) / 9)", "Array.from({ length: 23 }, (_, i) => (i + 1) / 24).concat([0.05, 0.95])")
t = rep(t, "  } else {\n    frontRibbon(1, 0.22);\n    frontRibbon(-1, 0.3);\n  }", "  } else if (d.mode !== 'hijab') {\n    frontRibbon(1, 0.22);\n    frontRibbon(-1, 0.3);\n  }")
t = rep(t, "  if (d.mode === 'head') {\n    // hood over the hair, open at the face; trim along the opening\n    const edge = 0.95;", "  if (d.mode === 'head' || d.mode === 'hijab') {\n    // hood over the hair, open at the face; trim along the opening\n    const hij = d.mode === 'hijab';\n    const edge = hij ? 0.78 : 0.95;")
t = rep(t, "theta: [0, Math.PI * 0.78] });\n    void cc;", "theta: [0, Math.PI * (hij ? 0.9 : 0.78)] });\n    void cc;")
t = rep(t, "[0.13 * s, 0.06 * s, 0.1 * s], base, { Neck: 1, Chest: 1, Head: 0.3 }, { seg: 12, rings: 8, theta: [0, 1.9] });", "[(hij ? 0.155 : 0.13) * s, (hij ? 0.085 : 0.06) * s, (hij ? 0.115 : 0.1) * s], base, { Neck: 1, Chest: 1, Head: 0.3 }, { seg: 12, rings: 8, theta: [0, 1.9] });")
wr(p, t)

# ------------------------------------------------------------------ body.ts
p = 'src/lib/body.ts'; t = rd(p)
t = rep(t, "  const covered = o.head.kind !== 'none' || o.dupatta?.mode === 'head';",
"  const covered = ['dastar', 'patka', 'nihang', 'rumal', 'police', 'pagri'].includes(o.head.kind) || o.dupatta?.mode === 'head' || o.dupatta?.mode === 'hijab';")
t = rep(t, "  if (bd.glasses) addGlasses(ctx);", "  if (bd.glasses || o.extras.includes('glasses')) addGlasses(ctx);")
# shoulder ball smoothing
t = rep(t, "mb.ellipsoid(a.clone().add(V(0, 0.002 * s, 0)), [rS[0] * (sl > 0.05 ? sleeveK * 0.86 : 1.0), rS[0] * (sl > 0.05 ? sleeveK * 0.9 : 1.0), rS[0] * (sl > 0.05 ? sleeveK * 0.9 : 1.0)]",
           "mb.ellipsoid(a.clone().add(V(-m * 0.005 * s, -0.007 * s, 0)), [rS[0] * (sl > 0.05 ? sleeveK * 0.84 : 0.96), rS[0] * (sl > 0.05 ? sleeveK * 0.8 : 0.92), rS[0] * (sl > 0.05 ? sleeveK * 0.88 : 0.96)]")
# kalava
t = rep(t, "    if (o.extras.includes('bangles') || o.extras.includes('choora')) {", """    if (sd === 'R' && o.extras.includes('kalava')) {
      for (const k of [0.9, 0.86]) mb.torus(el.clone().lerp(wr, k), 0.029 * s * limb ** 0.5, 0.029 * s * limb ** 0.5, 0.0032 * s, col(k > 0.88 ? '#d12a1f' : '#f0b429'), `LowerArm_${sd}`, [0, 0, -m * 0.54]);
    }
    if (o.extras.includes('bangles') || o.extras.includes('choora')) {""")
# mangalsutra and cross
t = rep(t, "  if (ex.includes('medal')) {", """  if (ex.includes('mangalsutra') && !kid) {
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
  if (ex.includes('medal')) {""")
wr(p, t)

# ------------------------------------------------------------------ props.ts
p = 'src/lib/props.ts'; t = rd(p)
t = rep(t, "    case 'lathi': {", """    case 'tasbih': {
      g.add(mesh(new THREE.TorusGeometry(0.05 * s, 0.0085 * s, 6, 26), mat('#2b1a0e', 0.45), [0, -0.1 * s, 0.01 * s], [0, Math.PI / 2, 0]));
      g.add(mesh(new THREE.SphereGeometry(0.011 * s, 8, 6), mat('#e3b83e', 0.4, 0.4), [0, -0.152 * s, 0.01 * s]));
      g.add(mesh(new THREE.CylinderGeometry(0.003 * s, 0.005 * s, 0.045 * s, 5), mat('#c4122f'), [0, -0.18 * s, 0.01 * s]));
      break;
    }
    case 'lathi': {""")
wr(p, t)
print('ok')
