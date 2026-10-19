import { Vector3 } from "../babylon";
import { mix, rgb, shade, type RGB } from "../render/GeoBuilder";
import { Rng } from "../render/textures";
import type { Kit } from "./Kit";
import { facadeFrame, type BuildingSpec } from "./layout";

export const PLINTH = 0.45;
export const GROUND_TOP = 3.85;
export const UPPER_H = 3.15;
const WALL_T = 0.3;

const TRIMS = ["#2f6f5e", "#3a5f8f", "#7a4a2a", "#8c2f39", "#4b6b3a", "#2d4f6c", "#6b4f8a"].map(rgb);
const WHITE: RGB = rgb("#f3eee4");
const IRON: RGB = rgb("#2b2b2e");
const CONCRETE: RGB = rgb("#bdb6aa");

export function roofHeight(b: BuildingSpec): number {
  return GROUND_TOP + (b.floors - 1) * UPPER_H;
}

interface Opening { u0: number; u1: number; y0: number; y1: number }

/**
 * Build wall panels for one storey band, leaving holes for openings. Each
 * panel is a box, so reveals (opening sides, sill and head) come for free.
 */
function wallBand(kit: Kit, wall: RGB, y0: number, y1: number, w: number, zFront: number, openings: Opening[], mat: "plaster" | "brick" = "plaster"): void {
  const g = kit.g(mat);
  const z0 = zFront - WALL_T;
  const ops = [...openings].sort((a, b) => a.u0 - b.u0);
  let u = 0;
  for (const o of ops) {
    if (o.u0 > u + 0.001) g.boxMinMax(u, y0, z0, o.u0, y1, zFront, wall);
    if (o.y0 > y0 + 0.001) g.boxMinMax(o.u0, y0, z0, o.u1, o.y0, zFront, wall);
    if (o.y1 < y1 - 0.001) g.boxMinMax(o.u0, o.y1, z0, o.u1, y1, zFront, wall);
    u = o.u1;
  }
  if (u < w - 0.001) g.boxMinMax(u, y0, z0, w, y1, zFront, wall);
}

function windowUnit(kit: Kit, rng: Rng, o: Opening, zFront: number, trim: RGB, wall: RGB, opts: { shutters: boolean; grill: boolean; chajja: boolean; closed: boolean }): void {
  const paint = kit.g("paint");
  const wood = kit.g("wood");
  const recess = zFront - 0.2;
  const ft = 0.07;
  const w = o.u1 - o.u0, h = o.y1 - o.y0;
  // Frame inside the reveal.
  paint.boxMinMax(o.u0, o.y0, recess - 0.06, o.u0 + ft, o.y1, recess, trim);
  paint.boxMinMax(o.u1 - ft, o.y0, recess - 0.06, o.u1, o.y1, recess, trim);
  paint.boxMinMax(o.u0, o.y1 - ft, recess - 0.06, o.u1, o.y1, recess, trim);
  paint.boxMinMax(o.u0, o.y0, recess - 0.06, o.u1, o.y0 + ft, recess, trim);
  // Mullion and transom.
  paint.boxMinMax((o.u0 + o.u1) / 2 - 0.03, o.y0, recess - 0.05, (o.u0 + o.u1) / 2 + 0.03, o.y1, recess - 0.01, trim);
  paint.boxMinMax(o.u0, o.y1 - h * 0.28, recess - 0.05, o.u1, o.y1 - h * 0.28 + 0.05, recess - 0.01, trim);
  if (opts.closed) {
    // Closed louvred wooden shutters.
    const c = shade(trim, 1.15);
    for (let y = o.y0 + 0.1; y < o.y1 - 0.08; y += 0.12) wood.boxMinMax(o.u0 + ft, y, recess - 0.05, o.u1 - ft, y + 0.08, recess - 0.02, c);
    kit.g("dark").boxMinMax(o.u0, o.y0, recess - 0.08, o.u1, o.y1, recess - 0.07, [1, 1, 1]);
  } else {
    kit.g("glass").boxMinMax(o.u0 + ft, o.y0 + ft, recess - 0.04, o.u1 - ft, o.y1 - ft, recess - 0.03, [1, 1, 1]);
    // Hint of a curtain inside.
    if (rng.next() < 0.6) {
      const cc = rgb(rng.pick(["#c94f4f", "#e6c35c", "#5c8fc9", "#e0e0d0", "#8fbf6a"]));
      kit.g("cloth").boxMinMax(o.u0 + ft, o.y0 + h * 0.3, recess - 0.12, o.u0 + w * rng.range(0.25, 0.45), o.y1 - ft, recess - 0.1, cc);
    }
  }
  // Sill.
  kit.g("plaster").boxMinMax(o.u0 - 0.08, o.y0 - 0.08, zFront - 0.2, o.u1 + 0.08, o.y0, zFront + 0.07, shade(wall, 0.9));
  if (opts.shutters && !opts.closed) {
    // Open wooden shutters folded flat against the wall either side.
    const sw = w / 2;
    const c = shade(trim, 1.1);
    for (const [a, bb] of [[o.u0 - sw - 0.02, o.u0 - 0.02], [o.u1 + 0.02, o.u1 + 0.02 + sw]] as const) {
      wood.boxMinMax(a, o.y0 + 0.02, zFront + 0.01, bb, o.y1 - 0.02, zFront + 0.05, c);
      for (let y = o.y0 + 0.12; y < o.y1 - 0.1; y += 0.14) paint.boxMinMax(a + 0.05, y, zFront + 0.05, bb - 0.05, y + 0.04, zFront + 0.065, shade(c, 0.8));
    }
  }
  if (opts.grill) {
    for (let u = o.u0 + 0.15; u < o.u1 - 0.05; u += 0.15) kit.g("metal").boxMinMax(u - 0.01, o.y0, zFront - 0.06, u + 0.01, o.y1, zFront - 0.04, IRON);
    for (const y of [o.y0 + h * 0.33, o.y0 + h * 0.66]) kit.g("metal").boxMinMax(o.u0, y - 0.012, zFront - 0.065, o.u1, y + 0.012, zFront - 0.035, IRON);
  }
  if (opts.chajja) {
    // Projecting sunshade over the window.
    kit.g("concrete").boxMinMax(o.u0 - 0.25, o.y1 + 0.12, zFront, o.u1 + 0.25, o.y1 + 0.2, zFront + 0.5, CONCRETE);
    kit.g("concrete").boxMinMax(o.u0 - 0.25, o.y1 + 0.06, zFront + 0.44, o.u1 + 0.25, o.y1 + 0.2, zFront + 0.5, shade(CONCRETE, 0.9));
  }
}

function doorUnit(kit: Kit, o: Opening, zFront: number, trim: RGB, steps: boolean): void {
  const recess = zFront - 0.28;
  const wood = kit.g("wood");
  const w = o.u1 - o.u0;
  const c = shade(trim, 1.05);
  // Two leaf panelled door, slightly ajar on one side.
  wood.boxMinMax(o.u0, o.y0, recess - 0.06, o.u0 + w / 2 - 0.01, o.y1, recess, c);
  wood.boxMinMax(o.u0 + w / 2 + 0.01, o.y0, recess - 0.06, o.u1, o.y1, recess, c);
  const p = kit.g("paint");
  for (const uu of [o.u0 + 0.08, o.u0 + w / 2 + 0.08]) {
    p.boxMinMax(uu, o.y0 + 0.2, recess, uu + w / 2 - 0.17, o.y0 + 1.0, recess + 0.025, shade(c, 0.82));
    p.boxMinMax(uu, o.y0 + 1.15, recess, uu + w / 2 - 0.17, o.y1 - 0.2, recess + 0.025, shade(c, 0.82));
  }
  kit.g("chrome").boxMinMax(o.u0 + w / 2 - 0.1, o.y0 + 1.0, recess, o.u0 + w / 2 - 0.05, o.y0 + 1.15, recess + 0.05, [0.8, 0.75, 0.5]);
  // Door frame + lintel.
  p.boxMinMax(o.u0 - 0.1, o.y0, zFront - 0.02, o.u0, o.y1 + 0.1, zFront + 0.04, trim);
  p.boxMinMax(o.u1, o.y0, zFront - 0.02, o.u1 + 0.1, o.y1 + 0.1, zFront + 0.04, trim);
  p.boxMinMax(o.u0 - 0.1, o.y1, zFront - 0.02, o.u1 + 0.1, o.y1 + 0.12, zFront + 0.04, trim);
  if (steps) {
    // Entrance steps from the sidewalk (0.15) up to the plinth.
    const cg = kit.g("concrete");
    cg.boxMinMax(o.u0 - 0.3, 0, zFront, o.u1 + 0.3, PLINTH - 0.15, zFront + 0.35, CONCRETE);
    cg.boxMinMax(o.u0 - 0.15, 0, zFront - 0.3, o.u1 + 0.15, PLINTH, zFront, shade(CONCRETE, 1.05));
    kit.collide((o.u0 + o.u1) / 2, (PLINTH - 0.15) / 2, zFront + 0.175, w + 0.6, PLINTH - 0.15, 0.35);
  }
}

function balcony(kit: Kit, u0: number, u1: number, y: number, zFront: number, trim: RGB): void {
  const depth = 1.0;
  kit.g("concrete").boxMinMax(u0, y - 0.15, zFront, u1, y, zFront + depth, CONCRETE);
  kit.collide((u0 + u1) / 2, y - 0.075, zFront + depth / 2, u1 - u0, 0.15, depth);
  const m = kit.g("metal");
  const top = y + 0.95;
  m.boxMinMax(u0, top - 0.04, zFront + depth - 0.05, u1, top, zFront + depth, trim);
  m.boxMinMax(u0, top - 0.04, zFront, u0 + 0.05, top, zFront + depth, trim);
  m.boxMinMax(u1 - 0.05, top - 0.04, zFront, u1, top, zFront + depth, trim);
  m.boxMinMax(u0, y + 0.1, zFront + depth - 0.04, u1, y + 0.13, zFront + depth - 0.01, trim);
  for (let u = u0 + 0.12; u < u1 - 0.05; u += 0.13) m.boxMinMax(u - 0.012, y, zFront + depth - 0.04, u + 0.012, top, zFront + depth - 0.02, trim);
  for (const uu of [u0 + 0.02, u1 - 0.02]) for (let z = zFront + 0.12; z < zFront + depth - 0.05; z += 0.13) m.boxMinMax(uu - 0.012, y, z - 0.012, uu + 0.012, top, z + 0.012, trim);
  // Rail collision so the balcony edge is solid when rooftops are reached.
  kit.collide((u0 + u1) / 2, y + 0.5, zFront + depth - 0.03, u1 - u0, 1.0, 0.06);
}

export interface ShopInfo {
  /** Shop interior: local rect behind the façade. */
  u0: number; u1: number; depth: number;
}

/** Ground-floor shopfront with counter, rolling shutter, sign and awning. */
function shopfront(kit: Kit, b: BuildingSpec, rng: Rng, w: number, trim: RGB, wall: RGB): ShopInfo {
  const u0 = 0.6, u1 = w - 0.6, y0 = PLINTH, y1 = 2.95;
  const depth = 3.6;
  wallBand(kit, wall, PLINTH, GROUND_TOP, w, 0, [{ u0, u1, y0, y1 }]);
  // Interior shell.
  const inner = shade(mix(wall, WHITE, 0.4), 0.92);
  const p = kit.g("interior");
  p.boxMinMax(u0, PLINTH, -depth - 0.2, u1, GROUND_TOP, -depth, inner, 0b000010);
  p.boxMinMax(u0 - 0.2, PLINTH, -depth, u0, GROUND_TOP, -WALL_T, inner, 0b100000);
  p.boxMinMax(u1, PLINTH, -depth, u1 + 0.2, GROUND_TOP, -WALL_T, inner, 0b010000);
  p.boxMinMax(u0, y1 + 0.3, -depth, u1, y1 + 0.5, -WALL_T, inner, 0b000100);
  kit.g("wood").boxMinMax(u0, PLINTH - 0.05, -depth, u1, PLINTH, 0, shade(rgb("#9a7550"), 0.9), 0b001000);
  // Tube light.
  kit.g("emissive").boxMinMax((u0 + u1) / 2 - 0.6, y1 + 0.2, -depth + 0.05, (u0 + u1) / 2 + 0.6, y1 + 0.25, -depth + 0.1, [1, 1, 1]);
  // Rolled-up shutter drum.
  const sg = kit.g("shutter");
  sg.boxMinMax(u0, y1 - 0.05, -0.28, u1, y1 + 0.28, -0.05, rgb("#9ea3a6"));
  // Counter at the front with a gap for the shopkeeper.
  const counterC = shade(trim, 1.1);
  const cz0 = -1.0, cz1 = -0.4;
  kit.g("wood").boxMinMax(u0 + 0.05, PLINTH, cz0, u1 - 1.0, PLINTH + 0.95, cz1, counterC);
  kit.g("paint").boxMinMax(u0 + 0.02, PLINTH + 0.95, cz0 - 0.05, u1 - 0.97, PLINTH + 1.0, cz1 + 0.05, shade(counterC, 0.7));
  // Shop collision: interior blocked from the counter line back.
  kit.collide(w / 2, GROUND_TOP / 2, (-b.depth + cz1) / 2 - 0.0, w, GROUND_TOP, b.depth + cz1);
  kit.collide((u1 - 1.0 + u1) / 2, 1.2, (cz0 + cz1) / 2, 1.0, 2.4, cz1 - cz0);
  // Side piers in front of the counter line.
  kit.collide(u0 / 2, GROUND_TOP / 2, cz1 / 2, u0, GROUND_TOP, -cz1);
  kit.collide(w - u0 / 2, GROUND_TOP / 2, cz1 / 2, u0, GROUND_TOP, -cz1);
  merchandise(kit, b, rng, u0, u1, depth, cz0);
  // Sign board.
  if (b.sign) {
    const sw = Math.min(w - 1.0, b.use === "dhaba" ? 7.5 : 6.2);
    const signY = 3.6;
    const h = sw / (1024 / 224);
    kit.g("paint").boxMinMax(w / 2 - sw / 2 - 0.08, signY - h / 2 - 0.08, 0.02, w / 2 + sw / 2 + 0.08, signY + h / 2 + 0.08, 0.14, rgb("#3a3a3a"));
    kit.sign(b.sign, w / 2, signY, 0.145, sw);
  }
  // Awning: striped fabric on a light frame.
  if (b.use !== "workshop" && rng.next() < 0.85) {
    const ac = rgb(rng.pick(["#c0392b", "#1f7a5a", "#d68910", "#2e86c1", "#8e44ad", "#b03a2e"]));
    awning(kit, u0 - 0.2, u1 + 0.2, 2.95, 1.5, ac);
  }
  return { u0, u1, depth };
}

export function awning(kit: Kit, u0: number, u1: number, yTop: number, out: number, c: RGB): void {
  const f = kit.g("fabric");
  const drop = 0.45;
  const yLow = yTop - drop;
  f.quad(new Vector3(u1, yLow, out), new Vector3(u0, yLow, out), new Vector3(u0, yTop, 0.05), new Vector3(u1, yTop, 0.05), c);
  f.quad(new Vector3(u0, yLow, out), new Vector3(u1, yLow, out), new Vector3(u1, yTop, 0.05), new Vector3(u0, yTop, 0.05), shade(c, 0.6));
  // Scalloped valance.
  f.box((u0 + u1) / 2, yLow - 0.12, out, u1 - u0, 0.24, 0.02, shade(c, 0.95));
  const m = kit.g("metal");
  for (const u of [u0 + 0.05, u1 - 0.05]) m.tube(new Vector3(u, yTop + 0.05, 0.05), new Vector3(u, yLow, out), 0.02, 5, IRON);
}

function merchandise(kit: Kit, b: BuildingSpec, rng: Rng, u0: number, u1: number, depth: number, counterZ: number): void {
  const back = -depth + 0.05;
  const shelfC = rgb("#7b5a3a");
  const wood = kit.g("wood");
  // Back shelving.
  for (let i = 0; i < 4; i++) {
    const y = PLINTH + 0.4 + i * 0.6;
    wood.boxMinMax(u0 + 0.1, y, back, u1 - 0.1, y + 0.04, back + 0.45, shelfC);
  }
  wood.boxMinMax(u0 + 0.1, PLINTH, back, u0 + 0.16, PLINTH + 2.4, back + 0.45, shelfC);
  wood.boxMinMax(u1 - 0.16, PLINTH, back, u1 - 0.1, PLINTH + 2.4, back + 0.45, shelfC);
  const palette = {
    kiryana: ["#e8d28a", "#c9502f", "#3f7fbf", "#f2f2f2", "#e39a2d", "#5fa34a"],
    textile: ["#c2185b", "#7b1fa2", "#f9a825", "#00897b", "#e53935", "#3949ab", "#ff7043", "#fdd835"],
    sweets: ["#f6c453", "#f08a24", "#fff1c1", "#e9b0c9", "#9ccc65"],
    chemist: ["#ffffff", "#e3f2fd", "#c8e6c9", "#ffcdd2", "#1e88e5"],
    phone: ["#212121", "#e91e63", "#03a9f4", "#ffeb3b", "#ffffff"],
    hardware: ["#d32f2f", "#1976d2", "#fbc02d", "#9e9e9e", "#388e3c"],
    tailor: ["#fafafa", "#90caf9", "#ffcc80", "#a5d6a7", "#ce93d8"],
    cycle: ["#212121", "#c62828", "#1565c0", "#9e9e9e"],
    fruit: ["#ff9800", "#ffeb3b", "#e53935", "#7cb342"],
  } as Record<string, string[]>;
  const pal = (palette[b.use] ?? ["#cccccc"]).map(rgb);
  const g = b.use === "textile" || b.use === "tailor" ? kit.g("cloth") : kit.g("paint");
  for (let i = 0; i < 4; i++) {
    const y = PLINTH + 0.44 + i * 0.6;
    let u = u0 + 0.25;
    while (u < u1 - 0.35) {
      const ww = b.use === "textile" ? 0.32 : rng.range(0.12, 0.3);
      const hh = b.use === "textile" ? 0.3 : rng.range(0.15, 0.45);
      const c = rng.pick(pal);
      if (b.use === "textile") g.cylinder(u + ww / 2, y, back + 0.2, 0.15, 0.15, 0.32, 8, c, true, 1);
      else g.boxMinMax(u, y, back + 0.05, u + ww, y + hh, back + 0.4, c);
      u += ww + rng.range(0.02, 0.08);
    }
  }
  // Counter-top items.
  const top = PLINTH + 1.0;
  if (b.use === "sweets") {
    kit.g("glass").boxMinMax(u0 + 0.3, top, counterZ + 0.05, u1 - 1.3, top + 0.35, counterZ + 0.5, [1, 1, 1]);
    for (let u = u0 + 0.4; u < u1 - 1.5; u += 0.45) kit.g("paint").boxMinMax(u, top + 0.02, counterZ + 0.1, u + 0.38, top + 0.08, counterZ + 0.45, rng.pick(pal));
  } else if (b.use === "kiryana") {
    for (let u = u0 + 0.4; u < u1 - 1.3; u += 0.5) kit.g("glass").cylinder(u, top, counterZ + 0.3, 0.12, 0.12, 0.3, 8, [1, 1, 1]);
    // Grain sacks out front.
    for (let i = 0; i < 3; i++) kit.g("cloth").ellipsoid(u0 + 0.6 + i * 0.7, PLINTH + 0.3, counterZ - 0.05 + 0.6, 0.3, 0.32, 0.28, 8, 5, rgb(rng.pick(["#d9c9a0", "#cdb98e", "#e2d6b4"])));
  } else if (b.use === "tailor") {
    const t = rgb("#37474f");
    kit.g("metal").boxMinMax(u0 + 0.5, top, counterZ + 0.15, u0 + 0.95, top + 0.25, counterZ + 0.35, t);
    kit.g("metal").cylinder(u0 + 1.0, top, counterZ + 0.25, 0.08, 0.08, 0.05, 10, t);
  } else if (b.use === "hardware") {
    for (let i = 0; i < 6; i++) kit.g("paint").cylinder(u0 + 0.4 + (i % 3) * 0.3, top + Math.floor(i / 3) * 0.25, counterZ + 0.3, 0.12, 0.12, 0.24, 10, rng.pick(pal));
  }
}

/** Full building. Returns shop info when the ground floor is a shopfront. */
export function buildBuilding(kit: Kit, b: BuildingSpec): ShopInfo | null {
  const rng = new Rng(b.seed * 7 + 3);
  const f = facadeFrame(b);
  kit.frame(f.ox, f.oz, f.rotY);
  const w = f.width;
  const d = b.depth;
  const wall = rgb(b.color);
  const trim = rng.pick(TRIMS);
  const top = roofHeight(b);
  const sb = b.upperSetback ?? 0;
  const isDhaba = b.use === "dhaba";
  const special = isDhaba || b.use === "workshop";

  // Plinth band.
  const plinthC = b.brick ? rgb("#a65e46") : shade(wall, 0.72);
  kit.g(b.brick ? "brick" : "plaster").boxMinMax(0, 0, -0.02, w, PLINTH, 0.02, plinthC, 0b000010 | 0b001000);

  // Main mass behind the façade (interior hidden). Sides may be brick.
  if (!special) {
    const p = kit.g("plaster");
    p.boxMinMax(0, 0, -d, w, top, -WALL_T - sb, wall, 0b001001);
    kit.g(b.brick ? "brick" : "plaster").boxMinMax(0, 0, -d, w, top, -WALL_T - sb, b.brick ? [1, 1, 1] : shade(wall, 0.95), 0b110000);
    // Dark interior plane seen through windows (not over the open shopfront).
    const darkY0 = b.use === "house" ? PLINTH : GROUND_TOP;
    kit.g("dark").boxMinMax(0.02, darkY0, -WALL_T - sb - 0.01, w - 0.02, top - 0.02, -WALL_T - sb, [1, 1, 1], 0b000010);
    if (sb > 0) {
      // Lower mass covers the ground floor in front of the setback.
      kit.g("plaster").boxMinMax(0, 0, -WALL_T - sb, w, GROUND_TOP, -WALL_T, wall, 0b111001);
      kit.g("concrete").boxMinMax(0, GROUND_TOP, -sb - WALL_T, w, GROUND_TOP + 0.12, 0.1, CONCRETE);
    }
  }

  if (isDhaba) {
    kit.g("plaster").boxMinMax(0, GROUND_TOP, -d, w, top, -WALL_T - sb, wall, 0b111001);
    kit.g("interior").boxMinMax(0, GROUND_TOP - 0.2, -d, w, GROUND_TOP, 0, rgb("#efe6d2"), 0b000110);
    kit.g("dark").boxMinMax(0.02, GROUND_TOP, -WALL_T - sb - 0.01, w - 0.02, top - 0.02, -WALL_T - sb, [1, 1, 1], 0b000010);
    kit.collide(w / 2, (top + GROUND_TOP - 0.2) / 2, -d / 2, w, top - GROUND_TOP + 0.2, d);
  }

  let shop: ShopInfo | null = null;
  // ---------------- Ground floor
  if (!special) {
    if (b.use === "house") {
      const du = rng.range(0.8, Math.max(0.9, w - 2.4));
      const door: Opening = { u0: du, u1: du + 1.2, y0: PLINTH, y1: PLINTH + 2.3 };
      const ops: Opening[] = [door];
      const winU = du > w / 2 ? 0.8 : w - 2.2;
      const gw: Opening = { u0: winU, u1: winU + 1.3, y0: PLINTH + 0.9, y1: PLINTH + 2.3 };
      if (Math.abs(gw.u0 - door.u0) > 1.8) ops.push(gw);
      wallBand(kit, shade(wall, 0.96), PLINTH, GROUND_TOP, w, 0, ops);
      doorUnit(kit, door, 0, trim, true);
      if (ops.length > 1) windowUnit(kit, rng, gw, 0, trim, wall, { shutters: false, grill: true, chajja: true, closed: false });
      kit.collide(w / 2, top / 2, -d / 2, w, top, d);
      // Electric meter box beside the door.
      kit.g("paint").boxMinMax(door.u1 + 0.25, 1.5, 0, door.u1 + 0.6, 1.95, 0.12, rgb("#d6d2c4"));
      kit.g("dark").boxMinMax(door.u1 + 0.3, 1.6, 0.12, door.u1 + 0.55, 1.85, 0.125, [1, 1, 1]);
    } else {
      shop = shopfront(kit, b, rng, w, trim, wall);
      kit.collide(w / 2, (top + GROUND_TOP) / 2, -d / 2, w, top - GROUND_TOP, d);
    }
    // Cornice at the first-floor line.
    kit.g("plaster").boxMinMax(-0.02, GROUND_TOP - 0.1, -0.05, w + 0.02, GROUND_TOP + 0.06, 0.1, shade(mix(wall, WHITE, 0.5), 1));
  }

  // ---------------- Upper floors
  if (!special || isDhaba) {
    for (let k = 1; k < b.floors; k++) {
      const y0 = GROUND_TOP + (k - 1) * UPPER_H, y1 = y0 + UPPER_H;
      const z = -sb;
      const n = Math.max(1, Math.floor((w - 0.8) / 2.6));
      const span = w / n;
      const ops: Opening[] = [];
      const hasBalcony = !!b.balcony && (k === 1 || rng.next() < 0.5) && n >= 2;
      const balcIdx = hasBalcony ? Math.floor(n / 2) : -1;
      for (let i = 0; i < n; i++) {
        const cx = span * (i + 0.5);
        if (i === balcIdx) ops.push({ u0: cx - 0.55, u1: cx + 0.55, y0: y0 + 0.12, y1: y0 + 2.3 });
        else ops.push({ u0: cx - 0.6, u1: cx + 0.6, y0: y0 + 0.9, y1: y0 + 2.35 });
      }
      wallBand(kit, wall, y0, y1, w, z, ops);
      ops.forEach((o, i) => {
        if (i === balcIdx) {
          doorUnit(kit, o, z, trim, false);
          balcony(kit, o.u0 - 0.9, o.u1 + 0.9, y0 + 0.12, z, trim);
          kit.g("concrete").boxMinMax(o.u0 - 1.0, y1 - 0.25, z, o.u1 + 1.0, y1 - 0.15, z + 1.1, CONCRETE);
        } else {
          windowUnit(kit, rng, o, z, trim, wall, { shutters: rng.next() < 0.55, grill: rng.next() < 0.35, chajja: true, closed: rng.next() < 0.18 });
        }
      });
      kit.g("plaster").boxMinMax(-0.02, y1 - 0.08, z - 0.05, w + 0.02, y1 + 0.04, z + 0.08, shade(mix(wall, WHITE, 0.5), 1));
    }
  }

  // ---------------- Roof
  if (!special || isDhaba) roof(kit, b, rng, w, d, top, sb, wall);
  return shop;
}

export function roof(kit: Kit, b: BuildingSpec, rng: Rng, w: number, d: number, top: number, sb: number, wall: RGB): void {
  const par = 0.95, t = 0.2;
  const pc = shade(wall, 0.97);
  const zf = -sb;
  const p = kit.g("plaster");
  p.boxMinMax(0, top, zf - t, w, top + par, zf, pc);
  p.boxMinMax(0, top, -d, w, top + par, -d + t, pc);
  p.boxMinMax(0, top, -d + t, t, top + par, zf - t, pc);
  p.boxMinMax(w - t, top, -d + t, w, top + par, zf - t, pc);
  p.boxMinMax(-0.04, top + par, zf - t - 0.03, w + 0.04, top + par + 0.06, zf + 0.04, shade(mix(wall, WHITE, 0.5), 1));
  kit.collide(w / 2, top + par / 2, zf - t / 2, w, par, t);
  kit.collide(w / 2, top + par / 2, -d + t / 2, w, par, t);
  kit.collide(t / 2, top + par / 2, (zf - d) / 2, t, par, d + zf);
  kit.collide(w - t / 2, top + par / 2, (zf - d) / 2, t, par, d + zf);
  kit.g("concrete").boxMinMax(t, top - 0.01, -d + t, w - t, top + 0.02, zf - t, shade(CONCRETE, 0.92), 0b001000);
  // Water tank on a steel stand.
  const tx = rng.range(1.2, w - 1.2), tz = -d + rng.range(1.5, Math.max(1.6, d * 0.5));
  const tankC = rng.next() < 0.7 ? rgb("#1d1d1f") : rgb("#d8cfb8");
  const m = kit.g("metal");
  for (const [dx, dz] of [[-0.5, -0.5], [0.5, -0.5], [-0.5, 0.5], [0.5, 0.5]] as const) m.boxMinMax(tx + dx - 0.04, top, tz + dz - 0.04, tx + dx + 0.04, top + 0.8, tz + dz + 0.04, IRON);
  m.boxMinMax(tx - 0.6, top + 0.78, tz - 0.6, tx + 0.6, top + 0.84, tz + 0.6, IRON);
  kit.g("paint").cylinder(tx, top + 0.84, tz, 0.62, 0.6, 1.15, 16, tankC, true);
  kit.g("paint").cylinder(tx, top + 1.99, tz, 0.25, 0.22, 0.1, 10, shade(tankC, 1.2), true);
  for (let i = 0; i < 4; i++) kit.g("paint").torus(tx, top + 1.0 + i * 0.27, tz, 0.615, 0.015, 16, 3, shade(tankC, 0.8));
  kit.collide(tx, top + 1.0, tz, 1.3, 2.0, 1.3);
  // Pipe from the tank down the façade corner.
  const pipeC = rgb("#8a8f8f");
  const pu = tx > w / 2 ? w - 0.18 : 0.18;
  kit.g("metal").tube(new Vector3(tx, top + 1.0, tz), new Vector3(pu, top + 1.0, tz), 0.035, 6, pipeC);
  kit.g("metal").tube(new Vector3(pu, top + 1.0, tz), new Vector3(pu, top + 1.0, zf + 0.1), 0.035, 6, pipeC);
  kit.g("metal").tube(new Vector3(pu, top + 1.0, zf + 0.1), new Vector3(pu, 0.2, zf + 0.1), 0.04, 6, pipeC);
  for (let y = 1; y < top; y += 1.6) kit.g("metal").boxMinMax(pu - 0.06, y, zf, pu + 0.06, y + 0.04, zf + 0.15, IRON);
  // Stair head-room (mumty) on taller buildings.
  if (b.floors >= 3 && rng.next() < 0.7) {
    const mx = tx < w / 2 ? w - 3.0 : 0.4;
    p.boxMinMax(mx, top, -d + 0.4, mx + 2.6, top + 2.5, -d + 3.0, shade(wall, 0.93));
    kit.g("wood").boxMinMax(mx + 0.8, top, -d + 3.0, mx + 1.7, top + 2.1, -d + 3.04, rgb("#6b4a2f"));
    kit.g("concrete").boxMinMax(mx - 0.1, top + 2.5, -d + 0.3, mx + 2.7, top + 2.62, -d + 3.3, CONCRETE);
    kit.collide(mx + 1.3, top + 1.25, -d + 1.7, 2.6, 2.5, 2.6);
  }
  // Clothes line on some roofs.
  if (rng.next() < 0.5) {
    const y = top + 1.7, z = -d / 2;
    m.boxMinMax(0.4, top, z - 0.03, 0.46, y, z + 0.03, IRON);
    m.boxMinMax(w - 0.46, top, z - 0.03, w - 0.4, y, z + 0.03, IRON);
    m.tube(new Vector3(0.43, y, z), new Vector3(w - 0.43, y, z), 0.008, 3, IRON);
    for (let u = 1.0; u < w - 1.0; u += rng.range(0.6, 1.1)) {
      const c = rgb(rng.pick(["#e53935", "#fdd835", "#1e88e5", "#ffffff", "#8e24aa", "#43a047", "#fb8c00"]));
      kit.g("cloth").boxMinMax(u, y - rng.range(0.5, 0.9), z - 0.01, u + rng.range(0.35, 0.6), y, z + 0.01, c);
    }
  }
}
