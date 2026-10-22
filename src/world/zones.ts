/**
 * Zoning: what kind of place each patch of the district is, and therefore
 * what it should sound and feel like.
 *
 * Before this, every street behaved identically — the same honking, the same
 * hawkers, the same odds of a quarrel, whether you were in Chaura Bazaar or
 * a lane of houses in Pind Kotli. A town is not like that. A market is loud
 * because it is a market; a residential gali is quiet except when two
 * neighbours fall out; a highway has truck horns and nobody selling bhindi;
 * fields have birds.
 *
 * Each zone carries multipliers rather than absolute numbers, so the quality
 * presets and the global tuning still apply on top. Zones are axis-aligned
 * rectangles checked in priority order — the smaller, more specific ones sit
 * above the big background areas.
 */
import type { Rect } from "./layout";
import { CANAL, CITY, LUDHIANA, TOWN, WORLD, inRectR, site } from "./region";
import { COLONIES } from "./colonies";

export type ZoneKind =
  | "bazaar" | "mandi" | "residential" | "civic" | "highway"
  | "village" | "farm" | "industrial" | "transport";

export interface ZoneLife {
  /** Horn frequency. 0 silences horns entirely, 1 is the global default. */
  horns: number;
  /** How much traffic wants to be here. */
  traffic: number;
  /** Street-seller calls. 0 means nobody is hawking. */
  calls: number;
  /** How often a street quarrel starts. */
  quarrels: number;
  /** Of those quarrels, the share that are two aunties going at it. */
  auntyBias: number;
  /** Which ambience bed plays under everything else. */
  bed: "market" | "street" | "quiet" | "highway" | "rural";
}

export interface Zone extends Rect {
  id: string;
  kind: ZoneKind;
  label: string;
  life: ZoneLife;
}

const LIFE: Record<ZoneKind, ZoneLife> = {
  // Shoulder to shoulder, carts on the tarmac, everybody shouting.
  bazaar: { horns: 1.6, traffic: 1.3, calls: 1.6, quarrels: 1.5, auntyBias: 0.5, bed: "market" },
  // Wholesale: loading, shouting, lorries reversing, few pedestrians browsing.
  mandi: { horns: 1.2, traffic: 1.1, calls: 1.3, quarrels: 1.0, auntyBias: 0.3, bed: "market" },
  // Houses. Quiet — until the gali has an argument, which is the entertainment.
  residential: { horns: 0.15, traffic: 0.45, calls: 0.35, quarrels: 1.2, auntyBias: 0.85, bed: "quiet" },
  // Offices, the thana, the clock tower: busy but orderly.
  civic: { horns: 0.7, traffic: 1.0, calls: 0.5, quarrels: 0.5, auntyBias: 0.3, bed: "street" },
  // Trucks at speed. Air horns, no hawkers, nobody strolling.
  highway: { horns: 1.1, traffic: 1.4, calls: 0.15, quarrels: 0.2, auntyBias: 0.2, bed: "highway" },
  // Pind: tractors, cattle, charpais. Almost no horns.
  village: { horns: 0.2, traffic: 0.5, calls: 0.3, quarrels: 1.0, auntyBias: 0.7, bed: "rural" },
  // Fields. Birds, a distant tubewell, the odd motorcycle.
  farm: { horns: 0.1, traffic: 0.4, calls: 0, quarrels: 0.15, auntyBias: 0.3, bed: "rural" },
  // The kiln: machinery, lorries, nobody living there.
  industrial: { horns: 0.5, traffic: 0.7, calls: 0, quarrels: 0.3, auntyBias: 0.2, bed: "quiet" },
  // Bus and auto stands: touts calling routes, constant manoeuvring.
  transport: { horns: 1.4, traffic: 1.2, calls: 1.8, quarrels: 0.8, auntyBias: 0.3, bed: "market" },
};

const WORLD_X0 = WORLD.minX, WORLD_X1 = WORLD.maxX;

function zone(id: string, kind: ZoneKind, label: string, r: Rect): Zone {
  return { id, kind, label, ...r, life: LIFE[kind] };
}

/** Grow a site's rectangle by `pad` metres. */
function around(id: string, pad: number): Rect {
  const s = site(id);
  return { x0: s.x0 - pad, x1: s.x1 + pad, z0: s.z0 - pad, z1: s.z1 + pad };
}

/**
 * Most specific first: the first rectangle that contains the point wins, so
 * a stand inside a bazaar still reads as a stand.
 */
export const ZONES: Zone[] = [
  // ---- Ludhiana, in detail. This is the loud one.
  zone("ludhAdda", "transport", "Ludhiana Bus & Auto Adda", around("ludhAdda", 14)),
  zone("ludhMandi", "mandi", "Ludhiana Sabzi Mandi", around("ludhMandi", 12)),
  zone("ludhChowk", "bazaar", "Ghanta Ghar Chowk", around("ludhGhanta", 26)),
  // Chaura Bazaar: the two galis and the cross-streets between them.
  zone("chauraBazaar", "bazaar", "Chaura Bazaar", { x0: -600, x1: -290, z0: -300, z1: -185 }),
  zone("ludhThana", "civic", "Ludhiana City Thana", around("ludhThana", 14)),
  // Everything else inside the city walls is people's houses.
  zone("ludhResidential", "residential", "Ludhiana mohalla", LUDHIANA),

  // ---- Ranggarh.
  zone("ranggarhBazaar", "bazaar", "Ranggarh Bazaar", { x0: -14, x1: 14, z0: -76, z1: 52 }),
  zone("ranggarhTown", "residential", "Ranggarh", TOWN),

  // ---- Nawan Shehar.
  zone("busAdda", "transport", "Bus Adda", around("busAdda", 12)),
  zone("mandi", "mandi", "Anaj Mandi", around("mandi", 12)),
  zone("ghantaGhar", "civic", "Ghanta Ghar Chowk", around("ghantaGhar", 30)),
  zone("thana", "civic", "Police Chowki", around("thana", 14)),
  zone("cinema", "bazaar", "Raj Talkies", around("cinema", 18)),
  zone("park", "residential", "Company Bagh", around("park", 6)),
  zone("cityStreets", "civic", "Nawan Shehar", CITY),

  // ---- The G.T. Road corridor and what sits on it.
  zone("sherDhaba", "highway", "Sher-e-Punjab Dhaba", around("sherDhaba", 18)),
  zone("petrol", "highway", "Panj Aab Fuels", around("petrol", 14)),
  zone("gtRoad", "highway", "G.T. Road", { x0: WORLD_X0, x1: WORLD_X1, z0: -182, z1: -138 }),

  // ---- Pind Kotli.
  zone("akhada", "village", "Kotli Akhada", around("akhada", 14)),
  // ---- Colonies and villages (colonies.ts): houses, so quiet until a gali falls out.
  ...COLONIES.map((c) => zone(c.id, c.kind === "village" ? "village" : "residential", c.name, c.rect)),

  // ---- Industry.
  zone("kiln", "industrial", "Bhatta", around("kiln", 30)),

  // ---- The canal bank is a quiet strip people walk along.
  zone("canal", "farm", "Nehar bank", { x0: WORLD_X0, x1: WORLD_X1, z0: CANAL.z0 - 8, z1: CANAL.z1 + 8 }),
];

/** Everything the zones do not claim is farmland. */
export const OPEN_COUNTRY: Zone = zone("country", "farm", "Khet", { x0: WORLD_X0, x1: WORLD_X1, z0: WORLD.minZ, z1: WORLD.maxZ });

export function zoneAt(x: number, z: number): Zone {
  for (const zz of ZONES) if (inRectR(zz, x, z)) return zz;
  return OPEN_COUNTRY;
}

/** Shorthand used by the noisy systems. */
export function lifeAt(x: number, z: number): ZoneLife {
  return zoneAt(x, z).life;
}
