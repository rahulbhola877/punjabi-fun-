import { Bone, Matrix, Mesh, Scene, Skeleton, TransformNode, Vector3 } from "../babylon";
import { GeoBuilder, rgb, shade, type RGB } from "../render/GeoBuilder";

/** Bone indices. The character faces +Z; its right side is +X. */
export const B = {
  hips: 0, spine: 1, chest: 2, neck: 3, head: 4,
  uArmL: 5, fArmL: 6, handL: 7, uArmR: 8, fArmR: 9, handR: 10,
  thighL: 11, shinL: 12, footL: 13, thighR: 14, shinR: 15, footR: 16,
} as const;
export const BONE_COUNT = 17;
const PARENT = [-1, 0, 1, 2, 3, 2, 5, 6, 2, 8, 9, 0, 11, 12, 0, 14, 15];
const NAMES = ["hips", "spine", "chest", "neck", "head", "uArmL", "fArmL", "handL", "uArmR", "fArmR", "handR", "thighL", "shinL", "footL", "thighR", "shinR", "footR"];

export type Top = "kurta" | "kameez" | "shirt" | "tshirt" | "vest";
export type Bottom = "pajama" | "salwar" | "jeans" | "trousers";
export type Headwear = "turban" | "patka" | "none" | "cap";
export type Hair = "short" | "braid" | "bun" | "bald" | "long";
export type Beard = "full" | "mustache" | "stubble" | "none";

export interface Appearance {
  sex: "m" | "f";
  /** Standing height in metres. */
  height: number;
  /** Width factor (0.85 slim … 1.25 heavy). */
  build: number;
  skin: string;
  age: "child" | "adult" | "elder";
  top: Top;
  topColor: string;
  topTrim?: string;
  sleeves: "long" | "short";
  bottom: Bottom;
  bottomColor: string;
  headwear: Headwear;
  headColor?: string;
  hair: Hair;
  hairColor: string;
  beard: Beard;
  dupatta?: string;
  shoes: "jutti" | "chappal" | "sneaker";
  shoeColor: string;
  apron?: string;
  /** Tailor's measuring tape draped round the neck. */
  tape?: string;
  kara?: boolean;
  vest?: string;
}

/** Joint positions in unit (1.72 m) model space. */
function joints(a: Appearance): Vector3[] {
  const f = a.sex === "f";
  const sw = (f ? 0.175 : 0.195) * Math.sqrt(a.build);
  const hx = (f ? 0.1 : 0.094) * Math.sqrt(a.build);
  return [
    new Vector3(0, 0.95, 0), new Vector3(0, 1.08, 0), new Vector3(0, 1.27, 0), new Vector3(0, 1.47, 0), new Vector3(0, 1.55, 0.005),
    new Vector3(-sw, 1.425, 0), new Vector3(-sw - 0.01, 1.14, 0), new Vector3(-sw - 0.012, 0.89, 0.005),
    new Vector3(sw, 1.425, 0), new Vector3(sw + 0.01, 1.14, 0), new Vector3(sw + 0.012, 0.89, 0.005),
    new Vector3(-hx, 0.92, 0), new Vector3(-hx, 0.5, 0.005), new Vector3(-hx, 0.085, -0.01),
    new Vector3(hx, 0.92, 0), new Vector3(hx, 0.5, 0.005), new Vector3(hx, 0.085, -0.01),
  ];
}

const smooth = (e0: number, e1: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

export interface BuiltHuman {
  root: TransformNode;
  mesh: Mesh;
  skeleton: Skeleton;
  bones: Bone[];
  rest: Vector3[];
  scale: number;
}

/**
 * Builds a single skinned mesh for a resident: connected limbs (lofted with
 * blended joint weights), hands with fingers, shaped feet, a restrained face,
 * and layered Punjabi clothing. One mesh + one skeleton = one draw call.
 */
export function buildHuman(scene: Scene, name: string, a: Appearance, material: import("../babylon").Material): BuiltHuman {
  const J = joints(a);
  const g = new GeoBuilder(1);
  const f = a.sex === "f";
  const bw = a.build;
  const skin = rgb(a.skin);
  const top = rgb(a.topColor);
  const trim = rgb(a.topTrim ?? a.topColor);
  const bottom = rgb(a.bottomColor);
  const hair = rgb(a.hairColor);
  const lipC = shade(skin, 0.62);
  const sleeveLong = a.sleeves === "long";
  const loose = a.top === "kurta" || a.top === "kameez";

  // ---------------- Torso (hips → neck) with blended spine weights.
  g.uvMode = "cloth";
  g.skinFn = (x, y) => {
    // Shoulder blend into the upper arms keeps the armpits connected.
    if (y > 1.33 && Math.abs(x) > 0.13) {
      const w = smooth(0.13, 0.2, Math.abs(x)) * 0.45;
      return { a: B.chest, b: x < 0 ? B.uArmL : B.uArmR, w };
    }
    if (y < 1.02) return { a: B.hips, b: B.spine, w: smooth(0.97, 1.02, y) * 0.5 };
    if (y < 1.2) return { a: B.spine, b: B.hips, w: 1 - smooth(1.0, 1.1, y) };
    if (y < 1.45) return { a: B.chest, b: B.spine, w: 1 - smooth(1.18, 1.28, y) };
    return { a: B.neck, b: B.chest, w: 1 - smooth(1.45, 1.5, y) };
  };
  const hipW = (f ? 1.1 : 1) * bw;
  const belly = a.age === "elder" || bw > 1.1 ? 1.25 : 1;
  const chestZ = f ? 0.13 : 0.12;
  const torsoTop = a.top === "vest" ? skin : top;
  const ring = (y: number, rx: number, rz: number, c: RGB, z = 0) => ({ p: new Vector3(0, y, z), rx, rz, c });
  g.loft([
    ring(0.84, 0.15 * hipW, 0.1, bottom),
    ring(0.9, 0.168 * hipW, 0.112, bottom),
    ring(0.97, 0.17 * hipW, 0.115, loose ? top : bottom),
    ring(1.06, 0.15 * bw, 0.105 * belly, top, 0.005 * belly),
    ring(1.16, 0.158 * bw, 0.112 * belly, top, 0.006),
    ring(1.28, (f ? 0.162 : 0.172) * bw, chestZ, torsoTop, 0.008),
    ring(1.37, (f ? 0.175 : 0.19) * Math.sqrt(bw), 0.11, torsoTop),
    ring(1.425, (f ? 0.155 : 0.168) * Math.sqrt(bw), 0.096, a.top === "vest" ? top : torsoTop),
    ring(1.465, 0.085, 0.07, a.top === "vest" ? top : torsoTop),
    { ...ring(1.49, 0.057, 0.058, skin), p: new Vector3(0, 1.49, -0.005) },
    { ...ring(1.58, 0.052, 0.054, skin), p: new Vector3(0, 1.58, 0.0) },
  ], 14, top, true, false);
  if (a.top === "vest") {
    // Sleeveless waistcoat over a kurta-coloured undershirt.
    g.loft([ring(1.0, 0.162 * bw, 0.118 * belly, rgb(a.vest ?? "#333333")), ring(1.3, 0.18 * bw, 0.128, rgb(a.vest ?? "#333333")), ring(1.42, 0.14, 0.095, rgb(a.vest ?? "#333333"))], 14, top);
  }
  // Kurta/kameez skirt: hangs from the hips, partially following the thighs.
  if (loose || a.top === "shirt") {
    const hem = a.top === "kurta" ? 0.47 : a.top === "kameez" ? 0.4 : 0.8;
    g.skinFn = (x, y) => {
      const t = Math.min(1, Math.max(0, (0.96 - y) / (0.96 - hem)));
      return { a: B.hips, b: x < 0 ? B.thighL : B.thighR, w: Math.min(0.75, t * 0.9 * Math.min(1, Math.abs(x) / 0.12)) };
    };
    const flare = a.top === "kameez" ? 1.06 : 1.1;
    g.loft([
      ring(0.98, 0.172 * hipW, 0.118 * belly, top),
      ring(0.8, 0.2 * hipW * flare, 0.14, top),
      ring(hem + 0.06, 0.222 * hipW * flare, 0.153, top),
      ring(hem + 0.055, 0.222 * hipW * flare, 0.153, trim),
      ring(hem, 0.224 * hipW * flare, 0.155, trim),
    ], 16, top, false, false);
    // Inside of the hem so the skirt has thickness from below.
    g.loft([ring(hem, 0.212 * hipW * flare, 0.147, shade(top, 0.6)), ring(0.9, 0.165 * hipW, 0.11, shade(top, 0.6))], 16, top);
  }
  if (a.apron) {
    g.skinFn = (_x, y) => ({ a: y > 1.0 ? B.chest : B.hips, b: B.spine, w: 0.3 });
    const ac = rgb(a.apron);
    g.box(0, 0.98, 0.135 * belly, 0.3, 0.55, 0.012, ac);
    g.box(0, 1.27, 0.128, 0.22, 0.12, 0.012, ac);
  }

  // ---------------- Arms
  for (const side of [-1, 1] as const) {
    const [ua, fa, ha] = side < 0 ? [B.uArmL, B.fArmL, B.handL] : [B.uArmR, B.fArmR, B.handR];
    const sh = J[ua]!, el = J[fa]!, wr = J[ha]!;
    g.skinFn = (_x, y) => {
      if (y > 1.2) return { a: ua, b: B.chest, w: smooth(1.39, 1.46, y) * 0.5 };
      if (y > 1.08) return { a: ua, b: fa, w: smooth(1.19, 1.09, y) };
      if (y > 0.93) return { a: fa, b: ua, w: 0 };
      return { a: fa, b: ha, w: smooth(0.93, 0.88, y) };
    };
    const sl = loose ? 1.3 : a.top === "tshirt" ? 1.25 : 1.1;
    const armR = Math.sqrt(bw);
    const upperC = a.top === "vest" ? (sleeveLong ? top : skin) : top;
    const lowerC = sleeveLong ? top : skin;
    const P = (j: Vector3, dy = 0, dx = 0) => new Vector3(j.x + dx * side, j.y + dy, j.z);
    const rings = [
      // Start inside the torso so the shoulder reads as one continuous surface.
      { p: P(sh, 0.025, -0.045), rx: 0.06 * armR * sl, rz: 0.062 * armR * sl, c: upperC },
      { p: P(sh, -0.04, 0.0), rx: 0.057 * armR * sl, rz: 0.057 * armR * sl, c: upperC },
      { p: P(sh, -0.16, 0.005), rx: 0.048 * armR * sl, rz: 0.05 * armR * sl, c: upperC },
    ];
    if (!sleeveLong) {
      rings.push({ p: P(sh, -0.19, 0.005), rx: 0.05 * armR * sl, rz: 0.051 * armR * sl, c: upperC });
      rings.push({ p: P(sh, -0.195, 0.005), rx: 0.042 * armR, rz: 0.043 * armR, c: skin });
    }
    rings.push({ p: P(el, 0.01), rx: 0.04 * armR * (sleeveLong ? sl : 1), rz: 0.042 * armR * (sleeveLong ? sl : 1), c: lowerC });
    rings.push({ p: P(el, -0.1), rx: 0.04 * armR * (sleeveLong ? sl : 1), rz: 0.044 * armR * (sleeveLong ? sl : 1), c: lowerC });
    if (sleeveLong) {
      rings.push({ p: P(wr, 0.05), rx: 0.038 * (loose ? 1.25 : 1.05), rz: 0.04 * (loose ? 1.25 : 1.05), c: trim });
      rings.push({ p: P(wr, 0.045), rx: 0.027, rz: 0.031, c: skin });
    }
    rings.push({ p: P(wr, 0.0), rx: 0.026, rz: 0.03, c: skin });
    g.loft(rings, 10, skin, true, true);
    // Hand: palm, four fingers and a thumb, all bound to the hand bone.
    g.uvMode = "skin";
    g.skinFn = null;
    g.skin = { a: ha, b: ha, w: 0 };
    const hx = wr.x, hy = wr.y, hz = wr.z;
    g.ellipsoid(hx, hy - 0.05, hz + 0.002, 0.017, 0.05, 0.042, 8, 6, skin);
    for (let i = 0; i < 4; i++) {
      const fz = hz - 0.026 + i * 0.0175;
      const len = [0.062, 0.072, 0.068, 0.055][i]!;
      const fy = hy - 0.092;
      g.loft([
        { p: new Vector3(hx, fy + 0.01, fz), rx: 0.0085, rz: 0.0085 },
        { p: new Vector3(hx - side * 0.004, fy - len * 0.55, fz), rx: 0.0078, rz: 0.008 },
        { p: new Vector3(hx - side * 0.014, fy - len, fz + 0.002), rx: 0.0068, rz: 0.007 },
      ], 6, skin, false, true);
    }
    g.loft([
      { p: new Vector3(hx - side * 0.006, hy - 0.035, hz + 0.03), rx: 0.011, rz: 0.011 },
      { p: new Vector3(hx - side * 0.018, hy - 0.07, hz + 0.045), rx: 0.0095, rz: 0.0095 },
      { p: new Vector3(hx - side * 0.026, hy - 0.095, hz + 0.05), rx: 0.0078, rz: 0.008 },
    ], 6, skin, false, true);
    if (a.kara && side > 0) g.torus(hx, hy + 0.035, hz, 0.036, 0.006, 14, 4, rgb("#c9cdd1"));
    g.skin = null;
    g.uvMode = "cloth";
  }

  // ---------------- Legs
  for (const side of [-1, 1] as const) {
    const [th, sh, ft] = side < 0 ? [B.thighL, B.shinL, B.footL] : [B.thighR, B.shinR, B.footR];
    const hip = J[th]!, knee = J[sh]!, ank = J[ft]!;
    g.skinFn = (_x, y) => {
      if (y > 0.9) return { a: th, b: B.hips, w: smooth(0.88, 0.97, y) * 0.6 };
      if (y > 0.43) return { a: th, b: sh, w: smooth(0.56, 0.45, y) };
      if (y > 0.13) return { a: sh, b: th, w: 0 };
      return { a: sh, b: ft, w: smooth(0.13, 0.09, y) };
    };
    const lw = Math.sqrt(bw) * (f ? 1.05 : 1);
    const baggy = a.bottom === "salwar" ? (loose ? 1.3 : 1.5) : a.bottom === "pajama" ? 1.15 : a.bottom === "trousers" ? 1.12 : 1.0;
    const ankleCuff = a.bottom === "salwar" ? 0.85 : 1;
    const L = (j: Vector3, dy: number) => new Vector3(j.x, j.y + dy, j.z);
    g.loft([
      { p: L(hip, 0.04), rx: 0.088 * lw * Math.min(baggy, 1.25), rz: 0.09 * lw * Math.min(baggy, 1.25), c: bottom },
      { p: L(hip, -0.12), rx: 0.08 * lw * baggy, rz: 0.083 * lw * baggy, c: bottom },
      { p: L(hip, -0.3), rx: 0.064 * lw * baggy, rz: 0.066 * lw * baggy, c: bottom },
      { p: L(knee, 0.02), rx: 0.052 * lw * baggy, rz: 0.056 * lw * baggy, c: bottom },
      { p: L(knee, -0.12), rx: 0.052 * lw * baggy * 0.95, rz: 0.058 * lw * baggy * 0.95, c: bottom },
      { p: L(ank, 0.12), rx: 0.04 * lw * baggy * ankleCuff, rz: 0.042 * lw * baggy * ankleCuff, c: bottom },
      { p: L(ank, 0.045), rx: 0.036 * (a.bottom === "salwar" ? 1.15 : baggy), rz: 0.038 * (a.bottom === "salwar" ? 1.15 : baggy), c: a.bottom === "salwar" ? shade(bottom, 0.85) : bottom },
      { p: L(ank, 0.02), rx: 0.03, rz: 0.032, c: skin },
    ], 10, bottom, false, true);
    // Footwear.
    g.skinFn = null;
    g.skin = { a: ft, b: ft, w: 0 };
    const sc = rgb(a.shoeColor);
    const fx = ank.x, fz = ank.z;
    if (a.shoes === "chappal") {
      g.uvMode = "skin";
      g.ellipsoid(fx, 0.04, fz + 0.06, 0.04, 0.03, 0.11, 10, 6, skin, -0.2, 1);
      g.uvMode = "cloth";
      g.box(fx, 0.008, fz + 0.06, 0.09, 0.016, 0.25, sc);
      g.box(fx, 0.045, fz + 0.11, 0.085, 0.012, 0.035, shade(sc, 0.8));
    } else {
      const toe = a.shoes === "jutti" ? 0.145 : 0.125;
      g.ellipsoid(fx, 0.038, fz + 0.05, 0.047, 0.046, toe, 12, 7, sc, -0.45, 1);
      g.box(fx, 0.012, fz + 0.05, 0.09, 0.024, toe * 2 - 0.02, a.shoes === "sneaker" ? rgb("#f2f2f2") : shade(sc, 0.5));
      if (a.shoes === "jutti") {
        // Curled toe and gold embroidery band, a Punjabi jutti signature.
        g.ellipsoid(fx, 0.04, fz + 0.05 + toe * 0.95, 0.012, 0.014, 0.025, 6, 4, sc);
        g.box(fx, 0.06, fz + 0.1, 0.092, 0.018, 0.06, rgb("#d4a52a"));
      }
    }
    g.skin = null;
  }

  // ---------------- Head and face (head bone)
  g.skinFn = null;
  const hs = a.age === "child" ? 1.12 : 1;
  const H = (x: number, y: number, z: number) => new Vector3(x * hs, 1.55 + (y - 1.55) * hs, z * hs);
  g.skin = { a: B.head, b: B.head, w: 0 };
  g.uvMode = "skin";
  const hc = H(0, 1.655, 0.012);
  g.ellipsoid(hc.x, hc.y, hc.z, 0.084 * hs, 0.108 * hs, 0.098 * hs, 16, 12, skin);
  const jaw = H(0, 1.6, 0.03);
  g.ellipsoid(jaw.x, jaw.y, jaw.z, (f ? 0.066 : 0.072) * hs, 0.058 * hs, 0.078 * hs, 12, 8, skin);
  const nose = H(0, 1.64, 0.103);
  g.ellipsoid(nose.x, nose.y, nose.z, 0.014 * hs, 0.026 * hs, 0.02 * hs, 8, 6, shade(skin, 0.96));
  for (const s of [-1, 1]) {
    const ear = H(0.083 * s, 1.65, 0.0);
    g.ellipsoid(ear.x, ear.y, ear.z, 0.012 * hs, 0.028 * hs, 0.019 * hs, 8, 6, shade(skin, 0.92));
    const eye = H(0.031 * s, 1.672, 0.084);
    g.ellipsoid(eye.x, eye.y, eye.z, 0.0145 * hs, 0.0085 * hs, 0.009 * hs, 8, 6, rgb("#f1ece2"));
    const iris = H(0.031 * s, 1.672, 0.0915);
    g.ellipsoid(iris.x, iris.y, iris.z, 0.0068 * hs, 0.0068 * hs, 0.0035 * hs, 8, 6, rgb("#2b1a10"));
    const brow = H(0.033 * s, 1.692, 0.091);
    g.box(brow.x, brow.y, brow.z, 0.03 * hs, 0.006 * hs, 0.008 * hs, a.age === "elder" ? rgb("#cfcac2") : shade(hair, 0.9));
    const cheek = H(0.04 * s, 1.63, 0.066);
    g.ellipsoid(cheek.x, cheek.y, cheek.z, 0.026 * hs, 0.02 * hs, 0.02 * hs, 8, 6, shade(skin, 1.02));
  }
  const mouth = H(0, 1.598, 0.097);
  g.ellipsoid(mouth.x, mouth.y, mouth.z, 0.021 * hs, 0.0055 * hs, 0.006 * hs, 8, 4, lipC);
  g.uvMode = "cloth";
  // Hair.
  if (a.hair !== "bald" && a.headwear !== "turban") {
    const hcap = H(0, 1.672, -0.004);
    g.ellipsoid(hcap.x, hcap.y, hcap.z, 0.09 * hs, 0.104 * hs, 0.104 * hs, 14, 8, hair, 0.0, 1);
    const back = H(0, 1.64, -0.03);
    g.ellipsoid(back.x, back.y, back.z, 0.087 * hs, 0.085 * hs, 0.085 * hs, 12, 8, hair, -0.4, 1);
    if (a.hair === "bun") {
      const bun = H(0, 1.66, -0.105);
      g.ellipsoid(bun.x, bun.y, bun.z, 0.045 * hs, 0.042 * hs, 0.035 * hs, 10, 6, hair);
    }
    if (a.hair === "long") {
      const l = H(0, 1.5, -0.075);
      g.ellipsoid(l.x, l.y, l.z, 0.085 * hs, 0.14 * hs, 0.035 * hs, 10, 6, hair);
    }
  }
  if (a.hair === "braid") {
    g.skin = null;
    g.skinFn = (_x, y) => ({ a: B.chest, b: B.head, w: smooth(1.45, 1.6, y) });
    g.loft([
      { p: H(0, 1.62, -0.095), rx: 0.03, rz: 0.03, c: hair },
      { p: new Vector3(0, 1.45, -0.115), rx: 0.025, rz: 0.022, c: hair },
      { p: new Vector3(0, 1.22, -0.13), rx: 0.018, rz: 0.016, c: hair },
      { p: new Vector3(0, 1.15, -0.13), rx: 0.012, rz: 0.012, c: rgb("#c2185b") },
    ], 8, hair, false, true);
    g.skinFn = null;
    g.skin = { a: B.head, b: B.head, w: 0 };
  }
  // Beard and moustache.
  if (a.beard !== "none") {
    const bc = a.age === "elder" ? rgb("#e2ddd4") : hair;
    if (a.beard === "full") {
      const bd = H(0, 1.59, 0.042);
      g.ellipsoid(bd.x, bd.y, bd.z, 0.077 * hs, 0.07 * hs, 0.066 * hs, 12, 8, bc, -1, 0.15);
      const bd2 = H(0, 1.56, 0.062);
      g.ellipsoid(bd2.x, bd2.y, bd2.z, 0.045 * hs, 0.04 * hs, 0.04 * hs, 10, 6, bc);
    }
    if (a.beard === "stubble") {
      const bd = H(0, 1.59, 0.04);
      g.ellipsoid(bd.x, bd.y, bd.z, 0.077 * hs, 0.068 * hs, 0.072 * hs, 12, 8, shade(skin, 0.75), -1, 0.2);
    }
    if (a.beard === "full" || a.beard === "mustache") {
      for (const s of [-1, 1]) {
        const m = H(0.018 * s, 1.613, 0.1);
        g.ellipsoid(m.x, m.y, m.z, 0.022 * hs, 0.008 * hs, 0.01 * hs, 8, 4, bc);
      }
    }
  }
  // Headwear.
  if (a.headwear === "turban") {
    const tc = rgb(a.headColor ?? "#1f3b73");
    const tdark = shade(tc, 0.82);
    const t0 = H(0, 1.7, -0.01);
    g.ellipsoid(t0.x, t0.y, t0.z, 0.102 * hs, 0.082 * hs, 0.118 * hs, 16, 10, tc, -0.35, 1);
    // Layered folds rising to a point at the front: the dumalla/pagg silhouette.
    for (let i = 0; i < 3; i++) {
      const y = 1.705 + i * 0.025;
      const fold = H(0, y, 0.012 + i * 0.008);
      g.ellipsoid(fold.x, fold.y, fold.z, (0.104 - i * 0.012) * hs, 0.026 * hs, (0.118 - i * 0.008) * hs, 16, 5, i % 2 ? tdark : tc);
    }
    const peak = H(0, 1.775, 0.03);
    g.ellipsoid(peak.x, peak.y, peak.z, 0.07 * hs, 0.045 * hs, 0.085 * hs, 12, 6, tc);
    const back = H(0, 1.69, -0.085);
    g.ellipsoid(back.x, back.y, back.z, 0.085 * hs, 0.06 * hs, 0.05 * hs, 10, 6, tdark);
  } else if (a.headwear === "patka") {
    const pc = rgb(a.headColor ?? "#e65100");
    const p0 = H(0, 1.69, -0.005);
    g.ellipsoid(p0.x, p0.y, p0.z, 0.094 * hs, 0.088 * hs, 0.106 * hs, 14, 8, pc, -0.2, 1);
    const knot = H(0, 1.79, 0.02);
    g.ellipsoid(knot.x, knot.y, knot.z, 0.04 * hs, 0.035 * hs, 0.04 * hs, 8, 6, pc);
  } else if (a.headwear === "cap") {
    const cc = rgb(a.headColor ?? "#455a64");
    const c0 = H(0, 1.7, -0.005);
    g.ellipsoid(c0.x, c0.y, c0.z, 0.093 * hs, 0.08 * hs, 0.103 * hs, 14, 8, cc, 0.0, 1);
    const brim = H(0, 1.712, 0.1);
    g.box(brim.x, brim.y, brim.z, 0.15 * hs, 0.01 * hs, 0.08 * hs, shade(cc, 0.8));
  }
  g.skin = null;

  // ---------------- Dupatta (or tailor's tape) draped round the neck, ends falling.
  const drape = a.dupatta ?? a.tape;
  if (drape) {
    const dc = rgb(drape);
    const tape = !a.dupatta;
    const wd = tape ? 0.018 : 0.06;
    g.skinFn = (_x, y) => ({ a: B.chest, b: B.spine, w: y < 1.2 ? 0.5 : 0 });
    if (tape) {
      for (const sd of [-1, 1]) {
        g.loft([
          { p: new Vector3(0.09 * sd, 1.36, 0.125), rx: wd, rz: 0.007, c: dc },
          { p: new Vector3(0.12 * sd, 1.46, 0.05), rx: wd, rz: 0.007, c: dc },
          { p: new Vector3(0.12 * sd, 1.46, -0.06), rx: wd, rz: 0.007, c: dc },
        ], 6, dc);
        g.loft([{ p: new Vector3(0.09 * sd, 1.36, 0.125), rx: wd, rz: 0.006, c: dc }, { p: new Vector3(0.1 * sd, 1.0, 0.15), rx: wd, rz: 0.006, c: dc }], 4, dc);
      }
    } else {
      // Over both shoulders, then one soft panel falling down the back to the waist.
      for (const sd of [-1, 1]) {
        g.loft([
          { p: new Vector3(0.1 * sd, 1.35, 0.125), rx: 0.05, rz: 0.006, c: dc },
          { p: new Vector3(0.12 * sd, 1.46, 0.04), rx: 0.05, rz: 0.006, c: dc },
          { p: new Vector3(0.11 * sd, 1.45, -0.08), rx: 0.05, rz: 0.006, c: dc },
        ], 6, dc);
      }
      const back = shade(dc, 0.92);
      g.loft([
        { p: new Vector3(0, 1.43, -0.105), rx: 0.15, rz: 0.006, c: dc },
        { p: new Vector3(0, 1.25, -0.135), rx: 0.15, rz: 0.006, c: back },
        { p: new Vector3(0, 1.05, -0.15), rx: 0.14, rz: 0.006, c: back },
        { p: new Vector3(0, 0.92, -0.16), rx: 0.13, rz: 0.006, c: back },
      ], 8, dc);
    }
    if (!tape) {
      g.loft([
        { p: new Vector3(-0.09, 1.36, 0.125), rx: 0.04, rz: 0.007, c: dc },
        { p: new Vector3(0, 1.27, 0.15), rx: 0.045, rz: 0.007, c: dc },
        { p: new Vector3(0.09, 1.36, 0.125), rx: 0.04, rz: 0.007, c: dc },
      ], 6, dc);
    }
  }
  g.skinFn = null;

  // ---------------- Skeleton
  const scale = a.height / 1.72;
  const root = new TransformNode(`${name}_root`, scene);
  const mesh = g.toMesh(`${name}_mesh`, scene, material);
  mesh.parent = root;
  mesh.isPickable = false;
  const skeleton = new Skeleton(`${name}_skel`, `${name}_skel`, scene);
  const bones: Bone[] = [];
  for (let i = 0; i < BONE_COUNT; i++) {
    const p = PARENT[i]!;
    const local = p < 0 ? J[i]!.clone() : J[i]!.subtract(J[p]!);
    const bone = new Bone(NAMES[i]!, skeleton, p < 0 ? null : bones[p]!, Matrix.Translation(local.x, local.y, local.z));
    bones.push(bone);
  }
  mesh.skeleton = skeleton;
  mesh.numBoneInfluencers = 2;
  root.scaling.setAll(scale);
  // Skinned meshes move; keep their bounds generous so they are never culled wrongly.
  mesh.alwaysSelectAsActiveMesh = false;
  mesh.refreshBoundingInfo({ applySkeleton: false });
  return { root, mesh, skeleton, bones, rest: J, scale };
}
