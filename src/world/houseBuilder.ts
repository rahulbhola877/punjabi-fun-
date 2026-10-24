/**
 * Punjabi house builder: facades with real openings instead of boxes stuck
 * on a wall. Every wall is built around its doors and windows (with reveals
 * showing the wall's thickness), and every opening is filled with a framed
 * door or window — panelled wooden or steel doors in a chaukhat, windows with
 * frames, grills, wooden shutters, sills and chajjas. On top of that come the
 * things that make a Punjab street read as one: jaali parapets, balconies
 * with railings, the stair mumty, the Sintex tank, coolers and AC units, dish
 * antennas, nameplates and gate pillars.
 *
 * Coordinates are the building's local frame (country.ts `frontFrame`): the
 * front runs along +x from 0 to w, faces +z, and the building goes back to
 * -d. Only faces that can be seen are emitted; everything is batched through
 * the Kit like the rest of the scenery.
 */
import { mix, rgb, shade, type RGB } from "../render/GeoBuilder";
import type { MatKey } from "../render/Materials";
import type { Kit } from "./Kit";

const PX = 0b100000, NX = 0b010000, PY = 0b001000, NY = 0b000100, PZ = 0b000010, NZ = 0b000001;
const WHITE: RGB = rgb("#f1eee6");
const IRON: RGB = rgb("#2b2b2e");
const GLASS: RGB = [1, 1, 1];

export interface Hole { u0: number; u1: number; v0: number; v1: number }

/**
 * A wall face at plane z (facing +z), from x0..x1 and y0..y1, with
 * rectangular holes cut in it, and the holes' reveals `r` deep. Holes in one
 * call must not overlap along x (call once per floor band).
 */
export function holedWall(kit: Kit, mat: MatKey, c: RGB, x0: number, x1: number, y0: number, y1: number, z: number, holes: Hole[], r = 0.16): void {
  const g = kit.g(mat);
  const hs = holes.filter((h) => h.u1 > x0 && h.u0 < x1).sort((a, b) => a.u0 - b.u0);
  let x = x0;
  const rc = shade(c, 0.86);
  for (const h of hs) {
    if (h.u0 > x + 1e-3) g.boxMinMax(x, y0, z, h.u0, y1, z, c, PZ);
    if (h.v0 > y0 + 1e-3) g.boxMinMax(h.u0, y0, z, h.u1, h.v0, z, c, PZ);
    if (h.v1 < y1 - 1e-3) g.boxMinMax(h.u0, h.v1, z, h.u1, y1, z, c, PZ);
    // Reveals: the cut sides of the wall, a shade darker.
    g.boxMinMax(h.u0, h.v0, z - r, h.u0, h.v1, z, rc, PX);
    g.boxMinMax(h.u1, h.v0, z - r, h.u1, h.v1, z, rc, NX);
    g.boxMinMax(h.u0, h.v1, z - r, h.u1, h.v1, z, shade(rc, 0.9), NY);
    if (h.v0 > y0 + 1e-3) g.boxMinMax(h.u0, h.v0, z - r, h.u1, h.v0, z, rc, PY);
    x = h.u1;
  }
  if (x < x1 - 1e-3) g.boxMinMax(x, y0, z, x1, y1, z, c, PZ);
}

export interface WindowStyle {
  frame: RGB;
  /** Iron grill in front of the glass: straight bars, or bars with a band pattern. */
  grill: "none" | "bars" | "pattern";
  /** Wooden leaves folded open against the wall (pind houses). */
  shutters?: RGB;
  /** Concrete sunshade over the window. */
  chajja?: RGB;
  /** Dark glass reads as an unlit room; "blue" is the tinted glass of a new kothi. */
  glass?: "dark" | "blue";
}

/** Fill a window hole cut by `holedWall` at plane z with reveal depth r. */
export function windowFill(kit: Kit, h: Hole, z: number, r: number, s: WindowStyle): void {
  // Frames, grills and sills are too small to cast a shadow worth drawing: they stay out of the shadow map.
  const cast = kit.cast;
  kit.cast = false;
  windowParts(kit, h, z, r, s);
  kit.cast = cast;
}

function windowParts(kit: Kit, h: Hole, z: number, r: number, s: WindowStyle): void {
  const zr = z - r;
  const w = h.u1 - h.u0;
  kit.g(s.glass === "dark" ? "dark" : "glass").boxMinMax(h.u0, h.v0, zr, h.u1, h.v1, zr, s.glass === "blue" ? rgb("#b8d4e6") : GLASS, PZ);
  // Frame: jambs, head, sill rail, a mullion and a transom.
  const f = kit.g("paint"), t = 0.06, fz = zr + 0.05;
  f.boxMinMax(h.u0, h.v0, zr, h.u0 + t, h.v1, fz, s.frame, PZ);
  f.boxMinMax(h.u1 - t, h.v0, zr, h.u1, h.v1, fz, s.frame, PZ);
  f.boxMinMax(h.u0 + t, h.v1 - t, zr, h.u1 - t, h.v1, fz, s.frame, PZ);
  f.boxMinMax(h.u0 + t, h.v0, zr, h.u1 - t, h.v0 + t, fz, s.frame, PZ | PY);
  if (w > 0.9) f.boxMinMax((h.u0 + h.u1) / 2 - 0.025, h.v0 + t, zr, (h.u0 + h.u1) / 2 + 0.025, h.v1 - t, fz, s.frame, PZ);
  // Grill set just inside the wall face.
  if (s.grill !== "none") {
    const gz0 = z - 0.07, gz1 = z - 0.05, m = kit.g("metal");
    const n = Math.max(3, Math.round(w / (kit.lean ? 0.45 : 0.27)));
    for (let i = 1; i < n; i++) {
      const u = h.u0 + (w * i) / n;
      m.boxMinMax(u - 0.011, h.v0, gz0, u + 0.011, h.v1, gz1, IRON, PZ);
    }
    const bands = s.grill === "pattern" ? [0.33, 0.5, 0.67] : [0.5];
    for (const k of bands) {
      const y = h.v0 + (h.v1 - h.v0) * k;
      m.boxMinMax(h.u0, y - 0.014, gz0, h.u1, y + 0.014, gz1 + 0.005, IRON, PZ);
    }

  }
  // Sill, sunshade and shutters on the wall face.
  kit.g("concrete").boxMinMax(h.u0 - 0.08, h.v0 - 0.07, z, h.u1 + 0.08, h.v0, z + 0.09, mix(s.frame, WHITE, 0.75), PY | PZ);
  if (s.chajja) kit.g("concrete").boxMinMax(h.u0 - 0.3, h.v1 + 0.14, z, h.u1 + 0.3, h.v1 + 0.24, z + 0.5, s.chajja, PY | NY | PZ);
  if (s.shutters) {
    const lw = w / 2, wd = kit.g("wood");
    wd.boxMinMax(h.u0 - lw, h.v0, z, h.u0 - 0.02, h.v1, z + 0.04, s.shutters, PZ | NX);
    wd.boxMinMax(h.u1 + 0.02, h.v0, z, h.u1 + lw, h.v1, z + 0.04, s.shutters, PZ | PX);
    for (const [a, b] of [[h.u0 - lw, h.u0 - 0.02], [h.u1 + 0.02, h.u1 + lw]] as const) {
      kit.g("wood").boxMinMax(a + 0.06, h.v0 + 0.08, z + 0.04, b - 0.06, h.v1 - 0.08, z + 0.04, shade(s.shutters, 0.8), PZ);
    }
  }
}

export interface DoorStyle {
  leaf: RGB;
  frame: RGB;
  /** "panel": wooden panelled door; "steel": sheet door with ribs; "darwaza": the pind's big double door with studs. */
  kind: "panel" | "steel" | "darwaza";
  /** Height of the step in front (plinth). */
  step?: number;
  /** Swung wide open into the house (an open house you can walk into). */
  open?: boolean;
}

/** Fill a door hole at plane z with reveal depth r: chaukhat, leaf (or two) and the step. */
export function doorFill(kit: Kit, h: Hole, z: number, r: number, s: DoorStyle): void {
  const cast = kit.cast;
  kit.cast = false;
  doorParts(kit, h, z, r, s);
  kit.cast = cast;
}

function doorParts(kit: Kit, h: Hole, z: number, r: number, s: DoorStyle): void {
  const zr = z - r + 0.04;
  const w = h.u1 - h.u0, hh = h.v1 - h.v0;
  const wd = kit.g(s.kind === "steel" ? "metal" : "wood");
  if (s.open) {
    // The leaf stands open against the inside of the wall, hinged at u0.
    kit.g("interior").boxMinMax(h.u0 + 0.02, h.v0, zr - 0.2 - (h.u1 - h.u0) + 0.05, h.u0 + 0.06, h.v1 - 0.02, zr - 0.2, shade(s.leaf, 1.3), PX | NX | PY);
  } else wd.boxMinMax(h.u0, h.v0, zr, h.u1, h.v1, zr, s.leaf, PZ);
  // Chaukhat: a frame standing just proud of the wall.
  const f = kit.g("wood"), t = 0.1;
  f.boxMinMax(h.u0 - t, h.v0, z - 0.02, h.u0, h.v1 + t, z + 0.05, s.frame, PZ | PX | NX);
  f.boxMinMax(h.u1, h.v0, z - 0.02, h.u1 + t, h.v1 + t, z + 0.05, s.frame, PZ | PX | NX);
  f.boxMinMax(h.u0, h.v1, z - 0.02, h.u1, h.v1 + t, z + 0.05, s.frame, PZ | NY | PY);
  const leaves = s.open ? 0 : s.kind === "darwaza" || w > 1.3 ? 2 : 1;
  const lw = w / leaves;
  const dark = shade(s.leaf, 0.78), lite = shade(s.leaf, 1.15);
  for (let l = 0; l < leaves; l++) {
    const a = h.u0 + l * lw, b = a + lw;
    if (s.kind === "steel") {
      // Pressed ribs and a small grilled vent near the top.
      for (let y = h.v0 + 0.25; y < h.v1 - 0.6; y += 0.32) kit.g("metal").boxMinMax(a + 0.08, y, zr, b - 0.08, y + 0.06, zr + 0.02, lite, PZ | PY);
      kit.g("dark").boxMinMax(a + 0.15, h.v1 - 0.5, zr + 0.001, b - 0.15, h.v1 - 0.18, zr + 0.001, GLASS, PZ);
    } else {
      // Raised panels: two tall, one short, the way every mistri makes them.
      const rows: Array<[number, number]> = s.kind === "darwaza" ? [[0.06, 0.36], [0.42, 0.7], [0.76, 0.95]] : [[0.06, 0.42], [0.48, 0.66], [0.72, 0.95]];
      for (const [p0, p1] of rows) kit.g("wood").boxMinMax(a + 0.09, h.v0 + hh * p0, zr, b - 0.09, h.v0 + hh * p1, zr + 0.025, dark, PZ | PY);
    }
    // Handle or kunda (ring latch) at the meeting edge.
    const hx = leaves === 2 ? (l === 0 ? b - 0.07 : a + 0.04) : b - 0.12;
    kit.g("chrome").boxMinMax(hx, h.v0 + hh * 0.46, zr + 0.025, hx + 0.03, h.v0 + hh * 0.52, zr + 0.05, rgb("#c9a227"), PZ | PX | NX);
  }
  if (s.kind === "darwaza") {
    // Brass studs in rows across both leaves.
    const st = kit.g("chrome");
    for (let y = h.v0 + 0.5; y < h.v1 - 0.3; y += 0.7) for (let x = h.u0 + 0.2; x < h.u1 - 0.1; x += 0.45) st.boxMinMax(x, y, zr + 0.03, x + 0.05, y + 0.05, zr + 0.03, rgb("#b8902a"), PZ);
  }
  if (s.step && s.step > 0.02) kit.g("concrete").boxMinMax(h.u0 - 0.25, 0, z, h.u1 + 0.25, s.step, z + 0.4, rgb("#c9c1b3"), PY | PZ | PX | NX);
}

/**
 * Parapet along the front with a jaali: solid base and coping, pierced in
 * between by square holes. Built as real piers so the sky shows through.
 */
export function jaaliParapet(kit: Kit, mat: MatKey, c: RGB, x0: number, x1: number, y: number, z: number, t = 0.2, h = 0.9): void {
  const g = kit.g(mat);
  const base = 0.32, cope = 0.12;
  g.boxMinMax(x0, y, z - t, x1, y + base, z, c, PZ | NZ | PX | NX);
  g.boxMinMax(x0 - 0.03, y + h - cope, z - t - 0.03, x1 + 0.03, y + h, z + 0.03, mix(c, WHITE, 0.35), PZ | NZ | PY | NY | PX | NX);
  const span = x1 - x0;
  const n = Math.max(2, Math.floor(span / (kit.lean ? 1.3 : 0.9)));
  const step = span / n, pier = Math.min(0.3, step * 0.45);
  for (let i = 0; i <= n; i++) {
    const cx = x0 + i * step;
    const a = Math.max(x0, cx - pier / 2), b = Math.min(x1, cx + pier / 2);
    g.boxMinMax(a, y + base, z - t, b, y + h - cope, z, c, PZ | NZ | PX | NX);
  }
}

/** A balcony slab out from the wall at height y with a steel railing. */
export function balcony(kit: Kit, x0: number, x1: number, y: number, z: number, out: number, slab: RGB, rail: RGB): void {
  kit.g("concrete").boxMinMax(x0, y - 0.14, z, x1, y, z + out, slab, PY | NY | PZ | PX | NX);
  const m = kit.g("metal");
  const top = y + 1.0;
  m.boxMinMax(x0 + 0.03, top - 0.05, z + out - 0.07, x1 - 0.03, top, z + out - 0.02, rail, PZ | PY | NY | NZ);
  m.boxMinMax(x0 + 0.03, y + 0.12, z + out - 0.06, x1 - 0.03, y + 0.16, z + out - 0.03, rail, PZ | PY);
  for (let u = x0 + 0.12; u < x1 - 0.05; u += kit.lean ? 0.5 : 0.32) kit.g("metal").boxMinMax(u - 0.012, y, z + out - 0.05, u + 0.012, top - 0.05, z + out - 0.05, rail, PZ);
  for (const u of [x0 + 0.03, x1 - 0.08]) for (const zz of [z + 0.05]) m.boxMinMax(u, y, zz, u + 0.05, top, z + out - 0.02, rail, PX | NX | PY);
}

/** The roof's stair room: a little box with a steel door facing the front. */
export function mumty(kit: Kit, mat: MatKey, c: RGB, x0: number, z1: number, w: number, d: number, y: number, door: RGB): void {
  const h = 2.5;
  kit.g(mat).boxMinMax(x0, y, z1 - d, x0 + w, y + h, z1, c, PX | NX | PY | PZ | NZ);
  kit.g("concrete").boxMinMax(x0 - 0.15, y + h, z1 - d - 0.15, x0 + w + 0.15, y + h + 0.12, z1 + 0.3, mix(c, WHITE, 0.4), PY | NY | PZ | PX | NX | NZ);
  const dw = 0.85;
  kit.g("metal").boxMinMax(x0 + 0.4, y, z1, x0 + 0.4 + dw, y + 2.05, z1 + 0.02, door, PZ);
  kit.g("wood").boxMinMax(x0 + 0.33, y, z1, x0 + 0.47 + dw, y + 2.12, z1 + 0.03, shade(door, 0.7), PZ);
}

/** Black Sintex water tank with its moulded ribs, on a low stand. */
export function sintex(kit: Kit, x: number, y: number, z: number, white = false): void {
  const c = white ? rgb("#d8cfb8") : rgb("#1d1d1f");
  kit.g("concrete").boxMinMax(x - 0.7, y, z - 0.7, x + 0.7, y + 0.3, z + 0.7, rgb("#a9a296"), PY | PZ | NZ | PX | NX);
  kit.g("paint").cylinder(x, y + 0.3, z, 0.62, 0.58, 1.25, 8, c, true);
  kit.g("paint").cylinder(x, y + 0.95, z, 0.64, 0.64, 0.06, 8, shade(c, 1.4), false);
  kit.g("paint").cylinder(x, y + 1.55, z, 0.22, 0.2, 0.1, 6, c, false);
}

/** Desert cooler in a window (brown box with the honeycomb pads). */
export function cooler(kit: Kit, cx: number, y: number, z: number): void {
  const c = rgb(["#8b6b4a", "#c9bfae", "#5d6d7e"][Math.abs(Math.round(cx * 7 + y)) % 3]!);
  kit.g("paint").boxMinMax(cx - 0.45, y, z, cx + 0.45, y + 1.0, z + 0.62, c, PZ | PX | NX | PY);
  for (let k = 0; k < 6; k++) kit.g("dark").boxMinMax(cx - 0.36, y + 0.12 + k * 0.13, z + 0.625, cx + 0.36, y + 0.17 + k * 0.13, z + 0.625, rgb("#6b5a3e"), PZ);
  for (const s of [-1, 1]) kit.g("dark").boxMinMax(cx + s * 0.451, y + 0.15, z + 0.12, cx + s * 0.451, y + 0.85, z + 0.5, rgb("#6b5a3e"), s > 0 ? PX : NX);
  kit.g("metal").boxMinMax(cx - 0.4, y - 0.06, z, cx + 0.4, y, z + 0.6, IRON, NY | PZ);
}

/** Split-AC outdoor unit on a bracket. */
export function acUnit(kit: Kit, cx: number, y: number, z: number): void {
  kit.g("paint").boxMinMax(cx - 0.4, y, z, cx + 0.4, y + 0.55, z + 0.3, rgb("#e9e9e4"), PZ | PX | NX | PY | NY);
  kit.g("dark").cylinderZ(cx - 0.08, y + 0.28, z + 0.305, 0.19, 0.01, 12, rgb("#333333"));
  kit.g("metal").boxMinMax(cx - 0.35, y - 0.05, z, cx + 0.35, y, z + 0.34, IRON, PZ | NY);
}

/** Dish antenna on a pole (roof or parapet). */
export function dish(kit: Kit, x: number, y: number, z: number, yaw: number): void {
  kit.g("metal").boxMinMax(x - 0.025, y, z - 0.025, x + 0.025, y + 0.9, z + 0.025, IRON, PX | NX | PZ | NZ);
  const sx = Math.sin(yaw), sz = Math.cos(yaw);
  kit.g("paint").ellipsoid(x + sx * 0.08, y + 0.95, z + sz * 0.08, 0.3 * Math.abs(sz) + 0.06, 0.3, 0.3 * Math.abs(sx) + 0.06, 10, 4, rgb("#e8e6e0"));
}

/** Gate pillar with a cap and a lamp; optionally the family's nameplate. */
export function gatePillar(kit: Kit, u: number, z: number, h: number, c: RGB, plate: boolean): void {
  kit.g("plaster").boxMinMax(u - 0.25, 0, z - 0.3, u + 0.25, h, z + 0.08, c, PZ | PX | NX | NZ);
  kit.g("paint").boxMinMax(u - 0.31, h, z - 0.36, u + 0.31, h + 0.12, z + 0.14, mix(c, WHITE, 0.6), PY | NY | PZ | PX | NX | NZ);
  kit.g("emissive").cylinder(u, h + 0.12, z - 0.11, 0.1, 0.12, 0.3, 6, rgb("#fff3d0"), true);
  if (plate) {
    kit.g("paint").boxMinMax(u - 0.22, h * 0.55, z + 0.08, u + 0.22, h * 0.55 + 0.26, z + 0.1, rgb("#c9a227"), PZ);
    kit.g("dark").boxMinMax(u - 0.19, h * 0.55 + 0.03, z + 0.101, u + 0.19, h * 0.55 + 0.23, z + 0.101, rgb("#202020"), PZ);
  }
}

/** Stone or tile cladding over part of a facade, with grout lines. */
export function cladding(kit: Kit, x0: number, x1: number, y0: number, y1: number, z: number, c: RGB): void {
  kit.g("paint").boxMinMax(x0, y0, z, x1, y1, z + 0.05, c, PZ | PX | NX | PY);
  const g = kit.g("dark");
  for (let y = y0 + 0.3; y < y1 - 0.1; y += 0.3) g.boxMinMax(x0 + 0.01, y, z + 0.051, x1 - 0.01, y + 0.015, z + 0.051, shade(c, 0.6), PZ);
}

/** A jharokha: the old mohalla's projecting window box on brackets with a little roof. */
export function jharokha(kit: Kit, cx: number, y: number, z: number, w: number, c: RGB, wood: RGB): void {
  const d = 0.55, h = 1.5;
  kit.g("plaster").boxMinMax(cx - w / 2, y, z, cx + w / 2, y + 0.15, z + d, c, PY | NY | PZ | PX | NX);
  for (const s of [-1, 1]) kit.g("plaster").boxMinMax(cx + s * (w / 2 - 0.12) - 0.08, y - 0.45, z, cx + s * (w / 2 - 0.12) + 0.08, y, z + d * 0.7, shade(c, 0.85), PZ | PX | NX | NY);
  const g = kit.g("wood");
  g.boxMinMax(cx - w / 2 + 0.05, y + 0.15, z + d - 0.08, cx + w / 2 - 0.05, y + h, z + d - 0.05, wood, PZ);
  kit.g("dark").boxMinMax(cx - w / 2 + 0.2, y + 0.45, z + d - 0.049, cx + w / 2 - 0.2, y + h - 0.2, z + d - 0.049, GLASS, PZ);
  for (let u = cx - w / 2 + 0.3; u < cx + w / 2 - 0.25; u += 0.18) kit.g("wood").boxMinMax(u - 0.015, y + 0.45, z + d - 0.045, u + 0.015, y + h - 0.2, z + d - 0.035, shade(wood, 0.7), PZ);
  for (const s of [-1, 1]) g.boxMinMax(cx + s * (w / 2 - 0.05) - 0.05, y + 0.15, z, cx + s * (w / 2 - 0.05) + 0.05, y + h, z + d, wood, PZ | (s > 0 ? PX : NX));
  kit.g("concrete").boxMinMax(cx - w / 2 - 0.15, y + h, z, cx + w / 2 + 0.15, y + h + 0.12, z + d + 0.2, mix(c, WHITE, 0.3), PY | NY | PZ | PX | NX);
  kit.g("concrete").ellipsoid(cx, y + h + 0.12, z + d * 0.5, w / 2 + 0.1, 0.3, d * 0.6, 10, 3, mix(c, WHITE, 0.3), 0, 1);
}

/** Lay out n windows evenly across a span, skipping any too close to `avoid`. */
export function windowRow(x0: number, x1: number, ww: number, gap: number, avoid: Array<[number, number]> = []): number[] {
  const n = Math.max(1, Math.floor((x1 - x0 + gap) / (ww + gap * 1.6)));
  const span = (x1 - x0) / n;
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    const c = x0 + span * (i + 0.5);
    if (avoid.some(([a, b]) => c + ww / 2 > a - 0.35 && c - ww / 2 < b + 0.35)) continue;
    out.push(c);
  }
  return out;
}

