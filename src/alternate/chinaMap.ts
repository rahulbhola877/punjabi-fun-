/** Lantern Harbor: a compact, fictional China-inspired river district, in metres. */
export const CHINA_WORLD = {
  minX: -82, maxX: 82, minZ: -74, maxZ: 92,
  start: { x: 41, z: -62 }, portal: { x: 41, z: -68 },
  host: { x: 34, z: -43 }, artisan: { x: 35, z: -8 },
  musician: { x: -27, z: 29 }, keeper: { x: -48, z: 62 },
} as const;

/** Shop and home footprints; pavements and the central road remain open. */
export const CHINA_BUILDINGS = [
  { x: 53, z: -51, w: 14, d: 11, h: 7, color: "#d9c8ad", roof: "#625955" },
  { x: 53, z: -32, w: 14, d: 12, h: 8, color: "#d8bda8", roof: "#725c54" },
  { x: 53, z: -12, w: 14, d: 12, h: 7, color: "#d2c9b2", roof: "#5d6264" },
  { x: 53, z: 10, w: 14, d: 12, h: 9, color: "#d6c5a8", roof: "#665c55" },
  { x: 53, z: 32, w: 14, d: 12, h: 7, color: "#c3c4b8", roof: "#586367" },
  { x: 17, z: -51, w: 11, d: 11, h: 6, color: "#d0bca8", roof: "#685e58" },
  { x: 17, z: -31, w: 11, d: 12, h: 7, color: "#d5c9b0", roof: "#5b6565" },
  { x: 17, z: -10, w: 11, d: 12, h: 6, color: "#c8bead", roof: "#78645c" },
  { x: 17, z: 14, w: 11, d: 12, h: 7, color: "#d1c7b6", roof: "#555f60" },
  { x: -62, z: -42, w: 12, d: 10, h: 5, color: "#d6c5aa", roof: "#655b57" },
  { x: -62, z: -23, w: 12, d: 10, h: 6, color: "#ccb7a0", roof: "#635f59" },
  { x: -62, z: -4, w: 12, d: 10, h: 5, color: "#d5c6ae", roof: "#706159" },
] as const;
/** Market stall footprints correspond to the two placed Tunyard stalls. */
export const CHINA_STALLS = [{ x: -46, z: 18 }, { x: -30, z: 31 }] as const;
export const CHINA_TABLES = [{ x: -43, z: 25 }, { x: -35, z: 24 }, { x: -23, z: 20 }, { x: -20, z: 32 }] as const;
const CHINA_SMALL_SOLIDS = [
  { x: -52, z: 22, r: 0.5 }, { x: -52, z: 28, r: 0.5 }, { x: -17, z: 16, r: 0.5 }, { x: -15, z: 34, r: 0.5 },
  { x: -48.5, z: 24, r: 0.12 }, { x: -43.5, z: 24, r: 0.12 }, { x: -32.5, z: 24, r: 0.12 },
  { x: -27.5, z: 24, r: 0.12 }, { x: -20.5, z: 24, r: 0.12 }, { x: -15.5, z: 24, r: 0.12 },
  { x: 23, z: -61, r: 0.12 }, { x: 23, z: -36, r: 0.12 }, { x: 23, z: -11, r: 0.12 },
  { x: 23, z: 14, r: 0.12 }, { x: 23, z: 39, r: 0.12 },
] as const;
/** Trunks are solid; broad crowns are decorative and may overlap a pavement. */
export const CHINA_TREES = [[24, -58], [46, -47], [24, -22], [46, 18], [-18, -29], [-55, 10], [-57, 38], [-52, 42], [-30, 59], [-70, 60], [-43, 79], [-70, 79], [-25, 78], [67, 47]] as const;

/** A slow, walkable rise towards the western overlook, away from the river. */
export function chinaHeight(x: number, z: number): number {
  const d = Math.hypot((x + 52) / 46, (z - 67) / 38);
  return d >= 1 ? 0 : 8 * (0.5 + 0.5 * Math.cos(Math.PI * d));
}

/** River crossing decks at the two local bridges. */
export function inChinaWater(x: number, z: number): boolean {
  return Math.abs(x) < 9 && !(z >= -4 && z <= 8) && !(z >= 42 && z <= 54);
}

/** Collision is shared with NPC/path tests, so a full footprint stays clear. */
export function canWalkChina(x: number, z: number): boolean {
  const r = 0.42, w = CHINA_WORLD;
  if (x < w.minX + r || x > w.maxX - r || z < w.minZ + r || z > w.maxZ - r) return false;
  for (const dx of [-r, r]) for (const dz of [-r, r]) if (inChinaWater(x + dx, z + dz)) return false;
  if (CHINA_BUILDINGS.some((b) => Math.abs(x - b.x) < b.w / 2 + r && Math.abs(z - b.z) < b.d / 2 + r)) return false;
  if (CHINA_STALLS.some((s) => Math.abs(x - s.x) < 1.3 + r && Math.abs(z - s.z) < 0.65 + r)) return false;
  if (CHINA_TABLES.some((s) => Math.abs(x - s.x) < 1.1 + r && Math.abs(z - s.z) < 0.65 + r)) return false;
  if (CHINA_SMALL_SOLIDS.some((s) => Math.hypot(x - s.x, z - s.z) < r + s.r)) return false;
  return !CHINA_TREES.some(([tx, tz]) => Math.hypot(x - tx, z - tz) < r + 0.28);
}

export interface ChinaProgress { stage: number; fishingComplete?: boolean }
export type ChinaPerson = "host" | "artisan" | "musician" | "keeper";

/** A compact local story with three different conversations, saved on each step. */
export function normalizeChinaProgress(value?: Partial<ChinaProgress>): ChinaProgress {
  const s = value?.stage;
  return { stage: typeof s === "number" && Number.isInteger(s) && s >= 0 && s <= 4 ? s : 0 };
}
export function chinaConversation(stage: number, person: ChinaPerson): { stage: number; text: string } {
  const s = normalizeChinaProgress({ stage }).stage;
  if (person === "host") {
    if (s === 0) return { stage: 1, text: "Mei: The riverside music evening needs a lantern shade and a tune. Will you help? First ask Lin at the workshop." };
    if (s === 3) return { stage: 4, text: "Mei: The lantern is ready and the tune has found its way home. Thank you for helping our evening begin!" };
    if (s === 4) return { stage: 4, text: "Mei: The lights are on for the riverside evening. Make yourself at home." };
    return { stage: s, text: s === 1 ? "Mei: Lin is at the workshop along the east street." : "Mei: Wen is across the bridge, near the riverside market." };
  }
  if (person === "artisan") {
    if (s === 1) return { stage: 2, text: "Lin: The lantern shade is finished. Please take it to Wen across the bridge; he knows the evening tune." };
    return { stage: s, text: "Lin: Paper and bamboo need a patient hand. The workshop stays open all afternoon." };
  }
  if (person === "musician") {
    if (s === 2) return { stage: 3, text: "Wen: A lantern for the stage! Here is the melody Mei was waiting for. Please tell her we are ready." };
    return { stage: s, text: "Wen: The river carries a melody surprisingly far. Come back for the evening music." };
  }
  return { stage: s, text: "Shu: Follow the slope for a quiet view over the harbor. Take your time coming down." };
}
