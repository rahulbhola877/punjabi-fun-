/**
 * The open countryside around the walled Ranggarh bazaar, as plain data:
 * highway, link roads, the city grid of Nawan Shehar, Pind Kotli village,
 * the canal and its bridges, farm tracks, landmark sites and farm plots.
 * Rendering, collision, the map, traffic, navigation and tests all read
 * this one description. Every road is an axis-aligned rectangle.
 *
 * Axes: +X east, +Z north, +Y up. Units: metres. The bazaar sits at the origin.
 */
import { Rng } from "../render/textures";
import type { Rect } from "./layout";

/** Playable extent of the whole world. */
export const WORLD = { minX: -700, maxX: 700, minZ: -700, maxZ: 700 } as const;
/** The walled bazaar (its own detailed layout lives in layout.ts). */
export const TOWN: Rect = { x0: -48, x1: 36, z0: -76, z1: 52 };
/** Openings in the town wall where the bazaar road leaves north and south. */
export const TOWN_GAP_X = 6.5;

export type RoadKind = "highway" | "road" | "street" | "track";
export interface Road extends Rect { id: string; kind: RoadKind; name: string }

/** Canal (nehar) band crossing the whole map west → east. */
export const CANAL = { z0: 162, z1: 178, waterY: -0.9, bedY: -1.6 } as const;
/** Low parapet walls run along both banks except at bridges. */
export const CANAL_BANK = 2.5;

export const CITY: Rect = { x0: 190, x1: 510, z0: -153, z1: 146 };
export const VILLAGE: Rect = { x0: -165, x1: 120, z0: 230, z1: 410 };
/**
 * "Ludhiana": the big city down the G.T. Road. Tighter blocks than Nawan
 * Shehar, shops on every frontage, carts on the tarmac and autos three-deep at
 * the chowk — this is where the game gets properly crowded and noisy.
 */
export const LUDHIANA: Rect = { x0: -600, x1: -340, z0: -400, z1: -175 };

const AVENUES = [200, 300, 400, 500];
const CITY_STREETS = [-80, 0, 70];

function ns(id: string, x: number, z0: number, z1: number, w: number, kind: RoadKind, name: string): Road {
  return { id, x0: x - w / 2, x1: x + w / 2, z0, z1, kind, name };
}
function ew(id: string, z: number, x0: number, x1: number, w: number, kind: RoadKind, name: string): Road {
  return { id, x0, x1, z0: z - w / 2, z1: z + w / 2, kind, name };
}

export const ROADS: Road[] = [
  ew("gt", -160, WORLD.minX + 8, WORLD.maxX - 8, 14, "highway", "G.T. Road"),
  ns("bazaarS", 0, -153, -74, 8, "road", "Bazaar Road"),
  ns("kotli", 0, 56, 640, 8, "road", "Kotli Road"),
  ew("nehar", 150, WORLD.minX + 8, WORLD.maxX - 8, 8, "road", "Nehar Road"),
  ...AVENUES.map((x, i) => ns(`ave${i}`, x, -153, 146, 10, "street", ["Mall Road", "Ghanta Ghar Road", "Bus Adda Road", "College Road"][i]!)),
  ...CITY_STREETS.map((z, i) => ew(`st${i}`, z, 195, 505, 10, "street", ["Mandi Road", "Chowk Bazaar", "Cinema Road"][i]!)),
  // Ludhiana: three avenues, three cross-roads and two narrow bazaar galis.
  // "ludhA1" runs all the way out to the G.T. Road, so traffic (and the
  // player) can get there without leaving the tarmac.
  ns("ludhA0", -580, -385, -190, 9, "street", "Chaura Bazaar Road"),
  ns("ludhA1", -470, -385, -155, 10, "road", "Ludhiana Road"),
  ns("ludhA2", -360, -385, -190, 9, "street", "Field Ganj Road"),
  ew("ludhS0", -385, -590, -298, 8, "street", "Mandi Road"),
  ew("ludhS1", -290, -590, -298, 9, "street", "Ghumar Mandi"),
  ew("ludhS2", -195, -590, -298, 9, "street", "Ghanta Ghar Road"),
  ns("ludhG0", -525, -285, -200, 9, "street", "Gali Pakki"),
  ns("ludhG1", -415, -285, -200, 9, "street", "Dal Bazaar Gali"),
  // Pind Kotli lanes.
  ew("pindMain", 320, -160, 115, 7, "street", "Pind di Gali"),
  ns("pindCross", -80, 236, 404, 7, "street", "Akhada Gali"),
  // Kacha farm tracks.
  ns("trackW", -300, -650, 650, 5, "track", "Kacha Rasta"),
  ns("trackWW", -600, -650, 650, 5, "track", "Kacha Rasta"),
  ns("trackSW", -120, -650, -167, 5, "track", "Kacha Rasta"),
  ns("trackSE", 300, -650, -167, 5, "track", "Kacha Rasta"),
  ns("trackNE", 300, 154, 650, 5, "track", "Kacha Rasta"),
  ns("trackE", 600, -650, 650, 5, "track", "Kacha Rasta"),
  ew("trackS", -400, -650, 650, 5, "track", "Kacha Rasta"),
  ew("trackN", 450, -650, 650, 5, "track", "Kacha Rasta"),
  // Short kacha lanes from the tracks to each farm (dera).
  ew("toDeraW", 57, -340, -302.5, 4, "track", "Dere da rasta"),
  ew("toDeraSW", -300, -195, -122.5, 4, "track", "Dere da rasta"),
  ew("toDeraNE", 300, 302.5, 330, 4, "track", "Dere da rasta"),
  ns("toDeraNW", -450, 452.5, 500, 4, "track", "Dere da rasta"),
  ew("toDeraSE", -300, 302.5, 440, 4, "track", "Dere da rasta"),
];

/** Bridges where north–south roads cross the canal. */
export const BRIDGES: Array<{ x: number; w: number }> = ROADS
  .filter((r) => r.z0 < CANAL.z0 && r.z1 > CANAL.z1)
  .map((r) => ({ x: (r.x0 + r.x1) / 2, w: Math.max(9, r.x1 - r.x0 + 3) }));

export type SiteKind =
  | "highwayDhaba" | "petrol" | "busAdda" | "ghantaGhar" | "mandi" | "park" | "thana" | "cinema"
  | "akhada" | "gurdwara" | "dera" | "kiln" | "kabaddi";

export interface Site extends Rect { id: string; kind: SiteKind; label: string; seed: number }

export const SITES: Site[] = [
  { id: "sherDhaba", kind: "highwayDhaba", label: "Sher-e-Punjab Dhaba", x0: 55, x1: 105, z0: -205, z1: -170, seed: 1 },
  { id: "petrol", kind: "petrol", label: "Panj Aab Fuels", x0: 125, x1: 170, z0: -200, z1: -170, seed: 2 },
  { id: "busAdda", kind: "busAdda", label: "Bus Adda", x0: 407, x1: 493, z0: -151, z1: -87, seed: 3 },
  { id: "ghantaGhar", kind: "ghantaGhar", label: "Ghanta Ghar Chowk", x0: 307, x1: 335, z0: 7, z1: 35, seed: 4 },
  { id: "mandi", kind: "mandi", label: "Anaj Mandi", x0: 207, x1: 293, z0: -151, z1: -87, seed: 5 },
  { id: "park", kind: "park", label: "Company Bagh", x0: 307, x1: 393, z0: 77, z1: 144, seed: 6 },
  { id: "thana", kind: "thana", label: "Police Chowki", x0: 207, x1: 240, z0: 7, z1: 35, seed: 7 },
  { id: "cinema", kind: "cinema", label: "Raj Talkies", x0: 407, x1: 450, z0: 7, z1: 40, seed: 8 },
  { id: "akhada", kind: "akhada", label: "Kotli Akhada", x0: -60, x1: -25, z0: 330, z1: 362, seed: 9 },
  { id: "gurdwara", kind: "gurdwara", label: "Gurdwara Sahib", x0: 40, x1: 95, z0: 332, z1: 385, seed: 10 },
  { id: "kabaddi", kind: "kabaddi", label: "Kabaddi Ground", x0: -150, x1: -95, z0: 335, z1: 395, seed: 11 },
  { id: "deraW", kind: "dera", label: "Jarnail's Dera", x0: -380, x1: -340, z0: 40, z1: 75, seed: 12 },
  { id: "deraSW", kind: "dera", label: "Bains Farm", x0: -230, x1: -195, z0: -320, z1: -285, seed: 13 },
  { id: "deraNE", kind: "dera", label: "Sandhu Dera", x0: 330, x1: 368, z0: 290, z1: 325, seed: 14 },
  { id: "deraNW", kind: "dera", label: "Grewal Dera", x0: -470, x1: -430, z0: 500, z1: 535, seed: 15 },
  { id: "deraSE", kind: "dera", label: "Gill Farm", x0: 440, x1: 478, z0: -320, z1: -285, seed: 16 },
  { id: "kiln", kind: "kiln", label: "Bhatta (brick kiln)", x0: 500, x1: 560, z0: -540, z1: -480, seed: 17 },
  // Ludhiana.
  { id: "ludhMandi", kind: "mandi", label: "Ludhiana Sabzi Mandi", x0: -570, x1: -484, z0: -375, z1: -311, seed: 18 },
  { id: "ludhAdda", kind: "busAdda", label: "Ludhiana Bus & Auto Adda", x0: -455, x1: -369, z0: -375, z1: -311, seed: 19 },
  { id: "ludhGhanta", kind: "ghantaGhar", label: "Ludhiana Ghanta Ghar", x0: -455, x1: -427, z0: -280, z1: -252, seed: 20 },
  { id: "ludhThana", kind: "thana", label: "Ludhiana City Thana", x0: -570, x1: -537, z0: -280, z1: -252, seed: 21 },
  { id: "ludhCinema", kind: "cinema", label: "Deepak Talkies", x0: -410, x1: -367, z0: -280, z1: -247, seed: 22 },
];

export function site(id: string): Site {
  const s = SITES.find((x) => x.id === id);
  if (!s) throw new Error(`unknown site ${id}`);
  return s;
}

// ---------------------------------------------------------------- Buildings outside the bazaar

export type OuterStyle = "city" | "village" | "farm";
export interface OuterBuilding extends Rect {
  id: string;
  style: OuterStyle;
  /** Direction the front faces (radians, 0 = +Z). */
  face: number;
  floors: number;
  color: string;
  shop?: string;
  seed: number;
}

const CITY_COLORS = ["#e3d2b0", "#d9b99b", "#c9d1c3", "#e8c9a0", "#cfd8dc", "#f0e0c0", "#d7ccc8", "#e6b89c", "#b8c9b0", "#f3d9b1"];
const SHOP_SIGNS = ["cMithai", "cMobile", "cCloth", "cElectro", "cJewel", "cTyre", "cHotel", "cLassi", "cDhaba", "cMedical", "cBooks", "cSalon"];

function intersects(a: Rect, b: Rect, pad = 0): boolean {
  return a.x0 < b.x1 + pad && a.x1 > b.x0 - pad && a.z0 < b.z1 + pad && a.z1 > b.z0 - pad;
}

function cityBuildings(): OuterBuilding[] {
  const out: OuterBuilding[] = [];
  const rng = new Rng(4242);
  const xs = AVENUES, zs = [CITY.z0, ...CITY_STREETS, CITY.z1];
  let n = 0;
  for (let i = 0; i < xs.length - 1; i++) {
    for (let j = 0; j < zs.length - 1; j++) {
      const bx0 = xs[i]! + 5 + 1.5, bx1 = xs[i + 1]! - 5 - 1.5;
      const bz0 = zs[j]! + (j === 0 ? 0 : 5) + 1.5, bz1 = zs[j + 1]! - (j === zs.length - 2 ? 4 : 5) - 1.5;
      // Rows along the north and south faces of the block (fronting E–W streets),
      // and short rows on the east and west faces (fronting avenues).
      const rows: Array<{ along: "x" | "z"; fixed: number; a0: number; a1: number; face: number; dir: 1 | -1 }> = [
        { along: "x", fixed: bz1, a0: bx0, a1: bx1, face: 0, dir: -1 },
        { along: "x", fixed: bz0, a0: bx0, a1: bx1, face: Math.PI, dir: 1 },
        { along: "z", fixed: bx0, a0: bz0 + 14, a1: bz1 - 14, face: -Math.PI / 2, dir: 1 },
        { along: "z", fixed: bx1, a0: bz0 + 14, a1: bz1 - 14, face: Math.PI / 2, dir: -1 },
      ];
      for (const row of rows) {
        let a = row.a0;
        while (a < row.a1 - 7) {
          const w = Math.min(rng.range(8, 15), row.a1 - a);
          if (w < 7) break;
          const d = rng.range(9, 13);
          const r: Rect = row.along === "x"
            ? { x0: a, x1: a + w, z0: row.dir < 0 ? row.fixed - d : row.fixed, z1: row.dir < 0 ? row.fixed : row.fixed + d }
            : { x0: row.dir > 0 ? row.fixed : row.fixed - d, x1: row.dir > 0 ? row.fixed + d : row.fixed, z0: a, z1: a + w };
          a += w + (rng.next() < 0.2 ? rng.range(2, 5) : 0.3);
          if (SITES.some((s) => intersects(s, r, 1))) continue;
          if (out.some((o) => intersects(o, r, 0.2))) continue;
          out.push({
            id: `city${n}`, style: "city", ...r, face: row.face, floors: rng.int(2, 5), color: rng.pick(CITY_COLORS),
            shop: rng.next() < 0.75 ? rng.pick(SHOP_SIGNS) : undefined, seed: 900 + n,
          });
          n++;
        }
      }
    }
  }
  return out;
}

function villageBuildings(): OuterBuilding[] {
  const out: OuterBuilding[] = [];
  const rng = new Rng(777);
  let n = 0;
  const add = (r: Rect, face: number) => {
    if (SITES.some((s) => intersects(s, r, 2))) return;
    if (ROADS.some((rd) => intersects(rd, r, 1))) return;
    if (out.some((o) => intersects(o, r, 1))) return;
    out.push({ id: `pind${n}`, style: "village", ...r, face, floors: rng.next() < 0.3 ? 2 : 1, color: rng.pick(["#b5654a", "#c27a5c", "#a85a44", "#e8dcc4", "#d9c8a8"]), seed: 1300 + n });
    n++;
  };
  // Houses lining both sides of the main village street and the akhada lane.
  for (let x = -155; x < 108; ) {
    const w = rng.range(10, 16);
    add({ x0: x, x1: x + w, z0: 324.5, z1: 324.5 + rng.range(10, 14) }, Math.PI);
    add({ x0: x, x1: x + w, z0: 315.5 - rng.range(10, 14), z1: 315.5 }, 0);
    x += w + rng.range(1, 4);
  }
  for (let z = 240; z < 398; ) {
    const w = rng.range(10, 15);
    add({ x0: -83.5 - rng.range(10, 13), x1: -83.5, z0: z, z1: z + w }, Math.PI / 2);
    add({ x0: -76.5, x1: -76.5 + rng.range(10, 13), z0: z, z1: z + w }, -Math.PI / 2);
    z += w + rng.range(1, 4);
  }
  // Houses along Kotli Road as it enters the village.
  for (let z = 236; z < 405; ) {
    const w = rng.range(10, 15);
    add({ x0: 5.5, x1: 5.5 + rng.range(10, 13), z0: z, z1: z + w }, -Math.PI / 2);
    add({ x0: -5.5 - rng.range(10, 13), x1: -5.5, z0: z, z1: z + w }, Math.PI / 2);
    z += w + rng.range(2, 6);
  }
  return out;
}

/**
 * Ludhiana's frontages: shops packed shoulder to shoulder along both sides of
 * every street in the district, three to six floors, almost all of them open
 * for business. Unlike the Nawan Shehar blocks these are built off the road
 * line rather than the block interior, which is what gives the narrow, walled
 * bazaar feeling.
 */
function ludhianaBuildings(taken: OuterBuilding[]): OuterBuilding[] {
  const out: OuterBuilding[] = [];
  const rng = new Rng(8181);
  let n = 0;
  const streets = ROADS.filter((r) => r.id.startsWith("ludh"));
  for (const r of streets) {
    const alongX = r.x1 - r.x0 >= r.z1 - r.z0;
    const half = (alongX ? r.z1 - r.z0 : r.x1 - r.x0) / 2;
    const c = alongX ? (r.z0 + r.z1) / 2 : (r.x0 + r.x1) / 2;
    const a0 = alongX ? r.x0 : r.z0, a1 = alongX ? r.x1 : r.z1;
    for (const sd of [-1, 1]) {
      // A 3 m footpath, then the shopfronts. Narrower than this and the
      // chase camera ends up inside a shop wall in the galis.
      const front = c + sd * (half + 3);
      let a = a0 + 4;
      while (a < a1 - 8) {
        const w = rng.range(6, 11);
        const d = rng.range(8, 13);
        const rect: Rect = alongX
          ? { x0: a, x1: a + w, z0: sd < 0 ? front - d : front, z1: sd < 0 ? front : front + d }
          : { x0: sd < 0 ? front - d : front, x1: sd < 0 ? front : front + d, z0: a, z1: a + w };
        a += w + (rng.next() < 0.15 ? rng.range(1.5, 3.5) : 0.25);
        if (!inRectR(LUDHIANA, (rect.x0 + rect.x1) / 2, (rect.z0 + rect.z1) / 2, 20)) continue;
        if (SITES.some((s) => intersects(s, rect, 1.5))) continue;
        if (ROADS.some((rd) => intersects(rd, rect, 1))) continue;
        if (out.some((o) => intersects(o, rect, 0.15)) || taken.some((o) => intersects(o, rect, 0.5))) continue;
        out.push({
          id: `ludh${n}`, style: "city", ...rect,
          face: alongX ? (sd < 0 ? 0 : Math.PI) : (sd < 0 ? -Math.PI / 2 : Math.PI / 2),
          floors: rng.int(3, 6), color: rng.pick(CITY_COLORS),
          shop: rng.next() < 0.92 ? rng.pick(SHOP_SIGNS) : undefined, seed: 4000 + n,
        });
        n++;
      }
    }
  }
  return out;
}

const BASE_OUTER = [...cityBuildings(), ...villageBuildings()];
export const OUTER_BUILDINGS: OuterBuilding[] = [...BASE_OUTER, ...ludhianaBuildings(BASE_OUTER)];

/**
 * The first mission's destination: "Hello Mobile Zone" on Chaura Bazaar Road,
 * Ludhiana — the shopfront nearest the middle of the street gets the sign,
 * and the counter point is on the footpath in front of it.
 */
export const MOBILE_SHOP: { x: number; z: number; yaw: number; building: string } = (() => {
  const road = ROADS.find((r) => r.id === "ludhA0")!;
  const cx = (road.x0 + road.x1) / 2, cz = -290;
  let best: OuterBuilding | null = null, bd = Infinity;
  for (const b of OUTER_BUILDINGS) {
    if (!b.id.startsWith("ludh") || !b.shop) continue;
    // Must face this road (its front edge on the road's side).
    const front = Math.abs(b.x1 - (road.x0 - 3)) < 0.6 || Math.abs(b.x0 - (road.x1 + 3)) < 0.6;
    if (!front) continue;
    const d = Math.hypot((b.x0 + b.x1) / 2 - cx, (b.z0 + b.z1) / 2 - cz);
    if (d < bd) { bd = d; best = b; }
  }
  const b = best!;
  b.shop = "cMobile";
  const east = Math.abs(b.x0 - (road.x1 + 3)) < 0.6;
  const x = east ? b.x0 - 1.4 : b.x1 + 1.4;
  return { x, z: (b.z0 + b.z1) / 2, yaw: east ? -Math.PI / 2 : Math.PI / 2, building: b.id };
})();

// ---------------------------------------------------------------- Farmland

export type Crop = "wheat" | "sarson" | "sugarcane" | "paddy" | "fodder" | "fallow";
export interface Plot extends Rect { id: string; crop: Crop; rowsAlongX: boolean; seed: number }

/** Areas that are never farmed. */
export const NO_FARM: Rect[] = [
  { x0: TOWN.x0 - 6, x1: TOWN.x1 + 6, z0: TOWN.z0 - 6, z1: TOWN.z1 + 6 },
  { x0: CITY.x0 - 4, x1: CITY.x1 + 4, z0: CITY.z0 - 4, z1: CITY.z1 + 4 },
  { x0: LUDHIANA.x0 - 8, x1: LUDHIANA.x1 + 8, z0: LUDHIANA.z0 - 8, z1: LUDHIANA.z1 + 8 },
  { x0: VILLAGE.x0, x1: VILLAGE.x1, z0: VILLAGE.z0, z1: VILLAGE.z1 },
  { x0: WORLD.minX, x1: WORLD.maxX, z0: CANAL.z0 - 10, z1: CANAL.z1 + 6 },
];

/**
 * Farm plots fill the land between roads: the world is cut into strips by
 * every road edge, each free cell is divided into fields of roughly 40–75 m
 * separated by bunds, and cells touching an obstacle are split further.
 */
function buildPlots(): Plot[] {
  const rng = new Rng(31337);
  const crops: Crop[] = ["wheat", "wheat", "wheat", "sarson", "sarson", "sugarcane", "paddy", "fodder", "fallow"];
  const out: Plot[] = [];
  const blocked = (r: Rect) =>
    NO_FARM.some((b) => intersects(b, r)) || ROADS.some((rd) => intersects(rd, r, 3)) || SITES.some((s) => intersects(s, r, 5)) ||
    OUTER_BUILDINGS.some((b) => intersects(b, r, 4));
  const xs = new Set<number>([WORLD.minX + 14, WORLD.maxX - 14]);
  const zs = new Set<number>([WORLD.minZ + 14, WORLD.maxZ - 14]);
  for (const r of ROADS) {
    if (r.x1 - r.x0 < r.z1 - r.z0) { xs.add(r.x0 - 3); xs.add(r.x1 + 3); } else { zs.add(r.z0 - 3); zs.add(r.z1 + 3); }
  }
  const X = [...xs].sort((a, b) => a - b), Z = [...zs].sort((a, b) => a - b);
  const place = (r: Rect, depth: number) => {
    const w = r.x1 - r.x0, h = r.z1 - r.z0;
    if (w < 14 || h < 14) return;
    if (!blocked(r) && w <= 80 && h <= 80) {
      out.push({ id: `plot${out.length}`, ...r, crop: rng.pick(crops), rowsAlongX: rng.next() < 0.5, seed: out.length + 1 });
      return;
    }
    if (depth > 5) return;
    // Split along the longer side (at a slightly random point) with a 3 m path between.
    if (w >= h) {
      const m = r.x0 + w * rng.range(0.4, 0.6);
      place({ ...r, x1: m - 1.5 }, depth + 1);
      place({ ...r, x0: m + 1.5 }, depth + 1);
    } else {
      const m = r.z0 + h * rng.range(0.4, 0.6);
      place({ ...r, z1: m - 1.5 }, depth + 1);
      place({ ...r, z0: m + 1.5 }, depth + 1);
    }
  };
  for (let i = 0; i < X.length - 1; i++) {
    for (let j = 0; j < Z.length - 1; j++) {
      const cell: Rect = { x0: X[i]!, x1: X[i + 1]!, z0: Z[j]!, z1: Z[j + 1]! };
      if (ROADS.some((rd) => intersects(rd, cell, -0.5))) continue;
      place(cell, 0);
    }
  }
  return out;
}

export const PLOTS: Plot[] = buildPlots();

// ---------------------------------------------------------------- Queries

export function inRectR(r: Rect, x: number, z: number, pad = 0): boolean {
  return x >= r.x0 - pad && x <= r.x1 + pad && z >= r.z0 - pad && z <= r.z1 + pad;
}

export function onRoad(x: number, z: number, pad = 0): Road | null {
  for (const r of ROADS) if (inRectR(r, x, z, pad)) return r;
  return null;
}

export function inCanal(x: number, z: number): boolean {
  if (z < CANAL.z0 || z > CANAL.z1) return false;
  return !BRIDGES.some((b) => Math.abs(x - b.x) < b.w / 2);
}

/** Open, walkable ground outside the bazaar: inside the world, not in a building, site wall or the canal. */
export function isOpenCountry(x: number, z: number): boolean {
  if (x < WORLD.minX + 6 || x > WORLD.maxX - 6 || z < WORLD.minZ + 6 || z > WORLD.maxZ - 6) return false;
  if (inRectR(TOWN, x, z, 1)) return false;
  if (inCanal(x, z) || (z > CANAL.z0 - CANAL_BANK - 0.6 && z < CANAL.z1 + CANAL_BANK + 0.6 && !BRIDGES.some((b) => Math.abs(x - b.x) < b.w / 2))) return false;
  if (OUTER_BUILDINGS.some((b) => inRectR(b, x, z, 0.6))) return false;
  return true;
}

/** Points along roads where it is always safe to put a player or vehicle. */
export const COUNTRY_SAFE_SPOTS: Array<{ x: number; z: number }> = (() => {
  const out: Array<{ x: number; z: number }> = [];
  for (const r of ROADS) {
    const len = Math.max(r.x1 - r.x0, r.z1 - r.z0);
    const alongX = r.x1 - r.x0 > r.z1 - r.z0;
    for (let t = 20; t < len - 10; t += 60) {
      const x = alongX ? r.x0 + t : (r.x0 + r.x1) / 2;
      const z = alongX ? (r.z0 + r.z1) / 2 : r.z0 + t;
      if (isOpenCountry(x, z)) out.push({ x, z });
    }
  }
  return out;
})();

// ---------------------------------------------------------------- Road condition

/**
 * Punjab roads come in every condition: smooth highway, patched-up link
 * roads, "tooti-footi" stretches full of potholes, and kacha tracks that turn
 * to chikkad (mud) after the rains. Potholes jolt vehicles (and spill food);
 * mud drags and slides.
 */
export type DefectKind = "pothole" | "patch" | "gravel" | "mud";
export interface Defect { x: number; z: number; r: number; kind: DefectKind; rot: number }

/** How rough each road is: chance per 10 m of a defect, and which kinds. */
const ROUGHNESS: Record<string, { p: number; kinds: DefectKind[] }> = {
  gt: { p: 0.12, kinds: ["patch", "patch", "pothole"] },
  bazaarS: { p: 0.35, kinds: ["patch", "pothole", "gravel"] },
  kotli: { p: 0.4, kinds: ["pothole", "patch", "gravel", "pothole"] },
  nehar: { p: 0.7, kinds: ["pothole", "pothole", "gravel", "patch", "mud"] },
  street: { p: 0.25, kinds: ["pothole", "patch"] },
  // Ludhiana's bazaar streets are the worst-kept tarmac in the game: this is
  // where an overloaded auto catches a pothole and goes over.
  ludh: { p: 0.8, kinds: ["pothole", "pothole", "pothole", "patch", "gravel"] },
  pind: { p: 0.6, kinds: ["mud", "pothole", "gravel"] },
  track: { p: 0.55, kinds: ["mud", "mud", "pothole"] },
};

function buildDefects(): Defect[] {
  const rng = new Rng(9119);
  const out: Defect[] = [];
  for (const r of ROADS) {
    const key = r.id.startsWith("ludh") ? "ludh" : r.id.startsWith("ave") || r.id.startsWith("st") ? "street" : r.id.startsWith("pind") ? "pind" : r.kind === "track" ? "track" : r.id;
    const rough = ROUGHNESS[key];
    if (!rough) continue;
    const alongX = r.x1 - r.x0 >= r.z1 - r.z0;
    const len = alongX ? r.x1 - r.x0 : r.z1 - r.z0;
    const w = alongX ? r.z1 - r.z0 : r.x1 - r.x0;
    for (let a = 6; a < len - 6; a += 10) {
      // Bad stretches come in clusters.
      const stretch = Math.sin(a * 0.013 + r.x0 * 0.01 + r.z0 * 0.017) > 0.2 ? 1.6 : 0.5;
      if (rng.next() > rough.p * stretch) continue;
      const kind = rng.pick(rough.kinds);
      const lat = rng.range(-w / 2 + 1, w / 2 - 1);
      const along = (alongX ? r.x0 : r.z0) + a + rng.range(-4, 4);
      const x = alongX ? along : (r.x0 + r.x1) / 2 + lat;
      const z = alongX ? (r.z0 + r.z1) / 2 + lat : along;
      if (z > CANAL.z0 - 3 && z < CANAL.z1 + 3) continue;
      const rr = kind === "pothole" ? rng.range(0.45, 0.95) : kind === "mud" ? rng.range(1.8, Math.min(4.5, w * 0.7)) : kind === "gravel" ? rng.range(1.5, 3) : rng.range(1.2, 2.6);
      out.push({ x, z, r: rr, kind, rot: rng.next() * Math.PI });
      // Potholes often come in pairs or threes.
      if (kind === "pothole" && rng.next() < 0.5) out.push({ x: x + rng.range(-1.6, 1.6), z: z + rng.range(-1.6, 1.6), r: rr * rng.range(0.6, 1), kind, rot: 0 });
    }
  }
  return out;
}

export const DEFECTS: Defect[] = buildDefects();

const DEFECT_CELL = 16;
const defectGrid = new Map<string, Defect[]>();
for (const d of DEFECTS) {
  for (let gx = Math.floor((d.x - d.r) / DEFECT_CELL); gx <= Math.floor((d.x + d.r) / DEFECT_CELL); gx++) {
    for (let gz = Math.floor((d.z - d.r) / DEFECT_CELL); gz <= Math.floor((d.z + d.r) / DEFECT_CELL); gz++) {
      const k = `${gx},${gz}`;
      const l = defectGrid.get(k) ?? [];
      l.push(d);
      defectGrid.set(k, l);
    }
  }
}

/** The road defect under a point, if any (gravel/patch are cosmetic). */
export function defectAt(x: number, z: number): Defect | null {
  const l = defectGrid.get(`${Math.floor(x / DEFECT_CELL)},${Math.floor(z / DEFECT_CELL)}`);
  if (!l) return null;
  for (const d of l) if ((d.x - x) ** 2 + (d.z - z) ** 2 < d.r * d.r && (d.kind === "pothole" || d.kind === "mud")) return d;
  return null;
}

// ---------------------------------------------------------------- Street vendors

export type RehriGoods = "sabzi" | "fruit" | "chaat" | "ganna";

/**
 * Rehri (hand-cart) vendors parked at the roadside: along the city's chowk
 * road and avenues, outside the bazaar gate and by the bus adda. Each is a
 * prop (country.ts) plus a vendor (countryFolk.ts); yaw faces the road.
 */
export const REHRIS: Array<{ x: number; z: number; yaw: number; goods: RehriGoods }> = (() => {
  const out: Array<{ x: number; z: number; yaw: number; goods: RehriGoods }> = [];
  const goods: RehriGoods[] = ["sabzi", "fruit", "chaat", "ganna"];
  const clear = (x: number, z: number, onRoad: boolean) =>
    isOpenCountry(x, z) && [[1.4, 0], [-1.4, 0], [0, 1.4], [0, -1.4]].every(([dx, dz]) => isOpenCountry(x + dx!, z + dz!)) &&
    (onRoad || !ROADS.some((r) => inRectR(r, x, z, 0.8))) && !SITES.some((s) => inRectR(s, x, z, 1)) &&
    // Not at a junction.
    ROADS.filter((r) => inRectR(r, x, z, 6)).length <= 1;
  // In the city the shops come right up to the road, so carts stand on the tarmac's edge.
  const along = (id: string, step: number, every: number, onRoad = false) => {
    const r = ROADS.find((q) => q.id === id)!;
    const alongX = r.x1 - r.x0 > r.z1 - r.z0;
    const a0 = alongX ? r.x0 : r.z0, a1 = alongX ? r.x1 : r.z1;
    let k = 0;
    for (let a = a0 + 12; a < a1 - 12; a += step) {
      for (const sd of [-1, 1]) {
        if (k++ % every) continue;
        const off = onRoad ? -0.85 : 1.8;
        const e = sd < 0 ? (alongX ? r.z0 : r.x0) - off : (alongX ? r.z1 : r.x1) + off;
        const x = alongX ? a : e, z = alongX ? e : a;
        if (!clear(x, z, onRoad)) continue;
        const yaw = alongX ? (sd < 0 ? 0 : Math.PI) : (sd < 0 ? Math.PI / 2 : -Math.PI / 2);
        out.push({ x, z, yaw, goods: goods[out.length % goods.length]! });
      }
    }
  };
  // Ludhiana: carts every few metres, on the tarmac, both sides.
  along("ludhS1", 11, 1, true);
  along("ludhS2", 13, 1, true);
  along("ludhA1", 17, 2, true);
  along("ludhA0", 19, 2, true);
  along("ludhG0", 9, 1, true);
  along("ludhG1", 9, 1, true);
  along("st1", 23, 3, true);
  along("ave1", 31, 4, true);
  along("st0", 37, 5, true);
  along("bazaarS", 19, 2);
  along("gt", 47, 9);
  return out;
})();
