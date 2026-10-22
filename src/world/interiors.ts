import { Vector3 } from "../babylon";
import { rgb, shade, type RGB } from "../render/GeoBuilder";
import { Rng } from "../render/textures";
import type { Kit } from "./Kit";
import { facadeFrame, type BuildingSpec } from "./layout";
import { GROUND_TOP, awning } from "./buildings";

export const DHABA_FLOOR = 0.3;
const STEEL: RGB = rgb("#b9bec2");
const IRON: RGB = rgb("#2b2b2e");

export interface InteriorInfo {
  fans: Vector3[];
  lights: Vector3[];
  /** World-space seats (position + facing yaw) for seated residents. */
  seats: Array<{ x: number; y: number; z: number; yaw: number }>;
}

/** Table + two benches. Local coordinates, table centred at (u, z). */
function tableSet(kit: Kit, u: number, z: number, y0: number, info: InteriorInfo, toYaw: number): void {
  const wood = kit.g("wood");
  const top = rgb("#8a5a33"), leg = rgb("#5e3c22");
  wood.boxMinMax(u - 0.65, y0 + 0.72, z - 0.38, u + 0.65, y0 + 0.77, z + 0.38, top);
  for (const [dx, dz] of [[-0.58, -0.3], [0.58, -0.3], [-0.58, 0.3], [0.58, 0.3]] as const) wood.boxMinMax(u + dx - 0.03, y0, z + dz - 0.03, u + dx + 0.03, y0 + 0.72, z + dz + 0.03, leg);
  kit.collide(u, y0 + 0.39, z, 1.3, 0.78, 0.76);
  // Steel plates and glasses.
  for (const dx of [-0.35, 0.35]) {
    kit.g("chrome").cylinder(u + dx, y0 + 0.77, z - 0.15, 0.13, 0.14, 0.02, 12, STEEL);
    kit.g("chrome").cylinder(u + dx, y0 + 0.77, z + 0.15, 0.13, 0.14, 0.02, 12, STEEL);
    kit.g("glass").cylinder(u + dx + 0.18, y0 + 0.77, z, 0.035, 0.04, 0.11, 8, [1, 1, 1]);
  }
  for (const side of [-1, 1]) {
    const bz = z + side * 0.62;
    wood.boxMinMax(u - 0.65, y0 + 0.43, bz - 0.17, u + 0.65, y0 + 0.47, bz + 0.17, top);
    for (const dx of [-0.55, 0.55]) wood.boxMinMax(u + dx - 0.03, y0, bz - 0.12, u + dx + 0.03, y0 + 0.43, bz + 0.12, leg);
    kit.collide(u, y0 + 0.23, bz, 1.3, 0.46, 0.34);
    for (const dx of [-0.35, 0.35]) {
      const w = kit.toWorld(u + dx, y0 + 0.47, bz);
      // Seated residents face the table (toward -side in local z).
      info.seats.push({ x: w.x, y: w.y, z: w.z, yaw: toYaw + (side > 0 ? Math.PI : 0) });
    }
  }
}

export function dhabaInterior(kit: Kit, b: BuildingSpec): InteriorInfo {
  const f = facadeFrame(b);
  kit.frame(f.ox, f.oz, f.rotY);
  const rng = new Rng(404);
  const w = f.width, d = b.depth, y0 = DHABA_FLOOR;
  const info: InteriorInfo = { fans: [], lights: [], seats: [] };
  const wallC = rgb("#f1d9a8"), dado = rgb("#2f7a5f");
  // Floor (terrazzo-like pavers) and front step.
  kit.g("paver").boxMinMax(0, 0, -d, w, y0, 0.0, rgb("#d9cdb8"), 0b001000);
  kit.collide(w / 2, y0 / 2, -d / 2, w, y0, d);
  kit.g("concrete").boxMinMax(0, 0, -0.02, w, y0, 0.02, rgb("#a89f92"), 0b000010);
  // Side and back walls (inner faces painted with a green dado).
  const p = kit.g("interior");
  for (const [u0, u1, face] of [[0, 0.3, 0b100000], [w - 0.3, w, 0b010000]] as const) {
    p.boxMinMax(u0, y0, -d, u1, GROUND_TOP, 0, wallC, face | 0b000010);
    p.boxMinMax(u0 === 0 ? 0.3 : w - 0.31, y0, -d + 0.3, u0 === 0 ? 0.31 : w - 0.3, y0 + 1.1, -0.1, dado, face);
    kit.collide((u0 + u1) / 2, GROUND_TOP / 2, -d / 2, 0.3, GROUND_TOP, d);
  }
  p.boxMinMax(0.3, y0, -d, w - 0.3, GROUND_TOP, -d + 0.3, wallC, 0b000010);
  kit.collide(w / 2, GROUND_TOP / 2, -d + 0.15, w, GROUND_TOP, 0.3);
  // Front columns and beam with the sign above.
  const colC = rgb("#9b2d20");
  for (const u of [0.2, 5.4, 10.6, w - 0.2]) {
    kit.solid("paint", u, (y0 + 3.3) / 2, -0.2, 0.4, 3.3 - y0, 0.4, colC);
  }
  kit.g("plaster").boxMinMax(0, 3.3, -0.3, w, GROUND_TOP, 0.05, rgb("#c0392b"));
  const sw = 8.4, sh = sw / (1024 / 224);
  kit.g("paint").boxMinMax(w / 2 - sw / 2 - 0.1, 4.1 - sh / 2 - 0.1, 0.05, w / 2 + sw / 2 + 0.1, 4.1 + sh / 2 + 0.1, 0.18, rgb("#3a2a1a"));
  kit.sign("dhaba", w / 2, 4.1, 0.185, sw);
  awning(kit, 0.2, w - 0.2, 3.3, 1.6, rgb("#d35400"));

  // Kitchen zone at the back behind a steel-topped pass counter.
  const kz = -d + 0.3, passZ0 = -9.9, passZ1 = -9.3;
  kit.g("interior").boxMinMax(0.3, y0, kz, w - 0.3, y0 + 2.0, kz + 0.02, rgb("#f4f4f0"), 0b000010); // tiles
  for (let u = 0.6; u < w - 0.5; u += 0.3) kit.g("interior").boxMinMax(u, y0, kz + 0.02, u + 0.01, y0 + 2.0, kz + 0.03, rgb("#d0d0cc"));
  kit.g("wood").boxMinMax(0.3, y0, passZ0, w - 0.3, y0 + 0.95, passZ1, rgb("#7a4b2a"));
  kit.g("chrome").boxMinMax(0.3, y0 + 0.95, passZ0 - 0.05, w - 0.3, y0 + 1.0, passZ1 + 0.05, STEEL);
  kit.collide(w / 2, (y0 + 1.0) / 2, (passZ0 + passZ1) / 2, w - 0.6, y0 + 1.0, passZ1 - passZ0 + 0.1);
  kit.collide(w / 2, 1.5, (kz + passZ0) / 2, w - 0.6, 3, passZ0 - kz);
  // Tandoor and cooking range.
  kit.g("dirt").cylinder(2.2, y0, -11.6, 0.55, 0.42, 0.95, 16, rgb("#b5714a"), true, 1, rgb("#3a2618"));
  kit.g("dark").cylinder(2.2, y0 + 0.951, -11.6, 0.25, 0.25, 0.01, 12, [1, 1, 1]);
  kit.g("metal").boxMinMax(4.0, y0, -12.6, 9.5, y0 + 0.8, -11.6, rgb("#5a5f63"));
  for (const [u, r, h] of [[4.7, 0.38, 0.45], [6.0, 0.45, 0.5], [7.4, 0.3, 0.35], [8.6, 0.35, 0.3]] as const) {
    kit.g("chrome").cylinder(u, y0 + 0.8, -12.1, r, r * 0.92, h, 16, STEEL, true, 1, shade(STEEL, 0.8));
  }
  // Steel shelves with plates.
  for (let i = 0; i < 3; i++) {
    const y = y0 + 1.4 + i * 0.4;
    kit.g("chrome").boxMinMax(10.2, y, -12.65, 15.3, y + 0.03, -12.3, STEEL);
    for (let u = 10.4; u < 15.1; u += 0.32) kit.g("chrome").cylinder(u, y + 0.03, -12.45, 0.14, 0.15, 0.03, 10, STEEL);
  }
  // Stacked flour sacks, onion basket.
  for (let i = 0; i < 4; i++) kit.g("cloth").ellipsoid(10.6 + i * 0.6, y0 + 0.28, -11.1, 0.3, 0.28, 0.25, 8, 5, rgb("#e7dcc0"));
  kit.g("wood").cylinder(14.5, y0, -11.0, 0.35, 0.42, 0.35, 12, rgb("#9c7a4c"));
  for (let i = 0; i < 14; i++) kit.g("paint").ellipsoid(14.5 + rng.range(-0.25, 0.25), y0 + 0.38 + rng.range(0, 0.08), -11.0 + rng.range(-0.25, 0.25), 0.07, 0.06, 0.07, 6, 4, rgb("#9b3b5a"));
  // Food on the pass counter (pickup point), tiffins ready to go.
  for (const u of [5.7, 6.2, 6.7]) {
    kit.g("chrome").cylinder(u, y0 + 1.0, -9.6, 0.13, 0.13, 0.32, 12, STEEL, true);
    kit.g("chrome").torus(u, y0 + 1.11, -9.6, 0.135, 0.01, 12, 3, shade(STEEL, 0.7));
    kit.g("chrome").torus(u, y0 + 1.22, -9.6, 0.135, 0.01, 12, 3, shade(STEEL, 0.7));
  }

  // Cash counter (galla) near the entrance where Bhola sits.
  kit.g("wood").boxMinMax(12.0, y0, -3.2, 15.4, y0 + 1.0, -2.4, rgb("#6d3f21"));
  // Polished wooden top with a small brass bell and a steel cash tin.
  kit.g("wood").boxMinMax(11.95, y0 + 1.0, -3.25, 15.45, y0 + 1.05, -2.35, rgb("#8a5530"));
  kit.g("chrome").cylinder(12.5, y0 + 1.05, -2.8, 0.05, 0.03, 0.06, 10, rgb("#d4a52a"));
  kit.g("chrome").boxMinMax(13.1, y0 + 1.05, -3.0, 13.6, y0 + 1.17, -2.65, STEEL);
  kit.g("paint").boxMinMax(14.2, y0 + 1.0, -3.0, 14.6, y0 + 1.12, -2.7, rgb("#222222"));
  kit.collide(13.7, (y0 + 1.25) / 2, -2.8, 3.4, y0 + 1.25, 0.8);
  kit.collide(15.0, 1.0, -3.6, 0.8, 2.0, 0.8);

  // Dining tables: two columns with a central aisle.
  const toYaw = f.rotY;
  for (const z of [-2.8, -5.4, -8.0]) {
    tableSet(kit, 2.6, z, y0, info, toYaw);
    if (z < -3) tableSet(kit, 10.2, z, y0, info, toYaw);
  }
  // Water cooler with steel glasses.
  kit.g("chrome").boxMinMax(0.4, y0, -1.4, 1.1, y0 + 1.3, -0.8, STEEL);
  kit.collide(0.75, (y0 + 1.3) / 2, -1.1, 0.7, y0 + 1.3, 0.6);
  // Menu board, posters and tube lights on walls.
  kit.frame(f.ox, f.oz, f.rotY);
  kit.g("paint").boxMinMax(5.0, y0 + 1.5, kz + 0.03, 8.3, y0 + 1.6, kz + 0.06, rgb("#3b2414"));
  // Menu sign faces +Z (toward the hall) on the kitchen wall above the range hood.
  kit.sign("menu", 12.6, 2.9, -d + 0.34, 1.7);
  postersOnSideWall(kit, 0.31, [-4.5, -7.2], ["poster1", "poster2"]);
  for (const z of [-3.5, -8.0]) {
    kit.g("emissive").boxMinMax(0.31, 2.9, z - 0.6, 0.36, 2.95, z + 0.6, [1, 1, 1]);
    kit.g("emissive").boxMinMax(w - 0.36, 2.9, z - 0.6, w - 0.31, 2.95, z + 0.6, [1, 1, 1]);
  }
  kit.g("emissive").boxMinMax(3.0, 2.9, kz + 0.02, 4.2, 2.95, kz + 0.07, [1, 1, 1]);
  // Ceiling fans (animated separately) and lights.
  for (const [u, z] of [[3.5, -4], [9.5, -4], [6.5, -7.5]] as const) {
    info.fans.push(kit.toWorld(u, GROUND_TOP - 0.2 - 0.45, z));
    kit.g("metal").boxMinMax(u - 0.015, GROUND_TOP - 0.65, z - 0.015, u + 0.015, GROUND_TOP - 0.2, z + 0.015, rgb("#dddddd"));
  }
  info.lights.push(kit.toWorld(w / 2, 3.0, -5.5));
  // Charpai (woven cot) near the front for lounging.
  charpai(kit, 1.2, -4.3, y0, Math.PI / 2);
  // Matka stand (earthen water pots) outside by the entrance.
  matkaStand(kit, 4.6, 0.6, 0.15);
  return info;
}

function postersOnSideWall(kit: Kit, u: number, zs: number[], keys: string[]): void {
  // Side wall at local u faces +X; rotate a sub-frame so the sign faces +X.
  zs.forEach((z, i) => {
    const wpt = kit.toWorld(u + 0.01, 0, z);
    const key = keys[i % keys.length]!;
    // Local +X of the frame becomes the poster's facing direction.
    kit.signAt(key, wpt.x, 2.0 + DHABA_FLOOR, wpt.z, kit.currentRotY() + Math.PI / 2, 1.0);
  });
}

export function charpai(kit: Kit, u: number, z: number, y0: number, rot = 0): void {
  const wood = kit.g("wood");
  const L = 1.9, W = 0.9, H = 0.45;
  const c = rgb("#8b5a2b");
  const ax = rot ? W : L, az = rot ? L : W;
  for (const [dx, dz] of [[-ax / 2, -az / 2], [ax / 2, -az / 2], [-ax / 2, az / 2], [ax / 2, az / 2]] as const) wood.cylinder(u + dx, y0, z + dz, 0.05, 0.045, H, 8, c);
  wood.boxMinMax(u - ax / 2, y0 + H - 0.06, z - az / 2, u + ax / 2, y0 + H, z - az / 2 + 0.05, c);
  wood.boxMinMax(u - ax / 2, y0 + H - 0.06, z + az / 2 - 0.05, u + ax / 2, y0 + H, z + az / 2, c);
  wood.boxMinMax(u - ax / 2, y0 + H - 0.06, z - az / 2, u - ax / 2 + 0.05, y0 + H, z + az / 2, c);
  wood.boxMinMax(u + ax / 2 - 0.05, y0 + H - 0.06, z - az / 2, u + ax / 2, y0 + H, z + az / 2, c);
  kit.g("fabric").boxMinMax(u - ax / 2 + 0.05, y0 + H - 0.05, z - az / 2 + 0.05, u + ax / 2 - 0.05, y0 + H - 0.02, z + az / 2 - 0.05, rgb("#d9c38f"));
  kit.collide(u, y0 + H / 2, z, ax, H, az);
}

export function matkaStand(kit: Kit, u: number, z: number, y0: number): void {
  const iron = kit.g("metal");
  iron.boxMinMax(u - 0.5, y0, z - 0.2, u + 0.5, y0 + 0.5, z + 0.2, IRON, 0b001000);
  for (const dx of [-0.48, 0.48]) for (const dz of [-0.18, 0.18]) iron.boxMinMax(u + dx - 0.02, y0, z + dz - 0.02, u + dx + 0.02, y0 + 0.5, z + dz + 0.02, IRON);
  for (const dx of [-0.25, 0.25]) {
    kit.g("dirt").ellipsoid(u + dx, y0 + 0.72, z, 0.22, 0.24, 0.22, 12, 8, rgb("#a4532f"));
    kit.g("dirt").cylinder(u + dx, y0 + 0.92, z, 0.08, 0.09, 0.08, 10, rgb("#8f4527"));
  }
  kit.collide(u, y0 + 0.5, z, 1.0, 1.0, 0.45);
}

// ---------------------------------------------------------------- Workshop

export function workshop(kit: Kit, b: BuildingSpec): InteriorInfo {
  const f = facadeFrame(b);
  kit.frame(f.ox, f.oz, f.rotY);
  const rng = new Rng(808);
  const w = f.width, d = b.depth;
  const info: InteriorInfo = { fans: [], lights: [], seats: [] };
  const brick: RGB = [1, 1, 1];
  const shedFront = -5;
  const roofY = 5.0;
  // Apron and shed floor (road level concrete with oil stains).
  kit.g("concrete").boxMinMax(0, -0.02, -d, w, 0.02, 2.5, rgb("#b4ada2"), 0b001000);
  for (let i = 0; i < 9; i++) kit.g("dark").cylinder(rng.range(2, 18), 0.021, rng.range(-15, -1), rng.range(0.3, 0.8), rng.range(0.3, 0.8), 0.002, 10, [1, 1, 1], true);
  // Compound walls either side of the apron.
  for (const [u0, u1] of [[0, 2], [18, 20]] as const) {
    kit.g("brick").boxMinMax(u0, 0, shedFront, u1, 2.3, 0, brick);
    kit.g("plaster").boxMinMax(u0 - 0.03, 2.3, shedFront, u1 + 0.03, 2.4, 0.03, rgb("#d8d0c0"));
    kit.collide((u0 + u1) / 2, 1.2, shedFront / 2, u1 - u0, 2.4, -shedFront);
  }
  // Shed walls.
  kit.solid("brick", w / 2, roofY / 2, -d + 0.15, w, roofY, 0.3, brick);
  kit.solid("brick", 0.15, roofY / 2, (shedFront - d) / 2, 0.3, roofY, d + shedFront, brick);
  kit.solid("brick", w - 0.15, roofY / 2, (shedFront - d) / 2, 0.3, roofY, d + shedFront, brick);
  // Steel columns and roof trusses.
  const steel = rgb("#3d4a57");
  for (const u of [0.35, 6.8, 13.3, w - 0.35]) kit.solid("metal", u, roofY / 2, shedFront - 0.15, 0.25, roofY, 0.25, steel);
  kit.g("metal").boxMinMax(0, roofY - 0.35, shedFront - 0.3, w, roofY, shedFront, steel);
  for (let u = 0.35; u < w; u += 3.25) {
    kit.g("metal").tube(new Vector3(u, roofY, shedFront - 0.15), new Vector3(u, roofY + 0.5, -d / 2 - 2), 0.05, 5, steel);
    kit.g("metal").tube(new Vector3(u, roofY + 0.5, -d / 2 - 2), new Vector3(u, roofY, -d + 0.2), 0.05, 5, steel);
    kit.g("metal").tube(new Vector3(u, roofY, shedFront - 0.15), new Vector3(u, roofY, -d + 0.2), 0.04, 5, steel);
  }
  // Corrugated roof (two pitches) with overhang.
  const sh = kit.g("shutter");
  const ridgeZ = -d / 2 - 2, ridgeY = roofY + 0.55;
  const rc = rgb("#8f979b");
  sh.quad(new Vector3(w + 0.2, roofY + 0.05, shedFront + 1.2), new Vector3(-0.2, roofY + 0.05, shedFront + 1.2), new Vector3(-0.2, ridgeY, ridgeZ), new Vector3(w + 0.2, ridgeY, ridgeZ), rc);
  sh.quad(new Vector3(-0.2, roofY + 0.05, shedFront + 1.2), new Vector3(w + 0.2, roofY + 0.05, shedFront + 1.2), new Vector3(w + 0.2, ridgeY, ridgeZ), new Vector3(-0.2, ridgeY, ridgeZ), shade(rc, 0.5));
  sh.quad(new Vector3(-0.2, roofY + 0.05, -d - 0.3), new Vector3(w + 0.2, roofY + 0.05, -d - 0.3), new Vector3(w + 0.2, ridgeY, ridgeZ), new Vector3(-0.2, ridgeY, ridgeZ), rc);
  sh.quad(new Vector3(w + 0.2, roofY + 0.05, -d - 0.3), new Vector3(-0.2, roofY + 0.05, -d - 0.3), new Vector3(-0.2, ridgeY, ridgeZ), new Vector3(w + 0.2, ridgeY, ridgeZ), shade(rc, 0.5));
  kit.collide(w / 2, roofY + 0.3, (shedFront - d) / 2, w, 0.6, d + shedFront);
  // Fascia board with the big sign.
  kit.g("paint").boxMinMax(1.0, roofY + 0.05, shedFront + 1.1, w - 1.0, roofY + 2.0, shedFront + 1.25, rgb("#163a5a"));
  kit.sign("workshop", w / 2, roofY + 1.02, shedFront + 1.26, 8.6);
  // Office cabin in the back corner.
  const cab = { u0: 14.5, u1: w - 0.3, z0: -d + 0.3, z1: -11.5 };
  kit.g("plaster").boxMinMax(cab.u0, 0, cab.z1 - 0.2, cab.u1, 3.0, cab.z1, rgb("#d9d2c0"));
  kit.g("plaster").boxMinMax(cab.u0, 0, cab.z0, cab.u0 + 0.2, 3.0, cab.z1, rgb("#d9d2c0"));
  kit.g("concrete").boxMinMax(cab.u0 - 0.1, 3.0, cab.z0, cab.u1, 3.12, cab.z1 + 0.1, rgb("#bdb6aa"));
  kit.g("glass").boxMinMax(cab.u0 + 0.6, 1.0, cab.z1 + 0.005, cab.u0 + 2.2, 2.1, cab.z1 + 0.02, [1, 1, 1]);
  kit.g("wood").boxMinMax(cab.u0 + 2.8, 0, cab.z1 + 0.005, cab.u0 + 3.7, 2.1, cab.z1 + 0.03, rgb("#4f6d7a"));
  kit.collide((cab.u0 + cab.u1) / 2, 1.5, (cab.z0 + cab.z1) / 2, cab.u1 - cab.u0, 3.0, cab.z1 - cab.z0);
  // Two-post hoist with an old car body on it.
  const hoistC = rgb("#c62828");
  for (const u of [2.6, 6.4]) kit.solid("paint", u, 1.6, -10.5, 0.35, 3.2, 0.35, hoistC);
  kit.g("metal").boxMinMax(2.6, 1.15, -11.3, 6.4, 1.25, -9.7, steel);
  carShell(kit, 4.5, 1.3, -10.5, rgb("#e8e2d0"));
  kit.collide(4.5, 1.9, -10.5, 1.7, 1.3, 3.6, Math.PI / 2);
  // Workbench with vice and tool board along the back wall.
  kit.g("wood").boxMinMax(7.5, 0.85, -d + 0.3, 13.5, 0.92, -d + 1.1, rgb("#6e4a2c"));
  kit.g("metal").boxMinMax(7.5, 0, -d + 0.3, 13.5, 0.85, -d + 1.1, rgb("#4a5560"));
  kit.collide(10.5, 0.46, -d + 0.7, 6.0, 0.92, 0.8);
  kit.g("metal").boxMinMax(8.0, 0.92, -d + 0.6, 8.3, 1.12, -d + 0.9, steel);
  kit.g("wood").boxMinMax(7.8, 1.3, -d + 0.31, 13.2, 2.6, -d + 0.34, rgb("#c9b48a"));
  for (let i = 0; i < 12; i++) {
    const u = 8.1 + (i % 6) * 0.85, y = 1.55 + Math.floor(i / 6) * 0.6;
    kit.g("chrome").boxMinMax(u, y, -d + 0.34, u + 0.06, y + rng.range(0.25, 0.45), -d + 0.38, STEEL);
  }
  kit.g("paint").boxMinMax(12.3, 0.92, -d + 0.4, 13.2, 1.3, -d + 0.95, rgb("#d32f2f"));
  // Tyre stacks, oil drums, compressor, engine on a stand.
  for (const [u, z, n] of [[1.2, -6.2, 5], [1.2, -7.4, 3], [17.3, -6.4, 4]] as const) {
    for (let i = 0; i < n; i++) kit.g("rubber").torus(u, 0.12 + i * 0.22, z, 0.3, 0.11, 14, 6, [1, 1, 1]);
    kit.collide(u, n * 0.11 + 0.05, z, 0.85, n * 0.22 + 0.1, 0.85);
  }
  for (const [u, z, c] of [[1.0, -14.5, "#1e5aa8"], [1.0, -13.6, "#c0392b"], [1.9, -14.5, "#1e5aa8"]] as const) {
    kit.g("paint").cylinder(u, 0, z, 0.3, 0.3, 0.9, 14, rgb(c), true);
    for (const y of [0.3, 0.6]) kit.g("paint").torus(u, y, z, 0.305, 0.015, 14, 3, shade(rgb(c), 0.7));
    kit.collide(u, 0.45, z, 0.6, 0.9, 0.6);
  }
  kit.g("paint").cylinder(11.5, 0.25, -7.8, 0.28, 0.28, 0.9, 12, rgb("#d84315"), true);
  kit.g("metal").boxMinMax(11.0, 0, -8.1, 12.0, 0.25, -7.5, IRON);
  kit.collide(11.5, 0.6, -7.8, 1.0, 1.2, 0.6);
  kit.g("metal").boxMinMax(15.5, 0.6, -8.0, 16.4, 1.2, -7.2, rgb("#6d6d6d"));
  kit.g("metal").boxMinMax(15.9, 0, -7.7, 16.0, 0.6, -7.5, IRON);
  kit.collide(15.95, 0.6, -7.6, 0.9, 1.2, 0.8);
  // Work lights.
  for (const u of [4, 10, 16]) kit.g("emissive").boxMinMax(u - 0.6, roofY - 0.45, -10.0, u + 0.6, roofY - 0.4, -9.9, [1, 1, 1]);
  info.lights.push(kit.toWorld(w * 0.3, roofY - 0.6, -9), kit.toWorld(w * 0.72, roofY - 0.6, -11));
  return info;
}

function carShell(kit: Kit, u: number, y: number, z: number, c: RGB): void {
  const p = kit.g("paint");
  // Body runs along local z here (car parked pointing into the shed).
  p.boxMinMax(u - 0.8, y, z - 1.8, u + 0.8, y + 0.65, z + 1.8, c);
  p.boxMinMax(u - 0.72, y + 0.65, z - 0.9, u + 0.72, y + 1.2, z + 0.9, c);
  kit.g("glass").boxMinMax(u - 0.7, y + 0.7, z - 0.95, u + 0.7, y + 1.15, z + 0.95, [1, 1, 1]);
  kit.g("dark").boxMinMax(u - 0.81, y - 0.05, z - 1.4, u + 0.81, y + 0.25, z - 0.8, [1, 1, 1]);
  kit.g("dark").boxMinMax(u - 0.81, y - 0.05, z + 0.8, u + 0.81, y + 0.25, z + 1.4, [1, 1, 1]);
}

const FX = 0b100000, FNX = 0b010000, FY = 0b001000, FNY = 0b000100, FZ = 0b000010, FNZ = 0b000001;

export interface HouseInside {
  w: number; d: number;
  /** Front face of the house (local z), plinth and floor height. */
  z0: number; plinth: number; fh: number;
  /** Ground-floor holes in the front wall (door and windows). */
  holes: Array<{ u0: number; u1: number; v0: number; v1: number }>;
  /** Front door left edge and width. */
  door: number; doorW: number;
  /** Depth of the front room. */
  baithak: number;
}

/**
 * The ground floor of an open colony kothi (see world/openHouses.ts): inner
 * wall faces and ceiling, the walls as colliders (the solid house block is
 * not used), a baithak with a sofa set, centre table, TV, showcase, photos,
 * wall clock, tube light and fan, and behind a partition the dining table,
 * fridge, kitchen platform with the gas chulha and cylinder, the steel
 * utensil rack, a water filter and the Godrej almirah.
 */
export function houseInterior(kit: Kit, s: HouseInside, rng: Rng, h: number): void {
  const { w, d, z0, plinth: y0, fh } = s;
  const W = 0.2, zf = z0 - W, zb = -d + W, ceil = y0 + fh - 0.15;
  const wallC = rgb(rng.pick(["#f3e1d6", "#dfeaf2", "#e3efdc", "#f4ead2", "#efe0ef"]));
  const p = kit.g("interior");
  // Floor (marble-ish) and ceiling.
  p.boxMinMax(W, y0, zb, w - W, y0, zf, rgb("#e9e4da"), FY);
  p.boxMinMax(W, ceil, zb, w - W, ceil, zf, rgb("#fbfaf6"), FNY);
  // Side and back walls' inner faces, a skirting line.
  p.boxMinMax(W, y0, zb, W, ceil, zf, wallC, FX);
  p.boxMinMax(w - W, y0, zb, w - W, ceil, zf, wallC, FNX);
  p.boxMinMax(W, y0, zb, w - W, ceil, zb, wallC, FZ);
  // Front wall from inside, round the door and the windows.
  const hs = [...s.holes].sort((a, b) => a.u0 - b.u0);
  let u = W;
  for (const o of hs) {
    if (o.u0 > u) p.boxMinMax(u, y0, zf, o.u0, ceil, zf, wallC, FNZ);
    if (o.v0 > y0 + 0.01) p.boxMinMax(o.u0, y0, zf, o.u1, o.v0, zf, wallC, FNZ);
    if (o.v1 < ceil) p.boxMinMax(o.u0, o.v1, zf, o.u1, ceil, zf, wallC, FNZ);
    // The reveal through the wall's thickness.
    p.boxMinMax(o.u0, o.v0, zf, o.u0, o.v1, z0, shade(wallC, 0.9), FX);
    p.boxMinMax(o.u1, o.v0, zf, o.u1, o.v1, z0, shade(wallC, 0.9), FNX);
    p.boxMinMax(o.u0, o.v1, zf, o.u1, o.v1, z0, shade(wallC, 0.9), FNY);
    if (o.v0 > y0 + 0.01) p.boxMinMax(o.u0, o.v0, zf, o.u1, o.v0, z0, shade(wallC, 0.9), FY);
    u = o.u1;
  }
  if (u < w - W) p.boxMinMax(u, y0, zf, w - W, ceil, zf, wallC, FNZ);
  // Colliders: floor slab, upper floors, walls, the front round the door.
  kit.collide(w / 2, y0 / 2, (z0 - d) / 2, w, y0, d + z0);
  kit.collide(w / 2, (ceil + h) / 2, (z0 - d) / 2, w, h - ceil, d + z0);
  kit.collide(W / 2, (y0 + ceil) / 2, (z0 - d) / 2, W, ceil - y0, d + z0);
  kit.collide(w - W / 2, (y0 + ceil) / 2, (z0 - d) / 2, W, ceil - y0, d + z0);
  kit.collide(w / 2, (y0 + ceil) / 2, -d + W / 2, w, ceil - y0, W);
  const dl = s.door, dr = s.door + s.doorW, dt = y0 + 2.25;
  kit.collide(dl / 2, (y0 + ceil) / 2, z0 - W / 2, dl, ceil - y0, W);
  kit.collide((dr + w) / 2, (y0 + ceil) / 2, z0 - W / 2, w - dr, ceil - y0, W);
  kit.collide((dl + dr) / 2, (dt + ceil) / 2, z0 - W / 2, dr - dl, ceil - dt, W);
  // Two steps up to the door (the plinth is too high for one stride).
  const cs = rgb("#c9c1b3");
  kit.g("concrete").boxMinMax(dl - 0.3, 0, z0, dr + 0.3, y0, z0 + 0.35, cs, FY | FZ | FX | FNX);
  kit.g("concrete").boxMinMax(dl - 0.3, 0, z0 + 0.35, dr + 0.3, y0 / 2, z0 + 0.7, shade(cs, 0.95), FY | FZ | FX | FNX);
  kit.collide((dl + dr) / 2, y0 / 2, z0 + 0.175, dr - dl + 0.6, y0, 0.35);
  kit.collide((dl + dr) / 2, y0 / 4, z0 + 0.525, dr - dl + 0.6, y0 / 2, 0.35);

  // ---- Partition between the baithak and the back, with a doorway.
  const zp = zf - s.baithak, pw = 0.12, pu0 = w / 2 - 0.5, pu1 = w / 2 + 0.5, pt = y0 + 2.1;
  for (const [a, b] of [[W, pu0], [pu1, w - W]] as const) {
    p.boxMinMax(a, y0, zp - pw, b, ceil, zp, wallC, FZ | FNZ);
    kit.collide((a + b) / 2, (y0 + ceil) / 2, zp - pw / 2, b - a, ceil - y0, pw);
  }
  p.boxMinMax(pu0, pt, zp - pw, pu1, ceil, zp, wallC, FZ | FNZ | FNY);
  p.boxMinMax(pu0, y0, zp - pw, pu0, pt, zp, shade(wallC, 0.9), FX);
  p.boxMinMax(pu1, y0, zp - pw, pu1, pt, zp, shade(wallC, 0.9), FNX);
  // A cotton curtain half drawn across the doorway.
  kit.g("fabric").boxMinMax(pu0, y0 + 0.4, zp - pw / 2 - 0.01, pu0 + 0.35, pt, zp - pw / 2 + 0.01, rgb(rng.pick(["#8e2430", "#2f5d8a", "#7a5c2e"])), FZ | FNZ);

  // ---- Baithak.
  const zc = zf - 2.4;
  // Rug.
  kit.g("fabric").boxMinMax(1.4, y0 + 0.004, zc - 1.3, w - 1.6, y0 + 0.012, zc + 1.3, rgb("#8e2430"), FY);
  kit.g("fabric").boxMinMax(1.55, y0 + 0.013, zc - 1.15, w - 1.75, y0 + 0.014, zc + 1.15, rgb("#b8862e"), FY);
  // Three-seater sofa against the left wall (seat at y0 + 0.45), two armchairs.
  const sofa = rgb(rng.pick(["#6b3a2a", "#4a3b5c", "#7a5a3a", "#2f4f4f"]));
  const cushion = shade(sofa, 1.25);
  const f = kit.g("fabric");
  f.boxMinMax(W + 0.05, y0, zc - 1.0, W + 0.85, y0 + 0.4, zc + 1.0, sofa);
  f.boxMinMax(W + 0.15, y0 + 0.4, zc - 0.95, W + 0.85, y0 + 0.47, zc + 0.95, cushion);
  f.boxMinMax(W + 0.05, y0 + 0.4, zc - 1.0, W + 0.25, y0 + 0.95, zc + 1.0, sofa);
  for (const sd of [-1, 1]) f.boxMinMax(W + 0.05, y0 + 0.4, zc + sd * 1.0 - (sd > 0 ? 0.15 : 0), W + 0.85, y0 + 0.62, zc + sd * 1.0 + (sd < 0 ? 0.15 : 0), sofa);
  kit.collide(W + 0.45, y0 + 0.3, zc, 0.8, 0.6, 2.0);
  for (const sz of [-1, 1]) {
    const az = zc + sz * 1.75, au = W + 1.6;
    f.boxMinMax(au - 0.4, y0, az - 0.4, au + 0.4, y0 + 0.4, az + 0.4, sofa);
    f.boxMinMax(au - 0.35, y0 + 0.4, az - 0.35, au + 0.35, y0 + 0.47, az + 0.35, cushion);
    const bz = sz > 0 ? az + 0.25 : az - 0.25;
    f.boxMinMax(au - 0.4, y0 + 0.4, Math.min(bz, bz + sz * 0.15), au + 0.4, y0 + 0.9, Math.max(bz, bz + sz * 0.15), sofa);
    kit.collide(au, y0 + 0.3, az, 0.8, 0.6, 0.8);
  }
  // Centre table: wooden frame, glass top, a steel plate of biscuits.
  const tw = kit.g("wood"), tu = W + 2.0;
  tw.boxMinMax(tu - 0.35, y0, zc - 0.6, tu + 0.35, y0 + 0.08, zc + 0.6, rgb("#5a3a22"));
  for (const [a, b] of [[-0.3, -0.55], [0.3, -0.55], [-0.3, 0.55], [0.3, 0.55]] as const) tw.boxMinMax(tu + a - 0.03, y0, zc + b - 0.03, tu + a + 0.03, y0 + 0.42, zc + b + 0.03, rgb("#5a3a22"));
  kit.g("glass").boxMinMax(tu - 0.38, y0 + 0.42, zc - 0.63, tu + 0.38, y0 + 0.44, zc + 0.63, [1, 1, 1]);
  kit.g("chrome").cylinder(tu, y0 + 0.44, zc + 0.2, 0.14, 0.15, 0.02, 12, STEEL);
  for (let i = 0; i < 5; i++) kit.g("matte").cylinder(tu - 0.06 + (i % 3) * 0.06, y0 + 0.46, zc + 0.15 + Math.floor(i / 3) * 0.08, 0.025, 0.025, 0.01, 8, rgb("#c58b45"));
  kit.collide(tu, y0 + 0.22, zc, 0.76, 0.44, 1.26);
  // TV unit and TV on the right wall, facing the sofa.
  const tvu = w - W - 0.25;
  tw.boxMinMax(tvu - 0.25, y0, zc - 0.9, tvu + 0.25, y0 + 0.55, zc + 0.9, rgb("#6b4a2b"));
  tw.boxMinMax(tvu - 0.26, y0 + 0.2, zc - 0.85, tvu - 0.25, y0 + 0.21, zc + 0.85, rgb("#3e2a18"));
  kit.g("dark").boxMinMax(tvu - 0.05, y0 + 0.75, zc - 0.62, tvu + 0.02, y0 + 1.45, zc + 0.62, rgb("#111111"));
  kit.g("emissive").boxMinMax(tvu - 0.055, y0 + 0.78, zc - 0.58, tvu - 0.05, y0 + 1.42, zc + 0.58, rgb("#3d6f8f"), FNX);
  kit.g("dark").boxMinMax(tvu - 0.03, y0 + 0.55, zc - 0.15, tvu + 0.01, y0 + 0.75, zc + 0.15, rgb("#222222"));
  kit.collide(tvu, y0 + 0.5, zc, 0.5, 1.0, 1.8);
  // Showcase with glass doors and the good steel glasses, beside the TV.
  const su = w - W - 0.2, sz0 = zf - 0.15;
  tw.boxMinMax(su - 0.2, y0, sz0 - 0.9, su + 0.2, y0 + 1.9, sz0, rgb("#5a3a22"));
  for (const y of [0.7, 1.2, 1.65]) for (let i = 0; i < 5; i++) kit.g("chrome").cylinder(su - 0.24, y0 + y, sz0 - 0.15 - i * 0.15, 0.03, 0.035, 0.12, 8, STEEL);
  kit.g("glass").boxMinMax(su - 0.29, y0 + 0.5, sz0 - 0.88, su - 0.28, y0 + 1.85, sz0 - 0.02, [1, 1, 1], FNX);
  kit.collide(su, y0 + 0.95, sz0 - 0.45, 0.4, 1.9, 0.9);
  // Photos on the partition: a family portrait and two framed calendars.
  for (const [fu, c] of [[w * 0.25, "#d8c3a0"], [w * 0.75, "#a7c4d8"], [W + 1.0, "#e8b4a0"]] as const) {
    kit.g("wood").boxMinMax(fu - 0.32, y0 + 1.55, zp + 0.005, fu + 0.32, y0 + 2.0, zp + 0.03, rgb("#b8902a"), FZ | FX | FNX | FY | FNY);
    kit.g("matte").boxMinMax(fu - 0.27, y0 + 1.6, zp + 0.031, fu + 0.27, y0 + 1.95, zp + 0.032, rgb(c), FZ);
  }
  // Wall clock over the doorway, the tube light on the left wall.
  kit.g("matte").cylinder(w / 2, y0 + 2.45, zp + 0.02, 0.17, 0.17, 0.03, 16, rgb("#2b2b2e"));
  kit.g("matte").boxMinMax(w / 2 - 0.15, y0 + 2.31, zp + 0.035, w / 2 + 0.15, y0 + 2.59, zp + 0.036, rgb("#f5f5f0"), FZ);
  kit.g("matte").boxMinMax(w / 2 - 0.006, y0 + 2.45, zp + 0.037, w / 2 + 0.006, y0 + 2.56, zp + 0.038, rgb("#111111"), FZ);
  kit.g("emissive").boxMinMax(W + 0.01, y0 + 2.4, zc - 0.6, W + 0.05, y0 + 2.45, zc + 0.6, rgb("#f4f8ff"));
  // Ceiling fan.
  const fanY = ceil - 0.35;
  kit.g("metal").cylinder(w / 2, fanY, zc, 0.02, 0.02, 0.35, 6, rgb("#e0ddd5"));
  kit.g("metal").cylinder(w / 2, fanY - 0.08, zc, 0.12, 0.12, 0.1, 12, rgb("#e0ddd5"));
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + 0.4;
    kit.g("metal").boxMinMax(w / 2 + Math.cos(a) * 0.1 - 0.06, fanY - 0.05, zc + Math.sin(a) * 0.1 - 0.06, w / 2 + Math.cos(a) * 0.1 + 0.06, fanY - 0.04, zc + Math.sin(a) * 0.1 + 0.06, rgb("#e0ddd5"));
    const tipU = w / 2 + Math.cos(a) * 0.62, tipZ = zc + Math.sin(a) * 0.62;
    kit.g("metal").boxMinMax(Math.min(w / 2 + Math.cos(a) * 0.15, tipU) - 0.05, fanY - 0.05, Math.min(zc + Math.sin(a) * 0.15, tipZ) - 0.05, Math.max(w / 2 + Math.cos(a) * 0.15, tipU) + 0.05, fanY - 0.04, Math.max(zc + Math.sin(a) * 0.15, tipZ) + 0.05, rgb("#e0ddd5"));
  }

  // ---- Back: dining, fridge, kitchen.
  const zk = zp - pw, depth = zk - zb;
  if (depth < 3) return;
  // Kitchen platform along the back wall: granite top, gas chulha, the red cylinder below.
  const kh = y0 + 0.85;
  kit.g("concrete").boxMinMax(W, y0, zb, w - W, kh - 0.04, zb + 0.6, rgb("#d9d2c4"), FY | FNZ | FX | FNX);
  kit.g("concrete").boxMinMax(W, kh - 0.04, zb, w - W, kh, zb + 0.62, rgb("#2e2a28"), FY | FNZ | FX | FNX);
  kit.collide(w / 2, (y0 + kh) / 2, zb + 0.31, w - 2 * W, kh - y0, 0.62);
  const gu = w * 0.35;
  kit.g("dark").boxMinMax(gu - 0.32, kh, zb + 0.12, gu + 0.32, kh + 0.07, zb + 0.5, rgb("#1d1d1d"));
  for (const du of [-0.15, 0.15]) kit.g("metal").cylinder(gu + du, kh + 0.07, zb + 0.31, 0.08, 0.08, 0.02, 10, rgb("#555555"));
  kit.g("chrome").cylinder(gu + 0.15, kh + 0.09, zb + 0.31, 0.12, 0.1, 0.14, 12, STEEL);
  kit.g("paint").cylinder(gu - 0.1, y0, zb + 0.95, 0.16, 0.16, 0.6, 12, rgb("#c62828"));
  kit.g("metal").cylinder(gu - 0.1, y0 + 0.6, zb + 0.95, 0.06, 0.06, 0.08, 8, rgb("#888888"));
  kit.collide(gu - 0.1, y0 + 0.3, zb + 0.95, 0.32, 0.6, 0.32);
  // Steel rack of thalis and katoris on the wall above, a water filter.
  for (let i = 0; i < 6; i++) kit.g("chrome").cylinder(w * 0.6 + i * 0.2, kh + 0.7, zb + 0.07, 0.15, 0.15, 0.015, 14, STEEL);
  kit.g("metal").boxMinMax(w * 0.58, kh + 0.52, zb, w * 0.6 + 1.2, kh + 0.55, zb + 0.2, rgb("#9a9a9a"));
  kit.g("paint").boxMinMax(w * 0.2 - 0.18, kh + 0.55, zb, w * 0.2 + 0.18, kh + 1.05, zb + 0.18, rgb("#f2f2f2"));
  kit.g("paint").boxMinMax(w * 0.2 - 0.14, kh + 0.62, zb + 0.181, w * 0.2 + 0.14, kh + 0.7, zb + 0.182, rgb("#1565c0"), FZ);
  // Fridge in the corner.
  const fu = w - W - 0.4, fz = zk - 0.45;
  kit.g("paint").boxMinMax(fu - 0.35, y0, fz - 0.35, fu + 0.35, y0 + 1.65, fz + 0.35, rgb(rng.pick(["#7b1f2a", "#9aa3a8", "#3d4a5c"])));
  kit.g("chrome").boxMinMax(fu - 0.37, y0 + 0.9, fz - 0.25, fu - 0.35, y0 + 1.3, fz - 0.22, STEEL);
  kit.collide(fu, y0 + 0.82, fz, 0.7, 1.65, 0.7);
  // Godrej almirah on the left.
  const au = W + 0.3, az = zk - 0.7;
  kit.g("metal").boxMinMax(au - 0.28, y0, az - 0.5, au + 0.28, y0 + 1.95, az + 0.5, rgb("#7d868c"));
  kit.g("metal").boxMinMax(au + 0.28, y0 + 0.05, az - 0.005, au + 0.29, y0 + 1.9, az + 0.005, rgb("#4a5257"), FX);
  kit.collide(au, y0 + 0.97, az, 0.56, 1.95, 1.0);
  // Dining table and four plastic chairs.
  if (depth >= 4.2) {
    const du = w / 2 + 0.3, dz = (zk + zb + 0.6) / 2;
    tw.boxMinMax(du - 0.8, y0 + 0.72, dz - 0.5, du + 0.8, y0 + 0.76, dz + 0.5, rgb("#8a5a33"));
    for (const [a, b] of [[-0.72, -0.42], [0.72, -0.42], [-0.72, 0.42], [0.72, 0.42]] as const) tw.boxMinMax(du + a - 0.03, y0, dz + b - 0.03, du + a + 0.03, y0 + 0.72, dz + b + 0.03, rgb("#5a3a22"));
    kit.collide(du, y0 + 0.38, dz, 1.6, 0.76, 1.0);
    const pc = rgb(rng.pick(["#f4f2ec", "#2e7d32", "#8e2430"]));
    for (const [a, b] of [[-0.4, -0.8], [0.4, -0.8], [-0.4, 0.8], [0.4, 0.8]] as const) {
      const cu = du + a, cz = dz + b, back = b > 0 ? cz + 0.2 : cz - 0.2;
      kit.g("paint").boxMinMax(cu - 0.22, y0 + 0.42, cz - 0.2, cu + 0.22, y0 + 0.46, cz + 0.2, pc);
      for (const [x, z] of [[-0.18, -0.16], [0.18, -0.16], [-0.18, 0.16], [0.18, 0.16]] as const) kit.g("paint").boxMinMax(cu + x - 0.02, y0, cz + z - 0.02, cu + x + 0.02, y0 + 0.42, cz + z + 0.02, pc);
      kit.g("paint").boxMinMax(cu - 0.22, y0 + 0.46, Math.min(back, back + Math.sign(b) * 0.04), cu + 0.22, y0 + 0.9, Math.max(back, back + Math.sign(b) * 0.04), pc);
    }
    kit.g("chrome").cylinder(du - 0.3, y0 + 0.76, dz, 0.15, 0.15, 0.02, 12, STEEL);
    kit.g("chrome").cylinder(du + 0.3, y0 + 0.76, dz, 0.07, 0.06, 0.12, 10, STEEL);
  }
  // Tube light in the back room too.
  kit.g("emissive").boxMinMax(w - W - 0.05, y0 + 2.4, (zk + zb) / 2 - 0.6, w - W - 0.01, y0 + 2.45, (zk + zb) / 2 + 0.6, rgb("#f4f8ff"));
}
