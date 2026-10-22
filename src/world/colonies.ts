/**
 * Planned colonies and village mohallas, laid out the way a town planner (or
 * a coloniser with a bulldozer and a PUDA licence) would: a main road or two
 * along the edges, parallel galis every 40–45 m between them, plots of
 * 10–15 m frontage backing onto the next gali's plots, and one block left
 * open as a park. Villages get a phirni (ring road) round the abadi, a
 * vehra and patti galis inside it, a gurdwara and a toba (pond).
 *
 * This module is plain data plus the house placer. region.ts folds the roads
 * into ROADS (so traffic, the walk graphs and the map pick them up) and the
 * houses into OUTER_BUILDINGS; zones.ts zones each one; countryFolk.ts fills
 * the galis with people.
 *
 * Axes and units as in region.ts. Every road is an axis-aligned rectangle.
 */
import { Rng } from "../render/textures";
import type { Rect } from "./layout";
import type { OuterBuilding, Road, RoadKind, Site } from "./region";

export function ns(id: string, x: number, z0: number, z1: number, w: number, kind: RoadKind, name: string): Road {
  return { id, x0: x - w / 2, x1: x + w / 2, z0, z1, kind, name };
}
export function ew(id: string, z: number, x0: number, x1: number, w: number, kind: RoadKind, name: string): Road {
  return { id, x0, x1, z0: z - w / 2, z1: z + w / 2, kind, name };
}

export interface Colony {
  id: string;
  name: string;
  /** "colony": kothis behind boundary walls. "village": brick and lime-washed pind houses. */
  kind: "colony" | "village";
  /** The planned area: zoned, never farmed, houses stay inside it. */
  rect: Rect;
  /** The colony's own roads and galis. */
  roads: Road[];
  /**
   * Roads houses are built along, with the sides to build on (-1 west/south,
   * +1 east/north). A phirni only gets houses on its inner side.
   */
  frontages: Array<{ id: string; sides: Array<-1 | 1> }>;
  /** Open blocks: parks, the toba, the gurdwara. No houses here. */
  open: Rect[];
  /** Where the place is named for travel and the map. */
  centre: { x: number; z: number };
}

const both: Array<-1 | 1> = [-1, 1];
const front = (ids: string[], sides = both) => ids.map((id) => ({ id, sides }));

function colony(id: string, name: string, rect: Rect, roads: Road[], open: Rect[], centre: { x: number; z: number }, frontIds?: string[]): Colony {
  // By default the galis (narrow roads) carry the houses; the wider colony
  // roads that tie them together are the block edges.
  const ids = frontIds ?? roads.filter((r) => Math.min(r.x1 - r.x0, r.z1 - r.z0) <= 6.01).map((r) => r.id);
  return { id, name, kind: "colony", rect, roads, frontages: front(ids), open, centre };
}

/**
 * The plan. Galis run from main road to main road so traffic never meets a
 * dead end; cross roads line up with the Nawan Shehar streets they continue.
 */
export const COLONIES: Colony[] = [
  // ---- Ranggarh: two colonies outside the bazaar walls, between the G.T. Road and the Nehar Road.
  colony("gnn", "Guru Nanak Nagar", { x0: -258, x1: -74, z0: -153, z1: 146 }, [
    ...[-235, -190, -145, -100].map((x, i) => ns(`col_gnn${i}`, x, -153, 146, 6, "street", `Guru Nanak Nagar, Gali ${i + 1}`)),
    ew("col_gnnA", -80, -238, -97, 7, "street", "Guru Nanak Nagar Road"),
    ew("col_gnnB", 0, -238, -97, 8, "street", "Guru Nanak Nagar Main Road"),
    ew("col_gnnC", 70, -238, -97, 7, "street", "Guru Nanak Nagar Road"),
  ], [{ x0: -185.5, x1: -149.5, z0: -75, z1: -5 }], { x: -167, z: 0 }),
  colony("sant", "Sant Nagar", { x0: 45, x1: 190, z0: -153, z1: 146 }, [
    ...[70, 115, 160].map((x, i) => ns(`col_sant${i}`, x, -153, 146, 6, "street", `Sant Nagar, Gali ${i + 1}`)),
    ew("col_santA", -80, 67, 195, 7, "street", "Sant Nagar Road"),
    ew("col_santB", 0, 67, 195, 8, "street", "Sant Nagar Main Road"),
    ew("col_santC", 70, 67, 195, 7, "street", "Sant Nagar Road"),
  ], [{ x0: 119.5, x1: 155.5, z0: -75, z1: -5 }], { x: 92, z: 0 }),

  // ---- Nawan Shehar: Model Town east of the grid (its streets carry on
  // through it), and the Urban Estate on the far bank of the canal.
  colony("model", "Model Town", { x0: 506, x1: 690, z0: -153, z1: 146 }, [
    ...[528, 573, 618, 663].map((x, i) => ns(`col_model${i}`, x, -153, 146, 6, "street", `Model Town, Gali ${i + 1}`)),
    ew("col_modelA", -80, 505, 666, 8, "street", "Model Town Road"),
    ew("col_modelB", 0, 505, 666, 8, "street", "Model Town Main Road"),
    ew("col_modelC", 70, 505, 666, 8, "street", "Model Town Road"),
  ], [{ x0: 577.5, x1: 613.5, z0: 5, z1: 65 }], { x: 550, z: 0 }),
  colony("estate", "Urban Estate", { x0: 205, x1: 515, z0: 186, z1: 276 }, [
    ew("col_estateCanal", 192, 4, 515, 8, "street", "Nehar Bank Road"),
    ns("estate", 300, 154, 276, 8, "street", "Urban Estate Road"),
    ...[230, 270, 340, 385, 430, 475].map((x, i) => ns(`col_estate${i}`, x, 196, 272, 6, "street", `Urban Estate, Gali ${i + 1}`)),
    ew("col_estateN", 272, 227, 478, 6, "street", "Urban Estate Back Road"),
  ], [], { x: 250, z: 192 }, [0, 1, 2, 3, 4, 5].map((i) => `col_estate${i}`)),

  // ---- Ludhiana: Sarabha Nagar south of the bazaar and Kitchlu Nagar to the east.
  colony("sarabha", "Sarabha Nagar", { x0: -600, x1: -340, z0: -565, z1: -389 }, [
    ...[-575, -535, -495, -455, -415, -375].map((x, i) => ns(`col_sarabha${i}`, x, -560, -389, 6, "street", `Sarabha Nagar, Gali ${i + 1}`)),
    ew("col_sarabhaS", -560, -590, -350, 7, "street", "Sarabha Nagar Road"),
    ew("col_sarabhaX", -480, -578, -372, 6, "street", "Sarabha Nagar Cross Gali"),
  ], [{ x0: -490.5, x1: -459.5, z0: -553, z1: -484 }], { x: -515, z: -480 }, [0, 1, 2, 3, 4, 5].map((i) => `col_sarabha${i}`)),
  colony("kitchlu", "Kitchlu Nagar", { x0: -297, x1: -123, z0: -397, z1: -167 }, [
    ...[-275, -235, -195, -155].map((x, i) => ns(`col_kitchlu${i}`, x, -397.5, -167, 6, "street", `Kitchlu Nagar, Gali ${i + 1}`)),
    ew("col_kitchluA", -290, -297.5, -122.5, 8, "street", "Ghumar Mandi Road"),
    ew("col_kitchluB", -230, -278, -152, 6, "street", "Kitchlu Nagar Cross Gali"),
  ], [], { x: -215, z: -290 }, [0, 1, 2, 3].map((i) => `col_kitchlu${i}`)),

  // ---- Villages.
  {
    id: "kotli", name: "Pind Kotli", kind: "village", rect: { x0: -192, x1: 146, z0: 216, z1: 426 },
    roads: [
      ew("pindPhirniS", 224, -185, 140, 6, "street", "Phirni"),
      ew("pindPhirniN", 418, -185, 140, 6, "street", "Phirni"),
      ns("pindPhirniW", -185, 221, 421, 6, "street", "Phirni"),
      ns("pindPhirniE", 140, 221, 421, 6, "street", "Phirni"),
      ew("pindVehra", 272, -182, 137, 5, "street", "Vehra Gali"),
      ns("pindPatti", -130, 227, 316.5, 5, "street", "Patti Gali"),
      ns("pindDharamsala", 55, 227, 316.5, 5, "street", "Dharamsala Gali"),
      ns("pindToba", 118, 323.5, 415, 5, "street", "Gurdwara Gali"),
    ],
    frontages: [
      ...front(["pindVehra", "pindPatti", "pindDharamsala", "pindToba"]),
      { id: "pindPhirniS", sides: [1] }, { id: "pindPhirniN", sides: [-1] },
      { id: "pindPhirniW", sides: [1] }, { id: "pindPhirniE", sides: [-1] },
    ],
    open: [], centre: { x: -12, z: 316 },
  },
  village("dhaliwal", "Pind Dhaliwal", 1),
  village("bhangu", "Pind Bhangu", -1),
];

/**
 * The two new villages on the Pind Link Road, mirror images of each other
 * across Kotli Road (side = +1 east, -1 west): phirni, a cross gali on the
 * old farm track's line, two mohalla galis, the toba and a landmark.
 */
function village(id: string, name: string, side: 1 | -1): Colony {
  const X = (a: number) => side * a;
  const lo = (a: number, b: number) => Math.min(X(a), X(b)), hi = (a: number, b: number) => Math.max(X(a), X(b));
  const P = `pind${id[0]!.toUpperCase()}${id.slice(1)}`;
  return {
    id, name, kind: "village",
    rect: { x0: lo(615, 865), x1: hi(615, 865), z0: 598, z1: 842 },
    roads: [
      ew(`${P}PhirniS`, 604, lo(620, 860), hi(620, 860), 6, "street", "Phirni"),
      ew(`${P}PhirniN`, 836, lo(620, 860), hi(620, 860), 6, "street", "Phirni"),
      ns(`${P}PhirniW`, X(side > 0 ? 625 : 855), 601, 839, 6, "street", "Phirni"),
      ns(`${P}PhirniE`, X(side > 0 ? 855 : 625), 601, 839, 6, "street", "Phirni"),
      ns(`${P}Cross`, X(740), 607, 833, 6, "street", `${name} di Gali`),
      ew(`${P}Gali1`, 660, lo(628, 852), hi(628, 852), 5, "street", "Mohalla Gali"),
      ew(`${P}Gali2`, 780, lo(628, 852), hi(628, 852), 5, "street", "Mohalla Gali"),
    ],
    frontages: [
      ...front([`${P}Cross`, `${P}Gali1`, `${P}Gali2`, "pindLink"]),
      { id: `${P}PhirniS`, sides: [1] }, { id: `${P}PhirniN`, sides: [-1] },
      { id: `${P}PhirniW`, sides: [side > 0 ? 1 : -1] }, { id: `${P}PhirniE`, sides: [side > 0 ? -1 : 1] },
    ],
    open: [], centre: { x: X(700), z: 720 },
  };
}

/** Landmarks inside the new villages (merged into SITES). */
export const COLONY_SITES: Site[] = [
  { id: "dhaliwalGurdwara", kind: "gurdwara", label: "Gurdwara Sahib, Dhaliwal", x0: 790, x1: 842, z0: 727, z1: 774, seed: 30 },
  { id: "dhaliwalToba", kind: "toba", label: "Dhaliwal Toba", x0: 650, x1: 705, z0: 730, z1: 772, seed: 31 },
  { id: "bhanguKabaddi", kind: "kabaddi", label: "Bhangu Kabaddi Ground", x0: -842, x1: -790, z0: 727, z1: 774, seed: 32 },
  { id: "bhanguToba", kind: "toba", label: "Bhangu Toba", x0: -705, x1: -650, z0: 730, z1: 772, seed: 33 },
  ...COLONIES.flatMap((c) => c.open.map((r, i) => ({ id: `${c.id}Park${i}`, kind: "colonyPark" as const, label: `${c.name} Park`, ...r, seed: 40 + i + c.id.length }))),
];

// ---------------------------------------------------------------- Houses

/** Kothi colours: what the painter had left over, which is every pastel there is. */
const KOTHI_COLORS = ["#f1e3c6", "#e9cfa6", "#f3d4c4", "#d8e2cf", "#cfe0e6", "#efe6d8", "#f6dba2", "#e4c7d6", "#d6d0e8", "#f0c9a8", "#c9dcc0", "#fbe7b5"];
const PIND_COLORS = ["#b5654a", "#c27a5c", "#a85a44", "#e8dcc4", "#d9c8a8", "#e9e1cf", "#cbb59a"];

function intersects(a: Rect, b: Rect, pad = 0): boolean {
  return a.x0 < b.x1 + pad && a.x1 > b.x0 - pad && a.z0 < b.z1 + pad && a.z1 > b.z0 - pad;
}

/**
 * Plots along every frontage of every colony: frontage 10–15 m, depth as much
 * as the block allows up to 17 m (so plots on neighbouring galis meet back to
 * back), a 1.5 m kerb in front. Corners stay clear of the cross roads.
 */
export function colonyHouses(allRoads: Road[], sites: Rect[], taken: OuterBuilding[]): OuterBuilding[] {
  const out: OuterBuilding[] = [];
  const rng = new Rng(5151);
  let n = 0;
  const fits = (r: Rect, c: Colony) =>
    r.x0 >= c.rect.x0 && r.x1 <= c.rect.x1 && r.z0 >= c.rect.z0 && r.z1 <= c.rect.z1 &&
    !allRoads.some((rd) => intersects(rd, r, 1.2)) && !sites.some((s) => intersects(s, r, 1.5)) &&
    !c.open.some((o) => intersects(o, r, 1)) &&
    !out.some((o) => intersects(o, r, 0.1)) && !taken.some((o) => intersects(o, r, 0.5));
  for (const c of COLONIES) {
    const village = c.kind === "village";
    for (const f of c.frontages) {
      const r = allRoads.find((q) => q.id === f.id);
      if (!r) continue;
      const alongX = r.x1 - r.x0 >= r.z1 - r.z0;
      const half = (alongX ? r.z1 - r.z0 : r.x1 - r.x0) / 2;
      const mid = alongX ? (r.z0 + r.z1) / 2 : (r.x0 + r.x1) / 2;
      const a0 = Math.max(alongX ? r.x0 : r.z0, alongX ? c.rect.x0 : c.rect.z0);
      const a1 = Math.min(alongX ? r.x1 : r.z1, alongX ? c.rect.x1 : c.rect.z1);
      for (const sd of f.sides) {
        const edge = mid + sd * (half + (village ? 1.3 : 1.5));
        let a = a0 + 2;
        while (a < a1 - 9) {
          const w = village ? rng.range(9, 15) : rng.range(10.5, 15);
          let placed: Rect | null = null;
          for (let d = village ? 14 : 17; d >= 9; d -= 1) {
            const rect: Rect = alongX
              ? { x0: a, x1: a + w, z0: sd < 0 ? edge - d : edge, z1: sd < 0 ? edge : edge + d }
              : { x0: sd < 0 ? edge - d : edge, x1: sd < 0 ? edge : edge + d, z0: a, z1: a + w };
            if (fits(rect, c)) { placed = rect; break; }
          }
          if (!placed) { a += 2; continue; }
          a += w + (village ? rng.range(0.2, 2.5) : rng.next() < 0.12 ? rng.range(3, 6) : 0.15);
          out.push({
            id: `${c.id}H${n}`, style: village ? "village" : "kothi", ...placed,
            face: alongX ? (sd < 0 ? 0 : Math.PI) : (sd < 0 ? Math.PI / 2 : -Math.PI / 2),
            floors: village ? (rng.next() < 0.35 ? 2 : 1) : rng.next() < 0.15 ? 1 : rng.next() < 0.75 ? 2 : 3,
            color: rng.pick(village ? PIND_COLORS : KOTHI_COLORS), seed: 6000 + n,
          });
          n++;
        }
      }
    }
  }
  return out;
}
