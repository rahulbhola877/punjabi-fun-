import { Matrix, Quaternion, Vector3 } from "../babylon";
import { GeoBuilder, mix, rgb, shade, type RGB } from "../render/GeoBuilder";
import type { MatKey } from "../render/Materials";
import { Rng } from "../render/textures";
import type { Kit } from "./Kit";
import { charpai, houseInterior } from "./interiors";
import { OPEN_HOUSE_IDS } from "./openHouses";
import { acUnit, balcony, cladding, cooler, dish, doorFill, gatePillar, holedWall, jaaliParapet, jharokha, mumty, sintex, windowFill, windowRow } from "./houseBuilder";
import { tree, wire } from "./props";
import {
  BRICK_PILES, BRIDGES, CANAL, CITY, GHAT, DEFECTS, GROUND_TILE, OUTER_BUILDINGS, PLOTS, REHRIS, ROADS, ROAD_SEG, SITES, TOWN, TOWN_GAP_X, VILLAGE, WORLD,
  holeHalf, onRoad, roadCondition, type Defect, type OuterBuilding, type Plot, type Road, type Site,
} from "./region";
import type { Rect } from "./layout";
import { COLONIES } from "./colonies";
import { colonyLife } from "./colonySeats";
import { BUS_STOPS, shelterSpot } from "./busRoutes";

/** Hidden beyond this distance from the camera (fog has swallowed it by then). */
export const COUNTRY_CULL = 460;
const SEG = ROAD_SEG;

const WHITE: RGB = rgb("#f1eee6");
const YELLOW: RGB = rgb("#e8b923");
const IRON: RGB = rgb("#2b2b2e");
const CONC: RGB = rgb("#bdb6aa");
/** Box faces for a building mass whose front (+z) is built separately: +x, -x, top and back. */
const PX_NX_PY_NZ = 0b111001;

// ---------------------------------------------------------------- Trees

type TreeKind = "safeda" | "kikar" | "neem" | "mango" | "shisham";

/**
 * Trees outside the bazaar are copies of a few low-poly templates merged
 * straight into the scenery chunks (so they batch and cull with them), plus
 * a trunk collider each.
 */
export class CountryDecor {
  private templates = new Map<string, { wood: GeoBuilder; leaf: GeoBuilder }>();
  count = 0;

  addTree(kit: Kit, kind: TreeKind, x: number, z: number, scale: number, rot: number): void {
    const variant = Math.floor(((x * 0.37 + z * 0.61) % 3 + 3) % 3);
    const key = `${kind}${variant}`;
    let t = this.templates.get(key);
    if (!t) { t = treeTemplate(kind, variant); this.templates.set(key, t); }
    const sy = scale * (0.9 + ((((x * 13.1 + z * 7.7) % 1) + 1) % 1) * 0.25);
    const m = Matrix.Compose(new Vector3(scale, sy, scale), Quaternion.RotationYawPitchRoll(rot, 0, 0), new Vector3(x, 0, z));
    kit.frame(x, z);
    kit.g("wood").appendTransformed(t.wood, m);
    kit.g("leaf").appendTransformed(t.leaf, m);
    const r = kind === "safeda" ? 0.22 : kind === "mango" ? 0.3 : 0.26;
    kit.colliders.add(x, 1.2, z, r * 2 * scale, 2.4, r * 2 * scale);
    this.count++;
  }
}

function treeTemplate(kind: TreeKind, variant: number): { wood: GeoBuilder; leaf: GeoBuilder } {
  const wood = new GeoBuilder(1.2), leaf = new GeoBuilder(1.5);
  const rng = new Rng(kind.length * 31 + variant * 7);
  const bark = kind === "safeda" ? rgb("#d9d2c2") : kind === "kikar" ? rgb("#4f4237") : rgb("#6b5a48");
  const green = kind === "safeda" ? rgb("#7d9a6a") : kind === "kikar" ? rgb("#7f9450") : kind === "mango" ? rgb("#3f6b2e") : rgb("#5f8a3a");
  const h = (kind === "safeda" ? 9.5 : kind === "kikar" ? 2.4 : kind === "mango" ? 2.0 : 3.0) * (0.9 + variant * 0.08);
  const r0 = kind === "safeda" ? 0.2 : kind === "mango" ? 0.3 : 0.24;
  const lean = rng.range(-0.15, 0.15);
  wood.loft([0, 0.5, 1].map((t) => ({ p: new Vector3(Math.sin(t * 2) * 0.12 * t + lean * t, t * h, 0), rx: r0 * (1.2 - t * 0.6), rz: r0 * (1.15 - t * 0.6) })), 6, bark, false, true);
  const top = new Vector3(Math.sin(2) * 0.12 + lean, h, 0);
  if (kind === "safeda") {
    for (let i = 0; i < 4; i++) leaf.ellipsoid(top.x + rng.range(-0.8, 0.8), h + i * 1.3 - 0.8, rng.range(-0.8, 0.8), 1.6 - i * 0.2, 1.4, 1.6 - i * 0.2, 7, 4, shade(green, rng.range(0.85, 1.1)), -1, 1, 0.5);
  } else if (kind === "kikar") {
    for (let i = 0; i < 5; i++) { const a = i * 1.26 + variant; leaf.ellipsoid(top.x + Math.cos(a) * 1.6, h + 0.6 + rng.range(0, 0.6), Math.sin(a) * 1.6, 1.7, 0.55, 1.7, 7, 4, shade(green, rng.range(0.85, 1.1)), -1, 1, 0.5); }
    for (let i = 0; i < 3; i++) { const a = i * 2.1 + variant; wood.tube(top, new Vector3(top.x + Math.cos(a) * 1.5, h + 0.6, Math.sin(a) * 1.5), 0.07, 4, bark); }
  } else {
    const n = kind === "mango" ? 6 : 5, R = kind === "mango" ? 1.9 : 1.6;
    for (let i = 0; i < n; i++) { const a = i * 1.1 + variant; leaf.ellipsoid(top.x + Math.cos(a) * R * 0.6, h + 1.2 + rng.range(0, 1), Math.sin(a) * R * 0.6, R, R * 0.8, R, 7, 4, shade(green, rng.range(0.85, 1.12)), -1, 1, 0.5); }
    leaf.ellipsoid(top.x, h + 2.4, 0, R * 1.1, R * 0.9, R * 1.1, 7, 4, shade(green, 1.1), -1, 1, 0.5);
  }
  return { wood, leaf };
}

// ---------------------------------------------------------------- Helpers

function flat(g: GeoBuilder, x0: number, z0: number, x1: number, z1: number, y: number, c: RGB): void {
  g.quad(new Vector3(x0, y, z0), new Vector3(x1, y, z0), new Vector3(x1, y, z1), new Vector3(x0, y, z1), c);
}

/** Run `fn` for pieces of a long rectangle, with the kit frame at each piece's centre (local coords). */
function pieces(kit: Kit, r: Rect, fn: (lx0: number, lz0: number, lx1: number, lz1: number, wx: number, wz: number) => void): void {
  const alongX = r.x1 - r.x0 >= r.z1 - r.z0;
  const len = alongX ? r.x1 - r.x0 : r.z1 - r.z0;
  const n = Math.max(1, Math.ceil(len / SEG));
  for (let i = 0; i < n; i++) {
    const a0 = (alongX ? r.x0 : r.z0) + (len * i) / n, a1 = (alongX ? r.x0 : r.z0) + (len * (i + 1)) / n;
    const q: Rect = alongX ? { x0: a0, x1: a1, z0: r.z0, z1: r.z1 } : { x0: r.x0, x1: r.x1, z0: a0, z1: a1 };
    const cx = (q.x0 + q.x1) / 2, cz = (q.z0 + q.z1) / 2;
    kit.frame(cx, cz);
    fn(q.x0 - cx, q.z0 - cz, q.x1 - cx, q.z1 - cz, cx, cz);
  }
}

const ROAD_Y: Record<Road["kind"], number> = { highway: 0.012, road: 0.016, street: 0.02, track: 0.006 };

/** Visual height of the road surface at a point (vehicles ride on the flat ground collider). */
function roadY(r: Road): number {
  return ROAD_Y[r.kind] + ROADS.indexOf(r) * 0.0012;
}

// ---------------------------------------------------------------- Entry point

export function buildCountry(kit: Kit): CountryDecor {
  const decor = new CountryDecor();
  kit.chunkSize = 160;
  kit.cullDistance = 0;
  ground(kit);
  kit.cullDistance = COUNTRY_CULL;
  for (const r of ROADS) road(kit, r);
  defects(kit);
  canal(kit);
  townWall(kit);
  for (const p of PLOTS) plot(kit, p, decor);
  for (const b of OUTER_BUILDINGS) (b.style === "city" ? cityBuilding : b.style === "kothi" ? kothi : villageHouse)(kit, b);
  for (const s of SITES) buildSite(kit, s, decor);
  for (const r of REHRIS) rehri(kit, r.x, r.z, r.yaw, r.goods);
  for (const b of BRICK_PILES) brickPile(kit, b.x, b.z);
  ludhianaWires(kit);
  colonyDressing(kit, decor);
  for (const st of BUS_STOPS) busShelter(kit, shelterSpot(st));
  roadsideTrees(kit, decor);
  streetLights(kit);
  junctionSigns(kit);
  worldEdge(kit, decor);
  kit.chunkSize = 40;
  kit.cullDistance = 0;
  kit.world();
  return decor;
}

function ground(kit: Kit): void {
  kit.world();
  const rng = new Rng(808);
  const g = kit.g("dirt");
  const base = rgb("#b9c58f");
  const T = GROUND_TILE;
  for (let x = WORLD.minX - 200; x < WORLD.maxX + 200; x += T) {
    for (let z = WORLD.minZ - 200; z < WORLD.maxZ + 200; z += T) {
      const c = shade(mix(base, rgb(rng.next() < 0.4 ? "#d8c9a0" : "#a9bf7e"), rng.range(0.1, 0.6)), rng.range(0.94, 1.04));
      // The canal band is cut out of the ground.
      const z0 = z, z1 = z + T;
      // Potholes go down through the ground too.
      const holes = POTHOLES.filter((d) => d.x > x && d.x < x + T && d.z > z0 && d.z < z1).map((d) => holeSquare(d, 0, 0));
      if (z1 <= CANAL.z0 || z0 >= CANAL.z1) flatHoles(g, x, z0, x + T, z1, -0.03, c, holes);
      else {
        if (z0 < CANAL.z0) flat(g, x, z0, x + T, CANAL.z0, -0.03, c);
        if (z1 > CANAL.z1) flat(g, x, CANAL.z1, x + T, z1, -0.03, c);
      }
    }
  }
  // Ground slabs either side of the canal, in strips so each collider chunk stays small.
  const S = 2000;
  for (let x = -S / 2; x < S / 2; x += 200) {
    kit.colliders.add(x + 100, -0.5, (-S / 2 + CANAL.z0) / 2, 200, 1, CANAL.z0 + S / 2);
    kit.colliders.add(x + 100, -0.5, (CANAL.z1 + S / 2) / 2, 200, 1, S / 2 - CANAL.z1);
  }
}

function road(kit: Kit, r: Road): void {
  const y = roadY(r);
  const cond = roadCondition(r);
  const mat: MatKey = r.kind === "track" ? "dirt" : "asphalt";
  // Fresh tarmac is dark; old roads are faded grey and dusty.
  const col: RGB = r.kind === "track" ? rgb("#9d8562") : cond === "good" ? shade([1, 1, 1], 0.8) : cond === "bad" ? mix([1, 1, 1], rgb("#d8c7a8"), 0.35) : [1, 1, 1];
  const alongX = r.x1 - r.x0 >= r.z1 - r.z0;
  const w = alongX ? r.z1 - r.z0 : r.x1 - r.x0;
  const myHoles = POTHOLES.filter((d) => d.road === r.id);
  const rng = new Rng(Math.abs(Math.round(r.x0 * 7 + r.z0 * 13)) + 5);
  pieces(kit, r, (lx0, lz0, lx1, lz1, cx, cz) => {
    const holes = myHoles.filter((d) => d.x - cx >= lx0 && d.x - cx <= lx1 && d.z - cz >= lz0 && d.z - cz <= lz1).map((d) => holeSquare(d, cx, cz, true));
    flatHoles(kit.g(mat), lx0, lz0, lx1, lz1, y, col, holes, shade(col, 0.62));
    const paint = kit.g("concrete");
    const len = alongX ? lx1 - lx0 : lz1 - lz0;
    const a0 = alongX ? lx0 : lz0;
    // In local "along/across" terms: a rectangle on this piece of road.
    const rect = (g: GeoBuilder, a: number, b: number, o0: number, o1: number, yy: number, c: RGB) => {
      if (alongX) flat(g, a, o0, b, o1, yy, c);
      else flat(g, o0, a, o1, b, yy, c);
    };
    const overHole = (a: number, b: number, o0: number, o1: number) => holes.some((h) => alongX
      ? a < h.x1 && b > h.x0 && o0 < h.z1 && o1 > h.z0 : a < h.z1 && b > h.z0 && o0 < h.x1 && o1 > h.x0);
    // Markings: a stripe at lateral offset `o`, dashed or solid, skipping other roads and potholes.
    const stripe = (o: number, wdt: number, dash: number, gap: number, c: RGB) => {
      for (let a = a0; a < a0 + len - 0.1; a += dash + gap) {
        const b = Math.min(a0 + len, a + dash);
        const mx = alongX ? cx + (a + b) / 2 : cx + o, mz = alongX ? cz + o : cz + (a + b) / 2;
        const other = onRoad(mx, mz, 0.5);
        if (other && other !== r) continue;
        if (overHole(a, b, o - wdt / 2, o + wdt / 2)) continue;
        if (alongX) flat(paint, a, o - wdt / 2, b, o + wdt / 2, y + 0.003, c);
        else flat(paint, o - wdt / 2, a, o + wdt / 2, b, y + 0.003, c);
      }
    };
    if (r.kind === "highway") {
      stripe(-0.12, 0.12, 6, 0, YELLOW);
      stripe(0.12, 0.12, 6, 0, YELLOW);
      stripe(-3.5, 0.12, 3, 6, WHITE);
      stripe(3.5, 0.12, 3, 6, WHITE);
      stripe(-w / 2 + 0.35, 0.15, 6, 0, WHITE);
      stripe(w / 2 - 0.35, 0.15, 6, 0, WHITE);
      // Kerb shoulder strips of packed earth.
      for (const s of [-1, 1]) {
        if (alongX) flat(kit.g("dirt"), lx0, s * w / 2, lx1, s * (w / 2 + 1.6), 0.004, rgb("#a48d68"));
      }
    } else if (r.kind === "road" || (r.kind === "street" && w > 6.5)) {
      // Galis are too narrow for a centre line: nobody would keep to it anyway.
      // On a bad road what is left of the paint is worn to nothing in places.
      if (cond !== "bad") stripe(0, 0.12, 3, 5, WHITE);
      else stripe(0, 0.12, 3, 11, shade(WHITE, 0.8));
      if (cond === "good") { stripe(-w / 2 + 0.3, 0.1, 6, 0, WHITE); stripe(w / 2 - 0.3, 0.1, 6, 0, WHITE); }
    } else if (r.kind === "street" && cond === "good") {
      // New colony galis get kerb-side lines too.
      stripe(-w / 2 + 0.3, 0.1, 6, 0, WHITE);
      stripe(w / 2 - 0.3, 0.1, 6, 0, WHITE);
    } else if (r.kind === "street") {
      // (no markings)
    } else {
      // Kacha track: two darker wheel ruts.
      for (const s of [-0.9, 0.9]) {
        for (let a = a0; a < a0 + len - 0.01; a += 4) {
          const b = Math.min(a0 + len, a + 4);
          if (!overHole(a, b, s - 0.35, s + 0.35)) rect(kit.g("dirt"), a, b, s - 0.35, s + 0.35, y + 0.002, rgb("#8a7253"));
        }
      }
    }
    if (cond === "bad" && r.kind !== "track") {
      // Broken edges where the tarmac has crumbled into the kacha shoulder, and cracks.
      const dust = rgb("#cfc4b0");
      for (let a = a0; a < a0 + len - 3; a += rng.range(2.5, 6)) {
        const b = a + rng.range(1.5, 4);
        for (const side of [-1, 1]) {
          if (rng.next() < 0.45) continue;
          const d = rng.range(0.25, 0.9);
          const o0 = side < 0 ? -w / 2 : w / 2 - d, o1 = side < 0 ? -w / 2 + d : w / 2;
          const mx = alongX ? cx + (a + b) / 2 : cx + (o0 + o1) / 2, mz = alongX ? cz + (o0 + o1) / 2 : cz + (a + b) / 2;
          const other = onRoad(mx, mz, 0.3);
          if (other && other !== r) continue;
          if (!overHole(a, b, o0, o1)) rect(kit.g("asphalt"), a, b, o0, o1, y + 0.002, shade(dust, rng.range(0.9, 1.08)));
        }
        if (rng.next() < 0.5) {
          // A crack: a thin dark zig-zag across part of the road.
          const g = kit.g("asphalt");
          let pa = a, po = rng.range(-w / 2 + 0.5, w / 2 - 0.5);
          for (let k = 0; k < 4; k++) {
            const na = pa + rng.range(0.4, 1.1), no = Math.max(-w / 2 + 0.2, Math.min(w / 2 - 0.2, po + rng.range(-0.7, 0.7)));
            if (!overHole(Math.min(pa, na) - 0.1, Math.max(pa, na) + 0.1, Math.min(po, no) - 0.1, Math.max(po, no) + 0.1)) {
              const p0 = alongX ? [pa, po] : [po, pa], p1 = alongX ? [na, no] : [no, na];
              const dx = p1[0]! - p0[0]!, dz = p1[1]! - p0[1]!, l = Math.hypot(dx, dz), nx = (-dz / l) * 0.025, nz = (dx / l) * 0.025;
              const c = shade(col, 0.45);
              const q = [new Vector3(p0[0]! - nx, y + 0.002, p0[1]! - nz), new Vector3(p1[0]! - nx, y + 0.002, p1[1]! - nz), new Vector3(p1[0]! + nx, y + 0.002, p1[1]! + nz), new Vector3(p0[0]! + nx, y + 0.002, p0[1]! + nz)];
              // Wind it to face up whichever way the crack runs.
              if (dx * (nz * 2) - dz * (nx * 2) > 0) g.quad(q[0]!, q[1]!, q[2]!, q[3]!, c);
              else g.quad(q[0]!, q[3]!, q[2]!, q[1]!, c);
            }
            pa = na; po = no;
          }
        }
      }
    }
  });
}

// ---------------------------------------------------------------- Potholes

const POTHOLES = DEFECTS.filter((d) => d.kind === "pothole");

/** A rectangle cut out of a flat surface, optionally filled back in up to a ragged rim. */
interface Hole { x0: number; z0: number; x1: number; z1: number; rim?: Array<[number, number]> }

/** The ragged rim of a pothole, relative to its centre: 16 points from angle 0 round. */
function holeRim(d: Defect): Array<[number, number]> {
  const rng = new Rng(Math.abs(Math.round(d.x * 13 + d.z * 7)) + 1);
  return Array.from({ length: 16 }, (_, i) => {
    const a = (i * Math.PI) / 8, rr = d.r * rng.range(0.84, 1.08);
    return [Math.cos(a) * rr, Math.sin(a) * rr] as [number, number];
  });
}

/** The square a pothole cuts out, in a frame centred at (ox, oz). */
function holeSquare(d: Defect, ox: number, oz: number, rim = false): Hole {
  const s = holeHalf(d);
  return { x0: d.x - ox - s, z0: d.z - oz - s, x1: d.x - ox + s, z1: d.z - oz + s, rim: rim ? holeRim(d) : undefined };
}

/**
 * A flat horizontal rectangle at height y with rectangular holes cut out of
 * it; holes with a rim are filled back in up to the rim (darker at the edge),
 * leaving a ragged opening for the pothole bowl below. Texture coordinates
 * run on across the pieces as if it were one quad.
 */
function flatHoles(g: GeoBuilder, x0: number, z0: number, x1: number, z1: number, y: number, c: RGB, holes: Hole[], edge: RGB = c): void {
  if (!holes.length) { flat(g, x0, z0, x1, z1, y, c); return; }
  const s = g.uvScale;
  const v = (x: number, z: number, col: RGB) => g.vertex(x, y, z, 0, 1, 0, (x - x0) / s, (z - z0) / s, col);
  const quad = (a0: number, b0: number, a1: number, b1: number) => {
    if (a1 - a0 < 1e-4 || b1 - b0 < 1e-4) return;
    const i0 = v(a0, b0, c), i1 = v(a1, b0, c), i2 = v(a1, b1, c), i3 = v(a0, b1, c);
    g.tri(i0, i1, i2); g.tri(i0, i2, i3);
  };
  const up = (p: [number, number], q: [number, number], r: [number, number], ip: number, iq: number, ir: number) => {
    if ((q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]) > 0) g.tri(ip, iq, ir);
    else g.tri(ip, ir, iq);
  };
  const ring = (h: Hole) => {
    const cx = (h.x0 + h.x1) / 2, cz = (h.z0 + h.z1) / 2, hx = (h.x1 - h.x0) / 2, hz = (h.z1 - h.z0) / 2;
    const sq: Array<[number, number]> = [], rim: Array<[number, number]> = [];
    for (let i = 0; i < 16; i++) {
      const a = (i * Math.PI) / 8, ca = Math.cos(a), sa = Math.sin(a);
      const t = Math.min(Math.abs(ca) > 1e-6 ? hx / Math.abs(ca) : Infinity, Math.abs(sa) > 1e-6 ? hz / Math.abs(sa) : Infinity);
      sq.push([cx + ca * t, cz + sa * t]);
      rim.push([cx + h.rim![i]![0], cz + h.rim![i]![1]]);
    }
    const is = sq.map((p) => v(p[0], p[1], c)), ir = rim.map((p) => v(p[0], p[1], edge));
    for (let i = 0; i < 16; i++) {
      const j = (i + 1) % 16;
      up(sq[i]!, sq[j]!, rim[j]!, is[i]!, is[j]!, ir[j]!);
      up(sq[i]!, rim[j]!, rim[i]!, is[i]!, ir[j]!, ir[i]!);
    }
  };
  // Slabs across x where holes are; within a slab, bands across z.
  const hs = holes.map((h) => ({ ...h, x0: Math.max(x0, h.x0), x1: Math.min(x1, h.x1), z0: Math.max(z0, h.z0), z1: Math.min(z1, h.z1) })).sort((a, b) => a.x0 - b.x0);
  const slabs: Array<{ x0: number; x1: number; hs: Hole[] }> = [];
  for (const h of hs) {
    const last = slabs[slabs.length - 1];
    if (last && h.x0 < last.x1) { last.x1 = Math.max(last.x1, h.x1); last.hs.push(h); }
    else slabs.push({ x0: h.x0, x1: h.x1, hs: [h] });
  }
  let cx = x0;
  for (const sl of slabs) {
    quad(cx, z0, sl.x0, z1);
    const sorted = sl.hs.sort((a, b) => a.z0 - b.z0);
    const bands: Array<{ z0: number; z1: number; hs: Hole[] }> = [];
    for (const h of sorted) {
      const last = bands[bands.length - 1];
      if (last && h.z0 < last.z1) { last.z1 = Math.max(last.z1, h.z1); last.hs.push(h); }
      else bands.push({ z0: h.z0, z1: h.z1, hs: [h] });
    }
    let cz = z0;
    for (const b of bands) {
      quad(sl.x0, cz, sl.x1, b.z0);
      // Holes that overlap each other become one plain rectangle.
      let bh = b.hs.sort((p, q) => p.x0 - q.x0);
      for (let merged = true; merged;) {
        merged = false;
        for (let i = 0; i + 1 < bh.length && !merged; i++) {
          const p = bh[i]!, q = bh[i + 1]!;
          if (q.x0 < p.x1) {
            bh = [...bh.slice(0, i), { x0: p.x0, x1: Math.max(p.x1, q.x1), z0: Math.min(p.z0, q.z0), z1: Math.max(p.z1, q.z1) }, ...bh.slice(i + 2)];
            merged = true;
          }
        }
      }
      let ax = sl.x0;
      for (const h of bh) {
        quad(ax, b.z0, h.x0, b.z1);
        quad(h.x0, b.z0, h.x1, h.z0);
        quad(h.x0, h.z1, h.x1, b.z1);
        if (h.rim) ring(h);
        ax = h.x1;
      }
      quad(ax, b.z0, sl.x1, b.z1);
      cz = b.z1;
    }
    quad(sl.x0, cz, sl.x1, z1);
    cx = sl.x1;
  }
  quad(cx, z0, x1, z1);
}

/** The pothole itself: a broken-edged bowl going down below the road. */
function potholeBowl(kit: Kit, d: Defect, y: number): void {
  kit.frame(d.x, d.z);
  const rim = holeRim(d);
  const bottom = y - d.depth;
  const edge = kit.g("asphalt"), dirt = kit.g("dirt");
  const wall = rgb("#55504a"), mud = rgb("#6e6658");
  const ringAt = (g: GeoBuilder, k: number, yy: number, c: RGB, ny: number) => rim.map(([x, z]) => {
    const l = Math.hypot(x, z) || 1;
    return g.vertex(x * k, yy, z * k, (-x / l) * (1 - ny), ny, (-z / l) * (1 - ny), x * k / 2, z * k / 2, c);
  });
  // Broken tarmac edge, then a dirt slope down to a flat muddy bottom.
  const top = ringAt(edge, 1, y, shade(wall, 0.9), 0.4), lip = ringAt(edge, 0.9, y - d.depth * 0.45, shade(wall, 0.7), 0.4);
  for (let i = 0; i < 16; i++) { const j = (i + 1) % 16; edge.tri(top[i]!, top[j]!, lip[j]!); edge.tri(top[i]!, lip[j]!, lip[i]!); }
  const lip2 = ringAt(dirt, 0.9, y - d.depth * 0.45, shade(mud, 0.8), 0.5), low = ringAt(dirt, 0.62, bottom, mud, 0.85);
  for (let i = 0; i < 16; i++) { const j = (i + 1) % 16; dirt.tri(lip2[i]!, lip2[j]!, low[j]!); dirt.tri(lip2[i]!, low[j]!, low[i]!); }
  const mid = dirt.vertex(0, bottom, 0, 0, 1, 0, 0, 0, shade(mud, 1.05));
  for (let i = 0; i < 16; i++) dirt.tri(low[i]!, low[(i + 1) % 16]!, mid);
  // Most hold a puddle of dark muddy water.
  if (Math.abs(Math.sin(d.x * 3.1 + d.z)) > 0.35) dirt.cylinder(0, bottom + 0.004, 0, d.r * 0.5, d.r * 0.5, 0.002, 12, rgb("#3b3731"), true, 0.8);
}

/** Potholes, patch repairs, broken gravel edges and mud on the roads. */
function defects(kit: Kit): void {
  for (const d of DEFECTS) {
    const r = ROADS.find((q) => q.id === d.road);
    const y = (r ? roadY(r) : 0.01) + 0.004;
    kit.frame(d.x, d.z, d.rot);
    switch (d.kind) {
      case "pothole":
        potholeBowl(kit, d, y - 0.004);
        break;
      case "patch":
        flat(kit.g("asphalt"), -d.r, -d.r * 0.6, d.r, d.r * 0.6, y, shade([1, 1, 1], 0.72));
        break;
      case "gravel":
        kit.g("dirt").cylinder(0, y - 0.002, 0, d.r, d.r, 0.004, 10, rgb("#a39478"), true, 0.6);
        break;
      case "mud":
        kit.g("dirt").cylinder(0, y - 0.002, 0, d.r, d.r, 0.006, 14, rgb("#5a4632"), true, 0.65);
        kit.g("water").cylinder(d.r * 0.15, y + 0.002, 0, d.r * 0.55, d.r * 0.55, 0.002, 12, rgb("#6b5a43"), true, 0.55);
        break;
    }
  }
}

function canal(kit: Kit): void {
  const { z0, z1, waterY, bedY } = CANAL;
  const spans: Array<[number, number]> = [];
  let x = WORLD.minX - 200;
  const brs = [...BRIDGES].sort((a, b) => a.x - b.x);
  for (const b of brs) { spans.push([x, b.x - b.w / 2]); x = b.x + b.w / 2; }
  spans.push([x, WORLD.maxX + 200]);
  const wall = rgb("#b7b2a6");
  // Water, bed and lined walls along the whole length.
  pieces(kit, { x0: WORLD.minX - 200, x1: WORLD.maxX + 200, z0, z1 }, (lx0, lz0, lx1, lz1) => {
    flat(kit.g("water"), lx0, lz0, lx1, lz1, waterY, rgb("#5f8f8a"));
    flat(kit.g("dirt"), lx0, lz0, lx1, lz1, bedY, rgb("#5d5141"));
    kit.g("concrete").boxMinMax(lx0, bedY, lz0, lx1, 0, lz0 + 0.3, wall, 0b000010);
    kit.g("concrete").boxMinMax(lx0, bedY, lz1 - 0.3, lx1, 0, lz1, wall, 0b000001);
  });
  kit.world();
  kit.colliders.add(0, bedY - 0.25, (z0 + z1) / 2, 2400, 0.5, z1 - z0);
  // Parapets on both banks, broken at the bridges (and at the ghat on the north bank).
  const gx0 = GHAT.x - GHAT.w / 2, gx1 = GHAT.x + GHAT.w / 2;
  for (const [a, b] of spans) {
    for (const zz of [z0 - 0.2, z1 + 0.2]) {
      const runs: Array<[number, number]> = zz > z1 && a < gx0 && b > gx1 ? [[a, gx0], [gx1, b]] : [[a, b]];
      for (const [ra, rb] of runs) pieces(kit, { x0: ra, x1: rb, z0: zz - 0.2, z1: zz + 0.2 }, (lx0, _lz0, lx1, _lz1, cx, cz) => {
        kit.g("plaster").boxMinMax(lx0, 0, -0.2, lx1, 0.75, 0.2, WHITE, 0b001111);
        kit.collide(0, 0.6, 0, lx1 - lx0, 1.2, 0.4);
        void cx; void cz;
      });
    }
  }
  for (const b of BRIDGES) bridge(kit, b.x, b.w);
  ghat(kit);
}

/** Steps down into the nehar where the village bathes and the boys swim. */
function ghat(kit: Kit): void {
  const { z1, bedY } = CANAL;
  kit.frame(GHAT.x, z1);
  const hw = GHAT.w / 2;
  for (let i = 0; i < GHAT.steps; i++) {
    const top = -GHAT.rise * (i + 1), za = -GHAT.run * (i + 1), zb = -GHAT.run * i;
    kit.g("concrete").boxMinMax(-hw, bedY, za, hw, top, zb, rgb(i % 2 ? "#b9b2a4" : "#c4bdb0"), 0b111111);
    kit.collide(0, (bedY + top) / 2, (za + zb) / 2, GHAT.w, top - bedY, GHAT.run);
  }
  // Side walls of the ghat, and a pole with a rope to hold.
  for (const sd of [-1, 1]) {
    kit.g("plaster").boxMinMax(sd * hw - 0.15, -GHAT.rise * GHAT.steps, -GHAT.run * GHAT.steps, sd * hw + 0.15, 0.75, 0.4, WHITE);
    kit.collide(sd * hw, (0.75 - GHAT.rise * GHAT.steps) / 2, (0.4 - GHAT.run * GHAT.steps) / 2, 0.3, 0.75 + GHAT.rise * GHAT.steps, 0.4 + GHAT.run * GHAT.steps);
  }
  kit.g("metal").cylinder(hw - 0.5, -GHAT.rise * GHAT.steps, -GHAT.run * GHAT.steps - 0.2, 0.04, 0.04, 2.2, 6, rgb("#5a5a5a"));
}

function bridge(kit: Kit, x: number, w: number): void {
  const z0 = CANAL.z0 - 1.5, z1 = CANAL.z1 + 1.5;
  kit.frame(x, (z0 + z1) / 2);
  const L = z1 - z0;
  kit.g("concrete").boxMinMax(-w / 2, -0.55, -L / 2, w / 2, 0.0, L / 2, rgb("#b8b1a3"), 0b111011);
  kit.collide(0, -0.3, 0, w, 0.6, L);
  // Arched underside for readability from the banks.
  kit.g("concrete").boxMinMax(-w / 2, -1.2, -1.5, w / 2, -0.55, 1.5, rgb("#a39c8f"));
  for (const s of [-1, 1]) {
    const xx = s * (w / 2 - 0.15);
    for (let z = -L / 2; z <= L / 2 + 0.01; z += 2) kit.g("plaster").boxMinMax(xx - 0.15, 0, z - 0.15, xx + 0.15, 1.0, z + 0.15, WHITE);
    kit.g("paint").boxMinMax(xx - 0.08, 0.85, -L / 2, xx + 0.08, 0.95, L / 2, rgb("#2f6f5e"));
    kit.g("paint").boxMinMax(xx - 0.06, 0.45, -L / 2, xx + 0.06, 0.53, L / 2, rgb("#2f6f5e"));
    kit.collide(xx, 0.6, 0, 0.3, 1.2, L);
  }
}

/** Old brick wall around the bazaar, open where the bazaar road leaves north and south. */
function townWall(kit: Kit): void {
  const T = TOWN, h = 3.4, t = 0.6;
  const bc: RGB = [1, 1, 1];
  const seg = (x0: number, z0: number, x1: number, z1: number) => {
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    kit.frame(cx, cz);
    const sx = Math.max(t, x1 - x0), sz = Math.max(t, z1 - z0);
    kit.g("brick").box(0, h / 2, 0, sx, h, sz, bc);
    kit.g("plaster").box(0, h + 0.1, 0, sx + 0.1, 0.2, sz + 0.1, shade(WHITE, 0.92));
    // Merlons.
    const alongX = sx > sz;
    const len = alongX ? sx : sz;
    for (let a = -len / 2 + 0.4; a < len / 2 - 0.3; a += 1.6) kit.g("brick").box(alongX ? a : 0, h + 0.5, alongX ? 0 : a, alongX ? 0.8 : t, 0.6, alongX ? t : 0.8, bc);
    kit.collide(0, h / 2 + 0.3, 0, sx, h + 0.6, sz);
  };
  seg(T.x0, T.z0, -TOWN_GAP_X, T.z0);
  seg(TOWN_GAP_X, T.z0, T.x1, T.z0);
  seg(T.x0, T.z1, -TOWN_GAP_X, T.z1);
  seg(TOWN_GAP_X, T.z1, T.x1, T.z1);
  seg(T.x0, T.z0, T.x0, T.z1);
  seg(T.x1, T.z0, T.x1, T.z1);
  // Gate pillars at the north opening with a welcome arch.
  kit.frame(0, T.z1);
  const red = rgb("#8e2b23"), cream = rgb("#efe0bf");
  for (const s of [-1, 1]) {
    kit.solid("plaster", s * (TOWN_GAP_X - 0.5), 3.2, 0, 1.0, 6.4, 1.0, cream);
    kit.g("plaster").boxMinMax(s * (TOWN_GAP_X - 0.5) - 0.6, 6.4, -0.6, s * (TOWN_GAP_X - 0.5) + 0.6, 6.7, 0.6, red);
  }
  kit.g("plaster").boxMinMax(-TOWN_GAP_X, 5.3, -0.4, TOWN_GAP_X, 6.3, 0.4, red);
  kit.collide(0, 5.8, 0, TOWN_GAP_X * 2, 1.0, 0.8);
  kit.frame(0, T.z1 + 0.41);
  kit.sign("gate", 0, 5.8, 0, 4.4);
  kit.frame(0, T.z1 - 0.41, Math.PI);
  kit.sign("kotliRoad", 0, 5.8, 0, 3.4);
}

// ---------------------------------------------------------------- Farmland

const CROP_COLOR: Record<Plot["crop"], RGB> = {
  wheat: rgb("#d9b65a"), sarson: rgb("#e3d22f"), sugarcane: rgb("#6f9a45"), paddy: rgb("#86b14d"), fodder: rgb("#5f9a3b"), fallow: rgb("#8e7354"),
};

function plot(kit: Kit, p: Plot, decor: CountryDecor): void {
  const cx = (p.x0 + p.x1) / 2, cz = (p.z0 + p.z1) / 2;
  const hx = (p.x1 - p.x0) / 2, hz = (p.z1 - p.z0) / 2;
  kit.frame(cx, cz);
  const rng = new Rng(p.seed * 17 + 5);
  const soil = p.crop === "paddy" ? rgb("#5d6b4c") : p.crop === "fallow" ? rgb("#7b6046") : rgb("#8a7050");
  flat(kit.g("dirt"), -hx, -hz, hx, hz, -0.015, soil);
  // Bunds (mend) around the plot.
  const bund = rgb("#9c8462");
  for (const s of [-1, 1]) {
    kit.g("dirt").boxMinMax(-hx, -0.03, s * hz - 0.35, hx, 0.18, s * hz + 0.35, bund, 0b001111);
    kit.g("dirt").boxMinMax(s * hx - 0.35, -0.03, -hz, s * hx + 0.35, 0.18, hz, bund, 0b111100);
  }
  const c = CROP_COLOR[p.crop];
  const along = p.rowsAlongX;
  const spacing = p.crop === "sugarcane" ? 1.7 : p.crop === "fodder" ? 1.1 : p.crop === "paddy" ? 0.9 : 1.25;
  const height = p.crop === "sugarcane" ? 2.7 : p.crop === "sarson" ? 1.15 : p.crop === "wheat" ? 0.95 : p.crop === "paddy" ? 0.45 : p.crop === "fodder" ? 0.4 : 0;
  const thick = spacing * (p.crop === "sugarcane" ? 0.72 : p.crop === "paddy" ? 0.55 : 0.84);
  if (p.crop === "fallow") {
    for (let a = -(along ? hz : hx) + 1; a < (along ? hz : hx) - 1; a += 1.1) {
      if (along) flat(kit.g("dirt"), -hx + 0.6, a - 0.25, hx - 0.6, a + 0.25, -0.01, shade(soil, 0.82));
      else flat(kit.g("dirt"), a - 0.25, -hz + 0.6, a + 0.25, hz - 0.6, -0.01, shade(soil, 0.82));
    }
  } else {
    const g = kit.g("crop");
    const span = along ? hz : hx;
    for (let a = -span + 1.2; a < span - 1.0; a += spacing) {
      const hh = height * rng.range(0.9, 1.08);
      const cc = shade(c, rng.range(0.9, 1.08));
      const top = p.crop === "sarson" ? mix(cc, rgb("#f4e04a"), 0.6) : shade(cc, 1.12);
      // Each row: two sides and a top (no ends, no bottom).
      if (along) {
        g.boxMinMax(-hx + 1, 0, a - thick / 2, hx - 1, hh, a + thick / 2, cc, 0b000011);
        kit.g("matte").boxMinMax(-hx + 1, 0, a - thick / 2, hx - 1, hh, a + thick / 2, top, 0b001000);
      } else {
        g.boxMinMax(a - thick / 2, 0, -hz + 1, a + thick / 2, hh, hz - 1, cc, 0b110000);
        kit.g("matte").boxMinMax(a - thick / 2, 0, -hz + 1, a + thick / 2, hh, hz - 1, top, 0b001000);
      }
    }
    if (p.crop === "paddy") flat(kit.g("water"), -hx + 0.5, -hz + 0.5, hx - 0.5, hz - 0.5, 0.02, rgb("#7fa08a"));
  }
  // Odd corner features: a haystack (toori), a tubewell outlet or a lone kikar.
  const f = rng.next();
  const corner = { x: (rng.next() < 0.5 ? -1 : 1) * (hx - 3), z: (rng.next() < 0.5 ? -1 : 1) * (hz - 3) };
  if (f < 0.22) haystack(kit, corner.x, corner.z, rng);
  else if (f < 0.32) tubewell(kit, corner.x, corner.z, rng.next() * Math.PI * 2);
  else if (f < 0.6) decor.addTree(kit, rng.next() < 0.6 ? "kikar" : "shisham", cx + corner.x, cz + corner.z, rng.range(0.9, 1.3), rng.next() * 6);
}

function haystack(kit: Kit, x: number, z: number, rng: Rng): void {
  const c = rgb("#d8b867");
  kit.g("fabric").cylinder(x, 0, z, 1.6, 1.5, 1.6, 12, c, false);
  kit.g("fabric").cylinder(x, 1.6, z, 1.5, 0.15, 1.8, 12, shade(c, 1.05), true);
  kit.collide(x, 1.2, z, 2.6, 2.4, 2.6);
  void rng;
}

/** Pump room with an outlet trough (tubewell). */
function tubewell(kit: Kit, x: number, z: number, rot: number): void {
  const base = kit.currentRotY();
  void base;
  const w = rgb("#e9e3d6");
  kit.g("plaster").boxMinMax(x - 1.4, 0, z - 1.4, x + 1.4, 2.4, z + 1.4, w);
  kit.g("concrete").boxMinMax(x - 1.5, 2.4, z - 1.5, x + 1.5, 2.55, z + 1.5, CONC);
  kit.g("wood").boxMinMax(x - 0.45, 0, z + 1.4, x + 0.45, 1.9, z + 1.43, rgb("#4f6b8a"));
  kit.g("concrete").boxMinMax(x - 0.6, 0, z - 3.2, x + 0.6, 0.45, z - 1.4, CONC);
  kit.g("water").boxMinMax(x - 0.45, 0.2, z - 3.1, x + 0.45, 0.4, z - 1.45, rgb("#7fa6a8"), 0b001000);
  kit.g("metal").cylinderZ(x, 0.55, z - 1.55, 0.12, 0.3, 8, IRON);
  kit.collide(x, 1.2, z, 2.8, 2.4, 2.8);
  kit.collide(x, 0.22, z - 2.3, 1.2, 0.45, 1.8);
  void rot;
}

// ---------------------------------------------------------------- Buildings

/** Frame at the building's front-left corner: local +X along the front, +Z out of the front. */
function frontFrame(kit: Kit, b: Rect & { face: number }): { w: number; d: number } {
  const f = b.face;
  const eps = 1e-3;
  if (Math.abs(f) < eps) { kit.frame(b.x0, b.z1, 0); return { w: b.x1 - b.x0, d: b.z1 - b.z0 }; }
  if (Math.abs(f - Math.PI) < eps) { kit.frame(b.x1, b.z0, Math.PI); return { w: b.x1 - b.x0, d: b.z1 - b.z0 }; }
  if (Math.abs(f + Math.PI / 2) < eps) { kit.frame(b.x0, b.z0, -Math.PI / 2); return { w: b.z1 - b.z0, d: b.x1 - b.x0 }; }
  kit.frame(b.x1, b.z1, Math.PI / 2);
  return { w: b.z1 - b.z0, d: b.x1 - b.x0 };
}

const TRIMS = ["#2f6f5e", "#3a5f8f", "#7a4a2a", "#8c2f39", "#4b6b3a", "#2d4f6c", "#6b4f8a", "#9e7b2f"].map(rgb);

/**
 * Upper floors of a city building: each floor a wall built around its
 * windows (and a balcony door when there is a balcony), the windows framed
 * and grilled under their own chajjas, the odd cooler, AC unit or jharokha.
 */
function cityUpper(kit: Kit, rng: Rng, w: number, y0: number, floors: number, fh: number, trim: RGB, wall: RGB, old: boolean): void {
  const grill = rng.next() < 0.55 ? (rng.next() < 0.5 ? "pattern" : "bars") : "none";
  const frame = rng.next() < 0.5 ? trim : rgb(rng.pick(["#f1eee6", "#6b4a2b", "#2b2b2e"]));
  for (let k = 0; k < floors; k++) {
    const yb = y0 + k * fh;
    const balc = k === 0 && w >= 5 && rng.next() < 0.45;
    const jhar = old && !balc && w >= 4.5 && rng.next() < 0.35;
    const centre = w / 2;
    const avoid: Array<[number, number]> = balc ? [[centre - 0.6, centre + 0.6]] : jhar ? [[centre - 0.9, centre + 0.9]] : [];
    const xs = windowRow(0.5, w - 0.5, 1.3, 0.9, avoid);
    const holes = xs.map((cx) => ({ u0: cx - 0.65, u1: cx + 0.65, v0: yb + 0.9, v1: yb + 2.3 }));
    const bdoor = balc ? { u0: centre - 0.55, u1: centre + 0.55, v0: yb + 0.05, v1: yb + 2.3 } : null;
    holedWall(kit, "plaster", wall, 0, w, yb, yb + fh, 0, bdoor ? [...holes, bdoor] : holes, 0.18);
    for (const h of holes) windowFill(kit, h, 0, 0.18, { frame, grill, chajja: mix(wall, WHITE, 0.45) });
    if (bdoor) {
      windowFill(kit, bdoor, 0, 0.18, { frame, grill: "none" });
      balcony(kit, 0.3, w - 0.3, yb + 0.05, 0, 1.0, mix(wall, WHITE, 0.35), rng.next() < 0.5 ? IRON : shade(trim, 1.1));
    }
    if (jhar) jharokha(kit, centre, yb + 0.6, 0, 1.6, shade(wall, 0.95), rgb("#6b4a2b"));
    if (holes.length && rng.next() < 0.25) cooler(kit, rng.pick(xs), yb + 0.95, 0);
    else if (holes.length && rng.next() < 0.3) acUnit(kit, Math.min(w - 0.5, rng.pick(xs) + 1.05), yb + 0.5, 0);
  }
}

function roofTop(kit: Kit, rng: Rng, w: number, d: number, top: number, wall: RGB): void {
  const par = 0.9, t = 0.2;
  const g = kit.g("plaster");
  g.boxMinMax(0, top, -t, w, top + par, 0, wall, 0b101110);
  g.boxMinMax(0, top, -d, w, top + par, -d + t, wall, 0b111101);
  g.boxMinMax(0, top, -d + t, t, top + par, -t, wall, 0b111000);
  g.boxMinMax(w - t, top, -d + t, w, top + par, -t, wall, 0b011100);
  if (rng.next() < 0.6) {
    const tx = rng.range(1.2, w - 1.2), tz = -rng.range(2, d - 2);
    kit.g("paint").cylinder(tx, top, tz, 0.62, 0.6, 1.3, 10, rng.next() < 0.7 ? rgb("#1d1d1f") : rgb("#d8cfb8"), true);
  }
}

const SHOP_GOODS = ["#c0392b", "#e67e22", "#f1c40f", "#27ae60", "#2980b9", "#8e44ad", "#ecf0f1", "#d35400"].map(rgb);

function cityBuilding(kit: Kit, b: OuterBuilding): void {
  const rng = new Rng(b.seed);
  const { w, d } = frontFrame(kit, b);
  const wall = rgb(b.color);
  const trim = rng.pick(TRIMS);
  const gh = 3.9, fh = 3.2;
  const top = gh + (b.floors - 1) * fh;
  // Mass (no front face: the front is built from pieces below).
  kit.g("plaster").boxMinMax(0, 0, -d, w, top, -0.25, wall, 0b111001);
  kit.g("plaster").boxMinMax(0, gh, -0.25, w, top, 0, shade(wall, 0.98), 0b110000);
  kit.collide(w / 2, top / 2, -d / 2, w, top, d);
  if (b.shop) {
    // Open shopfront: dark interior, goods on shelves, half-rolled shutter and a board.
    kit.g("dark").boxMinMax(0.3, 0.2, -3, w - 0.3, gh - 0.4, -2.98, [1, 1, 1], 0b000010);
    kit.g("interior").boxMinMax(0.3, 0, -3, w - 0.3, 0.2, -0.25, rgb("#c9bfae"), 0b001000);
    for (let u = 0.7; u < w - 0.8; u += 0.9) {
      for (let s = 0; s < 3; s++) kit.g("paint").boxMinMax(u, 0.6 + s * 0.8, -2.95, u + 0.7, 0.95 + s * 0.8, -2.6, rng.pick(SHOP_GOODS), 0b001010);
    }
    kit.g("wood").boxMinMax(0.6, 0, -1.4, w - 0.6, 0.95, -0.9, rgb("#7a5536"), 0b101110);
    kit.g("shutter").boxMinMax(0.3, gh - 0.95, -0.24, w - 0.3, gh - 0.4, -0.1, rgb("#9aa0a4"));
    for (const u of [0, w - 0.3]) kit.g("plaster").boxMinMax(u, 0, -0.25, u + 0.3, gh, 0, shade(wall, 0.9), 0b111110);
    kit.g("plaster").boxMinMax(0, gh - 0.4, -0.25, w, gh, 0.05, shade(wall, 0.9), 0b001110);
    kit.sign(b.shop, w / 2, gh + 0.55, 0.08, Math.min(w - 1.0, 5.2));
    kit.g("paint").boxMinMax(w / 2 - Math.min(w - 1.0, 5.2) / 2 - 0.05, gh + 0.55 - 0.65, 0.0, w / 2 + Math.min(w - 1.0, 5.2) / 2 + 0.05, gh + 0.55 + 0.65, 0.07, rgb("#202020"), 0b000010);
  } else {
    // Residential ground floor: a wall built round a framed door and a grilled window.
    const du = rng.range(0.6, Math.max(0.7, w - 2));
    const door = { u0: du, u1: du + 1.1, v0: 0.3, v1: 2.5 };
    const wx = du > w / 2 ? 0.8 : w - 2.1;
    const win = { u0: wx, u1: wx + 1.3, v0: 1.0, v1: 2.3 };
    holedWall(kit, "plaster", shade(wall, 0.96), 0, w, 0, gh, 0, [door, win], 0.2);
    doorFill(kit, door, 0, 0.2, { leaf: shade(trim, 0.9), frame: rgb("#5a3a22"), kind: rng.next() < 0.6 ? "panel" : "steel", step: 0.3 });
    windowFill(kit, win, 0, 0.2, { frame: trim, grill: "bars", chajja: mix(wall, WHITE, 0.45) });
  }
  kit.g("plaster").boxMinMax(-0.02, gh - 0.05, -0.05, w + 0.02, gh + 0.08, 0.15, mix(wall, WHITE, 0.5), 0b001110);
  cityUpper(kit, rng, w, gh, b.floors - 1, fh, trim, shade(wall, 0.98), b.id.startsWith("ludh") || rng.next() < 0.25);
  roofTop(kit, rng, w, d, top, shade(wall, 0.97));
  if (b.id.startsWith("ludh")) chauraFront(kit, rng, b, w, gh, fh, top);
}

/** Awning stripes seen over every second shop in a cloth market. */
const AWNING = ["#c62828", "#1565c0", "#2e7d32", "#f9a825", "#6a1b9a", "#00838f", "#ad1457"];

/**
 * What makes Chaura Bazaar look like Chaura Bazaar rather than a wider
 * street: a striped cloth awning on poles over the pavement, boards stacked
 * two and three deep up the frontage, and bolts of cloth hung out to show.
 */
function chauraFront(kit: Kit, rng: Rng, b: OuterBuilding, w: number, gh: number, fh: number, top: number): void {
  if (b.shop) {
    // Sloped cloth awning out over the footpath, on two thin poles.
    const c = rgb(rng.pick(AWNING)), c2 = rgb(rng.pick(AWNING));
    const out = rng.range(1.3, 1.9);
    const hi = gh - 0.55, lo = hi - rng.range(0.35, 0.6);
    const strip = Math.max(0.32, w / Math.round(w / 0.42));
    // Alternating stripes, each a thin slab spanning the slope. Boxes rather
    // than a true sloped sheet: at this scale the silhouette is what reads.
    let k = 0;
    for (let u = 0.15; u < w - 0.2; u += strip, k++) {
      const u1 = Math.min(u + strip, w - 0.15);
      kit.g("fabric").boxMinMax(u, lo, 0.05, u1 - 0.02, hi, out, k % 2 ? c : c2);
    }
    for (const u of [0.25, w - 0.25]) {
      kit.g("metal").boxMinMax(u - 0.03, 0, out - 0.08, u + 0.03, lo, out - 0.02, rgb("#6d6d6d"));
    }
    // Valance hanging off the front lip.
    kit.g("fabric").boxMinMax(0.15, lo - 0.28, out - 0.04, w - 0.15, lo, out, mix(c, rgb("#ffffff"), 0.25), 0b000010);
  }
  // Boards stacked up the floors — in a hosiery bazaar the whole wall is signs.
  for (let f = 1; f < Math.min(b.floors, 4); f++) {
    if (rng.next() < 0.45) continue;
    const y = gh + 0.3 + (f - 0.5) * fh;
    const bw = Math.min(w - 1.2, rng.range(2.4, 4.6));
    kit.g("paint").boxMinMax(w / 2 - bw / 2, y - 0.42, 0.02, w / 2 + bw / 2, y + 0.42, 0.1, rgb(rng.pick(AWNING)), 0b000010);
    kit.g("paint").boxMinMax(w / 2 - bw / 2 + 0.12, y - 0.26, 0.1, w / 2 + bw / 2 - 0.12, y + 0.26, 0.12, rgb("#f7f3e8"), 0b000010);
  }
  // A couple of bolts of cloth hung from an upper balcony.
  if (b.floors > 1 && rng.next() < 0.5) {
    for (let i = 0; i < rng.int(2, 4); i++) {
      const u = rng.range(0.6, Math.max(0.7, w - 0.9));
      const y = gh + 0.4 + rng.int(0, Math.max(0, b.floors - 2)) * fh;
      kit.g("cloth").boxMinMax(u, y - rng.range(1.1, 2.0), 0.06, u + rng.range(0.3, 0.5), y, 0.1, rgb(rng.pick(AWNING)), 0b000010);
    }
  }
  void top;
}

/**
 * A pind house. Brick or lime-washed, on a whitewashed plinth, in one of two
 * fronts: a verandah of square pillars in front of the rooms, or the street
 * wall with the big studded darwaza. Small windows with iron bars and wooden
 * shutters folded back, a jharokha on the odd old two-storey, a jaali
 * parapet, and on the roof a tank, a charpai or a stack of paathiyan.
 */
function villageHouse(kit: Kit, b: OuterBuilding): void {
  const rng = new Rng(b.seed);
  const { w, d } = frontFrame(kit, b);
  const brick = b.color.startsWith("#b") || b.color.startsWith("#a") || b.color.startsWith("#c2");
  const wall = rgb(b.color);
  const h = b.floors === 2 ? 6.2 : 3.4;
  const mat: MatKey = brick ? "brick" : "plaster";
  const wc: RGB = brick ? [1, 1, 1] : wall;
  const trim = rng.pick(TRIMS);
  const wood = rgb(rng.pick(["#6b4a2b", "#7a5536", "#4e3524"]));
  const verandah = b.floors === 1 && w >= 7 && d >= 7 && rng.next() < 0.45;
  const zf = verandah ? -2.2 : 0;
  kit.g(mat).boxMinMax(0, 0, -d, w, h, zf, wc, PX_NX_PY_NZ);
  kit.collide(w / 2, h / 2, -d / 2, w, h, d);
  const plinth = 0.4;
  // Rooms' front: the door and its windows, each with bars and shutters.
  const dw = verandah ? 1.2 : 2.2, dh = verandah ? 2.3 : 2.7;
  const du = Math.min(w - dw - 0.8, Math.max(0.8, rng.range(0.8, w - dw - 0.8)));
  const door = { u0: du, u1: du + dw, v0: plinth, v1: plinth + dh };
  const winY = plinth + 0.95;
  const xs = windowRow(0.5, w - 0.5, 0.9, 1.3, [[door.u0 - 0.5, door.u1 + 0.5]]).slice(0, 3);
  const wins = xs.map((cx) => ({ u0: cx - 0.45, u1: cx + 0.45, v0: winY, v1: winY + 1.05 }));
  const ground = b.floors === 2 ? 3.3 : h;
  holedWall(kit, mat, wc, 0, w, 0, ground, zf, [door, ...wins], 0.25);
  doorFill(kit, door, zf, 0.25, { leaf: verandah ? trim : rng.next() < 0.5 ? trim : wood, frame: wood, kind: verandah ? "panel" : "darwaza", step: plinth });
  const shut = rng.next() < 0.7 ? (rng.next() < 0.5 ? trim : wood) : undefined;
  for (const hw of wins) windowFill(kit, hw, zf, 0.25, { frame: wood, grill: "bars", shutters: shut, glass: "dark" });
  // Whitewashed plinth band, and a painted arch over the darwaza.
  kit.g("plaster").boxMinMax(-0.02, 0, zf - 0.02, w + 0.02, plinth, zf + 0.04, WHITE, 0b001010);
  if (!verandah) kit.g("plaster").ellipsoid((door.u0 + door.u1) / 2, door.v1 + 0.1, zf + 0.03, dw / 2 + 0.25, 0.45, 0.04, 12, 4, shade(trim, 1.15), 0, 1);
  if (b.floors === 2) {
    const up = windowRow(0.6, w - 0.6, 1.0, 1.4).slice(0, 3);
    const jhar = w >= 6 && rng.next() < 0.4;
    const holes = up.filter((cx) => !jhar || Math.abs(cx - w / 2) > 1.2).map((cx) => ({ u0: cx - 0.5, u1: cx + 0.5, v0: 4.2, v1: 5.4 }));
    holedWall(kit, mat, wc, 0, w, ground, h, zf, holes, 0.25);
    for (const hw of holes) windowFill(kit, hw, zf, 0.25, { frame: wood, grill: "bars", shutters: shut, glass: "dark" });
    if (jhar) jharokha(kit, w / 2, 3.9, zf, 1.6, brick ? rgb("#b5654a") : shade(wall, 0.95), wood);
  }
  if (verandah) {
    // Verandah: brick floor, square pillars, a flat roof on beams.
    kit.g("brick").boxMinMax(0, 0, zf, w, plinth, 0, [1, 1, 1], 0b001010);
    kit.collide(w / 2, plinth / 2, zf / 2, w, plinth, -zf);
    const n = Math.max(3, Math.round(w / 2.6));
    for (let i = 0; i <= n; i++) {
      const u = 0.15 + ((w - 0.3) * i) / n;
      kit.g(mat).boxMinMax(u - 0.15, plinth, -0.32, u + 0.15, 2.95, -0.02, wc, 0b110011);
    }
    kit.g("concrete").boxMinMax(0, 2.95, zf, w, 3.15, 0.1, mix(brick ? rgb("#c9a28a") : wall, WHITE, 0.3), 0b111110);
    kit.g("wood").boxMinMax(0, 2.85, -0.3, w, 2.95, -0.1, wood, 0b001110);
    if (rng.next() < 0.5) charpai(kit, rng.range(1.2, w - 2.4), -1.2, plinth, Math.PI / 2);
  }
  // Roof: jaali parapet on the front, plain on the back; tank, charpai or paathiyan.
  const pc = brick ? rgb("#c9a28a") : shade(wall, 0.95);
  jaaliParapet(kit, brick ? "brick" : "plaster", brick ? [1, 1, 1] : pc, 0, w, verandah ? 3.15 : h, verandah ? 0.1 : zf, 0.22, 0.85);
  kit.g("plaster").boxMinMax(0, h, -d, w, h + 0.8, -d + 0.25, shade(wall, 0.9), 0b111101);
  const r = rng.next();
  if (r < 0.4) sintex(kit, rng.range(1, w - 1), h, zf - rng.range(2, Math.max(2.2, d + zf - 2)), rng.next() < 0.3);
  else if (r < 0.65) charpai(kit, rng.range(1, w - 2.5), zf - rng.range(2, Math.max(2.2, d + zf - 2.5)), h, rng.next() * Math.PI);
  else if (r < 0.85) for (let i = 0; i < 3; i++) kit.g("fabric").cylinder(rng.range(1, w - 1), h, zf - rng.range(1.5, Math.max(1.7, d + zf - 1.5)), 0.5, 0.15, 0.9, 7, rgb("#6b5236"), true);
  if (rng.next() < 0.3) cooler(kit, xs[0] ?? w / 2, winY, zf);
  if (rng.next() < 0.2) dish(kit, w - 0.6, h + 0.85, zf - 0.6, 0);
  if (!verandah && rng.next() < 0.35) {
    // Gobar (dung-cake) heap or a charpai leaning by the door.
    kit.g("fabric").ellipsoid(Math.min(w - 0.8, door.u1 + 1.2), 0.4, 1.0, 0.7, 0.5, 0.7, 8, 5, rgb("#6b5236"));
  }
}

/** Gate colours on a colony street: black, bottle green, maroon, steel grey, the odd gold-painted show-off. */
const GATES = ["#1f1f22", "#24432f", "#5a1f24", "#4a5257", "#2a3b57", "#8a6d2a"].map(rgb);
const TILES = ["#b9b3a8", "#a5584a", "#c9c1b3", "#8f8a80", "#d2c6ad"].map(rgb);

/**
 * A colony kothi: a 1.4 m boundary wall with pillars and a steel gate on the
 * kerb, a tiled front yard, and the house set back behind it — a chajja over
 * every floor's windows, often a balcony, a stone-clad strip up one side, a
 * parapet, the black Sintex tank and the stair mumty on the roof.
 * Hidden faces are left out: there are a thousand of these.
 */
function kothi(kit: Kit, b: OuterBuilding): void {
  const rng = new Rng(b.seed);
  const { w, d } = frontFrame(kit, b);
  const wall = rgb(b.color);
  const trim = rng.pick(TRIMS);
  const NB = 0b111011;
  const yd = Math.min(4.5, Math.max(3, d * 0.27));
  const fh = 3.15, plinth = 0.45, h = plinth + b.floors * fh;
  // Kerb strip in front of the wall, then the yard.
  flat(kit.g("paver"), 0, 0, w, 1.5, 0.018, rgb("#cdbf9f"));
  flat(kit.g("paver"), 0, -yd, w, 0, 0.02, rng.pick(TILES));
  // Boundary wall, pillars (one with the family's nameplate) and a steel gate.
  const gw = Math.min(3.2, w * 0.3);
  const gu = rng.next() < 0.5 ? 0.6 : w - 0.6 - gw;
  const bw = rng.next() < 0.3 ? rgb("#b5654a") : shade(wall, 0.9);
  const bm: MatKey = rng.next() < 0.3 ? "brick" : "plaster";
  if (gu > 0.1) kit.g(bm).boxMinMax(0, 0, -0.22, gu, 1.4, 0, bm === "brick" ? [1, 1, 1] : bw, 0b001011);
  if (gu + gw < w - 0.1) kit.g(bm).boxMinMax(gu + gw, 0, -0.22, w, 1.4, 0, bm === "brick" ? [1, 1, 1] : bw, 0b001011);
  const plateLeft = rng.next() < 0.5;
  gatePillar(kit, gu, 0, 1.9, shade(wall, 0.82), plateLeft);
  gatePillar(kit, gu + gw, 0, 1.9, shade(wall, 0.82), !plateLeft);
  const gc = rng.pick(GATES);
  const open = OPEN_HOUSE_IDS.has(b.id);
  if (open) {
    // The gate stands open: both leaves swung back into the yard.
    for (const [hu, sd] of [[gu + 0.25, 1], [gu + gw - 0.25, -1]] as const) {
      const lw = gw / 2 - 0.27;
      kit.g("metal").boxMinMax(hu + sd * 0.02 - 0.03, 0.08, -0.14 - lw, hu + sd * 0.02 + 0.03, 0.95, -0.14, gc, 0b110000);
      for (let z = -0.24; z > -0.14 - lw + 0.05; z -= 0.2) kit.g("metal").boxMinMax(hu + sd * 0.02 - 0.014, 0.95, z - 0.014, hu + sd * 0.02 + 0.014, 1.7, z + 0.014, gc, 0b110000);
      kit.g("metal").boxMinMax(hu + sd * 0.02 - 0.03, 1.67, -0.14 - lw, hu + sd * 0.02 + 0.03, 1.73, -0.14, shade(gc, 1.6), 0b111000);
    }
    if (gu > 0.05) kit.collide(gu / 2, 0.85, -0.11, gu, 1.7, 0.3);
    if (gu + gw < w - 0.05) kit.collide((gu + gw + w) / 2, 0.85, -0.11, w - gu - gw, 1.7, 0.3);
  } else {
    // Two gate leaves: a solid lower half, bars above with a scroll rail.
    for (const [a0, a1] of [[gu + 0.25, gu + gw / 2 - 0.02], [gu + gw / 2 + 0.02, gu + gw - 0.25]] as const) {
      kit.g("metal").boxMinMax(a0, 0.08, -0.14, a1, 0.95, -0.08, gc, 0b000011);
      for (let u = a0 + 0.1; u < a1 - 0.05; u += 0.2) kit.g("metal").boxMinMax(u - 0.014, 0.95, -0.11, u + 0.014, 1.7, -0.11, gc, 0b000011);
      for (const y of [0.95, 1.35, 1.7]) kit.g("metal").boxMinMax(a0, y - 0.03, -0.14, a1, y + 0.03, -0.08, shade(gc, 1.6), 0b001011);
    }
    kit.collide(w / 2, 0.85, -0.11, w, 1.7, 0.3);
  }
  // Yard side walls (shared with the neighbours, so only the inner face).
  kit.g("plaster").boxMinMax(0, 0, -yd, 0.15, 1.4, -0.22, shade(wall, 0.88), 0b101010);
  kit.g("plaster").boxMinMax(w - 0.15, 0, -yd, w, 1.4, -0.22, shade(wall, 0.88), 0b011010);
  // The house: mass without its front, which is built round the openings.
  const z0 = -yd;
  kit.g("plaster").boxMinMax(0, 0, -d, w, h, z0, wall, PX_NX_PY_NZ);
  if (!open) kit.collide(w / 2, h / 2, (z0 - d) / 2, w, h, d + z0);
  const du = open ? w / 2 - 0.575 : gu < w / 2 ? Math.min(gu + gw + 0.4, w - 1.6) : Math.max(0.5, gu - 1.6);
  const door = { u0: du, u1: du + 1.15, v0: plinth, v1: plinth + 2.25 };
  // Stone cladding up one side; the windows keep clear of it.
  const clad = rng.next() < 0.4 && !open ? (rng.next() < 0.5 ? [0, 1.3] as [number, number] : [w - 1.3, w] as [number, number]) : null;
  const avoid: Array<[number, number]> = clad ? [[clad[0] - 0.3, clad[1] + 0.3]] : [];
  const grill = rng.next() < 0.6 ? "pattern" : rng.next() < 0.5 ? "bars" : "none";
  const frame = rng.next() < 0.45 ? rgb(rng.pick(["#f4f2ec", "#5a3a22", "#8a8f94"])) : trim;
  const glass = rng.next() < 0.4 ? "blue" : undefined;
  const sun = mix(wall, WHITE, 0.4);
  const longChajja = rng.next() < 0.5;
  let coolerDone = false;
  for (let f = 0; f < b.floors; f++) {
    const y = plinth + f * fh;
    const yb = f === 0 ? 0 : y, yt = plinth + (f + 1) * fh;
    const balc = f === 1 && w >= 6 && rng.next() < 0.55;
    const bd = balc ? { u0: w / 2 - 0.65, u1: w / 2 + 0.65, v0: y + 0.05, v1: y + 2.3 } : null;
    const av = [...avoid, ...(f === 0 ? [[door.u0, door.u1] as [number, number]] : []), ...(bd ? [[bd.u0, bd.u1] as [number, number]] : [])];
    const xs = windowRow(0.6, w - 0.6, 1.5, 1.0, av);
    const holes = xs.map((cx) => ({ u0: cx - 0.75, u1: cx + 0.75, v0: y + 0.95, v1: y + 2.3 }));
    holedWall(kit, "plaster", wall, 0, w, yb, yt, z0, [...holes, ...(f === 0 ? [door] : []), ...(bd ? [bd] : [])], 0.2);
    for (const hw of holes) windowFill(kit, hw, z0, 0.2, { frame, grill, glass, chajja: longChajja ? undefined : sun });
    if (f === 0) doorFill(kit, door, z0, 0.2, { leaf: rng.next() < 0.7 ? rgb(rng.pick(["#6b4a2b", "#8a5a33", "#4e3524"])) : shade(trim, 0.85), frame: rgb("#5a3a22"), kind: rng.next() < 0.75 ? "panel" : "steel", step: open ? 0 : plinth, open });
    if (f === 0 && open) houseInterior(kit, { w, d, z0, plinth, fh, holes: [...holes, door], door: door.u0, doorW: door.u1 - door.u0, baithak: 4.6 }, new Rng(b.seed * 7 + 1), h);
    if (bd) {
      windowFill(kit, bd, z0, 0.2, { frame, grill: "none", glass });
      balcony(kit, 0.4, w - 0.4, y + 0.05, z0, 1.1, mix(wall, WHITE, 0.35), rng.next() < 0.5 ? IRON : shade(trim, 1.2));
    }
    // A long chajja along the whole front instead of one over each window.
    if (longChajja) kit.g("concrete").boxMinMax(-0.1, y + 2.55, z0, w + 0.1, y + 2.68, z0 + 0.6, sun, 0b111110);
    if (!coolerDone && holes.length && rng.next() < 0.35) { cooler(kit, xs[0]!, y + 0.95, z0); coolerDone = true; }
    else if (f > 0 && holes.length && rng.next() < 0.45) acUnit(kit, Math.min(w - 0.5, xs[xs.length - 1]! + 1.15), y + 0.6, z0);
  }
  kit.g("plaster").boxMinMax(-0.02, 0, z0, w + 0.02, plinth, z0 + 0.04, shade(wall, 0.7), 0b001010);
  if (clad) cladding(kit, clad[0], clad[1], plinth, h, z0, rgb(rng.pick(["#8d7b68", "#a39582", "#6d625a", "#b0a28c"])));
  // Car porch over the drive on the gate side, on two pillars.
  if (w >= 9 && yd >= 3.5 && rng.next() < 0.45) {
    const p0 = Math.max(0.3, gu - 0.1), p1 = Math.min(w - 0.3, gu + gw + 0.1), py = plinth + 2.7;
    kit.g("concrete").boxMinMax(p0, py, z0, p1, py + 0.2, -0.9, sun, 0b111110);
    for (const u of [p0 + 0.15, p1 - 0.15]) kit.g("plaster").boxMinMax(u - 0.15, 0, -1.2, u + 0.15, py, -0.9, shade(wall, 0.9), 0b110011);
    kit.collide((p0 + p1) / 2, py / 2, -1.05, 0.3, py, 0.3);
  }
  // Roof: jaali parapet on the front, the tank, the mumty and maybe a dish.
  if (rng.next() < 0.7) jaaliParapet(kit, "plaster", shade(wall, 0.96), 0, w, h, z0, 0.22, 0.9);
  else kit.g("plaster").boxMinMax(0, h, z0 - 0.22, w, h + 0.85, z0, shade(wall, 0.96), 0b101011);
  if (rng.next() < 0.65) sintex(kit, rng.range(1.0, w - 1.0), h, z0 - rng.range(3, Math.max(3.2, d - yd - 3)));
  if (rng.next() < 0.7 && d - yd > 7) mumty(kit, "plaster", shade(wall, 0.94), rng.next() < 0.5 ? 0.3 : w - 3.3, -d + 3.6, 3, 3.3, h, rgb(rng.pick(["#4a5257", "#24432f", "#5a1f24"])));
  if (rng.next() < 0.35) dish(kit, rng.range(0.8, w - 0.8), h, z0 - 1.2, 0);
  void NB;
}

// ---------------------------------------------------------------- Landmark sites

function buildSite(kit: Kit, s: Site, decor: CountryDecor): void {
  const cx = (s.x0 + s.x1) / 2, cz = (s.z0 + s.z1) / 2;
  const hx = (s.x1 - s.x0) / 2, hz = (s.z1 - s.z0) / 2;
  const rng = new Rng(s.seed * 101);
  kit.frame(cx, cz);
  switch (s.kind) {
    case "highwayDhaba": highwayDhaba(kit, hx, hz, rng); break;
    case "petrol": petrol(kit, hx, hz); break;
    case "busAdda": busAdda(kit, hx, hz, rng); break;
    case "ghantaGhar": ghantaGhar(kit, hx, hz, s.id === "ludhGhanta"); break;
    case "mandi": mandi(kit, hx, hz, rng); break;
    case "park": park(kit, s, hx, hz, rng); break;
    case "thana": thana(kit, hx, hz); break;
    case "cinema": cinema(kit, hx, hz); break;
    case "akhada": akhada(kit, s, hx, hz, rng); break;
    case "gurdwara": gurdwara(kit, hx, hz); break;
    case "kabaddi": kabaddi(kit, hx, hz); break;
    case "dera": dera(kit, s, hx, hz, rng, decor); break;
    case "kiln": kiln(kit, hx, hz); break;
    case "toba": toba(kit, s, hx, hz, rng, decor); break;
    case "school": school(kit, hx, hz, rng); break;
    case "hospital": hospital(kit, hx, hz); break;
    case "colonyPark": park(kit, s, hx, hz, rng); swings(kit, hx, hz); break;
    case "mandir": mandir(kit, hx, hz); break;
  }
}

/**
 * A colony Shiv mandir: boundary wall with the gate on the street (south)
 * side, a raised marble platform, the garbhagriha with a curved shikhara of
 * stacked, tapering tiers topped by a kalash and a saffron dhwaja, a pillared
 * mandap in front, and the big brass ghanti hung at the door.
 */
function mandir(kit: Kit, hx: number, hz: number): void {
  paving(kit, hx, hz, "paver", rgb("#ece3d2"));
  const cream = rgb("#f3e6cf"), saffron = rgb("#e9822a"), red = rgb("#b5352a"), brass = rgb("#c9a243");
  for (const sd of [-1, 1]) {
    if (sd < 0) {
      kit.g("plaster").boxMinMax(-hx, 0, -hz - 0.2, -2.5, 1.5, -hz + 0.2, cream);
      kit.g("plaster").boxMinMax(2.5, 0, -hz - 0.2, hx, 1.5, -hz + 0.2, cream);
      kit.collide((-hx - 2.5) / 2, 0.75, -hz, hx - 2.5, 1.5, 0.4);
      kit.collide((hx + 2.5) / 2, 0.75, -hz, hx - 2.5, 1.5, 0.4);
    } else {
      kit.g("plaster").boxMinMax(-hx, 0, hz - 0.2, hx, 1.5, hz + 0.2, cream);
      kit.collide(0, 0.75, hz, hx * 2, 1.5, 0.4);
    }
    kit.g("plaster").boxMinMax(sd * hx - 0.2, 0, -hz, sd * hx + 0.2, 1.5, hz, cream);
    kit.collide(sd * hx, 0.75, 0, 0.4, 1.5, hz * 2);
  }
  // Gate arch with a saffron band.
  kit.g("plaster").boxMinMax(-2.8, 1.5, -hz - 0.3, 2.8, 3.6, -hz + 0.3, cream);
  kit.g("paint").boxMinMax(-2.8, 3.1, -hz - 0.31, 2.8, 3.4, -hz + 0.31, saffron);
  // Platform and steps.
  kit.g("concrete").boxMinMax(-8, 0, -4, 8, 0.9, 12, rgb("#efe9df"));
  kit.collide(0, 0.45, 4, 16, 0.9, 16);
  for (let i = 0; i < 3; i++) kit.g("concrete").boxMinMax(-2.5, 0, -4 - 0.4 * (i + 1), 2.5, 0.9 - 0.3 * (i + 1), -4 - 0.4 * i, rgb("#e6dfd2"));
  // Mandap: a roof on eight pillars in front of the sanctum.
  for (const x of [-4.5, -1.5, 1.5, 4.5]) for (const z of [-3, 2]) {
    kit.g("plaster").cylinder(x, 0.9, z, 0.22, 0.2, 3, 10, cream);
    kit.collide(x, 2.4, z, 0.45, 3, 0.45);
  }
  kit.g("plaster").boxMinMax(-5.2, 3.9, -3.6, 5.2, 4.3, 2.6, cream);
  kit.g("paint").boxMinMax(-5.25, 3.95, -3.65, 5.25, 4.1, 2.65, red);
  // Garbhagriha, a dark doorway, and the shikhara above it.
  kit.g("plaster").boxMinMax(-3.5, 0.9, 2.6, 3.5, 5.2, 9.6, cream);
  kit.collide(0, 3, 6.1, 7, 4.3, 7);
  kit.g("dark").boxMinMax(-0.8, 0.9, 2.58, 0.8, 3.1, 2.6, [1, 1, 1], 0b000001);
  kit.g("paint").boxMinMax(-1.0, 3.1, 2.56, 1.0, 3.3, 2.6, saffron, 0b000001);
  let w = 3.3, y = 5.2;
  for (let i = 0; i < 9; i++) {
    const h = 0.95 - i * 0.04, w1 = w * (0.9 - i * 0.012);
    kit.g("plaster").boxMinMax(-w, y, 6.1 - w, w, y + h * 0.75, 6.1 + w, cream);
    kit.g("paint").boxMinMax(-w1, y + h * 0.75, 6.1 - w1, w1, y + h, 6.1 + w1, i % 2 ? saffron : red);
    y += h; w = w1;
  }
  kit.g("plaster").ellipsoid(0, y + 0.3, 6.1, w + 0.2, 0.45, w + 0.2, 12, 6, cream);
  kit.g("metal").cylinder(0, y + 0.6, 6.1, 0.28, 0.08, 1.0, 10, brass);
  // Dhwaja: a saffron pennant on a thin staff.
  kit.g("metal").cylinder(0.3, y + 0.6, 6.1, 0.03, 0.03, 2.4, 6, rgb("#7a5a2a"));
  kit.g("cloth").quad(new Vector3(0.33, y + 3.0, 6.1), new Vector3(0.33, y + 2.3, 6.1), new Vector3(1.8, y + 2.7, 6.15), new Vector3(1.8, y + 2.7, 6.15), saffron);
  kit.g("cloth").quad(new Vector3(1.8, y + 2.7, 6.15), new Vector3(0.33, y + 2.3, 6.1), new Vector3(0.33, y + 3.0, 6.1), new Vector3(1.8, y + 2.7, 6.15), saffron);
  // The ghanti hung in the mandap, over the way in.
  kit.g("metal").cylinder(0, 3.3, -2.6, 0.02, 0.02, 0.6, 4, rgb("#555555"));
  kit.g("chrome").cylinder(0, 3.0, -2.6, 0.22, 0.12, 0.35, 12, brass);
}

function paving(kit: Kit, hx: number, hz: number, mat: MatKey, c: RGB): void {
  flat(kit.g(mat), -hx, -hz, hx, hz, 0.01, c);
}

function shed(kit: Kit, x0: number, z0: number, x1: number, z1: number, h: number, roofC: RGB): void {
  for (const [x, z] of [[x0, z0], [x1, z0], [x0, z1], [x1, z1]] as const) {
    kit.g("metal").boxMinMax(x - 0.12, 0, z - 0.12, x + 0.12, h, z + 0.12, IRON);
    kit.collide(x, h / 2, z, 0.25, h, 0.25);
  }
  for (let x = x0 + 4; x < x1 - 2; x += 4) for (const z of [z0, z1]) { kit.g("metal").boxMinMax(x - 0.1, 0, z - 0.1, x + 0.1, h, z + 0.1, IRON); kit.collide(x, h / 2, z, 0.2, h, 0.2); }
  kit.g("shutter").boxMinMax(x0 - 0.6, h, z0 - 0.6, x1 + 0.6, h + 0.12, z1 + 0.6, roofC);
}

function highwayDhaba(kit: Kit, hx: number, hz: number, rng: Rng): void {
  paving(kit, hx, hz, "dirt", rgb("#a68e66"));
  // Kitchen block at the back, open eating shed in front facing the highway (north, +Z).
  const back = -hz + 2;
  kit.g("plaster").boxMinMax(-hx + 2, 0, back, hx - 2, 3.6, back + 6, rgb("#e7c46c"));
  kit.collide(0, 1.8, back + 3, hx * 2 - 4, 3.6, 6);
  kit.g("dark").boxMinMax(-6, 0.3, back + 6, 6, 2.6, back + 6.02, [1, 1, 1], 0b000010);
  kit.g("concrete").boxMinMax(-7, 0, back + 6, 7, 1.0, back + 7.2, rgb("#9e8f7a"));
  kit.collide(0, 0.5, back + 6.6, 14, 1.0, 1.2);
  kit.g("plaster").cylinder(8, 0, back + 7.6, 0.75, 0.55, 1.0, 12, rgb("#c9a27a"));
  kit.collide(8, 0.5, back + 7.6, 1.5, 1.0, 1.5);
  shed(kit, -hx + 3, back + 9, hx - 3, hz - 3, 3.4, rgb("#2e7d32"));
  for (let i = 0; i < 8; i++) charpai(kit, -hx + 7 + (i % 4) * 9, back + 12 + Math.floor(i / 4) * 7, 0, rng.next() * 0.4);
  kit.frame((kit.toWorld(0, 0, 0)).x, (kit.toWorld(0, 0, 0)).z);
  // Big board on poles facing the road.
  for (const s of [-1, 1]) { kit.g("metal").boxMinMax(s * 5 - 0.1, 0, hz + 1.5, s * 5 + 0.1, 6.5, hz + 1.7, IRON); kit.collide(s * 5, 3.2, hz + 1.6, 0.25, 6.5, 0.25); }
  kit.sign("sherDhaba", 0, 5.4, hz + 1.75, 10);
  // Parked trucks (static, painted "Horn OK Please").
  truckProp(kit, hx - 6, hz - 6, 0.08);
  truckProp(kit, -hx + 7, hz - 7, -0.12);
}

/** A vendor's hand-cart: wooden bed on cycle wheels, heaped with produce (front faces +Z). */
/**
 * The wires. Every Ludhiana gali is roofed by a sagging mess of them strung
 * between the frontages, and nothing else says "this street" so cheaply:
 * poles and a tidy grid read as a planned town, a tangle overhead does not.
 */
function ludhianaWires(kit: Kit): void {
  const rng = new Rng(5150);
  const fronts = OUTER_BUILDINGS.filter((b) => b.id.startsWith("ludh"));
  for (const r of ROADS) {
    if (!r.id.startsWith("ludh")) continue;
    const alongX = r.x1 - r.x0 >= r.z1 - r.z0;
    const c = alongX ? (r.z0 + r.z1) / 2 : (r.x0 + r.x1) / 2;
    const a0 = alongX ? r.x0 : r.z0, a1 = alongX ? r.x1 : r.z1;
    // Pair up the buildings facing each other across this street.
    const near = (sd: number) => fronts
      .filter((b) => {
        const bc = alongX ? (b.z0 + b.z1) / 2 : (b.x0 + b.x1) / 2;
        return Math.sign(bc - c) === sd && Math.abs(bc - c) < 18;
      })
      .sort((p, q) => (alongX ? p.x0 - q.x0 : p.z0 - q.z0));
    const west = near(-1), east = near(1);
    for (let i = 0; i < Math.min(west.length, east.length); i++) {
      const A = west[i]!, Bb = east[i]!;
      const aa = alongX ? (A.x0 + A.x1) / 2 : (A.z0 + A.z1) / 2;
      if (aa < a0 + 6 || aa > a1 - 6) continue;
      if (rng.next() < 0.35) continue;
      const hA = 3.9 + (A.floors - 1) * 3.2, hB = 3.9 + (Bb.floors - 1) * 3.2;
      // Two or three wires per crossing, at slightly different heights.
      for (let k = 0; k < rng.int(2, 3); k++) {
        const y = Math.min(hA, hB) - rng.range(0.4, 2.6) - k * 0.25;
        if (y < 4.2) continue;
        const off = rng.range(-1.6, 1.6);
        const pa = alongX
          ? new Vector3(aa + off, y, A.z0 > c ? A.z0 : A.z1)
          : new Vector3(A.x0 > c ? A.x0 : A.x1, y, aa + off);
        const pb = alongX
          ? new Vector3(aa + off + rng.range(-1.2, 1.2), y - rng.range(0, 0.5), Bb.z0 > c ? Bb.z0 : Bb.z1)
          : new Vector3(Bb.x0 > c ? Bb.x0 : Bb.x1, y - rng.range(0, 0.5), aa + off + rng.range(-1.2, 1.2));
        wire(kit, pa, pb, rng.range(0.5, 1.4), rng.range(0.012, 0.022));
      }
    }
    // And a few running along the street, shop to shop.
    const side = rng.next() < 0.5 ? west : east;
    for (let i = 1; i < side.length; i++) {
      if (rng.next() < 0.45) continue;
      const A = side[i - 1]!, Bb = side[i]!;
      const y = 3.9 + Math.min(A.floors, Bb.floors) * 3.2 - rng.range(1.2, 3.0);
      if (y < 4.2) continue;
      const pa = alongX ? new Vector3((A.x0 + A.x1) / 2, y, A.z0 > c ? A.z0 : A.z1) : new Vector3(A.x0 > c ? A.x0 : A.x1, y, (A.z0 + A.z1) / 2);
      const pb = alongX ? new Vector3((Bb.x0 + Bb.x1) / 2, y, Bb.z0 > c ? Bb.z0 : Bb.z1) : new Vector3(Bb.x0 > c ? Bb.x0 : Bb.x1, y, (Bb.z0 + Bb.z1) / 2);
      wire(kit, pa, pb, rng.range(0.3, 0.9), 0.014);
    }
  }
}

/** Ludhiana's Ghanta Ghar: red brick, four turrets, arches and a cupola. */
function ludhianaTower(kit: Kit, hx: number, hz: number, red: RGB, cream: RGB): void {
  const H = 24;
  // Stepped plinth.
  kit.g("plaster").boxMinMax(-5, 0, -5, 5, 1.1, 5, cream);
  kit.g("brick").boxMinMax(-4.2, 1.1, -4.2, 4.2, 2.0, 4.2, [1, 1, 1]);
  kit.collide(0, 1, 0, 10, 2.0, 10);
  // Shaft, banded in cream every storey.
  kit.g("brick").boxMinMax(-2.7, 2.0, -2.7, 2.7, H - 5, 2.7, [1, 1, 1]);
  kit.collide(0, H / 2, 0, 5.4, H - 4, 5.4);
  for (let y = 5.2; y < H - 6; y += 4.2) {
    kit.g("plaster").boxMinMax(-2.85, y, -2.85, 2.85, y + 0.35, 2.85, cream);
    // Arched openings on each face, two per band.
    for (let i = 0; i < 4; i++) {
      const a = (i * Math.PI) / 2, fx = Math.sin(a) * 2.72, fz = Math.cos(a) * 2.72;
      const saved = kit.toWorld(0, 0, 0), rot = kit.currentRotY();
      kit.frame(saved.x + fx, saved.z + fz, a);
      for (const u of [-1.1, 1.1]) {
        kit.g("dark").boxMinMax(u - 0.42, y + 0.9, -0.02, u + 0.42, y + 2.5, 0.04, [1, 1, 1], 0b000010);
        kit.g("plaster").ellipsoid(u, y + 2.5, 0.01, 0.42, 0.42, 0.03, 10, 5, cream, 0, 1);
      }
      kit.frame(saved.x, saved.z, rot);
    }
  }
  // Balcony under the clock stage.
  kit.g("plaster").boxMinMax(-3.6, H - 5.4, -3.6, 3.6, H - 5.0, 3.6, cream);
  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI) / 2, fx = Math.sin(a) * 3.5, fz = Math.cos(a) * 3.5;
    const saved = kit.toWorld(0, 0, 0), rot = kit.currentRotY();
    kit.frame(saved.x + fx, saved.z + fz, a);
    for (let u = -3.2; u <= 3.21; u += 0.45) kit.g("plaster").boxMinMax(u - 0.06, H - 5.0, -0.06, u + 0.06, H - 4.2, 0.06, cream);
    kit.frame(saved.x, saved.z, rot);
  }
  // Clock stage and four faces.
  kit.g("brick").boxMinMax(-2.95, H - 5.0, -2.95, 2.95, H - 1.2, 2.95, [1, 1, 1]);
  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI) / 2, fx = Math.sin(a) * 2.98, fz = Math.cos(a) * 2.98;
    const saved = kit.toWorld(0, 0, 0), rot = kit.currentRotY();
    kit.frame(saved.x + fx, saved.z + fz, a);
    kit.g("emissive").cylinderZ(0, H - 3.1, 0.02, 1.25, 0.06, 24, rgb("#fbf6e9"));
    kit.g("paint").cylinderZ(0, H - 3.1, 0.05, 1.32, 0.03, 24, rgb("#4e342e"));
    kit.g("paint").boxMinMax(-0.05, H - 3.1, 0.07, 0.05, H - 2.15, 0.1, IRON);
    kit.g("paint").boxMinMax(-0.05, H - 3.16, 0.07, 0.68, H - 3.04, 0.1, IRON);
    kit.frame(saved.x, saved.z, rot);
  }
  // Cornice, dome and finial.
  kit.g("plaster").boxMinMax(-3.3, H - 1.2, -3.3, 3.3, H - 0.7, 3.3, cream);
  kit.g("plaster").ellipsoid(0, H - 0.7, 0, 2.5, 2.6, 2.5, 14, 7, cream, 0, 1);
  kit.g("metal").cylinder(0, H + 1.9, 0, 0.09, 0.02, 1.9, 6, rgb("#c9a227"));
  // Corner turrets with their own little domes.
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
    const x = sx * 3.1, z = sz * 3.1;
    kit.g("brick").cylinder(x, 2.0, z, 0.62, 0.62, H - 8.5, 10, [1, 1, 1]);
    kit.g("plaster").cylinder(x, H - 6.5, z, 0.78, 0.7, 0.4, 10, cream);
    kit.g("plaster").ellipsoid(x, H - 6.1, z, 0.72, 0.8, 0.72, 10, 5, red, 0, 1);
  }
  // Benches round the base, and the board.
  for (const [x, z] of [[-hx + 3, -hz + 3], [hx - 3, -hz + 3], [-hx + 3, hz - 3], [hx - 3, hz - 3]] as const) {
    kit.g("wood").boxMinMax(x - 1.2, 0.45, z - 0.3, x + 1.2, 0.55, z + 0.3, rgb("#7a5536"));
  }
  kit.frame(kit.toWorld(0, 0, 0).x, kit.toWorld(0, 0, 0).z - 5.05, Math.PI);
  kit.sign("ghantaGhar", 0, 0.6, 0, 2.8);
}

/** A small heap of half-bricks at the kerb: scenery you can pick a weapon off. */
function brickPile(kit: Kit, x: number, z: number): void {
  const rng = new Rng(Math.round(Math.abs(x) * 31 + Math.abs(z) * 7) + 1);
  const g = kit.g("brick");
  for (let i = 0; i < 9; i++) {
    const row = Math.floor(i / 3);
    const a = rng.range(0, Math.PI);
    const bx = x + rng.range(-0.55, 0.55), bz = z + rng.range(-0.55, 0.55);
    const y = row * 0.075 + 0.037;
    const w = 0.115, l = 0.24, h = 0.07;
    const ca = Math.cos(a), sa = Math.sin(a);
    g.boxMinMax(bx - (l * ca + w * sa) / 2, y - h / 2, bz - (l * sa + w * ca) / 2,
      bx + (l * ca + w * sa) / 2, y + h / 2, bz + (l * sa + w * ca) / 2, [1, 1, 1]);
  }
}

function rehri(kit: Kit, x: number, z: number, yaw: number, goods: string): void {
  kit.frame(x, z, yaw);
  const rng = new Rng(Math.round(x * 7 + z * 13));
  const wood = rgb("#7a5230"), bed = rgb("#9c6b3c");
  kit.g("wood").boxMinMax(-1.05, 0.78, -0.5, 1.05, 0.86, 0.5, bed);
  kit.g("wood").boxMinMax(-1.05, 0.86, -0.5, 1.05, 0.96, -0.46, wood);
  kit.g("wood").boxMinMax(-1.05, 0.86, 0.46, 1.05, 0.96, 0.5, wood);
  for (const sx of [-1, 1]) {
    kit.g("rubber").cylinderX(sx * 0.62, 0.36, 0.56, 0.36, 0.05, 14, [0.12, 0.12, 0.12]);
    kit.g("rubber").cylinderX(sx * 0.62, 0.36, -0.56, 0.36, 0.05, 14, [0.12, 0.12, 0.12]);
    kit.g("metal").boxMinMax(sx * 0.62 - 0.02, 0.34, -0.58, sx * 0.62 + 0.02, 0.8, 0.58, [0.2, 0.2, 0.2]);
  }
  // Push handles at one end.
  for (const sz of [-0.38, 0.38]) kit.g("wood").boxMinMax(1.05, 0.82, sz - 0.03, 1.75, 0.86, sz + 0.03, wood);
  if (goods === "chaat") {
    // Gol gappe: a glass box and a big steel pot of jaljeera.
    kit.g("glass").boxMinMax(-0.9, 0.96, -0.35, -0.1, 1.45, 0.35, [1, 1, 1], 0b000010);
    for (let i = 0; i < 10; i++) kit.g("matte").ellipsoid(-0.75 + (i % 5) * 0.15, 1.02, -0.15 + Math.floor(i / 5) * 0.25, 0.07, 0.06, 0.07, 6, 4, rgb("#d9a352"));
    kit.g("chrome").cylinder(0.45, 0.96, 0, 0.28, 0.24, 0.42, 14, rgb("#c9ccce"));
  } else if (goods === "ganna") {
    // Ganne da ras: a crusher wheel and a bundle of cane.
    kit.g("metal").cylinder(-0.4, 0.96, 0, 0.32, 0.32, 0.5, 14, rgb("#4e5b4a"));
    kit.g("metal").cylinderX(-0.4, 1.7, 0, 0.35, 0.04, 16, rgb("#2e2e2e"));
    for (let i = 0; i < 6; i++) kit.g("leaf").boxMinMax(0.1 + i * 0.12, 0.96, -0.3, 0.18 + i * 0.12, 1.0 + 0.04, 0.4, rgb(i % 2 ? "#7c8a3e" : "#94a04f"));
  } else {
    // Heaps of sabzi or fruit in rows.
    const cols = goods === "fruit" ? ["#f39c12", "#f6d743", "#c0392b", "#7cb342"] : ["#c0392b", "#8e6d4a", "#7cb342", "#ecf0f1", "#6a1b9a"];
    for (let i = 0; i < 8; i++) {
      const c = rgb(cols[i % cols.length]!);
      kit.g("matte").ellipsoid(-0.75 + (i % 4) * 0.5, 0.96, -0.2 + Math.floor(i / 4) * 0.42, 0.24, 0.16 + rng.next() * 0.06, 0.18, 8, 4, c, 0, 1);
    }
    kit.g("metal").cylinder(0.85, 0.96, -0.3, 0.02, 0.02, 0.5, 6, [0.2, 0.2, 0.2]);
    kit.g("metal").boxMinMax(0.7, 1.45, -0.42, 1.0, 1.47, -0.18, [0.3, 0.3, 0.3]);
  }
  // A faded umbrella on half of them.
  if (rng.next() < 0.5) {
    kit.g("metal").cylinder(-0.95, 0.96, -0.42, 0.02, 0.02, 1.25, 6, [0.25, 0.25, 0.25]);
    kit.g("fabric").ellipsoid(-0.95, 2.18, -0.42, 0.95, 0.22, 0.95, 10, 4, rgb(rng.pick(["#1565c0", "#c62828", "#2e7d32", "#f9a825"])), 0, 1);
  }
  kit.collide(0.3, 0.6, 0, 2.6, 1.2, 1.1);
  kit.world();
}

function truckProp(kit: Kit, x: number, z: number, rot: number): void {
  const saved = kit.toWorld(0, 0, 0);
  const prev = kit.currentRotY();
  kit.frame(saved.x + x * Math.cos(prev) + z * Math.sin(prev), saved.z - x * Math.sin(prev) + z * Math.cos(prev), prev + rot);
  const body = rgb("#d35400"), cab = rgb("#f2c230");
  kit.g("paint").boxMinMax(-1.25, 1.1, -5.5, 1.25, 3.6, 1.0, body);
  for (let i = 0; i < 5; i++) kit.g("paint").boxMinMax(-1.27, 1.4 + i * 0.4, -5.3, -1.25, 1.6 + i * 0.4, 0.8, i % 2 ? rgb("#1e88e5") : rgb("#c62828"), 0b010000);
  kit.g("paint").boxMinMax(-1.2, 1.0, 1.0, 1.2, 3.1, 3.2, cab);
  kit.g("glass").boxMinMax(-1.1, 2.1, 3.2, 1.1, 2.9, 3.25, [1, 1, 1], 0b000010);
  kit.g("paint").boxMinMax(-1.3, 0.6, 3.1, 1.3, 1.1, 3.35, rgb("#9e9e9e"));
  kit.sign("hornOk", 0, 2.3, -5.52 - 0.0, 2.2);
  for (const zz of [-4.3, -3.0, 2.2]) for (const s of [-1, 1]) kit.g("rubber").cylinderX(s * 1.15, 0.55, zz, 0.55, 0.4, 12, [1, 1, 1]);
  kit.collide(0, 1.8, -2.1, 2.6, 3.6, 7.4);
  kit.frame(saved.x, saved.z, prev);
}

function petrol(kit: Kit, hx: number, hz: number): void {
  paving(kit, hx, hz, "concrete", rgb("#cfcac0"));
  const h = 5.6;
  for (const [x, z] of [[-10, -4], [10, -4], [-10, 6], [10, 6]] as const) { kit.solid("paint", x, h / 2, z, 0.5, h, 0.5, rgb("#f0f0f0")); }
  kit.g("paint").boxMinMax(-14, h, -7, 14, h + 1.0, 9, rgb("#1b8a5a"));
  kit.g("paint").boxMinMax(-14.02, h + 0.2, -7.02, 14.02, h + 0.5, 9.02, rgb("#f6d743"), 0b110011);
  kit.g("emissive").boxMinMax(-12, h - 0.02, -5, 12, h, 7, rgb("#f6f2e6"), 0b000100);
  for (const x of [-5, 5]) {
    kit.g("concrete").boxMinMax(x - 1.5, 0, -0.6, x + 1.5, 0.25, 2.6, CONC);
    for (const z of [0.3, 1.7]) { kit.g("paint").boxMinMax(x - 0.45, 0.25, z - 0.3, x + 0.45, 1.9, z + 0.3, rgb("#e53935")); kit.g("dark").boxMinMax(x - 0.3, 1.2, z + 0.3, x + 0.3, 1.6, z + 0.31, [1, 1, 1], 0b000010); }
    kit.collide(x, 0.9, 1.0, 3.0, 1.9, 3.2);
  }
  kit.g("plaster").boxMinMax(-hx + 2, 0, -hz + 1, -hx + 12, 3.2, -hz + 7, rgb("#f3efe6"));
  kit.collide(-hx + 7, 1.6, -hz + 4, 10, 3.2, 6);
  kit.g("metal").boxMinMax(hx - 3.2, 0, hz - 2.2, hx - 2.8, 6, hz - 1.8, IRON);
  kit.collide(hx - 3, 3, hz - 2, 0.5, 6, 0.5);
  kit.sign("petrol", hx - 3, 6.6, hz - 1.75, 3.2);
}

function busAdda(kit: Kit, hx: number, hz: number, rng: Rng): void {
  paving(kit, hx, hz, "concrete", rgb("#bdb7ab"));
  // Long platform with a shelter along the north side.
  kit.g("concrete").boxMinMax(-hx + 4, 0, hz - 12, hx - 4, 0.3, hz - 6, rgb("#c9c2b3"));
  kit.collide(0, 0.15, hz - 9, hx * 2 - 8, 0.3, 6);
  shed(kit, -hx + 5, hz - 11.5, hx - 5, hz - 6.5, 3.6, rgb("#c0392b"));
  for (let x = -hx + 8; x < hx - 8; x += 6) { kit.g("wood").boxMinMax(x, 0.75, hz - 10.5, x + 3, 0.85, hz - 9.9, rgb("#7a5536")); }
  kit.g("plaster").boxMinMax(hx - 16, 0, hz - 5, hx - 6, 3.4, hz - 1, rgb("#f0e2c4"));
  kit.collide(hx - 11, 1.7, hz - 3, 10, 3.4, 4);
  kit.sign("busAdda", hx - 11, 3.9, hz - 0.95, 6);
  // Parked buses in bays.
  for (let i = 0; i < 3; i++) busProp(kit, -hx + 14 + i * 16, -6 + rng.range(-1, 1), rng);
}

/** A roadside bus shelter: steel posts, a tin roof, a back screen and a bench, open to the road. */
function busShelter(kit: Kit, at: { x: number; z: number; yaw: number }): void {
  kit.frame(at.x, at.z, at.yaw);
  const STEEL = rgb("#5f6b73"), ROOF = rgb("#2f6f9f"), BENCH = rgb("#8a9399");
  kit.g("concrete").boxMinMax(-2.3, 0, -1.0, 2.3, 0.15, 0.9, rgb("#b8b2a6"));
  for (const x of [-2.1, 2.1]) for (const z of [-0.8, 0.6]) kit.g("metal").boxMinMax(x - 0.05, 0.15, z - 0.05, x + 0.05, 2.65, z + 0.05, STEEL);
  // Tin roof sloping back, with a deep fascia board in front.
  kit.g("metal").boxMinMax(-2.4, 2.65, -1.1, 2.4, 2.72, 0.95, ROOF);
  kit.g("paint").boxMinMax(-2.4, 2.55, 0.92, 2.4, 2.95, 0.98, rgb("#f2c230"));
  kit.g("dark").boxMinMax(-1.0, 2.62, 0.98, 1.0, 2.88, 0.99, rgb("#1f3b57"));
  // Back screen and a steel bench.
  kit.g("metal").boxMinMax(-2.1, 0.5, -0.86, 2.1, 2.2, -0.8, rgb("#9fb3bf"));
  kit.g("metal").boxMinMax(-1.8, 0.45, -0.75, 1.8, 0.5, -0.3, BENCH);
  for (const x of [-1.6, 0, 1.6]) kit.g("metal").boxMinMax(x - 0.03, 0.15, -0.55, x + 0.03, 0.45, -0.5, STEEL);
  kit.collide(0, 1.3, -0.83, 4.3, 2.2, 0.15);
  kit.collide(0, 0.32, -0.52, 3.6, 0.35, 0.5);
  for (const x of [-2.1, 2.1]) kit.collide(x, 1.4, 0.6, 0.12, 2.5, 0.12);
  kit.world();
}

function busProp(kit: Kit, x: number, z: number, rng: Rng): void {
  const c = rng.pick([rgb("#1565c0"), rgb("#2e7d32"), rgb("#c62828")]);
  kit.g("paint").boxMinMax(x - 1.3, 0.5, z - 5.5, x + 1.3, 3.2, z + 5.5, c);
  kit.g("paint").boxMinMax(x - 1.32, 1.1, z - 5.4, x + 1.32, 1.3, z + 5.4, rgb("#f5f5f5"), 0b110000);
  for (let k = -4; k <= 4; k += 1.6) for (const s of [-1, 1]) kit.g("glass").boxMinMax(x + s * 1.31 - 0.01, 1.8, z + k - 0.6, x + s * 1.31 + 0.01, 2.7, z + k + 0.6, [1, 1, 1], s > 0 ? 0b100000 : 0b010000);
  kit.g("glass").boxMinMax(x - 1.2, 1.7, z + 5.5, x + 1.2, 2.9, z + 5.52, [1, 1, 1], 0b000010);
  for (const zz of [-3.8, 3.6]) for (const s of [-1, 1]) kit.g("rubber").cylinderX(x + s * 1.2, 0.5, z + zz, 0.5, 0.35, 12, [1, 1, 1]);
  kit.collide(x, 1.8, z, 2.6, 3.4, 11);
}

/**
 * The clock tower. Ludhiana's is the taller, redder Indo-Saracenic one that
 * the whole city gives directions by — corner turrets, arched openings and a
 * balcony — so it does not read as the same tower as Nawan Shehar's.
 */
function ghantaGhar(kit: Kit, hx: number, hz: number, ludhiana = false): void {
  paving(kit, hx, hz, "paver", rgb("#d8c9ae"));
  const red = ludhiana ? rgb("#8d3b24") : rgb("#a2432f"), cream = rgb("#efe0bf");
  if (ludhiana) { ludhianaTower(kit, hx, hz, red, cream); return; }
  kit.g("plaster").boxMinMax(-4, 0, -4, 4, 1.0, 4, cream);
  kit.collide(0, 0.5, 0, 8, 1.0, 8);
  kit.g("brick").boxMinMax(-2.4, 1.0, -2.4, 2.4, 15, 2.4, [1, 1, 1]);
  kit.collide(0, 8, 0, 4.8, 14, 4.8);
  for (let y = 4; y < 15; y += 3.6) kit.g("plaster").boxMinMax(-2.55, y, -2.55, 2.55, y + 0.3, 2.55, cream);
  kit.g("plaster").boxMinMax(-2.9, 15, -2.9, 2.9, 17.6, 2.9, red);
  kit.g("plaster").ellipsoid(0, 17.6, 0, 2.6, 2.4, 2.6, 12, 6, cream, 0, 1);
  kit.g("metal").cylinder(0, 19.9, 0, 0.08, 0.02, 1.6, 6, rgb("#c9a227"));
  // Four clock faces.
  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI) / 2;
    const fx = Math.sin(a) * 2.92, fz = Math.cos(a) * 2.92;
    const saved = kit.toWorld(0, 0, 0), rot = kit.currentRotY();
    kit.frame(saved.x + fx, saved.z + fz, a);
    kit.g("emissive").cylinderZ(0, 16.3, 0.02, 1.0, 0.05, 20, rgb("#fbf6e9"));
    kit.g("paint").boxMinMax(-0.04, 16.3, 0.06, 0.04, 17.05, 0.09, IRON);
    kit.g("paint").boxMinMax(-0.04, 16.25, 0.06, 0.55, 16.33, 0.09, IRON);
    kit.frame(saved.x, saved.z, rot);
  }
  for (const [x, z] of [[-hx + 3, -hz + 3], [hx - 3, -hz + 3], [-hx + 3, hz - 3], [hx - 3, hz - 3]] as const) {
    kit.g("wood").boxMinMax(x - 1.2, 0.45, z - 0.3, x + 1.2, 0.55, z + 0.3, rgb("#7a5536"));
  }
  kit.frame(kit.toWorld(0, 0, 0).x, kit.toWorld(0, 0, 0).z - 4.05, Math.PI);
  kit.sign("ghantaGhar", 0, 0.5, 0, 2.6);
}

function mandi(kit: Kit, hx: number, hz: number, rng: Rng): void {
  paving(kit, hx, hz, "concrete", rgb("#c3bba9"));
  shed(kit, -hx + 6, -6, hx - 6, 16, 6, rgb("#8d8d8d"));
  const jute = rgb("#c8a86b");
  for (let i = 0; i < 9; i++) {
    const x = -hx + 12 + (i % 3) * 22 + rng.range(-2, 2), z = -2 + Math.floor(i / 3) * 6;
    const n = rng.int(3, 5);
    for (let k = 0; k < n; k++) kit.g("fabric").boxMinMax(x - 3 + k * 0.3, k * 0.5, z - 1.5 + k * 0.2, x + 3 - k * 0.3, (k + 1) * 0.5, z + 1.5 - k * 0.2, shade(jute, rng.range(0.9, 1.1)));
    kit.collide(x, n * 0.25, z, 6, n * 0.5, 3);
  }
  // Grain heaps on tarpaulins.
  for (let i = 0; i < 3; i++) {
    const x = -hx + 15 + i * 25, z = -hz + 10;
    flat(kit.g("fabric"), x - 5, z - 4, x + 5, z + 4, 0.02, rgb("#2e5e9e"));
    kit.g("fabric").ellipsoid(x, 0, z, 4, 1.4, 3, 12, 6, rgb("#d6ae5a"), 0, 1);
    kit.collide(x, 0.5, z, 6, 1.0, 4);
  }
  kit.frame(kit.toWorld(0, 0, 0).x, kit.toWorld(0, 0, 0).z + hz - 1);
  kit.sign("mandi", 0, 6.8, 0.05, 6);
}

function park(kit: Kit, s: Site, hx: number, hz: number, rng: Rng): void {
  flat(kit.g("grass"), -hx, -hz, hx, hz, 0.012, rgb("#86a35a"));
  flat(kit.g("paver"), -1.5, -hz, 1.5, hz, 0.02, rgb("#d9c9a8"));
  flat(kit.g("paver"), -hx, -1.5, hx, 1.5, 0.021, rgb("#d9c9a8"));
  const wallC = rgb("#e9dfcb");
  for (const sd of [-1, 1]) {
    kit.g("plaster").boxMinMax(-hx, 0, sd * hz - 0.15, -2.5, 1.0, sd * hz + 0.15, wallC); kit.collide((-hx - 2.5) / 2, 0.5, sd * hz, hx - 2.5, 1.0, 0.3);
    kit.g("plaster").boxMinMax(2.5, 0, sd * hz - 0.15, hx, 1.0, sd * hz + 0.15, wallC); kit.collide((hx + 2.5) / 2, 0.5, sd * hz, hx - 2.5, 1.0, 0.3);
    kit.g("plaster").boxMinMax(sd * hx - 0.15, 0, -hz, sd * hx + 0.15, 1.0, -2.5, wallC); kit.collide(sd * hx, 0.5, (-hz - 2.5) / 2, 0.3, 1.0, hz - 2.5);
    kit.g("plaster").boxMinMax(sd * hx - 0.15, 0, 2.5, sd * hx + 0.15, 1.0, hz, wallC); kit.collide(sd * hx, 0.5, (hz + 2.5) / 2, 0.3, 1.0, hz - 2.5);
  }
  const cx = (s.x0 + s.x1) / 2, cz = (s.z0 + s.z1) / 2;
  for (let i = 0; i < 10; i++) {
    const x = cx + rng.range(-hx + 6, hx - 6), z = cz + rng.range(-hz + 6, hz - 6);
    if (Math.abs(x - cx) < 4 || Math.abs(z - cz) < 4) continue;
    tree(kit, x, z, 0, rng.next() < 0.5 ? "neem" : "peepal", s.seed * 10 + i, false);
  }
  kit.frame(cx, cz);
  for (const [x, z] of [[4, 6], [-4, -6], [6, -4], [-6, 4]] as const) kit.g("wood").boxMinMax(x - 1.1, 0.45, z - 0.3, x + 1.1, 0.55, z + 0.3, rgb("#5d4037"));
}

/** Boundary wall round a site with a gate gap on one side (local -Z = south, +Z = north). */
function siteWall(kit: Kit, hx: number, hz: number, gateSide: 1 | -1, gate: number, c: RGB): void {
  for (const sd of [-1, 1]) {
    kit.g("plaster").boxMinMax(sd * hx - 0.15, 0, -hz, sd * hx + 0.15, 1.8, hz, c, 0b111011);
    kit.collide(sd * hx, 0.9, 0, 0.3, 1.8, hz * 2);
    if (sd === gateSide) {
      for (const s2 of [-1, 1]) {
        const a = s2 < 0 ? -hx : gate / 2, b = s2 < 0 ? -gate / 2 : hx;
        kit.g("plaster").boxMinMax(a, 0, sd * hz - 0.15, b, 1.8, sd * hz + 0.15, c, 0b111011);
        kit.collide((a + b) / 2, 0.9, sd * hz, b - a, 1.8, 0.3);
      }
    } else {
      kit.g("plaster").boxMinMax(-hx, 0, sd * hz - 0.15, hx, 1.8, sd * hz + 0.15, c, 0b111011);
      kit.collide(0, 0.9, sd * hz, hx * 2, 1.8, 0.3);
    }
  }
}

/**
 * Government school: a two-storey L of classrooms with a verandah, the
 * assembly ground with the flag, a mid-day-meal shed and the gate on the
 * canal road.
 */
function school(kit: Kit, hx: number, hz: number, rng: Rng): void {
  flat(kit.g("dirt"), -hx, -hz, hx, hz, 0.008, rgb("#c2a978"));
  siteWall(kit, hx, hz, -1, 6, rgb("#e7d7b4"));
  const wall = rgb("#e9c98a"), band = rgb("#8d3b2a");
  // Classroom block along the north wall, wing down the west side.
  for (const [x0, z0, x1, z1] of [[-hx + 3, hz - 13, hx - 3, hz - 3], [-hx + 3, -hz + 10, -hx + 13, hz - 13]] as const) {
    kit.g("plaster").boxMinMax(x0, 0, z0, x1, 7.2, z1, wall, 0b111011);
    kit.collide((x0 + x1) / 2, 3.6, (z0 + z1) / 2, x1 - x0, 7.2, z1 - z0);
    for (const y of [3.4, 7.0]) kit.g("paint").boxMinMax(x0 - 0.05, y, z0 - 0.05, x1 + 0.05, y + 0.25, z1 + 0.05, band, 0b111011);
  }
  // Doors and windows on the courtyard faces.
  for (let x = -hx + 16; x < hx - 5; x += 5) for (const y of [0, 3.6]) {
    kit.g("dark").boxMinMax(x, y + 0.9, hz - 13.02, x + 1.6, y + 2.4, hz - 13, [1, 1, 1], 0b000001);
    kit.g("paint").boxMinMax(x + 2.2, y, hz - 13.02, x + 3.3, y + 2.3, hz - 13, rgb("#2e5d8a"), 0b000001);
  }
  for (let z = -hz + 13; z < hz - 16; z += 5) for (const y of [0, 3.6]) kit.g("dark").boxMinMax(-hx + 13, y + 0.9, z, -hx + 13.02, y + 2.4, z + 1.6, [1, 1, 1], 0b100000);
  kit.sign("school", 6, 5.3, hz - 12.9, 12);
  kit.frame(kit.toWorld(0, 0, 0).x, kit.toWorld(0, 0, 0).z, Math.PI);
  kit.sign("school", 0, 2.6, hz + 0.2, 7);
  kit.frame(kit.toWorld(0, 0, 0).x, kit.toWorld(0, 0, 0).z, 0);
  // Flag on a whitewashed plinth in the assembly ground.
  kit.g("plaster").boxMinMax(4, 0, -2, 7, 0.7, 1, WHITE);
  kit.collide(5.5, 0.35, -0.5, 3, 0.7, 3);
  kit.g("metal").cylinder(5.5, 0.7, -0.5, 0.06, 0.05, 8, 6, rgb("#d0d0d0"));
  kit.collide(5.5, 4.5, -0.5, 0.2, 8, 0.2);
  for (const [c, i] of [["#ff9933", 0], ["#ffffff", 1], ["#138808", 2]] as const) kit.g("cloth").boxMinMax(5.56, 8.1 - i * 0.4, -0.5, 7.9, 8.5 - i * 0.4, -0.47, rgb(c));
  // Mid-day-meal shed with the big degchi.
  shed(kit, hx - 14, -hz + 4, hx - 4, -hz + 11, 2.8, rgb("#9e9e9e"));
  kit.g("metal").cylinder(hx - 9, 0, -hz + 7.5, 0.7, 0.6, 0.8, 12, rgb("#9a9a9a"));
  kit.collide(hx - 9, 0.4, -hz + 7.5, 1.4, 0.8, 1.4);
  for (let i = 0; i < 4; i++) decor0(kit, rng, -hx + 18 + i * 12, -hz + 3);
}

/** A neem sapling in a brick tree-guard, for school grounds and compounds. */
function decor0(kit: Kit, rng: Rng, x: number, z: number): void {
  kit.g("brick").cylinder(x, 0, z, 0.7, 0.7, 0.9, 8, [1, 1, 1], false);
  kit.g("wood").cylinder(x, 0, z, 0.08, 0.06, 2.4, 5, rgb("#6b5a48"));
  kit.g("leaf").ellipsoid(x, 2.8, z, 1.1, 0.9, 1.1, 7, 4, shade(rgb("#5f8a3a"), rng.range(0.9, 1.1)));
  kit.collide(x, 0.45, z, 1.4, 0.9, 1.4);
}

/**
 * Civil hospital: a long white block with the red band and cross, the
 * emergency porch on the G.T. Road side, an ambulance at it, and the
 * benches outside OPD where everybody waits.
 */
function hospital(kit: Kit, hx: number, hz: number): void {
  paving(kit, hx, hz, "concrete", rgb("#c9c3b6"));
  siteWall(kit, hx, hz, 1, 10, rgb("#ececec"));
  const white = rgb("#f2f0ea"), red = rgb("#c62828");
  kit.g("plaster").boxMinMax(-hx + 4, 0, -hz + 4, hx - 4, 10.5, -hz + 22, white, 0b111011);
  kit.collide(0, 5.25, -hz + 13, hx * 2 - 8, 10.5, 18);
  for (const y of [3.4, 6.9]) kit.g("paint").boxMinMax(-hx + 3.95, y, -hz + 3.95, hx - 3.95, y + 0.3, -hz + 22.05, red, 0b111011);
  for (let x = -hx + 7; x < hx - 6; x += 4) for (const y of [0.9, 4.3, 7.8]) kit.g("glass").boxMinMax(x, y, -hz + 22, x + 1.8, y + 1.6, -hz + 22.03, [1, 1, 1], 0b000010);
  // Emergency porch on two pillars, facing the road.
  kit.g("concrete").boxMinMax(-6, 3.4, -hz + 22, 6, 3.7, -hz + 28, white);
  for (const x of [-5.6, 5.6]) { kit.g("plaster").boxMinMax(x - 0.25, 0, -hz + 27.5, x + 0.25, 3.4, -hz + 28, white); kit.collide(x, 1.7, -hz + 27.75, 0.5, 3.4, 0.5); }
  kit.g("dark").boxMinMax(-2, 0, -hz + 22, 2, 2.6, -hz + 22.03, [1, 1, 1], 0b000010);
  kit.sign("hospital", 0, 5.2, -hz + 22.05, 9);
  kit.g("emissive").boxMinMax(-0.9, 9.2, -hz + 22, 0.9, 9.5, -hz + 22.1, red);
  kit.g("emissive").boxMinMax(-0.15, 8.5, -hz + 22, 0.15, 10.2, -hz + 22.1, red);
  // Ambulance: white van with the red stripe.
  kit.g("paint").boxMinMax(8, 0.4, -hz + 24, 10.1, 2.6, -hz + 29.5, white);
  kit.g("paint").boxMinMax(7.98, 1.3, -hz + 24, 10.12, 1.6, -hz + 29.5, red, 0b110000);
  kit.g("dark").boxMinMax(8.1, 1.7, -hz + 29.5, 10, 2.4, -hz + 29.52, [1, 1, 1], 0b000010);
  for (const z of [-hz + 25, -hz + 28.5]) for (const x of [7.9, 10.2]) kit.g("rubber").boxMinMax(x - 0.12, 0, z - 0.4, x + 0.12, 0.8, z + 0.4, rgb("#1a1a1a"));
  kit.collide(9.05, 1.5, -hz + 26.75, 2.1, 2.6, 5.5);
  // OPD benches.
  for (let i = 0; i < 4; i++) { kit.g("metal").boxMinMax(-hx + 8 + i * 4, 0.42, -hz + 23, -hx + 10.8 + i * 4, 0.48, -hz + 23.5, rgb("#455a64")); }
}

/** Two swings and a slide in a colony park, by the south gate. */
function swings(kit: Kit, hx: number, hz: number): void {
  const pole = rgb("#c62828"), seat = rgb("#f9a825");
  for (const x of [-hx + 6, -hx + 11]) {
    const z = -hz + 6;
    for (const s of [-1, 1]) {
      kit.g("metal").tube(new Vector3(x + s * 1.3, 0, z - 0.8), new Vector3(x + s * 1.3, 2.6, z), 0.05, 5, pole);
      kit.g("metal").tube(new Vector3(x + s * 1.3, 0, z + 0.8), new Vector3(x + s * 1.3, 2.6, z), 0.05, 5, pole);
    }
    kit.g("metal").boxMinMax(x - 1.35, 2.55, z - 0.05, x + 1.35, 2.65, z + 0.05, pole);
    for (const s of [-0.3, 0.3]) kit.g("metal").boxMinMax(x + s - 0.01, 0.5, z - 0.01, x + s + 0.01, 2.55, z + 0.01, IRON);
    kit.g("wood").boxMinMax(x - 0.35, 0.45, z - 0.15, x + 0.35, 0.5, z + 0.15, seat);
    kit.collide(x, 1.3, z, 2.8, 2.6, 0.3);
  }
  const sx = hx - 8, sz = -hz + 6;
  kit.g("metal").boxMinMax(sx - 0.5, 0, sz - 2.2, sx + 0.5, 1.9, sz - 1.8, rgb("#1565c0"));
  kit.g("paint").quad(new Vector3(sx - 0.45, 1.9, sz - 1.8), new Vector3(sx + 0.45, 1.9, sz - 1.8), new Vector3(sx + 0.45, 0.1, sz + 1.8), new Vector3(sx - 0.45, 0.1, sz + 1.8), rgb("#fbc02d"));
  kit.collide(sx, 0.9, sz, 1, 1.9, 4);
}

/**
 * A village toba: a green-brown pond with a trampled mud rim, a brick ghat
 * where the buffaloes go in, reeds, and the old peepal leaning over it.
 */
function toba(kit: Kit, s: Site, hx: number, hz: number, rng: Rng, decor: CountryDecor): void {
  flat(kit.g("dirt"), -hx, -hz, hx, hz, 0.006, rgb("#9c8664"));
  const rx = hx - 6, rz = hz - 5;
  kit.g("dirt").cylinder(0, 0.004, 0, rx + 2.5, rx + 2.5, 0.006, 28, rgb("#6e5a40"), true, (rz + 2.5) / (rx + 2.5));
  kit.g("water").cylinder(0, 0.012, 0, rx, rx, 0.006, 28, rgb("#5f6f4a"), true, rz / rx);
  kit.g("brick").boxMinMax(-3, 0, -rz - 2.5, 3, 0.25, -rz + 0.5, [1, 1, 1]);
  kit.g("brick").boxMinMax(-3, 0, -rz - 4, 3, 0.45, -rz - 2.5, [1, 1, 1]);
  kit.collide(0, 0.22, -rz - 3.2, 6, 0.45, 1.5);
  for (let i = 0; i < 36; i++) {
    const a = rng.range(0, Math.PI * 2);
    if (Math.abs(a - Math.PI * 1.5) < 0.4) continue;
    const x = Math.cos(a) * (rx + rng.range(-0.8, 0.6)), z = Math.sin(a) * (rz + rng.range(-0.8, 0.6));
    kit.g("leaf").boxMinMax(x - 0.04, 0, z - 0.04, x + 0.04, rng.range(0.7, 1.4), z + 0.04, rgb("#6f8a3e"), 0b111011);
  }
  const cx = (s.x0 + s.x1) / 2, cz = (s.z0 + s.z1) / 2;
  tree(kit, cx + rx + 3, cz + rz, 0, "peepal", s.seed * 7, true);
  decor.addTree(kit, "kikar", cx - rx - 2, cz + rz - 2, 1.1, 1);
  decor.addTree(kit, "kikar", cx - rx, cz - rz - 1, 0.9, 2);
}

function thana(kit: Kit, hx: number, hz: number): void {
  paving(kit, hx, hz, "concrete", rgb("#c8c2b6"));
  kit.g("plaster").boxMinMax(-hx + 2, 0, -hz + 2, hx - 2, 4, -hz + 12, rgb("#d7c7a6"));
  kit.g("plaster").boxMinMax(-hx + 2, 0.0, -hz + 11.95, hx - 2, 0.8, -hz + 12.05, rgb("#c0392b"), 0b000010);
  kit.collide(0, 2, -hz + 7, hx * 2 - 4, 4, 10);
  kit.g("dark").boxMinMax(-1, 0, -hz + 12, 1, 2.4, -hz + 12.02, [1, 1, 1], 0b000010);
  kit.sign("thana", 0, 3.2, -hz + 12.1, 5);
  // Striped barricades.
  for (const x of [-6, 6]) {
    for (let k = 0; k < 3; k++) kit.g("paint").boxMinMax(x - 1.2, 0.3 + k * 0.25, hz - 3, x + 1.2, 0.45 + k * 0.25, hz - 2.9, k % 2 ? rgb("#f5f5f5") : rgb("#c62828"));
    kit.collide(x, 0.5, hz - 2.95, 2.4, 1.0, 0.3);
  }
}

function cinema(kit: Kit, hx: number, hz: number): void {
  paving(kit, hx, hz, "paver", rgb("#d3c4a6"));
  kit.g("plaster").boxMinMax(-hx + 2, 0, -hz + 2, hx - 2, 11, hz - 8, rgb("#e8d9b8"));
  kit.collide(0, 5.5, -3, hx * 2 - 4, 11, hz * 2 - 10);
  kit.g("paint").boxMinMax(-hx + 3, 3.5, hz - 8, hx - 3, 9.5, hz - 7.85, rgb("#202020"));
  kit.sign("cinemaPoster", 0, 6.5, hz - 7.8, 13);
  kit.g("emissive").boxMinMax(-hx + 3, 9.8, hz - 8.2, hx - 3, 10.6, hz - 7.8, rgb("#ffcf5a"));
  kit.g("dark").boxMinMax(-3, 0, hz - 8, 3, 3, hz - 7.98, [1, 1, 1], 0b000010);
}

function akhada(kit: Kit, s: Site, hx: number, hz: number, rng: Rng): void {
  // Soft-earth pit with a low raised border; spectators gather around it.
  flat(kit.g("dirt"), -hx, -hz, hx, hz, 0.005, rgb("#a8906a"));
  const R = 7;
  kit.g("dirt").cylinder(0, -0.02, 0, R, R, 0.05, 28, rgb("#7d5f45"), true);
  kit.g("plaster").torus(0, 0.15, 0, R + 0.25, 0.2, 32, 4, rgb("#e5d5b5"));
  kit.g("plaster").cylinder(R + 3, 0, -R, 0.4, 0.35, 1.2, 8, rgb("#f0e6d2"));
  kit.g("metal").cylinder(R + 3, 1.2, -R, 0.05, 0.05, 2.5, 6, rgb("#c9a227"));
  kit.collide(R + 3, 0.6, -R, 0.8, 1.2, 0.8);
  const cx = (s.x0 + s.x1) / 2, cz = (s.z0 + s.z1) / 2;
  tree(kit, cx - hx + 3, cz + hz - 3, 0, "peepal", 4141, true);
  kit.frame(cx, cz);
  for (let i = 0; i < 4; i++) charpai(kit, -R - 3.5, -6 + i * 4, 0, Math.PI / 2 + rng.range(-0.1, 0.1));
  kit.frame(cx, cz - hz + 0.5);
  kit.g("metal").boxMinMax(-2, 0, -0.1, -1.8, 3, 0.1, IRON);
  kit.g("metal").boxMinMax(1.8, 0, -0.1, 2, 3, 0.1, IRON);
  kit.sign("akhada", 0, 2.6, 0.12, 3.6);
}

function gurdwara(kit: Kit, hx: number, hz: number): void {
  paving(kit, hx, hz, "paver", rgb("#ece6da"));
  const white = rgb("#f6f4ee"), gold = rgb("#d9b44a");
  // Boundary wall with an entrance on the south (street) side.
  for (const sd of [-1, 1]) {
    kit.g("plaster").boxMinMax(-hx, 0, sd * hz - 0.2, sd < 0 ? -3 : hx, 1.6, sd * hz + 0.2, white);
    if (sd < 0) { kit.g("plaster").boxMinMax(3, 0, -hz - 0.2, hx, 1.6, -hz + 0.2, white); kit.collide((hx + 3) / 2, 0.8, -hz, hx - 3, 1.6, 0.4); kit.collide((-hx - 3) / 2, 0.8, -hz, hx - 3, 1.6, 0.4); }
    else kit.collide(0, 0.8, hz, hx * 2, 1.6, 0.4);
    kit.g("plaster").boxMinMax(sd * hx - 0.2, 0, -hz, sd * hx + 0.2, 1.6, hz, white);
    kit.collide(sd * hx, 0.8, 0, 0.4, 1.6, hz * 2);
  }
  kit.g("plaster").boxMinMax(-3.2, 1.6, -hz - 0.3, 3.2, 4.2, -hz + 0.3, white);
  kit.g("plaster").ellipsoid(0, 4.2, -hz, 1.2, 1.0, 0.6, 10, 5, gold, 0, 1);
  // Main hall on a plinth with a central dome and corner kiosks.
  kit.g("plaster").boxMinMax(-12, 0, -2, 12, 1.0, 18, white);
  kit.collide(0, 0.5, 8, 24, 1.0, 20);
  kit.g("plaster").boxMinMax(-10, 1.0, 0, 10, 7.5, 16, white);
  kit.collide(0, 4.2, 8, 20, 6.5, 16);
  for (let x = -8; x <= 8; x += 4) kit.g("dark").boxMinMax(x - 0.8, 1.6, -0.02, x + 0.8, 4.6, 0, [1, 1, 1], 0b000001);
  kit.g("plaster").boxMinMax(-4, 7.5, 4, 4, 9, 12, white);
  kit.g("plaster").ellipsoid(0, 9, 8, 4.2, 4.5, 4.2, 16, 8, white, 0, 1);
  kit.g("metal").cylinder(0, 13.4, 8, 0.5, 0.05, 1.8, 8, gold);
  for (const [x, z] of [[-9, 1], [9, 1], [-9, 15], [9, 15]] as const) {
    kit.g("plaster").boxMinMax(x - 1, 7.5, z - 1, x + 1, 9.3, z + 1, white);
    kit.g("plaster").ellipsoid(x, 9.3, z, 1.1, 1.3, 1.1, 10, 5, gold, 0, 1);
  }
  // Nishan Sahib: tall pole with a saffron flag.
  const fx = hx - 6, fz = -hz + 6;
  kit.g("plaster").boxMinMax(fx - 1.2, 0, fz - 1.2, fx + 1.2, 0.8, fz + 1.2, white);
  kit.g("metal").cylinder(fx, 0.8, fz, 0.14, 0.09, 17, 8, rgb("#e08a1e"));
  kit.collide(fx, 1, fz, 2.4, 2, 2.4);
  kit.g("cloth").quad(new Vector3(fx, 17.5, fz), new Vector3(fx, 15.2, fz), new Vector3(fx + 3.4, 16.4, fz + 0.1), new Vector3(fx + 3.4, 16.4, fz + 0.1), rgb("#f08a1e"));
  kit.g("cloth").quad(new Vector3(fx + 3.4, 16.4, fz + 0.1), new Vector3(fx, 15.2, fz), new Vector3(fx, 17.5, fz), new Vector3(fx + 3.4, 16.4, fz + 0.1), rgb("#f08a1e"));
}

function kabaddi(kit: Kit, hx: number, hz: number): void {
  flat(kit.g("dirt"), -hx, -hz, hx, hz, 0.006, rgb("#b79a6e"));
  kit.g("plaster").torus(0, 0.01, 0, 11, 0.12, 40, 3, WHITE);
  flat(kit.g("concrete"), -0.1, -11, 0.1, 11, 0.02, WHITE);
  for (let i = 0; i < 6; i++) charpai(kit, -hx + 3, -hz + 6 + i * 8, 0, Math.PI / 2);
}

function dera(kit: Kit, s: Site, hx: number, hz: number, rng: Rng, decor: CountryDecor): void {
  flat(kit.g("dirt"), -hx, -hz, hx, hz, 0.006, rgb("#ad9672"));
  // Farmhouse, cattle shed (chappar) and a tubewell; a mango grove behind.
  kit.g("brick").boxMinMax(-hx + 2, 0, hz - 12, -hx + 16, 3.4, hz - 2, [1, 1, 1]);
  kit.collide(-hx + 9, 1.7, hz - 7, 14, 3.4, 10);
  kit.g("paint").boxMinMax(-hx + 7, 0, hz - 12.05, -hx + 9.2, 2.4, hz - 12, rgb("#3a6ea5"), 0b000001);
  kit.g("plaster").boxMinMax(-hx + 2, 3.4, hz - 12, -hx + 16, 4.1, hz - 11.8, rgb("#e3cdb0"));
  for (const [x, z] of [[hx - 14, hz - 10], [hx - 3, hz - 10], [hx - 14, hz - 3], [hx - 3, hz - 3]] as const) { kit.g("wood").boxMinMax(x - 0.12, 0, z - 0.12, x + 0.12, 2.6, z + 0.12, rgb("#6b4a2f")); kit.collide(x, 1.3, z, 0.25, 2.6, 0.25); }
  kit.g("fabric").boxMinMax(hx - 15, 2.6, hz - 11, hx - 2, 2.85, hz - 2, rgb("#b58f4f"));
  kit.g("wood").boxMinMax(hx - 13, 0, hz - 9.5, hx - 4, 0.6, hz - 8.8, rgb("#7a5536"));
  kit.collide(hx - 8.5, 0.3, hz - 9.15, 9, 0.6, 0.7);
  tubewell(kit, -hx + 6, -hz + 6, 0);
  haystack(kit, hx - 5, -hz + 6, rng);
  charpai(kit, -hx + 10, hz - 15, 0, 0.3);
  const cx = (s.x0 + s.x1) / 2, cz = (s.z0 + s.z1) / 2;
  for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) decor.addTree(kit, "mango", cx - hx + 8 + i * 8, cz - hz - 6 - j * 8, 1, rng.next() * 6);
}

function kiln(kit: Kit, hx: number, hz: number): void {
  flat(kit.g("dirt"), -hx, -hz, hx, hz, 0.006, rgb("#9a6a4d"));
  kit.g("brick").cylinder(0, 0, 0, 2.2, 1.4, 32, 12, [1, 1, 1], true);
  kit.collide(0, 16, 0, 4, 32, 4);
  kit.g("dark").cylinder(0, 31.8, 0, 1.3, 1.3, 0.3, 12, [1, 1, 1], true);
  kit.g("brick").ellipsoid(0, 0, 0, 22, 3, 16, 20, 6, rgb("#b07a5a"), 0, 1);
  kit.collide(0, 1.2, 0, 34, 2.4, 24);
  for (let i = 0; i < 6; i++) {
    const x = -hx + 6 + i * 9, z = -hz + 5;
    kit.g("brick").boxMinMax(x - 2, 0, z - 1, x + 2, 1.6, z + 1, [1, 1, 1]);
    kit.collide(x, 0.8, z, 4, 1.6, 2);
  }
}

// ---------------------------------------------------------------- Trees, lights, signs, edge

function roadsideTrees(kit: Kit, decor: CountryDecor): void {
  const rng = new Rng(55);
  const ok = (x: number, z: number) =>
    !onRoad(x, z, 2.5) && !OUTER_BUILDINGS.some((b) => x > b.x0 - 3 && x < b.x1 + 3 && z > b.z0 - 3 && z < b.z1 + 3) &&
    !SITES.some((s) => x > s.x0 - 3 && x < s.x1 + 3 && z > s.z0 - 3 && z < s.z1 + 3) &&
    !(x > TOWN.x0 - 4 && x < TOWN.x1 + 4 && z > TOWN.z0 - 4 && z < TOWN.z1 + 4) &&
    !(z > CANAL.z0 - 1.5 && z < CANAL.z1 + 1.5) &&
    !(x > CITY.x0 && x < CITY.x1 && z > CITY.z0 && z < CITY.z1);
  // Safeda (eucalyptus) rows along the G.T. Road, Kotli Road and both canal banks.
  for (let x = WORLD.minX + 20; x < WORLD.maxX - 20; x += 9) {
    for (const z of [-170.5, -149.5]) if (ok(x, z)) decor.addTree(kit, "safeda", x + rng.range(-1, 1), z + rng.range(-0.5, 0.5), rng.range(0.85, 1.15), rng.next() * 6);
    for (const z of [CANAL.z0 - 4.5, CANAL.z1 + 3.5]) if (ok(x + 4, z)) decor.addTree(kit, "safeda", x + 4 + rng.range(-1, 1), z, rng.range(0.85, 1.15), rng.next() * 6);
  }
  for (let z = 60; z < 630; z += 10) for (const x of [-7, 7]) if (ok(x, z)) decor.addTree(kit, rng.next() < 0.7 ? "safeda" : "shisham", x + rng.range(-0.5, 0.5), z, rng.range(0.85, 1.1), rng.next() * 6);
  for (let z = -150; z < -80; z += 10) for (const x of [-7, 7]) if (ok(x, z)) decor.addTree(kit, "shisham", x, z, 1, rng.next() * 6);
  // Village neem and peepal near the chowk.
  for (let i = 0; i < 18; i++) {
    const x = rng.range(VILLAGE.x0, VILLAGE.x1), z = rng.range(VILLAGE.z0, VILLAGE.z1);
    if (ok(x, z)) decor.addTree(kit, "neem", x, z, rng.range(0.9, 1.3), rng.next() * 6);
  }
  // Scattered kikar on field margins.
  for (let i = 0; i < 260; i++) {
    const x = rng.range(WORLD.minX + 20, WORLD.maxX - 20), z = rng.range(WORLD.minZ + 20, WORLD.maxZ - 20);
    if (!ok(x, z) || PLOTS.some((p) => x > p.x0 + 1 && x < p.x1 - 1 && z > p.z0 + 1 && z < p.z1 - 1)) continue;
    decor.addTree(kit, rng.next() < 0.6 ? "kikar" : "shisham", x, z, rng.range(0.8, 1.3), rng.next() * 6);
  }
}

/**
 * Colony galis: a lamp post and a neem every so often on the kerb, and a
 * welcome arch with the colony's name where you turn in off the main road.
 */
function colonyDressing(kit: Kit, decor: CountryDecor): void {
  const rng = new Rng(4848);
  for (const c of COLONIES) {
    for (const f of c.frontages) {
      const r = ROADS.find((q) => q.id === f.id);
      if (!r || r.id === "pindLink") continue;
      const alongX = r.x1 - r.x0 >= r.z1 - r.z0;
      const half = (alongX ? r.z1 - r.z0 : r.x1 - r.x0) / 2;
      const mid = alongX ? (r.z0 + r.z1) / 2 : (r.x0 + r.x1) / 2;
      const a0 = alongX ? r.x0 : r.z0, a1 = alongX ? r.x1 : r.z1;
      let k = 0;
      for (let a = a0 + 14; a < a1 - 10; a += 18, k++) {
        const sd = f.sides[k % f.sides.length]!;
        const off = mid + sd * (half + 0.7);
        const x = alongX ? a : off, z = alongX ? off : a;
        if (onRoad(x, z, 0.3)) continue;
        if (c.kind === "colony" && k % 2 === 0) {
          kit.frame(x, z, alongX ? (sd < 0 ? 0 : Math.PI) : (sd < 0 ? Math.PI / 2 : -Math.PI / 2));
          kit.g("metal").cylinder(0, 0, 0, 0.08, 0.06, 6, 6, rgb("#6d7275"));
          kit.g("metal").boxMinMax(-0.04, 5.9, 0, 0.04, 6.0, 1.2, rgb("#6d7275"));
          kit.g("emissive").boxMinMax(-0.12, 5.75, 0.9, 0.12, 5.9, 1.4, rgb("#fff1c9"));
          kit.collide(0, 3, 0, 0.2, 6, 0.2);
        } else if (rng.next() < 0.6) {
          decor.addTree(kit, c.kind === "village" ? (rng.next() < 0.5 ? "neem" : "kikar") : "neem", x, z, rng.range(0.8, 1.1), rng.next() * 6);
        }
      }
    }
  }
  // A manji (village) or a white plastic chair (colony) at each sitting spot.
  for (const { colony: c, seats } of colonyLife()) {
    for (const st of seats) {
      if (c.kind === "village") { kit.world(); charpai(kit, st.x, st.z, 0, st.yaw + Math.PI / 2); continue; }
      kit.frame(st.x, st.z, st.yaw);
      const w = rgb("#eeeeea");
      kit.g("paint").boxMinMax(-0.25, 0.4, -0.25, 0.25, 0.45, 0.22, w);
      kit.g("paint").boxMinMax(-0.25, 0.45, -0.28, 0.25, 0.95, -0.24, w);
      for (const [x, z] of [[-0.22, -0.22], [0.22, -0.22], [-0.22, 0.2], [0.22, 0.2]] as const) kit.g("paint").boxMinMax(x - 0.02, 0, z - 0.02, x + 0.02, 0.4, z + 0.02, w);
    }
  }
  for (const g of COLONY_GATES) {
    const r = ROADS.find((q) => q.id === g.road)!;
    const alongX = r.x1 - r.x0 >= r.z1 - r.z0;
    const half = (alongX ? r.z1 - r.z0 : r.x1 - r.x0) / 2 + 1.2;
    // The arch spans the road; its boards face along it both ways.
    kit.frame(g.x, g.z, alongX ? Math.PI / 2 : 0);
    const white = rgb("#efe7d6"), gold = rgb("#d9b44a");
    for (const s of [-1, 1]) {
      kit.g("plaster").boxMinMax(s * half - 0.5, 0, -0.5, s * half + 0.5, 6.4, 0.5, white, 0b111011);
      kit.g("plaster").ellipsoid(s * half, 6.4, 0, 0.6, 0.8, 0.6, 8, 4, gold, 0, 1);
      kit.collide(s * half, 3.2, 0, 1, 6.4, 1);
    }
    kit.g("plaster").boxMinMax(-half, 5.0, -0.35, half, 6.2, 0.35, white);
    const sw = Math.min(half * 2 - 1.4, 7);
    kit.sign(g.sign, 0, 5.6, 0.36, sw);
    kit.frame(g.x, g.z, (alongX ? Math.PI / 2 : 0) + Math.PI);
    kit.sign(g.sign, 0, 5.6, 0.36, sw);
  }
}

/** Welcome arches: on which road, where, and which board. */
const COLONY_GATES: Array<{ road: string; x: number; z: number; sign: string }> = [
  { road: "col_gnn1", x: -190, z: -145, sign: "gGnn" },
  { road: "col_santB", x: 188, z: 0, sign: "gSant" },
  { road: "col_sant1", x: 115, z: -145, sign: "gSant" },
  { road: "col_modelB", x: 512, z: 0, sign: "gModel" },
  { road: "estate", x: 300, z: 200, sign: "gEstate" },
  { road: "col_sarabha3", x: -455, z: -393, sign: "gSarabha" },
  { road: "col_kitchluA", x: -293, z: -290, sign: "gKitchlu" },
  { road: "kotli", x: 0, z: 214, sign: "gKotli" },
  { road: "pindLink", x: 612, z: 720, sign: "gDhaliwal" },
  { road: "pindLink", x: -612, z: 720, sign: "gBhangu" },
];

function streetLights(kit: Kit): void {
  // Simple lamp posts along city streets and the highway near junctions.
  const posts: Array<[number, number]> = [];
  for (const x of [200, 300, 400, 500]) for (let z = -140; z < 140; z += 30) posts.push([x + 6, z]);
  for (let x = -60; x < 560; x += 40) posts.push([x, -152]);
  for (const [x, z] of posts) {
    if (onRoad(x, z, 0.2)) continue;
    kit.frame(x, z);
    kit.g("metal").cylinder(0, 0, 0, 0.09, 0.06, 7, 6, rgb("#6d7275"));
    kit.g("metal").boxMinMax(-1.2, 6.8, -0.05, 0, 6.9, 0.05, rgb("#6d7275"));
    kit.g("emissive").boxMinMax(-1.4, 6.65, -0.12, -0.9, 6.8, 0.12, rgb("#fff1c9"));
    kit.collide(0, 3.5, 0, 0.2, 7, 0.2);
  }
}

function junctionSigns(kit: Kit): void {
  const boards: Array<{ x: number; z: number; rot: number; key: string }> = [
    { x: 6.5, z: -146, rot: Math.PI, key: "toBazaar" },
    { x: -6.5, z: -174, rot: 0, key: "toCity" },
    { x: 6.5, z: 140, rot: 0, key: "toKotli" },
    { x: 190, z: -146, rot: -Math.PI / 2, key: "toCity" },
    { x: 6.5, z: 63, rot: 0, key: "toKotli" },
    { x: -6, z: 228, rot: 0, key: "pindKotli" },
  ];
  for (const b of boards) {
    kit.world();
    kit.g("metal").cylinder(b.x, 0, b.z, 0.06, 0.06, 3.0, 6, rgb("#5e6163"));
    kit.colliders.add(b.x, 1.5, b.z, 0.15, 3, 0.15);
    kit.signAt(b.key, b.x, 2.8, b.z, b.rot, 2.0);
    kit.signAt(b.key, b.x, 2.8, b.z, b.rot + Math.PI, 2.0);
  }
}

/** The edge of the map: a dense tree belt and invisible walls. */
function worldEdge(kit: Kit, decor: CountryDecor): void {
  const rng = new Rng(999);
  const W = WORLD;
  for (let a = W.minX; a < W.maxX; a += 7) {
    for (const [x, z] of [[a, W.minZ + 3], [a, W.maxZ - 3], [W.minX + 3, a], [W.maxX - 3, a]] as const) {
      decor.addTree(kit, rng.next() < 0.6 ? "safeda" : "shisham", x + rng.range(-1.5, 1.5), z + rng.range(-1.5, 1.5), rng.range(0.9, 1.2), rng.next() * 6);
    }
  }
  kit.world();
  const L = W.maxX - W.minX;
  kit.colliders.add(0, 15, W.minZ, L, 40, 1);
  kit.colliders.add(0, 15, W.maxZ, L, 40, 1);
  kit.colliders.add(W.minX, 15, 0, 1, 40, L);
  kit.colliders.add(W.maxX, 15, 0, 1, 40, L);
}
