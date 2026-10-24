import { Vector3 } from "../babylon";
import { rgb, shade, type RGB } from "../render/GeoBuilder";
import { Rng } from "../render/textures";
import type { Kit } from "./Kit";
import { BUILDINGS, COURTYARD, CURB_H, FRONTAGE, LANE_W, facadeToWorld, footprint } from "./layout";
import { roofHeight } from "./buildings";
import { charpai } from "./interiors";

const IRON: RGB = rgb("#2b2b2e");

/** Static circles pedestrians steer around (filled while props are built). */
export const OBSTACLES: Array<{ x: number; z: number; r: number }> = [];
const obstacle = (x: number, z: number, r: number) => OBSTACLES.push({ x, z, r });
const WIRE: RGB = rgb("#151515");

/** A sagging cable as a chain of thin tubes. */
export function wire(kit: Kit, a: Vector3, b: Vector3, sag: number, r = 0.012): void {
  const n = 10;
  let prev = a;
  for (let i = 1; i <= n; i++) {
    const t = i / n;
    const p = Vector3.Lerp(a, b, t);
    p.y -= sag * 4 * t * (1 - t);
    kit.g("metal").tube(prev, p, r, 3, WIRE);
    prev = p;
  }
}

interface Pole { top: Vector3; arm: Vector3[] }

function electricPole(kit: Kit, x: number, z: number, lamp: boolean, transformer: boolean, armDir: 1 | -1): Pole {
  kit.world();
  const h = 8.6;
  const c = rgb("#b0aaa0");
  const g = kit.g("concrete");
  // Tapered rectangular concrete pole.
  const segs = 4;
  for (let i = 0; i < segs; i++) {
    const t0 = i / segs, t1 = (i + 1) / segs;
    const w0 = 0.26 - t0 * 0.1, w1 = 0.26 - t1 * 0.1;
    g.box(x, CURB_H + h * (t0 + t1) / 2, z, (w0 + w1) / 2, h / segs, (w0 + w1) / 2, shade(c, 1 - i * 0.03));
  }
  kit.colliders.add(x, CURB_H + 1.5, z, 0.3, 3, 0.3);
  obstacle(x, z, 0.3);
  const top = new Vector3(x, CURB_H + h - 0.3, z);
  // Cross-arm with insulators.
  const m = kit.g("metal");
  m.boxMinMax(x - 0.06, top.y - 0.06, z - 0.7, x + 0.06, top.y + 0.04, z + 0.7, IRON);
  const arm: Vector3[] = [];
  for (const dz of [-0.6, -0.2, 0.2, 0.6]) {
    kit.g("paint").cylinder(x, top.y + 0.04, z + dz, 0.04, 0.03, 0.12, 6, rgb("#e8e2d4"));
    arm.push(new Vector3(x, top.y + 0.14, z + dz));
  }
  if (lamp) {
    // Street lamp arm reaching over the road.
    const ly = CURB_H + 6.2;
    m.tube(new Vector3(x, ly, z), new Vector3(x + armDir * 1.6, ly + 0.5, z), 0.035, 5, rgb("#55595c"));
    m.boxMinMax(x + armDir * 1.6 - 0.3, ly + 0.38, z - 0.1, x + armDir * 1.6 + 0.3, ly + 0.5, z + 0.1, rgb("#55595c"));
    kit.g("emissive").boxMinMax(x + armDir * 1.6 - 0.26, ly + 0.36, z - 0.08, x + armDir * 1.6 + 0.26, ly + 0.38, z + 0.08, [1, 1, 1]);
  }
  if (transformer) {
    m.boxMinMax(x - 0.35, CURB_H + 4.2, z - 0.8, x + 0.35, CURB_H + 4.3, z + 0.8, IRON);
    kit.g("paint").boxMinMax(x - 0.3, CURB_H + 4.3, z - 0.55, x + 0.3, CURB_H + 5.3, z + 0.55, rgb("#6f7f6a"));
    for (const dz of [-0.4, 0, 0.4]) kit.g("paint").cylinder(x, CURB_H + 5.3, z + dz, 0.05, 0.03, 0.3, 6, rgb("#c9632c"));
    for (let i = 0; i < 6; i++) m.boxMinMax(x - 0.32 - 0.02, CURB_H + 4.4 + i * 0.14, z - 0.5, x - 0.32, CURB_H + 4.45 + i * 0.14, z + 0.5, rgb("#55604f"));
  }
  // Tangle of service cables wrapped near the top.
  for (let i = 0; i < 3; i++) kit.g("metal").torus(x, CURB_H + 6.8 + i * 0.12, z, 0.18, 0.025, 10, 3, WIRE);
  return { top, arm };
}

export function buildPolesAndWires(kit: Kit): void {
  const rng = new Rng(12);
  // Poles sit just behind the kerb so the footpath stays clear.
  const wx = -4.35, ex = 4.35;
  const westZ = [-60, -43, -24.5, -2.5, 14.5, 33];
  const eastZ = [-62, -45, -24, -4, 13, 39];
  const west = westZ.map((z, i) => electricPole(kit, wx, z, i % 2 === 0, false, 1));
  const east = eastZ.map((z, i) => electricPole(kit, ex, z, i % 2 === 1, i === 3, -1));
  kit.world();
  for (const line of [west, east]) {
    for (let i = 0; i < line.length - 1; i++) {
      for (let k = 0; k < 4; k++) wire(kit, line[i]!.arm[k]!, line[i + 1]!.arm[k]!, 0.35 + k * 0.05);
    }
  }
  // Cross-street cables.
  for (let i = 0; i < Math.min(west.length, east.length); i += 2) wire(kit, west[i]!.arm[3]!, east[i]!.arm[0]!, 0.6);
  // Service drops from the nearest pole to each building façade.
  for (const b of BUILDINGS) {
    if (b.side !== "west" && b.side !== "east") continue;
    const mid = facadeToWorld(b, (b.a1 - b.a0) * rng.range(0.25, 0.75), 0.05);
    const poles = b.side === "west" ? west : east;
    let best = poles[0]!;
    for (const p of poles) if (Math.abs(p.top.z - mid.z) < Math.abs(best.top.z - mid.z)) best = p;
    const y = Math.min(roofHeight(b) - 0.8, 5.6);
    const target = new Vector3(mid.x, y, mid.z);
    wire(kit, best.arm[rng.int(0, 3)]!, target, 0.4, 0.009);
    if (rng.next() < 0.5) wire(kit, best.arm[rng.int(0, 3)]!, target.add(new Vector3(0, -0.3, rng.range(-0.8, 0.8))), 0.6, 0.009);
    kit.g("paint").boxMinMax(target.x - 0.05, y - 0.08, target.z - 0.05, target.x + 0.05, y + 0.08, target.z + 0.05, rgb("#e0dccf"));
  }
  // Lane cables zig-zag between houses.
  for (let x = LANE_W.x0 + 3; x < LANE_W.x1 - 2; x += 5) {
    wire(kit, new Vector3(x, 5.2, LANE_W.z0 - 0.02), new Vector3(x + 2.5, 5.3, LANE_W.z1 + 0.02), 0.3, 0.01);
  }
  // Street name signs.
  signPost(kit, -4.6, -12.4, Math.PI / 2, "lane3");
  signPost(kit, 4.6, -63, -Math.PI / 2, "mainSt");
}

function signPost(kit: Kit, x: number, z: number, rotY: number, key: string): void {
  kit.world();
  kit.g("metal").cylinder(x, CURB_H, z, 0.04, 0.04, 2.6, 6, rgb("#5e6163"));
  kit.colliders.add(x, 1.4, z, 0.12, 2.6, 0.12);
  kit.signAt(key, x, CURB_H + 2.35, z, rotY, 1.0);
  kit.signAt(key, x, CURB_H + 2.35, z, rotY + Math.PI, 1.0);
}

/** Neem / peepal tree with a trunk loft, branches and leafy canopy blobs. */
export function tree(kit: Kit, x: number, z: number, y0: number, kind: "neem" | "peepal", seed: number, guard: boolean): void {
  kit.world();
  const rng = new Rng(seed);
  const bark = kind === "neem" ? rgb("#6b5a48") : rgb("#8a7d6b");
  const trunkH = kind === "neem" ? 2.6 : 3.2;
  const r0 = kind === "neem" ? 0.22 : 0.42;
  const rings: Array<{ p: Vector3; rx: number; rz: number }> = [];
  for (let i = 0; i <= 5; i++) {
    const t = i / 5;
    rings.push({ p: new Vector3(x + Math.sin(t * 2 + seed) * 0.15 * t, y0 + t * trunkH, z + Math.cos(t * 3 + seed) * 0.12 * t), rx: r0 * (1.25 - t * 0.5), rz: r0 * (1.2 - t * 0.5) });
  }
  kit.g("wood").loft(rings, 10, bark, false, true);
  kit.colliders.add(x, y0 + 1.2, z, r0 * 2.1, 2.4, r0 * 2.1);
  obstacle(x, z, guard ? 0.7 : r0 + 0.3);
  const crown = rings[rings.length - 1]!.p;
  const leafBase = kind === "neem" ? rgb("#6a8a3c") : rgb("#5b8a36");
  const nBranch = kind === "neem" ? 6 : 8;
  const spread = kind === "neem" ? 2.3 : 3.8;
  const ends: Vector3[] = [];
  for (let i = 0; i < nBranch; i++) {
    const a = (i / nBranch) * Math.PI * 2 + rng.range(-0.3, 0.3);
    const end = crown.add(new Vector3(Math.cos(a) * spread * rng.range(0.55, 0.95), rng.range(0.9, 2.2), Math.sin(a) * spread * rng.range(0.55, 0.95)));
    const mid = Vector3.Lerp(crown, end, 0.5).add(new Vector3(0, 0.3, 0));
    kit.g("wood").loft([{ p: crown, rx: r0 * 0.5, rz: r0 * 0.5 }, { p: mid, rx: r0 * 0.3, rz: r0 * 0.3 }, { p: end, rx: r0 * 0.12, rz: r0 * 0.12 }], 6, bark);
    ends.push(end);
  }
  ends.push(crown.add(new Vector3(0, kind === "neem" ? 2.6 : 3.6, 0)));
  // Foliage: clusters of small clumps around each branch end, darker beneath.
  for (const e of ends) {
    const n = kit.lean ? 3 : kind === "neem" ? 4 : 5;
    for (let i = 0; i < n; i++) {
      const s = rng.range(0.6, 1.15) * (kind === "neem" ? 1 : 1.25);
      const o = new Vector3(rng.range(-1, 1), rng.range(-0.4, 0.7), rng.range(-1, 1)).scale(kind === "neem" ? 0.9 : 1.3);
      const c = shade(leafBase, rng.range(0.78, 1.15));
      const hue: RGB = [c[0] * rng.range(0.9, 1.1), c[1], c[2] * rng.range(0.85, 1.1)];
      kit.g("leaf").ellipsoid(e.x + o.x, e.y + o.y, e.z + o.z, s, s * 0.7, s, 7, 4, hue, -1, 1, 0.5);
    }
  }
  if (guard) {
    // Brick tree guard with a whitewashed rim, common on bazaar footpaths.
    const g = kit.g("brick");
    const hs = 0.55, h = 0.55;
    g.boxMinMax(x - hs, y0, z - hs, x + hs, y0 + h, z - hs + 0.12, [1, 1, 1]);
    g.boxMinMax(x - hs, y0, z + hs - 0.12, x + hs, y0 + h, z + hs, [1, 1, 1]);
    g.boxMinMax(x - hs, y0, z - hs, x - hs + 0.12, y0 + h, z + hs, [1, 1, 1]);
    g.boxMinMax(x + hs - 0.12, y0, z - hs, x + hs, y0 + h, z + hs, [1, 1, 1]);
    kit.g("plaster").boxMinMax(x - hs - 0.01, y0 + h, z - hs - 0.01, x + hs + 0.01, y0 + h + 0.05, z + hs + 0.01, rgb("#f2efe8"));
    kit.colliders.add(x, y0 + h / 2, z, hs * 2, h, hs * 2);
  }
}

function bicycle(kit: Kit, x: number, z: number, y0: number, rotY: number, c: RGB): void {
  kit.frame(x, z, rotY, y0);
  const m = kit.g("metal");
  const r = 0.34;
  for (const zz of [-0.52, 0.52]) {
    kit.g("rubber").torus(0, r, zz, r, 0.025, 18, 4, [1, 1, 1], "x");
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI;
      m.tube(new Vector3(0, r + Math.sin(a) * r, zz + Math.cos(a) * r), new Vector3(0, r - Math.sin(a) * r, zz - Math.cos(a) * r), 0.004, 3, rgb("#c0c0c0"));
    }
  }
  const P = (y: number, zz: number) => new Vector3(0, y, zz);
  const crank = P(0.32, -0.02), seat = P(0.85, -0.2), head = P(0.88, 0.38);
  m.tube(P(r, -0.52), crank, 0.018, 5, c);
  m.tube(crank, seat, 0.02, 5, c);
  m.tube(seat, head, 0.02, 5, c);
  m.tube(crank, head, 0.022, 5, c);
  m.tube(P(r, -0.52), seat, 0.015, 5, c);
  m.tube(head, P(r, 0.52), 0.018, 5, c);
  m.tube(head, P(1.02, 0.3), 0.015, 5, c);
  m.tube(new Vector3(-0.28, 1.02, 0.3), new Vector3(0.28, 1.02, 0.3), 0.014, 5, rgb("#9a9a9a"));
  kit.g("rubber").box(0, 0.9, -0.22, 0.12, 0.05, 0.24, [1, 1, 1]);
  kit.g("metal").box(0, 0.62, -0.62, 0.12, 0.02, 0.3, rgb("#555555"));
  kit.collide(0, 0.5, 0, 0.3, 1.0, 1.6);
  obstacle(x, z, 0.75);
  kit.world();
}

function handcart(kit: Kit, x: number, z: number, rotY: number, fruit: RGB[], seed: number): void {
  const rng = new Rng(seed);
  kit.frame(x, z, rotY);
  const wood = kit.g("wood");
  const c = rgb("#7a5230");
  wood.boxMinMax(-0.6, 0.75, -1.0, 0.6, 0.82, 1.0, c);
  wood.boxMinMax(-0.62, 0.82, -1.02, 0.62, 0.95, -0.95, c);
  wood.boxMinMax(-0.62, 0.82, 0.95, 0.62, 0.95, 1.02, c);
  // Bicycle-style wheels and a stand.
  for (const xx of [-0.65, 0.65]) kit.g("rubber").torus(xx, 0.36, 0, 0.36, 0.03, 16, 4, [1, 1, 1], "x");
  kit.g("metal").tube(new Vector3(-0.65, 0.36, 0), new Vector3(0.65, 0.36, 0), 0.02, 5, IRON);
  kit.g("metal").boxMinMax(-0.04, 0, 0.85, 0.04, 0.75, 0.92, IRON);
  kit.g("metal").tube(new Vector3(-0.3, 0.8, -1.0), new Vector3(-0.3, 0.9, -1.6), 0.02, 4, IRON);
  kit.g("metal").tube(new Vector3(0.3, 0.8, -1.0), new Vector3(0.3, 0.9, -1.6), 0.02, 4, IRON);
  // Fruit pyramid.
  for (let layer = 0; layer < (kit.lean ? 2 : 3); layer++) {
    for (let i = -3 + layer; i <= 3 - layer; i++) {
      for (let j = -5 + layer; j <= 5 - layer; j++) {
        const f = fruit[(Math.abs(i * 3 + j) >> 2) % fruit.length]!;
        kit.g("paint").ellipsoid(i * 0.15 + rng.range(-0.01, 0.01), 0.88 + layer * 0.1, j * 0.15, 0.078, 0.07, 0.078, 5, 3, shade(f, rng.range(0.8, 1.05)));
      }
    }
  }
  // Umbrella.
  kit.g("metal").tube(new Vector3(0.5, 0.8, 0.8), new Vector3(0.5, 2.3, 0.8), 0.02, 4, IRON);
  kit.g("fabric").cylinder(0.5, 2.15, 0.8, 1.0, 0.05, 0.35, 10, rgb("#2e86c1"), false);
  kit.collide(0, 0.55, 0, 1.4, 1.1, 2.2);
  obstacle(x, z - 0.6, 0.9);
  obstacle(x, z + 0.6, 0.9);
  kit.world();
}

function fruitStall(kit: Kit): void {
  // Sloped wooden display boards in front of Pammi's shop (east side).
  const b = BUILDINGS.find((x) => x.id === "e_fruit")!;
  const f = footprint(b);
  kit.frame(FRONTAGE, f.z0, -Math.PI / 2);
  const rng = new Rng(9);
  const fruitCols = ["#e8912a", "#e3c13b", "#b8322a", "#6f9e3a", "#d9752b", "#6d3a5c"].map(rgb);
  const wood = kit.g("wood");
  for (let k = 0; k < 3; k++) {
    const u0 = 1.2 + k * 3.2, u1 = u0 + 2.8;
    wood.boxMinMax(u0, CURB_H, 0.1, u1, CURB_H + 0.6, 0.9, rgb("#8a6038"));
    const g = kit.g("paint");
    const col = fruitCols[(k * 2) % fruitCols.length]!;
    for (let r = 0; r < 5; r++) {
      for (let u = u0 + 0.1; u < u1 - 0.08; u += 0.16) {
        const y = CURB_H + 0.64 + r * 0.07, z = 0.82 - r * 0.14;
        const cc = u < (u0 + u1) / 2 ? col : fruitCols[(k * 2 + 1) % fruitCols.length]!;
        g.ellipsoid(u + rng.range(-0.015, 0.015), y, z, 0.078, 0.07, 0.078, 5, 3, shade(cc, rng.range(0.8, 1.05)));
      }
    }
    kit.collide((u0 + u1) / 2, CURB_H + 0.45, 0.5, u1 - u0, 0.9, 0.8);
    for (let u = u0 + 0.4; u < u1; u += 0.9) { const w = kit.toWorld(u, 0, 0.5); obstacle(w.x, w.z, 0.5); }
  }
  // Banana bunches hanging from the awning.
  for (let u = 1.5; u < 10; u += 1.3) {
    for (let i = 0; i < 6; i++) kit.g("paint").cylinder(u + (i % 3) * 0.06, 2.0 - Math.floor(i / 3) * 0.2, 0.9 + (i % 2) * 0.05, 0.03, 0.025, 0.22, 5, rgb("#e5c33a"));
  }
  kit.world();
}

export function buildProps(kit: Kit): void {
  // Trees: neem along the footpaths, a big peepal in the courtyard.
  tree(kit, -5.3, 7.8, CURB_H, "neem", 3, true);
  tree(kit, 5.3, -42.8, CURB_H, "neem", 4, true);
  tree(kit, 5.3, 42.5, CURB_H, "neem", 8, true);
  tree(kit, -5.3, -57, CURB_H, "neem", 6, true);
  tree(kit, (COURTYARD.x0 + COURTYARD.x1) / 2 - 1, (COURTYARD.z0 + COURTYARD.z1) / 2 + 4, 0, "peepal", 11, false);
  courtyardPlatform(kit);
  // Carts and stalls.
  handcart(kit, 3.0, -55.5, 0, ["#f39c12", "#e74c3c", "#f1c40f"].map(rgb), 21);
  handcart(kit, -3.1, 24, 0, ["#7cb342", "#c0392b", "#fbc02d"].map(rgb), 22);
  fruitStall(kit);
  // Bicycles outside the cycle shop and in the courtyard.
  const bikeCols = ["#1f3b73", "#111111", "#a31d1d", "#2e7d32"].map(rgb);
  for (let i = 0; i < 4; i++) bicycle(kit, -5.9, -4.6 + i * 0.75 + (i > 1 ? 4.6 : 0), CURB_H, Math.PI / 2, bikeCols[i]!);
  bicycle(kit, -43.5, -2, 0, 0.3, bikeCols[1]!);
  // Charpai and handpump in the courtyard.
  charpai(kit, -37.6, -15.5, 0, 0);
  obstacle(-37.6, -15.5, 1.1);
  kit.world();
  handpump(kit, -44.2, -10.5);
  // Bins and planters.
  for (const [x, z] of [[-5.9, -21.5], [5.9, 4.5], [5.9, -66.5]] as const) {
    kit.g("paint").cylinder(x, CURB_H, z, 0.26, 0.3, 0.75, 12, rgb("#2e7d32"), true, 1, rgb("#1b5e20"));
    kit.colliders.add(x, CURB_H + 0.37, z, 0.6, 0.75, 0.6);
    obstacle(x, z, 0.4);
  }
  for (const [x, z] of [[-6.2, 30], [6.2, 36], [-6.2, -64]] as const) planter(kit, x, z);
}

function planter(kit: Kit, x: number, z: number): void {
  kit.world();
  kit.g("dirt").cylinder(x, CURB_H, z, 0.22, 0.3, 0.45, 12, rgb("#a4532f"), true, 1, rgb("#5a3a22"));
  for (let i = 0; i < 5; i++) kit.g("leaf").ellipsoid(x + Math.cos(i) * 0.12, CURB_H + 0.6 + (i % 2) * 0.1, z + Math.sin(i) * 0.12, 0.18, 0.22, 0.18, 7, 5, rgb("#4f8a3a"));
  kit.colliders.add(x, CURB_H + 0.3, z, 0.6, 0.6, 0.6);
  obstacle(x, z, 0.4);
}

function handpump(kit: Kit, x: number, z: number): void {
  const m = kit.g("metal");
  const c = rgb("#2f5f8a");
  kit.g("concrete").boxMinMax(x - 0.6, 0, z - 0.6, x + 0.6, 0.12, z + 0.6, rgb("#a8a196"));
  m.cylinder(x, 0.12, z, 0.07, 0.07, 1.0, 10, c);
  m.cylinder(x, 1.1, z, 0.1, 0.09, 0.3, 10, c);
  m.tube(new Vector3(x, 1.0, z), new Vector3(x + 0.35, 0.85, z), 0.03, 6, c);
  m.tube(new Vector3(x, 1.38, z), new Vector3(x - 0.8, 1.15, z), 0.025, 6, c);
  kit.colliders.add(x, 0.7, z, 0.3, 1.4, 0.3);
  obstacle(x, z, 0.7);
}

function courtyardPlatform(kit: Kit): void {
  // Raised chabutra around the peepal with seating ledge.
  kit.world();
  const cx = (COURTYARD.x0 + COURTYARD.x1) / 2 - 1, cz = (COURTYARD.z0 + COURTYARD.z1) / 2 + 4;
  const g = kit.g("plaster");
  g.cylinder(cx, 0, cz, 1.9, 1.9, 0.45, 20, rgb("#e6d8bd"), true, 1, rgb("#d8c6a2"));
  kit.colliders.add(cx, 0.22, cz, 2.8, 0.45, 2.8);
  obstacle(cx, cz, 2.2);
  for (let i = 0; i < 4; i++) {
    const a = i * Math.PI / 2 + Math.PI / 4;
    kit.colliders.add(cx + Math.cos(a) * 1.2, 0.22, cz + Math.sin(a) * 1.2, 1.2, 0.45, 1.2, a);
  }
  kit.g("paint").torus(cx, 0.9, cz, 0.5, 0.03, 16, 4, rgb("#d32f2f"));
}
