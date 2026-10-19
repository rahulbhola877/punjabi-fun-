import { Vector3 } from "../babylon";
import { rgb, shade, type RGB } from "../render/GeoBuilder";
import { Rng } from "../render/textures";
import type { Kit } from "./Kit";
import type { MatKey } from "../render/Materials";
import {
  COURTYARD, CURB_H, FRONTAGE, LANE_W, ROAD_HALF, SIDEWALK_RECTS, STREET_Z0, STREET_Z1, WORKSHOP_APRON,
  type Rect,
} from "./layout";

const CURB_C: RGB = rgb("#a9a297");
const YELLOW: RGB = rgb("#e8b923");
const BLACK: RGB = rgb("#222222");

function groundQuad(kit: Kit, mat: MatKey, r: Rect, y: number, c: RGB): void {
  const g = kit.g(mat);
  g.quad(new Vector3(r.x0, y, r.z0), new Vector3(r.x1, y, r.z0), new Vector3(r.x1, y, r.z1), new Vector3(r.x0, y, r.z1), c);
}

/** Sidewalk slab with curb stones on the road side. */
function sidewalk(kit: Kit, r: Rect, roadSide: "east" | "west", painted: boolean): void {
  const top = CURB_H;
  kit.g("paver").boxMinMax(r.x0, 0, r.z0, r.x1, top, r.z1, rgb("#e2d6c0"), 0b001000);
  kit.colliders.add((r.x0 + r.x1) / 2, top / 2, (r.z0 + r.z1) / 2, r.x1 - r.x0, top, r.z1 - r.z0);
  // Curb stones (slightly proud of the paving), optionally painted black/yellow.
  const cx0 = roadSide === "east" ? r.x1 - 0.18 : r.x0;
  const cx1 = cx0 + 0.18;
  const len = 1.0;
  for (let z = r.z0; z < r.z1 - 0.01; z += len) {
    const z1 = Math.min(r.z1, z + len);
    const k = Math.round((z - r.z0) / len);
    const c = painted ? (k % 2 ? YELLOW : BLACK) : shade(CURB_C, 0.92 + (k % 3) * 0.04);
    kit.g("concrete").boxMinMax(cx0, 0, z + 0.01, cx1, top + 0.02, z1 - 0.01, c, 0b111011);
  }
  // End caps of curbs facing along z.
  kit.g("concrete").boxMinMax(r.x0, 0, r.z0, r.x1, top + 0.02, r.z0 + 0.02, CURB_C, 0b000001);
  kit.g("concrete").boxMinMax(r.x0, 0, r.z1 - 0.02, r.x1, top + 0.02, r.z1, CURB_C, 0b000010);
}

/** Sloped kerb ramp from road level up to the sidewalk (visual + matching collision). */
function curbRamp(kit: Kit, xEdge: number, dir: 1 | -1, z0: number, z1: number): void {
  // dir: +1 ramp rises toward +x (west sidewalk is at -x so dir=-1).
  const run = 0.9;
  // The wedge sits in the gutter: road level at xa rising to kerb height at the edge.
  const xa = xEdge - dir * run, xb = xEdge;
  const g = kit.g("concrete");
  const c = rgb("#b8b0a2");
  if (dir > 0) g.quad(new Vector3(xa, 0.005, z1), new Vector3(xa, 0.005, z0), new Vector3(xb, CURB_H, z0), new Vector3(xb, CURB_H, z1), c);
  else g.quad(new Vector3(xa, 0.005, z0), new Vector3(xa, 0.005, z1), new Vector3(xb, CURB_H, z1), new Vector3(xb, CURB_H, z0), c);
  // Hatching stripes for readability.
  for (let z = z0 + 0.2; z < z1 - 0.1; z += 0.5) {
    const ya = 0.012, yb = CURB_H + 0.007;
    if (dir > 0) kit.g("paint").quad(new Vector3(xa, ya, z + 0.15), new Vector3(xa, ya, z), new Vector3(xb, yb, z), new Vector3(xb, yb, z + 0.15), YELLOW);
    else kit.g("paint").quad(new Vector3(xa, ya, z), new Vector3(xa, ya, z + 0.15), new Vector3(xb, yb, z + 0.15), new Vector3(xb, yb, z), YELLOW);
  }
  const ang = Math.atan2(CURB_H, run);
  const len = Math.hypot(run, CURB_H);
  // Thin box tilted about Z; express as rotY = ±90° and pitch about local X.
  kit.colliders.add((xa + xb) / 2, CURB_H / 2 - 0.05, (z0 + z1) / 2, z1 - z0, 0.1, len, Math.PI / 2, dir > 0 ? -ang : ang);
}

/** Speed breaker across the main road: painted hump with ramps. */
export function speedBreakerColliders(c: { add: (cx: number, cy: number, cz: number, sx: number, sy: number, sz: number, rotY?: number, rotX?: number) => void }, z: number): void {
  const h = 0.08, half = 0.45;
  const x0 = -ROAD_HALF + 0.05, x1 = ROAD_HALF - 0.05;
  c.add(0, h / 2 - 0.02, z, x1 - x0, h + 0.04 - 0.02, 0.3);
  const ang = Math.atan2(h, half - 0.15);
  const len = Math.hypot(half - 0.15, h);
  c.add(0, h / 2 - 0.03, z - 0.3, x1 - x0, 0.06, len, 0, -ang);
  c.add(0, h / 2 - 0.03, z + 0.3, x1 - x0, 0.06, len, 0, ang);
}

function speedBreaker(kit: Kit, z: number): void {
  const h = 0.08, half = 0.45;
  const x0 = -ROAD_HALF + 0.05, x1 = ROAD_HALF - 0.05;
  const segs = 6;
  for (let i = 0; i < segs; i++) {
    const a0 = -half + (i / segs) * 2 * half, a1 = -half + ((i + 1) / segs) * 2 * half;
    const y0 = h * Math.cos((a0 / half) * Math.PI * 0.5), y1 = h * Math.cos((a1 / half) * Math.PI * 0.5);
    for (let x = x0; x < x1 - 0.01; x += 0.5) {
      const xe = Math.min(x1, x + 0.5);
      const stripe = Math.round((x - x0) / 0.5) % 2 ? YELLOW : BLACK;
      kit.g("paint").quad(new Vector3(x, y0, z + a0), new Vector3(xe, y0, z + a0), new Vector3(xe, y1, z + a1), new Vector3(x, y1, z + a1), stripe);
    }
  }
  // Collision: a central flat box plus two pitched ramps.
  speedBreakerColliders(kit.colliders, z);
}

export function buildStreet(kit: Kit): void {
  kit.world();
  const rng = new Rng(5);
  // (The ground and the world's floor collider are built with the open country.)
  // Main road with faded edge lines.
  groundQuad(kit, "asphalt", { x0: -ROAD_HALF, x1: ROAD_HALF, z0: STREET_Z0 - 2, z1: STREET_Z1 + 6 }, 0, [1, 1, 1]);
  for (const x of [-ROAD_HALF + 0.35, ROAD_HALF - 0.45]) {
    for (let z = STREET_Z0; z < STREET_Z1; z += 3) groundQuad(kit, "concrete", { x0: x, x1: x + 0.1, z0: z, z1: z + 1.6 }, 0.004, rgb("#e7e1cf"));
  }
  // Manhole covers.
  for (const z of [-55, -12, 30]) kit.g("metal").cylinder(rng.range(-1.5, 1.5), 0, z, 0.35, 0.35, 0.012, 14, rgb("#4a4744"), true);
  speedBreaker(kit, -20.5);
  speedBreaker(kit, 9);
  // Sidewalks. Black/yellow painted kerbs near the gate and chowk ends.
  for (const r of SIDEWALK_RECTS) {
    const side = r.x0 < 0 ? "east" : "west";
    sidewalk(kit, r, side, r.z0 <= STREET_Z0 + 1 || r.z1 >= STREET_Z1 - 1);
  }
  curbRamp(kit, -ROAD_HALF, -1, -36.5, -34.5);
  curbRamp(kit, ROAD_HALF, 1, -53.5, -51.5);
  curbRamp(kit, -ROAD_HALF, -1, 17, 19);
  // Lane (gali): concrete with open drains on both sides.
  groundQuad(kit, "concrete", { x0: LANE_W.x0, x1: LANE_W.x1, z0: LANE_W.z0, z1: LANE_W.z1 }, 0.003, rgb("#c6bfb1"));
  for (const z of [LANE_W.z0 + 0.15, LANE_W.z1 - 0.15]) {
    groundQuad(kit, "dark", { x0: LANE_W.x0, x1: LANE_W.x1, z0: z - 0.13, z1: z + 0.13 }, 0.006, [1, 1, 1]);
    for (let x = LANE_W.x0 + 1; x < LANE_W.x1; x += 2.5) kit.g("concrete").boxMinMax(x, 0, z - 0.17, x + 0.6, 0.035, z + 0.17, rgb("#9e978a"));
  }
  // Courtyard: brick paving with a border.
  groundQuad(kit, "brick", { x0: COURTYARD.x0, x1: COURTYARD.x1, z0: COURTYARD.z0, z1: COURTYARD.z1 }, 0.004, rgb("#c99a84"));
  courtyardWalls(kit);
  // Workshop apron edge strip (drop kerb).
  kit.g("concrete").boxMinMax(ROAD_HALF, 0, WORKSHOP_APRON.z0, ROAD_HALF + 0.18, 0.03, WORKSHOP_APRON.z1, CURB_C);
  gate(kit, -66);
  eastLaneGate(kit);
}

function courtyardWalls(kit: Kit): void {
  const C = COURTYARD;
  const wallC = rgb("#d7c4a3");
  const h = 3.0;
  // North and south walls with a wooden door each.
  for (const z of [C.z1, C.z0]) {
    kit.solid("plaster", (C.x0 + C.x1) / 2, h / 2, z, C.x1 - C.x0, h, 0.3, wallC);
    kit.g("plaster").boxMinMax(C.x0, h, z - 0.18, C.x1, h + 0.08, z + 0.18, shade(wallC, 0.9));
    const dz = z === C.z1 ? -0.16 : 0.16;
    kit.g("wood").boxMinMax(-41, 0, z + dz - 0.03, -39.6, 2.2, z + dz + 0.03, rgb("#6b3f24"));
  }
}

function gate(kit: Kit, z: number): void {
  kit.world();
  const red = rgb("#8e2b23"), cream = rgb("#efe0bf");
  for (const x of [-5.4, 5.4]) {
    kit.solid("plaster", x, 3.2, z, 0.9, 6.4, 0.9, cream);
    kit.g("plaster").boxMinMax(x - 0.6, 0, z - 0.6, x + 0.6, 0.6, z + 0.6, red);
    kit.g("plaster").boxMinMax(x - 0.55, 6.4, z - 0.55, x + 0.55, 6.7, z + 0.55, red);
    kit.g("plaster").cylinder(x, 6.7, z, 0.35, 0.05, 0.7, 10, cream);
  }
  kit.g("plaster").boxMinMax(-5.9, 5.3, z - 0.4, 5.9, 6.3, z + 0.4, red);
  kit.colliders.add(0, 5.8, z, 11.8, 1.0, 0.8);
  // Signs on both faces.
  kit.frame(0, z + 0.41, 0);
  kit.sign("gate", 0, 5.8, 0, 4.4);
  kit.frame(0, z - 0.41, Math.PI);
  kit.sign("gate", 0, 5.8, 0, 4.4);
  kit.world();
}

function eastLaneGate(kit: Kit): void {
  kit.world();
  const x = FRONTAGE + 2.0;
  kit.solid("metal", x, 1.2, -28, 0.1, 2.4, 4, rgb("#3d5a6c"));
  for (let z = -29.9; z < -26; z += 0.25) kit.g("metal").boxMinMax(x - 0.08, 0, z, x - 0.05, 2.3, z + 0.04, rgb("#2b3d49"));
  kit.frame(x - 0.1, -28, -Math.PI / 2);
  kit.sign("yardGate", 0, 1.6, 0, 1.6);
  kit.world();
  groundQuad(kit, "concrete", { x0: FRONTAGE, x1: x, z0: -30, z1: -26 }, 0.003, rgb("#bfb7a8"));
}
