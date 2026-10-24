import { Vector3 } from "../babylon";
import { shade, type RGB } from "../render/GeoBuilder";
import type { MatKey } from "../render/Materials";
import type { Kit } from "./Kit";

/**
 * The vocabulary of the public buildings: arches, domes with their finials, chhatris, colonnades and arcades,
 * kangura parapets, cornices, sunshades and steps. A temple, a gurdwara, a police station or a clock tower used
 * to be a few boxes with rectangular holes; these are the pieces that make them read as what they are. All of
 * it is in the kit's current frame: x along the front, y up, a wall faces +z.
 */

const PX = 0b100000, NX = 0b010000, PY = 0b001000, NY = 0b000100, PZ = 0b000010;

export interface ArchOpening {
  /** Centre across the wall, and its width. */
  u: number; w: number;
  /** Floor of the opening, and the height at which the arch begins to curve. */
  v0: number; spring: number;
  /** Rise of the arch above the spring line (half the width for a round arch). */
  rise?: number;
  /** "round", "pointed" (a Mughal / Sikh pointed arch) or "flat". */
  kind?: "round" | "pointed" | "flat";
}

/** The height of an arch's soffit at distance `dx` from its centre line. */
export function archY(o: ArchOpening, dx: number): number {
  const hw = o.w / 2, rise = o.rise ?? hw;
  if (o.kind === "flat" || Math.abs(dx) >= hw) return o.spring;
  const t = Math.abs(dx) / hw;
  if (o.kind === "pointed") {
    // Two arcs meeting at a point: higher than a round arch of the same width at the crown.
    const r = hw * 1.4, cx = hw - r;
    const y = Math.sqrt(Math.max(0, r * r - (Math.abs(dx) - cx) ** 2));
    return o.spring + Math.min(rise, y * (rise / Math.sqrt(r * r - cx * cx)));
  }
  return o.spring + rise * Math.sqrt(1 - t * t);
}

/**
 * A wall face at plane z with arched openings: the wall above each opening follows the curve of the arch, in
 * slices, with a dark recess behind and a moulded band round the arch.
 */
export function archWall(kit: Kit, mat: MatKey, c: RGB, x0: number, x1: number, y0: number, y1: number, z: number, openings: ArchOpening[], recess = 0.35, band?: RGB): void {
  const g = kit.g(mat);
  const os = [...openings].sort((a, b) => a.u - b.u);
  let x = x0;
  const SL = 9;
  for (const o of os) {
    const l = o.u - o.w / 2, r = o.u + o.w / 2;
    if (l > x + 1e-3) g.boxMinMax(x, y0, z, l, y1, z + 0.001, c, PZ);
    // Below the opening floor.
    if (o.v0 > y0 + 1e-3) g.boxMinMax(l, y0, z, r, o.v0, z + 0.001, c, PZ);
    // The slices above the springing, following the arch.
    for (let i = 0; i < SL; i++) {
      const a = l + ((r - l) * i) / SL, b = l + ((r - l) * (i + 1)) / SL;
      const top = archY(o, (a + b) / 2 - o.u);
      if (top < y1) g.boxMinMax(a, top, z, b, y1, z + 0.001, c, PZ);
    }
    // Between the floor and the springing the opening is open: only the dark recess behind and the reveals.
    const dark = kit.g("dark");
    dark.boxMinMax(l, o.v0, z - recess, r, o.spring, z - recess + 0.001, [1, 1, 1], PZ);
    for (let i = 0; i < SL; i++) {
      const a = l + ((r - l) * i) / SL, b = l + ((r - l) * (i + 1)) / SL;
      const top = Math.min(y1, archY(o, (a + b) / 2 - o.u));
      dark.boxMinMax(a, o.spring, z - recess, b, top, z - recess + 0.001, [1, 1, 1], PZ);
      // The soffit of the arch (its underside) in the wall's own shade.
      g.boxMinMax(a, top - 0.001, z - recess, b, top, z, shade(c, 0.78), NY);
    }
    // The jambs.
    g.boxMinMax(l, o.v0, z - recess, l + 0.001, o.spring, z, shade(c, 0.8), PX);
    g.boxMinMax(r - 0.001, o.v0, z - recess, r, o.spring, z, shade(c, 0.8), NX);
    if (band) {
      // A band of contrast colour round the arch, standing proud of the wall.
      const bw = 0.18;
      for (let i = 0; i < SL; i++) {
        const a = l + ((r - l) * i) / SL, b = l + ((r - l) * (i + 1)) / SL;
        const t0 = archY(o, (a + b) / 2 - o.u);
        kit.g("paint").boxMinMax(a, t0, z, b, t0 + bw, z + 0.05, band, PZ | PY);
      }
      kit.g("paint").boxMinMax(l - bw, o.v0, z, l, o.spring + 0.001, z + 0.05, band, PZ);
      kit.g("paint").boxMinMax(r, o.v0, z, r + bw, o.spring + 0.001, z + 0.05, band, PZ);
    }
    x = r;
  }
  if (x1 > x + 1e-3) g.boxMinMax(x, y0, z, x1, y1, z + 0.001, c, PZ);
}

/** A kalash finial: a pot, a lotus, a tapering spire and a point, in gold. */
export function finial(kit: Kit, cx: number, y: number, cz: number, s: number, gold: RGB): void {
  const m = kit.g("metal");
  m.cylinder(cx, y, cz, 0.28 * s, 0.34 * s, 0.14 * s, 8, gold, true);
  kit.g("chrome").ellipsoid(cx, y + 0.14 * s, cz, 0.3 * s, 0.26 * s, 0.3 * s, 10, 5, gold, -1, 1, 0.3);
  m.cylinder(cx, y + 0.4 * s, cz, 0.12 * s, 0.07 * s, 0.14 * s, 8, gold, true);
  kit.g("chrome").ellipsoid(cx, y + 0.58 * s, cz, 0.2 * s, 0.1 * s, 0.2 * s, 8, 3, gold, -1, 1, 0.3);
  m.cylinder(cx, y + 0.6 * s, cz, 0.07 * s, 0.01 * s, 0.7 * s, 6, gold, true);
}

export interface DomeOpts {
  /** Radius, height of the dome itself, height of the drum under it. */
  r: number; h: number; drum?: number;
  c: RGB; drumColor?: RGB; gold?: RGB;
  /** Scalloped lotus petals round the base. */
  lotus?: boolean;
  /** A finial on top (scale). */
  finial?: number;
  /** Ribs: thin vertical bands of another colour (a ribbed Sikh dome). */
  ribs?: RGB;
}

/** A dome on a drum, with a rim, optional lotus petals and ribs, and a finial. Returns the height of the top. */
export function dome(kit: Kit, cx: number, y: number, cz: number, o: DomeOpts): number {
  const p = kit.g("plaster");
  const drum = o.drum ?? 0;
  if (drum > 0) {
    p.cylinder(cx, y, cz, o.r * 1.02, o.r * 1.02, drum, 16, o.drumColor ?? o.c, true);
    kit.g("paint").cylinder(cx, y + drum - 0.12, cz, o.r * 1.07, o.r * 1.07, 0.16, 16, shade(o.drumColor ?? o.c, 0.9), true);
  }
  const base = y + drum;
  // The rim and the dome itself.
  p.cylinder(cx, base, cz, o.r * 1.06, o.r * 1.02, 0.22, 16, shade(o.c, 0.92), true);
  p.ellipsoid(cx, base + 0.2, cz, o.r, o.h, o.r, 16, 8, o.c, 0, 1, 0.15);
  if (o.lotus) {
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2, px = cx + Math.cos(a) * o.r * 0.93, pz = cz + Math.sin(a) * o.r * 0.93;
      kit.g("paint").ellipsoid(px, base + 0.22, pz, o.r * 0.2, o.h * 0.24, o.r * 0.2, 5, 3, o.gold ?? o.c, 0, 1);
    }
  }
  if (o.ribs) {
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      for (let k = 0; k < 4; k++) {
        const t0 = k / 4, t1 = (k + 1) / 4 * 0.9;
        const r0 = o.r * Math.cos(t0 * 1.45), r1 = o.r * Math.cos(t1 * 1.45), h0 = o.h * Math.sin(t0 * 1.45), h1 = o.h * Math.sin(t1 * 1.45);
        kit.g("paint").tube(new Vector3(cx + Math.cos(a) * r0 * 1.005, base + 0.2 + h0, cz + Math.sin(a) * r0 * 1.005), new Vector3(cx + Math.cos(a) * r1 * 1.005, base + 0.2 + h1, cz + Math.sin(a) * r1 * 1.005), 0.04, 3, o.ribs);
      }
    }
  }
  const top = base + 0.2 + o.h;
  if (o.finial) finial(kit, cx, top - 0.05, cz, o.finial, o.gold ?? o.c);
  return top;
}

/** A chhatri: four slim pillars, a slab and a small dome. */
export function chhatri(kit: Kit, cx: number, y: number, cz: number, w: number, h: number, wall: RGB, domeColor: RGB, gold: RGB): void {
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
    kit.g("plaster").cylinder(cx + sx * w / 2, y, cz + sz * w / 2, 0.09 * w / 2 + 0.05, 0.09 * w / 2 + 0.07, h, 8, wall, true);
    kit.g("plaster").boxMinMax(cx + sx * w / 2 - 0.12, y + h - 0.12, cz + sz * w / 2 - 0.12, cx + sx * w / 2 + 0.12, y + h, cz + sz * w / 2 + 0.12, shade(wall, 0.95));
  }
  kit.g("plaster").boxMinMax(cx - w / 2 - 0.2, y + h, cz - w / 2 - 0.2, cx + w / 2 + 0.2, y + h + 0.25, cz + w / 2 + 0.2, wall);
  dome(kit, cx, y + h + 0.25, cz, { r: w / 2 * 0.95, h: w * 0.55, c: domeColor, gold, finial: 0.7 });
}

/**
 * A row of columns between x0 and x1 at plane z, floor y0, to the beam at y1: base, shaft, capital, and a beam
 * over them. `arches` springs round arches between the columns instead of a flat beam.
 */
export function colonnade(kit: Kit, x0: number, x1: number, y0: number, y1: number, z: number, n: number, c: RGB, opts: { arches?: boolean; r?: number; collide?: boolean } = {}): number[] {
  const r = opts.r ?? 0.22;
  const xs: number[] = [];
  for (let i = 0; i <= n; i++) xs.push(x0 + ((x1 - x0) * i) / n);
  const p = kit.g("plaster");
  for (const x of xs) {
    p.boxMinMax(x - r * 1.5, y0, z - r * 1.5, x + r * 1.5, y0 + 0.28, z + r * 1.5, shade(c, 0.93));
    p.cylinder(x, y0 + 0.28, z, r, r * 0.88, y1 - y0 - 0.9, 10, c, false);
    p.boxMinMax(x - r * 1.45, y1 - 0.62, z - r * 1.45, x + r * 1.45, y1 - 0.4, z + r * 1.45, shade(c, 0.95));
    p.boxMinMax(x - r * 1.9, y1 - 0.4, z - r * 1.9, x + r * 1.9, y1, z + r * 1.9, c);
    if (opts.collide !== false) kit.collide(x, (y0 + y1) / 2, z, r * 2.2, y1 - y0, r * 2.2);
  }
  if (opts.arches) {
    const ops: ArchOpening[] = [];
    for (let i = 0; i < n; i++) ops.push({ u: (xs[i]! + xs[i + 1]!) / 2, w: xs[i + 1]! - xs[i]! - r * 3.4, v0: y0, spring: y1 - 1.2 - (xs[i + 1]! - xs[i]!) * 0.25, kind: "round" });
    // The spandrels above the arches, and the beam over everything.
    archWall(kit, "plaster", c, x0 - r * 1.9, x1 + r * 1.9, y1 - 0.4 - (xs[1]! - xs[0]!) * 0.5, y1 + 0.3, z - 0.02, ops, 0.2);
  } else {
    p.boxMinMax(x0 - 0.3, y1, z - r * 2, x1 + 0.3, y1 + 0.35, z + r * 2, shade(c, 0.97));
  }
  return xs;
}

/** Kangura: a row of stepped merlons along a parapet. */
export function kangura(kit: Kit, x0: number, x1: number, y: number, z: number, depth: number, c: RGB, step = 0.9, h = 0.55): void {
  const p = kit.g("plaster");
  p.boxMinMax(x0, y, z - depth / 2, x1, y + 0.18, z + depth / 2, c);
  for (let x = x0 + step * 0.25; x < x1 - step * 0.4; x += step) {
    p.boxMinMax(x, y + 0.18, z - depth / 2, x + step * 0.55, y + 0.18 + h * 0.7, z + depth / 2, c);
    p.boxMinMax(x + step * 0.1, y + 0.18 + h * 0.7, z - depth / 2, x + step * 0.45, y + 0.18 + h, z + depth / 2, shade(c, 1.04));
  }
}

/** A moulded cornice: three courses stepping out. */
export function cornice(kit: Kit, x0: number, x1: number, y: number, z: number, out: number, c: RGB): void {
  const p = kit.g("plaster");
  p.boxMinMax(x0 - out * 0.3, y, z - 0.1, x1 + out * 0.3, y + 0.14, z + out * 0.4, shade(c, 0.95));
  p.boxMinMax(x0 - out * 0.6, y + 0.14, z - 0.1, x1 + out * 0.6, y + 0.3, z + out * 0.7, c);
  p.boxMinMax(x0 - out, y + 0.3, z - 0.1, x1 + out, y + 0.46, z + out, shade(c, 1.03));
}

/** A sunshade (chajja) over a window: a sloping slab on two brackets. */
export function chajja(kit: Kit, x0: number, x1: number, y: number, z: number, out: number, c: RGB): void {
  kit.g("plaster").quad(new Vector3(x0 - 0.1, y, z), new Vector3(x1 + 0.1, y, z), new Vector3(x1 + 0.1, y - 0.18, z + out), new Vector3(x0 - 0.1, y - 0.18, z + out), c);
  kit.g("plaster").boxMinMax(x0 - 0.1, y - 0.2, z + out - 0.03, x1 + 0.1, y - 0.15, z + out, shade(c, 0.9));
  for (const x of [x0, x1 - 0.06]) kit.g("plaster").boxMinMax(x, y - 0.3, z, x + 0.06, y - 0.02, z + out * 0.8, shade(c, 0.9));
}

/** Steps running out along +z from the plane z, `n` of them, each `rise` high and `run` deep. */
export function steps(kit: Kit, x0: number, x1: number, z: number, y: number, n: number, rise: number, run: number, c: RGB): void {
  for (let i = 0; i < n; i++) {
    kit.g("concrete").boxMinMax(x0, y - rise * (i + 1), z + run * i, x1, y - rise * i, z + run * (i + 1), shade(c, 0.97 - i * 0.01));
  }
  kit.collide((x0 + x1) / 2, y - (rise * n) / 2, z + (run * n) / 2, x1 - x0, rise * n, run * n);
}

/** Run `fn` in a frame placed at local (x, z) of the current one and turned by `rot`; the old frame comes back. */
export function at(kit: Kit, x: number, z: number, rot: number, fn: () => void): void {
  const w = kit.toWorld(x, 0, z), r = kit.currentRotY();
  const o = kit.toWorld(0, 0, 0);
  kit.frame(w.x, w.z, r + rot);
  fn();
  kit.frame(o.x, o.z, r);
}
