import { Matrix, Quaternion, Vector3 } from "../babylon";
import { GeoBuilder, mix, rgb, shade, type RGB } from "../render/GeoBuilder";
import type { MatKey } from "../render/Materials";
import { Rng } from "../render/textures";
import type { Kit } from "./Kit";
import { charpai } from "./interiors";
import { tree } from "./props";
import {
  BRIDGES, CANAL, CITY, DEFECTS, OUTER_BUILDINGS, PLOTS, REHRIS, ROADS, SITES, TOWN, TOWN_GAP_X, VILLAGE, WORLD, onRoad,
  type OuterBuilding, type Plot, type Road, type Site,
} from "./region";
import type { Rect } from "./layout";

/** Hidden beyond this distance from the camera (fog has swallowed it by then). */
export const COUNTRY_CULL = 460;
const SEG = 120;

const WHITE: RGB = rgb("#f1eee6");
const YELLOW: RGB = rgb("#e8b923");
const IRON: RGB = rgb("#2b2b2e");
const CONC: RGB = rgb("#bdb6aa");

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
  for (const b of OUTER_BUILDINGS) (b.style === "city" ? cityBuilding : villageHouse)(kit, b);
  for (const s of SITES) buildSite(kit, s, decor);
  for (const r of REHRIS) rehri(kit, r.x, r.z, r.yaw, r.goods);
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
  const T = 100;
  for (let x = WORLD.minX - 200; x < WORLD.maxX + 200; x += T) {
    for (let z = WORLD.minZ - 200; z < WORLD.maxZ + 200; z += T) {
      const c = shade(mix(base, rgb(rng.next() < 0.4 ? "#d8c9a0" : "#a9bf7e"), rng.range(0.1, 0.6)), rng.range(0.94, 1.04));
      // The canal band is cut out of the ground.
      const z0 = z, z1 = z + T;
      if (z1 <= CANAL.z0 || z0 >= CANAL.z1) flat(g, x, z0, x + T, z1, -0.03, c);
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
  const mat: MatKey = r.kind === "track" ? "dirt" : "asphalt";
  const col: RGB = r.kind === "track" ? rgb("#9d8562") : r.kind === "highway" ? rgb("#e6e6e6") : [1, 1, 1];
  const alongX = r.x1 - r.x0 >= r.z1 - r.z0;
  const w = alongX ? r.z1 - r.z0 : r.x1 - r.x0;
  pieces(kit, r, (lx0, lz0, lx1, lz1, cx, cz) => {
    flat(kit.g(mat), lx0, lz0, lx1, lz1, y, col);
    const paint = kit.g("concrete");
    const len = alongX ? lx1 - lx0 : lz1 - lz0;
    const a0 = alongX ? lx0 : lz0;
    // Markings: a stripe at lateral offset `o`, dashed or solid, skipping other roads.
    const stripe = (o: number, wdt: number, dash: number, gap: number, c: RGB) => {
      for (let a = a0; a < a0 + len - 0.1; a += dash + gap) {
        const b = Math.min(a0 + len, a + dash);
        const mx = alongX ? cx + (a + b) / 2 : cx + o, mz = alongX ? cz + o : cz + (a + b) / 2;
        const other = onRoad(mx, mz, 0.5);
        if (other && other !== r) continue;
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
    } else if (r.kind === "road" || r.kind === "street") {
      stripe(0, 0.12, 3, 5, WHITE);
    } else {
      // Kacha track: two darker wheel ruts.
      for (const s of [-0.9, 0.9]) {
        if (alongX) flat(kit.g("dirt"), lx0, s - 0.35, lx1, s + 0.35, y + 0.002, rgb("#8a7253"));
        else flat(kit.g("dirt"), s - 0.35, lz0, s + 0.35, lz1, y + 0.002, rgb("#8a7253"));
      }
    }
  });
}

/** Potholes, patch repairs, broken gravel edges and mud on the roads. */
function defects(kit: Kit): void {
  for (const d of DEFECTS) {
    const r = onRoad(d.x, d.z, 0.5);
    const y = (r ? roadY(r) : 0.01) + 0.004;
    kit.frame(d.x, d.z, d.rot);
    switch (d.kind) {
      case "pothole":
        kit.g("dark").cylinder(0, y - 0.003, 0, d.r, d.r, 0.004, 12, [1, 1, 1], true, 0.75);
        kit.g("dirt").cylinder(0, y - 0.002, 0, d.r * 0.75, d.r * 0.75, 0.004, 10, rgb("#5e5243"), true, 0.75);
        kit.g("water").cylinder(0.1, y, 0, d.r * 0.4, d.r * 0.4, 0.002, 8, rgb("#58706e"), true, 0.75);
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
  // Parapets on both banks, broken at the bridges.
  for (const [a, b] of spans) {
    for (const zz of [z0 - 0.2, z1 + 0.2]) {
      pieces(kit, { x0: a, x1: b, z0: zz - 0.2, z1: zz + 0.2 }, (lx0, _lz0, lx1, _lz1, cx, cz) => {
        kit.g("plaster").boxMinMax(lx0, 0, -0.2, lx1, 0.75, 0.2, WHITE, 0b001111);
        kit.collide(0, 0.6, 0, lx1 - lx0, 1.2, 0.4);
        void cx; void cz;
      });
    }
  }
  for (const b of BRIDGES) bridge(kit, b.x, b.w);
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

function windows(kit: Kit, rng: Rng, w: number, y0: number, floors: number, fh: number, trim: RGB, wall: RGB): void {
  for (let k = 0; k < floors; k++) {
    const yb = y0 + k * fh;
    const n = Math.max(1, Math.floor((w - 1) / 3));
    const span = w / n;
    const balc = k === 0 && n >= 2 && rng.next() < 0.45;
    for (let i = 0; i < n; i++) {
      const cx = span * (i + 0.5);
      kit.g("glass").boxMinMax(cx - 0.65, yb + 0.9, 0, cx + 0.65, yb + 2.3, 0.02, [1, 1, 1], 0b000010);
      kit.g("paint").boxMinMax(cx - 0.75, yb + 2.3, -0.02, cx + 0.75, yb + 2.42, 0.45, trim, 0b001110);
      kit.g("plaster").boxMinMax(cx - 0.75, yb + 0.82, -0.02, cx + 0.75, yb + 0.9, 0.12, shade(wall, 0.88), 0b001010);
      if (rng.next() < 0.3) for (let u = cx - 0.55; u < cx + 0.6; u += 0.22) kit.g("metal").boxMinMax(u - 0.012, yb + 0.9, 0.01, u + 0.012, yb + 2.3, 0.03, IRON, 0b000010);
    }
    if (balc) {
      kit.g("concrete").boxMinMax(0.3, yb + 0.05, 0, w - 0.3, yb + 0.2, 1.0, CONC);
      for (let u = 0.4; u < w - 0.3; u += 0.18) kit.g("metal").boxMinMax(u - 0.015, yb + 0.2, 0.95, u + 0.015, yb + 1.1, 0.98, IRON, 0b100011);
      kit.g("metal").boxMinMax(0.3, yb + 1.05, 0.93, w - 0.3, yb + 1.12, 1.0, IRON);
    }
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
  kit.g("plaster").boxMinMax(0, gh, -0.25, w, top, 0, shade(wall, 0.98), 0b110010);
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
    // Residential ground floor: wall with a door and a grilled window.
    const du = rng.range(0.6, Math.max(0.7, w - 2));
    kit.g("plaster").boxMinMax(0, 0, -0.25, w, gh, 0, shade(wall, 0.96), 0b000010);
    kit.g("wood").boxMinMax(du, 0, 0, du + 1.1, 2.3, 0.04, shade(trim, 0.9), 0b000010);
    kit.g("glass").boxMinMax(du > w / 2 ? 0.8 : w - 2.1, 1.1, 0, du > w / 2 ? 2.1 : w - 0.8, 2.3, 0.02, [1, 1, 1], 0b000010);
  }
  kit.g("plaster").boxMinMax(-0.02, gh - 0.05, -0.05, w + 0.02, gh + 0.08, 0.15, mix(wall, WHITE, 0.5), 0b001110);
  windows(kit, rng, w, gh, b.floors - 1, fh, trim, wall);
  roofTop(kit, rng, w, d, top, shade(wall, 0.97));
}

function villageHouse(kit: Kit, b: OuterBuilding): void {
  const rng = new Rng(b.seed);
  const { w, d } = frontFrame(kit, b);
  const brick = b.color.startsWith("#b") || b.color.startsWith("#a") || b.color.startsWith("#c2");
  const wall = rgb(b.color);
  const h = b.floors === 2 ? 6.2 : 3.3;
  const mat: MatKey = brick ? "brick" : "plaster";
  kit.g(mat).boxMinMax(0, 0, -d, w, h, 0, brick ? [1, 1, 1] : wall, 0b111110);
  kit.collide(w / 2, h / 2, -d / 2, w, h, d);
  // Painted gate, a couple of small windows, a whitewashed plinth band.
  const trim = rng.pick(TRIMS);
  const gu = rng.range(0.8, Math.max(0.9, w - 3.2));
  kit.g("paint").boxMinMax(gu, 0, 0, gu + 2.4, 2.6, 0.06, trim, 0b000010);
  kit.g("paint").boxMinMax(gu + 1.18, 0, 0.06, gu + 1.22, 2.6, 0.08, shade(trim, 0.6), 0b000010);
  kit.g("plaster").boxMinMax(-0.02, 0, -0.02, w + 0.02, 0.5, 0.04, WHITE, 0b001010);
  for (const u of [gu > w / 2 ? 1.0 : w - 2.0]) {
    kit.g("dark").boxMinMax(u, 1.3, 0, u + 0.9, 2.2, 0.02, [1, 1, 1], 0b000010);
    for (let k = 0; k < 4; k++) kit.g("metal").boxMinMax(u + 0.1 + k * 0.22, 1.3, 0.02, u + 0.13 + k * 0.22, 2.2, 0.04, IRON, 0b000010);
  }
  if (b.floors === 2) for (let u = 1.2; u < w - 1.5; u += 3.2) kit.g("dark").boxMinMax(u, 4.1, 0, u + 1.0, 5.3, 0.02, [1, 1, 1], 0b000010);
  // Parapet with a jaali band.
  kit.g("plaster").boxMinMax(0, h, -0.25, w, h + 0.8, 0, brick ? shade(rgb("#c9a28a"), 1) : shade(wall, 0.95), 0b101110);
  kit.g("plaster").boxMinMax(0, h, -d, w, h + 0.8, -d + 0.25, shade(wall, 0.9), 0b111101);
  if (rng.next() < 0.35) {
    // Gobar (dung-cake) heap or a charpai leaning by the gate.
    kit.g("fabric").ellipsoid(gu + 3.4, 0.4, 1.2, 0.7, 0.5, 0.7, 8, 5, rgb("#6b5236"));
  }
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
    case "ghantaGhar": ghantaGhar(kit, hx, hz); break;
    case "mandi": mandi(kit, hx, hz, rng); break;
    case "park": park(kit, s, hx, hz, rng); break;
    case "thana": thana(kit, hx, hz); break;
    case "cinema": cinema(kit, hx, hz); break;
    case "akhada": akhada(kit, s, hx, hz, rng); break;
    case "gurdwara": gurdwara(kit, hx, hz); break;
    case "kabaddi": kabaddi(kit, hx, hz); break;
    case "dera": dera(kit, s, hx, hz, rng, decor); break;
    case "kiln": kiln(kit, hx, hz); break;
  }
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

function busProp(kit: Kit, x: number, z: number, rng: Rng): void {
  const c = rng.pick([rgb("#1565c0"), rgb("#2e7d32"), rgb("#c62828")]);
  kit.g("paint").boxMinMax(x - 1.3, 0.5, z - 5.5, x + 1.3, 3.2, z + 5.5, c);
  kit.g("paint").boxMinMax(x - 1.32, 1.1, z - 5.4, x + 1.32, 1.3, z + 5.4, rgb("#f5f5f5"), 0b110000);
  for (let k = -4; k <= 4; k += 1.6) for (const s of [-1, 1]) kit.g("glass").boxMinMax(x + s * 1.31 - 0.01, 1.8, z + k - 0.6, x + s * 1.31 + 0.01, 2.7, z + k + 0.6, [1, 1, 1], s > 0 ? 0b100000 : 0b010000);
  kit.g("glass").boxMinMax(x - 1.2, 1.7, z + 5.5, x + 1.2, 2.9, z + 5.52, [1, 1, 1], 0b000010);
  for (const zz of [-3.8, 3.6]) for (const s of [-1, 1]) kit.g("rubber").cylinderX(x + s * 1.2, 0.5, z + zz, 0.5, 0.35, 12, [1, 1, 1]);
  kit.collide(x, 1.8, z, 2.6, 3.4, 11);
}

function ghantaGhar(kit: Kit, hx: number, hz: number): void {
  paving(kit, hx, hz, "paver", rgb("#d8c9ae"));
  const red = rgb("#a2432f"), cream = rgb("#efe0bf");
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
