import { dateOf } from "../world/Calendar";

/**
 * What things cost where, and on which day. The shelf price in the shop tables is the Ranggarh price; every other
 * place moves it: the village is cheaper, Ludhiana and the highway dearer, a festival day dearer still, and each
 * day has its own small wave so that no two mornings are quite the same. A district that knows you sells to you
 * a little cheaper.
 */

export type District = "ranggarh" | "nawan" | "ludhiana" | "kotli" | "road";

export const DISTRICTS: District[] = ["ranggarh", "nawan", "ludhiana", "kotli", "road"];

export const DISTRICT_NAME: Record<District, string> = {
  ranggarh: "Ranggarh", nawan: "Nawan Shehar", ludhiana: "Ludhiana", kotli: "Pind Kotli", road: "G.T. Road and the fields",
};

interface Box { x0: number; x1: number; z0: number; z1: number }
const inBox = (b: Box, x: number, z: number) => x >= b.x0 && x <= b.x1 && z >= b.z0 && z <= b.z1;

/** Where each district lies: the first box a point is in decides (Ludhiana's works across the G.T. Road included). */
const BOXES: Array<[District, Box[]]> = [
  ["ludhiana", [{ x0: -620, x1: -150, z0: -520, z1: -155 }, { x0: -620, x1: -380, z0: -155, z1: -95 }]],
  ["kotli", [{ x0: -232, x1: 186, z0: 176, z1: 466 }]],
  ["ranggarh", [{ x0: -260, x1: 190, z0: -155, z1: 176 }]],
  ["nawan", [{ x0: 190, x1: 720, z0: -240, z1: 300 }]],
];

export function districtAt(x: number, z: number): District {
  for (const [d, boxes] of BOXES) if (boxes.some((b) => inBox(b, x, z))) return d;
  return "road";
}

const BASE: Record<District, number> = { ranggarh: 1, nawan: 1.08, ludhiana: 1.15, kotli: 0.85, road: 1.2 };

/** How well a district knows you: the tier names and what each takes off the price. */
export const DISTRICT_TIERS = [
  { at: 0, name: "Anjaan", off: 0 },
  { at: 6, name: "Jaanu", off: 0.02 },
  { at: 20, name: "Maana hoya", off: 0.05 },
  { at: 45, name: "Mashhoor", off: 0.08 },
] as const;

export function districtTier(rep: number): { index: number; name: string; off: number; next: number | null } {
  let i = 0;
  for (let k = 0; k < DISTRICT_TIERS.length; k++) if (rep >= DISTRICT_TIERS[k]!.at) i = k;
  const t = DISTRICT_TIERS[i]!;
  return { index: i, name: t.name, off: t.off, next: DISTRICT_TIERS[i + 1]?.at ?? null };
}

/** A steady pseudo-random number in [-1, 1] for an item on a day. */
function wave(item: string, day: number): number {
  let h = 2166136261 ^ day;
  for (let i = 0; i < item.length; i++) h = Math.imul(h ^ item.charCodeAt(i), 16777619);
  h ^= h >>> 15; h = Math.imul(h, 2246822519); h ^= h >>> 13;
  return ((h >>> 0) % 2001) / 1000 - 1;
}

/** Eating and carrying home are what a festival makes dearer; tools, upgrades and clothes keep their price. */
const MOVES = new Set(["food", "goods", "warmth", "buff"]);

/** The price multiplier for an item of this kind on this day in this district, given how well the district knows you. */
export function bandMultiplier(district: District, day: number, itemId: string, kind: string, districtRep = 0): number {
  if (!MOVES.has(kind)) return 1;
  const g = dateOf(day), tomorrow = dateOf(day + 1);
  const festival = g.festival ? 1.15 : tomorrow.festival ? 1.06 : 1;
  const m = BASE[district] * (1 + 0.06 * wave(itemId, day)) * festival * (1 - districtTier(districtRep).off);
  return Math.max(0.6, m);
}

/** A price in whole rupees: to the rupee under 100, to five rupees above. */
export function priceOf(base: number, mult: number): number {
  const p = base * mult;
  return p < 100 ? Math.max(1, Math.round(p)) : Math.round(p / 5) * 5;
}

export type Band = "sasta" | "theek" | "mehnga";
export function bandOf(mult: number): Band {
  return mult < 0.95 ? "sasta" : mult > 1.1 ? "mehnga" : "theek";
}
