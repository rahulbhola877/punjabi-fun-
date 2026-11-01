/** An independently authored, compact 2D destination. Coordinates are in tiles. */
export const PIXEL_WORLD = { width: 48, height: 32, start: { x: 7.5, y: 25.5 }, portal: { x: 5.5, y: 26.5 }, shrine: { x: 36.5, y: 3.5 } } as const;
export const LANTERNS = [
  { x: 8.5, y: 8.5 }, { x: 15.5, y: 22.5 }, { x: 27.5, y: 8.5 },
  { x: 34.5, y: 25.5 }, { x: 43.5, y: 11.5 },
] as const;

export interface PixelProgress { found: number[]; completed: boolean }

/** Reject stale, duplicate or invalid values from a saved game. */
export function normalizePixelProgress(value?: Partial<PixelProgress>): PixelProgress {
  const found = [...new Set(Array.isArray(value?.found) ? value.found.filter((i) => Number.isInteger(i) && i >= 0 && i < LANTERNS.length) : [])].sort((a, b) => a - b);
  return { found, completed: value?.completed === true && found.length === LANTERNS.length };
}

export const HOUSES = [
  { x: 28, y: 17, w: 4, h: 3, color: "#cf7860" },
  { x: 36, y: 20, w: 4, h: 3, color: "#d6a46b" },
  { x: 41, y: 15, w: 4, h: 3, color: "#bd6d79" },
] as const;

/** Individually placed trees give the meadow, woodland and village distinct edges. */
export const PIXEL_TREES = [
  [3, 3], [7, 4], [12, 3], [16, 5], [3, 9], [12, 11], [17, 10], [5, 15], [11, 17], [16, 16],
  [3, 20], [10, 21], [17, 26], [13, 28], [4, 29], [18, 29],
  [25, 3], [29, 4], [26, 12], [31, 12], [44, 4], [44, 8], [46, 12],
  [25, 19], [25, 23], [29, 25], [32, 29], [40, 27], [45, 24], [45, 29],
] as const;

export function isPixelWater(tx: number, ty: number): boolean {
  const river = tx >= 20 && tx <= 22 && !(ty === 14 || ty === 15 || ty === 25 || ty === 26);
  const lake = ((tx - 37) / 4.8) ** 2 + ((ty - 7) / 2.7) ** 2 < 1;
  return river || lake;
}

/** Collision tests the player's whole footprint, not just the centre. */
export function canWalkPixel(x: number, y: number): boolean {
  const radius = 0.22;
  if (x < 1 + radius || y < 1 + radius || x > PIXEL_WORLD.width - 1 - radius || y > PIXEL_WORLD.height - 1 - radius) return false;
  for (const dx of [-radius, radius]) for (const dy of [-radius, radius]) {
    if (isPixelWater(Math.floor(x + dx), Math.floor(y + dy))) return false;
  }
  if (HOUSES.some((h) => x + radius > h.x && x - radius < h.x + h.w && y + radius > h.y && y - radius < h.y + h.h)) return false;
  if (PIXEL_TREES.some(([tx, ty]) => Math.hypot(x - (tx + 0.5), y - (ty + 0.72)) < 0.46)) return false;
  return true;
}

export function collectPixelLanterns(x: number, y: number, found: ReadonlySet<number>): number[] {
  return LANTERNS.flatMap((p, i) => !found.has(i) && Math.hypot(x - p.x, y - p.y) < 0.7 ? [i] : []);
}
