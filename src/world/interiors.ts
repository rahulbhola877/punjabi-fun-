import { Vector3 } from "@babylonjs/core";
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
  kit.g("glass").boxMinMax(12.1, y0 + 1.0, -3.15, 14.0, y0 + 1.25, -2.45, [1, 1, 1]);
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
  info.lights.push(kit.toWorld(w / 2, roofY - 0.6, -9));
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
