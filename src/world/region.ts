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
import { COLONIES, COLONY_SITES, colonyHouses, ew, ns } from "./colonies";
import { RAIL } from "./Rail";
import { WORLD_BOUNDS } from "../app/config";
import { RectIndex } from "./RectIndex";

/** Playable extent of the whole world. */
export const WORLD = WORLD_BOUNDS;
/** Far ends of the roads that run edge to edge. */
// The kacha tracks and the Kotli road run to the edge that is nearest on each side, so none runs off the map (the east edge is further out).
const E = Math.min(WORLD.maxX, -WORLD.minX, WORLD.maxZ, -WORLD.minZ) - 8;
/** The walled bazaar (its own detailed layout lives in layout.ts). */
export const TOWN: Rect = { x0: -48, x1: 36, z0: -76, z1: 52 };
/** Openings in the town wall where the bazaar road leaves north and south. */
export const TOWN_GAP_X = 6.5;

export type RoadKind = "highway" | "road" | "street" | "track";
export interface Road extends Rect { id: string; kind: RoadKind; name: string }

/** Canal (nehar) band crossing the whole map west → east. */
export const CANAL = { z0: 162, z1: 178, waterY: -0.9, bedY: -2.6 } as const;
/** The bathing ghat on the north bank below Pind Kotli: a gap in the parapet and steps down into the water. */
export const GHAT = { x: 45, w: 4, steps: 6, rise: 0.25, run: 0.5 } as const;
/** Low parapet walls run along both banks except at bridges. */
export const CANAL_BANK = 2.5;

export const CITY: Rect = { x0: 190, x1: 510, z0: -153, z1: 146 };
/** Pind Kotli's abadi, out to its phirni. */
export const VILLAGE: Rect = { x0: -192, x1: 146, z0: 216, z1: 426 };
/**
 * "Ludhiana": the big city down the G.T. Road. Tighter blocks than Nawan
 * Shehar, shops on every frontage, carts on the tarmac and autos three-deep at
 * the chowk — this is where the game gets properly crowded and noisy.
 */
export const LUDHIANA: Rect = { x0: -600, x1: -340, z0: -400, z1: -175 };

const AVENUES = [200, 300, 400, 500];
const CITY_STREETS = [-80, 0, 70];

export const ROADS: Road[] = [
  ew("gt", -160, WORLD.minX + 8, WORLD.maxX - 8, 14, "highway", "G.T. Road"),
  ns("bazaarS", 0, -153, -74, 8, "road", "Bazaar Road"),
  ns("kotli", 0, 56, E, 8, "road", "Kotli Road"),
  // The link road west and east through the two outer villages.
  ew("pindLink", 720, -1100, 1100, 7, "road", "Pind Link Road"),
  // A continuous freight bypass keeps heavy vehicles out of residential galis.
  // Both arms meet G.T. Road, Nehar Road and the village link; canal bridges
  // are derived below from the same road rectangles.
  ns("bypassW", -1100, -1100, 1050, 12, "road", "Western Bypass"),
  ns("bypassE", 1100, -1100, 1050, 12, "road", "Eastern Bypass"),
  ew("bypassS", -1100, -1100, 1100, 12, "road", "Southern Freight Road"),
  ew("bypassN", 1050, -1100, 1100, 10, "road", "Northern Link Road"),
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
  ew("pindMain", 320, -182, 137, 7, "street", "Pind di Gali"),
  ns("pindCross", -80, 227, 415, 7, "street", "Akhada Gali"),
  // Kacha farm tracks.
  ns("trackW", -300, -E, E, 5, "track", "Kacha Rasta"),
  ns("trackWW", -600, -E, E, 5, "track", "Kacha Rasta"),
  ns("trackFW", -900, -E, E, 5, "track", "Kacha Rasta"),
  ns("trackSW", -120, -E, -167, 5, "track", "Kacha Rasta"),
  ns("trackSE", 300, -E, -167, 5, "track", "Kacha Rasta"),
  // North of the canal the Urban Estate road takes over up to the colony's back road.
  ns("trackNE", 300, 276, E, 5, "track", "Kacha Rasta"),
  // Ends at Pind Dhaliwal's phirni.
  ns("trackE", 740, -E, 601, 5, "track", "Kacha Rasta"),
  ns("trackFE", 900, -E, E, 5, "track", "Kacha Rasta"),
  ew("trackS", -400, -E, E, 5, "track", "Kacha Rasta"),
  ew("trackN", 450, -E, E, 5, "track", "Kacha Rasta"),
  ew("trackFS", -760, -E, E, 5, "track", "Kacha Rasta"),
  ew("trackFN", 880, -E, E, 5, "track", "Kacha Rasta"),
  // Short kacha lanes from the tracks to each farm (dera).
  ew("toDeraW", 57, -340, -302.5, 4, "track", "Dere da rasta"),
  ew("toDeraSW", -300, -117.5, -80, 4, "track", "Dere da rasta"),
  ew("toDeraNE", 300, 302.5, 330, 4, "track", "Dere da rasta"),
  ns("toDeraNW", -450, 452.5, 500, 4, "track", "Dere da rasta"),
  ew("toDeraSE", -300, 302.5, 440, 4, "track", "Dere da rasta"),
  // Colonies and village mohallas (colonies.ts).
  ...COLONIES.flatMap((c) => c.roads),
];

/** Bridges where north–south roads cross the canal. */
export const BRIDGES: Array<{ x: number; w: number }> = ROADS
  .filter((r) => r.z0 < CANAL.z0 && r.z1 > CANAL.z1)
  .map((r) => ({ x: (r.x0 + r.x1) / 2, w: Math.max(9, r.x1 - r.x0 + 3) }));

export type SiteKind =
  | "highwayDhaba" | "petrol" | "busAdda" | "ghantaGhar" | "mandi" | "park" | "thana" | "cinema"
  | "akhada" | "gurdwara" | "dera" | "kiln" | "kabaddi" | "toba" | "colonyPark" | "school" | "hospital" | "mandir" | "factory" | "dispensary" | "chaupal";

export interface Site extends Rect { id: string; kind: SiteKind; label: string; seed: number }

export const SITES: Site[] = [
  { id: "bypassMandi", kind: "mandi", label: "Bypass Anaj Mandi", x0: -894, x1: -808, z0: -1088, z1: -1024, seed: 71 },
  { id: "bypassAdda", kind: "busAdda", label: "Bypass Bus Adda", x0: -780, x1: -694, z0: -1088, z1: -1024, seed: 72 },
  { id: "bypassFuel", kind: "petrol", label: "Bypass Kisan Fuels", x0: -650, x1: -605, z0: -1142, z1: -1112, seed: 73 },
  { id: "bypassDhaba", kind: "highwayDhaba", label: "Bypass Truckers Dhaba", x0: -570, x1: -520, z0: -1147, z1: -1112, seed: 74 },
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
  { id: "deraSW", kind: "dera", label: "Bains Farm", x0: -80, x1: -45, z0: -320, z1: -285, seed: 13 },
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
  // Public buildings: the government school by the Urban Estate, the civil hospital on the G.T. Road.
  { id: "school", kind: "school", label: "Govt. Senior Secondary School", x0: 148, x1: 202, z0: 199, z1: 262, seed: 23 },
  { id: "hospital", kind: "hospital", label: "Civil Hospital", x0: 180, x1: 262, z0: -232, z1: -178, seed: 24 },
  // The Focal Point: three works along the G.T. Road west of the bazaar, and the village's dispensary and chaupal.
  { id: "facCycle", kind: "factory", label: "Shakti Cycle Works", x0: -588, x1: -532, z0: -148, z1: -102, seed: 25 },
  { id: "facHosiery", kind: "factory", label: "Punjab Hosiery Mills", x0: -524, x1: -468, z0: -148, z1: -102, seed: 26 },
  { id: "facMill", kind: "factory", label: "Kisan Rice & Flour Mill", x0: -460, x1: -404, z0: -148, z1: -102, seed: 27 },
  { id: "dispensary", kind: "dispensary", label: "Pind Kotli Dispensary", x0: 10, x1: 34, z0: 297, z1: 314, seed: 28 },
  { id: "chaupal", kind: "chaupal", label: "Kotli Chaupal", x0: 10, x1: 36, z0: 326, z1: 346, seed: 29 },
  // The new towns on the fields (colonies.ts): a bus adda, a petrol pump and a dhaba on the G.T. Road side of Naya
  // Sheher; a school there too; and Dhandra's mandi, kabaddi ground and school.
  { id: "nayaBusAdda", kind: "busAdda", label: "Naya Sheher Bus Adda", x0: 1180, x1: 1266, z0: -241, z1: -177, seed: 80 },
  { id: "nayaPetrol", kind: "petrol", label: "Naya Sheher Fuels", x0: 1290, x1: 1335, z0: -225, z1: -195, seed: 81 },
  { id: "nayaDhaba", kind: "highwayDhaba", label: "Naya Sheher Dhaba", x0: 1020, x1: 1070, z0: -140, z1: -105, seed: 82 },
  { id: "nayaSchool", kind: "school", label: "Naya Sheher Model School", x0: 1000, x1: 1054, z0: 20, z1: 83, seed: 83 },
  { id: "dhandraMandi", kind: "mandi", label: "Dhandra Sabzi Mandi", x0: 600, x1: 686, z0: -1000, z1: -936, seed: 84 },
  { id: "dhandraKabaddi", kind: "kabaddi", label: "Dhandra Kabaddi Ground", x0: 600, x1: 655, z0: -880, z1: -820, seed: 85 },
  { id: "dhandraSchool", kind: "school", label: "Dhandra Govt. School", x0: 380, x1: 434, z0: -1080, z1: -1017, seed: 86 },
  // Sukh Pahar: the bus adda and petrol pump at the Mall's entry from the bypass, the police chowki, and the clock tower.
  { id: "hillBusAdda", kind: "busAdda", label: "Sukh Pahar Bus Adda", x0: 1112, x1: 1198, z0: 240, z1: 304, seed: 87 },
  { id: "hillPetrol", kind: "petrol", label: "Sukh Pahar Fuels", x0: 1112, x1: 1157, z0: 336, z1: 366, seed: 88 },
  { id: "hillThana", kind: "thana", label: "Sukh Pahar Police Chowki", x0: 1202, x1: 1232, z0: 345, z1: 373, seed: 89 },
  { id: "hillClock", kind: "ghantaGhar", label: "Sukh Pahar Ghanta Ghar", x0: 1315, x1: 1343, z0: 338, z1: 366, seed: 90 },
  ...COLONY_SITES,
];

export function site(id: string): Site {
  const s = SITES.find((x) => x.id === id);
  if (!s) throw new Error(`unknown site ${id}`);
  return s;
}

// ---------------------------------------------------------------- Buildings outside the bazaar

/** "kothi" is a colony house: boundary wall and gate, a small front yard, the house behind. */
export type OuterStyle = "city" | "village" | "farm" | "kothi";
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
/** Chaura Bazaar trades: hosiery, knitwear and cycles, with the usual mixed in. */
const LUDH_SIGNS = ["lHosiery", "lKnit", "lCycle", "lShawl", "lMachine", "lHosiery", "lKnit", "cCloth", "cJewel", "cMithai", "cLassi", "cMobile"];
/** The Mall of Sukh Pahar: a hotel, sweets and lassi, woollens, books, a chemist, a salon and jewellers. */
const HILL_SIGNS = ["cHotel", "cLassi", "cMithai", "cCloth", "cBooks", "cMedical", "cSalon", "cJewel"];

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

/** One row of shopfronts: its id prefix and seed, its trades, its storeys, the zone it stays in, and its own rng seed. */
interface ShopRow { prefix: string; seed: number; signs: string[]; floors: [number, number]; zone: Rect; rng: number }

/**
 * Shopfronts packed shoulder to shoulder along both sides of the given streets, inside the row's zone, almost all of
 * them open for business. Built off the road line rather than the block interior, which is what gives the narrow,
 * walled bazaar feeling of Ludhiana and of the Mall in Sukh Pahar.
 */
function shopFronts(streets: Road[], row: ShopRow, taken: OuterBuilding[]): OuterBuilding[] {
  const out: OuterBuilding[] = [];
  const rng = new Rng(row.rng);
  let n = 0;
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
        if (!inRectR(row.zone, (rect.x0 + rect.x1) / 2, (rect.z0 + rect.z1) / 2, 20)) continue;
        if (SITES.some((s) => intersects(s, rect, 1.5))) continue;
        if (ROADS.some((rd) => intersects(rd, rect, 1))) continue;
        if (out.some((o) => intersects(o, rect, 0.15)) || taken.some((o) => intersects(o, rect, 0.5))) continue;
        out.push({
          id: `${row.prefix}${n}`, style: "city", ...rect,
          // sd < 0 is the west/south side of the street, so its front edge is
          // the far one and it must look back ACROSS the road: +X for a
          // north-south street, +Z for an east-west one. This was inverted,
          // which built every shopfront on the north-south streets — Chaura
          // Bazaar Road and both galis — facing into the block instead of
          // onto the street. From the street you saw a blank wall, which is
          // why the first mission's mobile shop was "just a block".
          face: alongX ? (sd < 0 ? 0 : Math.PI) : (sd < 0 ? Math.PI / 2 : -Math.PI / 2),
          floors: rng.int(row.floors[0], row.floors[1]), color: rng.pick(CITY_COLORS),
          shop: rng.next() < 0.95 ? rng.pick(row.signs) : undefined, seed: row.seed + n,
        });
        n++;
      }
    }
  }
  return out;
}

/** Ludhiana's frontages: three to six floors of shops on every street of the district. */
function ludhianaBuildings(taken: OuterBuilding[]): OuterBuilding[] {
  return shopFronts(ROADS.filter((r) => r.id.startsWith("ludh")), { prefix: "ludh", seed: 4000, signs: LUDH_SIGNS, floors: [3, 6], zone: LUDHIANA, rng: 8181 }, taken);
}

const BASE_OUTER = [...cityBuildings(), ...villageBuildings()];
const BYPASS_SHOPS: OuterBuilding[] = ["cDhaba", "cLassi", "cMedical", "cBooks", "cCloth", "cMithai"].map((shop, i) => ({
  id: `bypassShop${i}`, style: "city", x0: -892 + i * 12, x1: -882 + i * 12, z0: -1130, z1: -1113,
  face: 0, floors: 2, color: CITY_COLORS[i % CITY_COLORS.length]!, shop, seed: 7800 + i,
}));
const TOWN_OUTER = [...BASE_OUTER, ...ludhianaBuildings(BASE_OUTER), ...BYPASS_SHOPS];
/** The Mall of Sukh Pahar: shops on both sides of the road through the hill station. */
const MALL_SHOPS = shopFronts([ROADS.find((r) => r.id === "col_hillMall")!], { prefix: "hillShop", seed: 4400, signs: HILL_SIGNS, floors: [2, 4], zone: COLONIES.find((c) => c.id === "hill")!.rect, rng: 6262 }, TOWN_OUTER);
export const OUTER_BUILDINGS: OuterBuilding[] = [...TOWN_OUTER, ...MALL_SHOPS, ...colonyHouses(ROADS, SITES, [...TOWN_OUTER, ...MALL_SHOPS])];

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

/**
 * The civic buildings of Nawan Shehar: the bank and its ATM by the main crossing, the post office on the next
 * avenue. Each is a city frontage that has been given its sign; the same counter geometry as a shop.
 */
export interface Civic { kind: "bank" | "atm" | "post"; id: string; x: number; z: number; yaw: number; cx: number; cz: number }
export const CIVIC: Civic[] = (() => {
  const out: Civic[] = [];
  const taken = new Set<string>();
  const pick = (kind: Civic["kind"], key: string, nx: number, nz: number) => {
    let best: OuterBuilding | null = null, bd = Infinity;
    for (const b of OUTER_BUILDINGS) {
      if (b.style !== "city" || taken.has(b.id) || b.id === MOBILE_SHOP.building) continue;
      // A frontage on a street, not a building tucked behind.
      const d = Math.hypot((b.x0 + b.x1) / 2 - nx, (b.z0 + b.z1) / 2 - nz);
      if (d < bd) { bd = d; best = b; }
    }
    const b = best!;
    taken.add(b.id);
    b.shop = key;
    const fx = Math.round(Math.sin(b.face)), fz = Math.round(Math.cos(b.face));
    const cx = (b.x0 + b.x1) / 2, cz = (b.z0 + b.z1) / 2;
    const ex = fx ? (fx > 0 ? b.x1 : b.x0) : cx, ez = fz ? (fz > 0 ? b.z1 : b.z0) : cz;
    out.push({ kind, id: b.id, x: ex - fx * 2.0, z: ez - fz * 2.0, yaw: b.face, cx: ex + fx * 0.9, cz: ez + fz * 0.9 });
  };
  pick("bank", "cBank", 316, 12);
  pick("atm", "cAtm", 316, -14);
  pick("post", "cPost", 384, -64);
  return out;
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
  ...COLONIES.map((c) => c.rect),
  { x0: WORLD.minX, x1: WORLD.maxX, z0: CANAL.z0 - 10, z1: CANAL.z1 + 6 },
  // The railway corridor (world/Rail.ts).
  { x0: WORLD.minX, x1: WORLD.maxX, z0: RAIL.z - RAIL.half, z1: RAIL.z + RAIL.half },
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
  // Colony galis stay inside their (unfarmed) colonies: cutting the whole map
  // along them would slice every field for a kilometre into thin strips.
  const colonyRoads = new Set(COLONIES.flatMap((c) => c.roads));
  for (const r of ROADS) {
    if (colonyRoads.has(r)) continue;
    if (r.x1 - r.x0 < r.z1 - r.z0) { xs.add(r.x0 - 3); xs.add(r.x1 + 3); } else { zs.add(r.z0 - 3); zs.add(r.z1 + 3); }
  }
  // The railway cuts the fields cleanly along both edges of its corridor.
  zs.add(RAIL.z - RAIL.half); zs.add(RAIL.z + RAIL.half);
  const X = [...xs].sort((a, b) => a - b), Z = [...zs].sort((a, b) => a - b);
  const place = (r: Rect, depth: number) => {
    const w = r.x1 - r.x0, h = r.z1 - r.z0;
    if (w < 14 || h < 14) return;
    if (!blocked(r) && w <= 80 && h <= 80) {
      out.push({ id: `plot${out.length}`, ...r, crop: rng.pick(crops), rowsAlongX: rng.next() < 0.5, seed: out.length + 1 });
      return;
    }
    if (depth > 8) return;
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
      if (cell.z0 >= RAIL.z - RAIL.half - 0.01 && cell.z1 <= RAIL.z + RAIL.half + 0.01) continue;
      place(cell, 0);
    }
  }
  return out;
}

export const PLOTS: Plot[] = buildPlots();

// ---------------------------------------------------------------- Queries

// Grass, pedestrians and roadside props ask these thousands of times while moving.
// Index expanded bounds once, retaining exact tests and the original road priority.
const roadIndex = new RectIndex(ROADS, 40, 8);
const buildingIndex = new RectIndex(OUTER_BUILDINGS, 40, 0.6);

export function inRectR(r: Rect, x: number, z: number, pad = 0): boolean {
  return x >= r.x0 - pad && x <= r.x1 + pad && z >= r.z0 - pad && z <= r.z1 + pad;
}

export function onRoad(x: number, z: number, pad = 0): Road | null {
  for (const r of pad <= 8 ? roadIndex.at(x, z) : ROADS) if (inRectR(r, x, z, pad)) return r;
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
  if (buildingIndex.at(x, z).some((b) => inRectR(b, x, z, 0.6))) return false;
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
 * Punjab roads come in every condition. The planned colonies (Model Town,
 * Urban Estate, Sarabha Nagar) and the four-laned G.T. Road are smooth fresh
 * tarmac; the Nawan Shehar avenues and link roads are patched but fine; old
 * Ludhiana, the older colonies, the Nehar Road and the village galis are
 * "tooti-footi" — real potholes you drop into and a surface that rattles the
 * whole vehicle; kacha tracks are ruts and chikkad (mud).
 */
export type RoadCondition = "good" | "fair" | "bad" | "kacha";
export type DefectKind = "pothole" | "patch" | "gravel" | "mud";
/** A road defect. Potholes are real holes `depth` metres deep, cut into the road and the ground. */
export interface Defect { x: number; z: number; r: number; kind: DefectKind; rot: number; depth: number; road: string }

const GOOD_COLONIES = ["col_model", "col_estate", "estate", "col_sarabha"];
const BAD_COLONIES = ["col_gnn", "col_kitchlu"];

export function roadCondition(r: Road): RoadCondition {
  const id = r.id;
  if (r.kind === "track") return "kacha";
  if (id === "gt" || GOOD_COLONIES.some((p) => id.startsWith(p))) return "good";
  if (id.startsWith("ludh") || id === "nehar" || id.startsWith("pind") && id !== "pindLink" || BAD_COLONIES.some((p) => id.startsWith(p))) return "bad";
  return "fair";
}

/** Chance per 10 m of a defect, and which kinds, for each condition. */
const ROUGHNESS: Record<RoadCondition, { p: number; kinds: DefectKind[] }> = {
  good: { p: 0, kinds: [] },
  fair: { p: 0.16, kinds: ["patch", "patch", "patch", "gravel", "pothole"] },
  bad: { p: 0.6, kinds: ["pothole", "pothole", "pothole", "patch", "gravel"] },
  kacha: { p: 0.55, kinds: ["mud", "mud", "pothole", "gravel"] },
};
/** Height (m) of the small bumps all over a road's surface that shake a vehicle. */
const ROUGH_AMP: Record<RoadCondition, number> = { good: 0, fair: 0.004, bad: 0.016, kacha: 0.026 };

/** Long roads are built in pieces this long (country.ts); a pothole never straddles a piece end. */
export const ROAD_SEG = 120;
/** The ground is laid in tiles this big; a pothole never straddles a tile edge either. */
export const GROUND_TILE = 100;

function buildDefects(): Defect[] {
  const rng = new Rng(9119);
  const out: Defect[] = [];
  const crosses = (v: number, s: number, step: number, o = 0) => Math.floor((v - s - o) / step) !== Math.floor((v + s - o) / step);
  for (const r of ROADS) {
    const cond = roadCondition(r);
    const rough = ROUGHNESS[cond];
    if (rough.p === 0) continue;
    // Ludhiana's bazaar streets are the worst-kept tarmac in the game: this is
    // where an overloaded auto catches a pothole and goes over.
    const p = r.id.startsWith("ludh") ? 0.8 : rough.p;
    const alongX = r.x1 - r.x0 >= r.z1 - r.z0;
    const a0 = alongX ? r.x0 : r.z0;
    const len = alongX ? r.x1 - r.x0 : r.z1 - r.z0;
    const w = alongX ? r.z1 - r.z0 : r.x1 - r.x0;
    const nSeg = Math.max(1, Math.ceil(len / ROAD_SEG));
    const holes: Array<[number, number]> = [];
    const addHole = (x: number, z: number, rr: number): boolean => {
      const s = holeHalf({ r: rr } as Defect);
      const a = alongX ? x : z;
      // Clear of other roads, other potholes along this one, piece ends and ground tiles.
      if (ROADS.some((o) => o !== r && inRectR(o, x, z, s + 0.4))) return false;
      if (holes.some(([b0, b1]) => a + s > b0 - 0.2 && a - s < b1 + 0.2)) return false;
      if (crosses(a - a0, s, len / nSeg) || crosses(x, s, GROUND_TILE) || crosses(z, s, GROUND_TILE)) return false;
      if (Math.abs((alongX ? z - (r.z0 + r.z1) / 2 : x - (r.x0 + r.x1) / 2)) > w / 2 - s - 0.1) return false;
      holes.push([a - s, a + s]);
      out.push({ x, z, r: rr, kind: "pothole", rot: rng.next() * Math.PI, depth: rng.range(0.07, 0.14) * (cond === "kacha" ? 1.4 : 1), road: r.id });
      return true;
    };
    for (let a = 6; a < len - 6; a += 10) {
      // Bad stretches come in clusters.
      const stretch = Math.sin(a * 0.013 + r.x0 * 0.01 + r.z0 * 0.017) > 0.2 ? 1.6 : 0.5;
      if (rng.next() > p * stretch) continue;
      const kind = rng.pick(rough.kinds);
      const lat = rng.range(-w / 2 + 1, w / 2 - 1);
      const along = a0 + a + rng.range(-4, 4);
      const x = alongX ? along : (r.x0 + r.x1) / 2 + lat;
      const z = alongX ? (r.z0 + r.z1) / 2 + lat : along;
      if (z > CANAL.z0 - 3 && z < CANAL.z1 + 3) continue;
      if (kind === "pothole") {
        const rr = rng.range(0.45, 0.95);
        if (!addHole(x, z, rr)) continue;
        // Potholes often come in pairs or threes, one after the other.
        if (rng.next() < 0.5) {
          const r2 = rr * rng.range(0.6, 1), d = (rr + r2) * 1.2 + 0.6;
          addHole(alongX ? x + d : x + rng.range(-0.8, 0.8), alongX ? z + rng.range(-0.8, 0.8) : z + d, r2);
        }
        continue;
      }
      const rr = kind === "mud" ? rng.range(1.8, Math.min(4.5, w * 0.7)) : kind === "gravel" ? rng.range(1.5, 3) : rng.range(1.2, 2.6);
      out.push({ x, z, r: rr, kind, rot: rng.next() * Math.PI, depth: kind === "mud" ? 0.05 : kind === "gravel" ? 0.02 : 0, road: r.id });
    }
  }
  return out;
}

/** Half the side of the square cut out of the road and ground around a pothole. */
export function holeHalf(d: Defect): number {
  return d.r * 1.15 + 0.05;
}

export const DEFECTS: Defect[] = (() => {
  const all = buildDefects();
  const holes = all.filter((d) => d.kind === "pothole");
  // A patch or puddle never lies over a pothole (it would float over the hole).
  return all.filter((d) => d.kind === "pothole" || !holes.some((h) => Math.abs(h.x - d.x) < d.r + holeHalf(h) && Math.abs(h.z - d.z) < d.r + holeHalf(h)));
})();

const DEFECT_CELL = 16;
const defectGrid = new Map<string, Defect[]>();
const roadGrid = new Map<string, Road[]>();
const cellsOf = (x0: number, z0: number, x1: number, z1: number, fn: (k: string) => void) => {
  for (let gx = Math.floor(x0 / DEFECT_CELL); gx <= Math.floor(x1 / DEFECT_CELL); gx++) {
    for (let gz = Math.floor(z0 / DEFECT_CELL); gz <= Math.floor(z1 / DEFECT_CELL); gz++) fn(`${gx},${gz}`);
  }
};
for (const d of DEFECTS) {
  if (d.kind === "patch") continue;
  cellsOf(d.x - d.r, d.z - d.r, d.x + d.r, d.z + d.r, (k) => { const l = defectGrid.get(k) ?? []; l.push(d); defectGrid.set(k, l); });
}
const roadCond = new Map<Road, number>();
for (const r of ROADS) {
  const amp = ROUGH_AMP[roadCondition(r)];
  if (!amp) continue;
  roadCond.set(r, amp);
  cellsOf(r.x0, r.z0, r.x1, r.z1, (k) => { const l = roadGrid.get(k) ?? []; l.push(r); roadGrid.set(k, l); });
}

/** The pothole or mud under a point, if any (gravel/patch are cosmetic). */
export function defectAt(x: number, z: number): Defect | null {
  const l = defectGrid.get(`${Math.floor(x / DEFECT_CELL)},${Math.floor(z / DEFECT_CELL)}`);
  if (!l) return null;
  for (const d of l) if ((d.x - x) ** 2 + (d.z - z) ** 2 < d.r * d.r && (d.kind === "pothole" || d.kind === "mud")) return d;
  return null;
}

/** Depth profile of a pothole: flat bottom, sloping broken edge. */
function bowl(d: Defect, dist: number): number {
  const t = dist / d.r;
  if (t >= 1) return 0;
  return d.depth * (t < 0.55 ? 1 : (1 - t) / 0.45);
}

export interface Surface { kind: DefectKind | "rough"; depth: number }
const surf: Surface = { kind: "rough", depth: 0 };
/**
 * What a wheel touching the road at (x, z) sits on, and how far below the
 * flat road it sits: inside a pothole, in mud, or among the small bumps of a
 * badly kept road. Null on smooth tarmac and off the roads. (Shared result
 * object: read it before the next call.)
 */
export function surfaceAt(x: number, z: number): Surface | null {
  const k = `${Math.floor(x / DEFECT_CELL)},${Math.floor(z / DEFECT_CELL)}`;
  let depth = 0, kind: Surface["kind"] | null = null;
  const roads = roadGrid.get(k);
  if (roads) {
    for (const r of roads) {
      if (!inRectR(r, x, z)) continue;
      const amp = roadCond.get(r)!;
      const n = Math.sin(x * 2.3 + z * 0.9) * Math.sin(z * 2.9 - x * 0.6) + 0.5 * Math.sin(x * 7.1 + 1.3) * Math.sin(z * 6.7);
      depth = amp * (0.5 + n / 3);
      kind = "rough";
      break;
    }
  }
  const l = defectGrid.get(k);
  if (l) {
    for (const d of l) {
      const dist = Math.hypot(d.x - x, d.z - z);
      if (dist >= d.r) continue;
      if (d.kind === "pothole") { depth = Math.max(depth, bowl(d, dist)); kind = "pothole"; }
      else if (d.kind === "mud") { depth += d.depth * (1 - dist / d.r); kind = "mud"; }
      else { depth += d.depth * Math.abs(Math.sin(x * 9 + z * 11)); kind = kind ?? "gravel"; }
      break;
    }
  }
  if (kind === null) return null;
  surf.kind = kind;
  surf.depth = depth;
  return surf;
}

// ---------------------------------------------------------------- Waterlogging

/**
 * Where the water stands after a proper downpour: low chowks and galis whose
 * drains are choked — old Ludhiana, the older colonies, the bus adda, the
 * village gali by the toba. Knee-deep at the worst. The planned colonies
 * (Model Town, Urban Estate, Sarabha Nagar) have working sewers and stay dry.
 */
export interface FloodZone extends Rect { id: string; name: string; /** Water depth (m) at the centre in a full flood. */ depth: number }

/** A flood zone along a stretch of road, spilling a little onto the sides. */
function floodOn(id: string, roadId: string, from: number, to: number, depth: number, name: string): FloodZone {
  const r = ROADS.find((q) => q.id === roadId)!;
  const alongX = r.x1 - r.x0 >= r.z1 - r.z0;
  const spill = 1.2;
  return alongX
    ? { id, name, depth, x0: from, x1: to, z0: r.z0 - spill, z1: r.z1 + spill }
    : { id, name, depth, x0: r.x0 - spill, x1: r.x1 + spill, z0: from, z1: to };
}

export const FLOOD_ZONES: FloodZone[] = [
  floodOn("fDalBazaar", "ludhG1", -262, -228, 0.45, "Dal Bazaar Gali"),
  floodOn("fGhumar", "ludhS1", -562, -530, 0.35, "Ghumar Mandi"),
  floodOn("fChaura", "ludhA0", -372, -342, 0.3, "Chaura Bazaar"),
  floodOn("fKitchlu", "col_kitchlu1", -332, -300, 0.4, "Kitchlu Nagar"),
  floodOn("fGnn", "col_gnn1", 18, 50, 0.3, "Guru Nanak Nagar"),
  floodOn("fNehar", "nehar", 20, 58, 0.25, "Nehar Road"),
  floodOn("fPind", "pindMain", -44, -12, 0.4, "Pind di Gali"),
  floodOn("fBazaarGate", "bazaarS", -122, -98, 0.25, "Bazaar Road"),
  floodOn("fBusAdda", "ave2", -112, -84, 0.3, "Bus Adda Road"),
];

/** How far (0..1) a point is into a flood zone's rounded shape: 1 in the middle, 0 at and past the edge. */
export function floodShape(f: FloodZone, x: number, z: number): number {
  const hx = (f.x1 - f.x0) / 2, hz = (f.z1 - f.z0) / 2;
  const u = Math.abs(x - (f.x0 + f.x1) / 2) / hx, v = Math.abs(z - (f.z0 + f.z1) / 2) / hz;
  const d = u ** 4 + v ** 4;
  return d >= 1 ? 0 : Math.min(1, (1 - d) * 3);
}

// ---------------------------------------------------------------- Loose bricks

/**
 * Half-bricks lying about: beside the kiln, at the roadworks that never
 * finish, on the Ludhiana galis and in the bazaar. Something to reach for
 * when a jhagda turns serious — see combat/Combat.ts.
 */
export const BRICK_PILES: Array<{ x: number; z: number }> = [
  // Ranggarh bazaar: the chowk repairs everyone complains about.
  { x: 6.6, z: -18.5 }, { x: -6.6, z: 12.0 },
  // Ludhiana: the galis and the mandi edge.
  { x: -419.5, z: -252 }, { x: -410.5, z: -272 }, { x: -529.5, z: -228 },
  { x: -476, z: -306 }, { x: -464, z: -232 },
  // Nawan Shehar chowk and bus adda.
  { x: 313, z: -4 }, { x: 404, z: -96 },
  // The brick kiln, where they come from.
  { x: 496, z: -498 }, { x: 496, z: -506 },
  // Pind Kotli: a half-built room by the lane.
  { x: -70, z: 312 },
];

// ---------------------------------------------------------------- Street vendors

export type RehriGoods = "sabzi" | "fruit" | "chaat" | "ganna";

/** Roads with rehris standing on the tarmac's edge: traffic keeps clear of them. */
export const CART_ROADS = new Set(["ludhS1", "ludhS2", "ludhA1", "ludhA0", "ludhG0", "ludhG1", "st1", "ave1", "st0"]);

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
