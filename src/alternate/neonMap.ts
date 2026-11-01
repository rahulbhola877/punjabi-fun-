/** Authored walkable bounds and landmarks for the small Neon Quay prototype. */
export const NEON_WORLD = { minX: -31, maxX: 31, minZ: -31, maxZ: 33, start: { x: 0, z: -20 }, portal: { x: 0, z: -27 }, relay: { x: 0, z: 9 } } as const;
export const NEON_BEACONS = [{ x: -20, z: -7 }, { x: 20, z: 5 }, { x: -2, z: 26 }] as const;
/** A friendly fox offers directions near the central square. */
export const NEON_FOX = { x: 7, z: 12 } as const;

export function neonFoxHint(found: ReadonlySet<number>, completed: boolean): string {
  if (completed) return "Fox: The quay is glowing again. Thanks, friend!";
  if (!found.has(0)) return "Fox: One signal is west of the crossroads. Look for a glowing crystal.";
  if (!found.has(1)) return "Fox: Another signal is east of the crossroads.";
  if (!found.has(2)) return "Fox: The last signal is up the north street.";
  return "Fox: You found them all! Press E beside the central relay.";
}

/** Building footprints are also used for the scene's collision. */
export const NEON_BUILDINGS = [
  { x: -14, z: -17, w: 9, d: 7, h: 9, color: "#694f98" },
  { x: 14, z: -17, w: 9, d: 7, h: 12, color: "#455c9c" },
  { x: -13, z: 7, w: 8, d: 9, h: 13, color: "#504485" },
  { x: 14, z: 20, w: 10, d: 8, h: 11, color: "#804777" },
  { x: -20, z: 22, w: 8, d: 6, h: 8, color: "#536192" },
] as const;

export interface NeonProgress { found: number[]; completed: boolean }
export function normalizeNeonProgress(value?: Partial<NeonProgress>): NeonProgress {
  const found = [...new Set(Array.isArray(value?.found) ? value.found.filter((i) => Number.isInteger(i) && i >= 0 && i < NEON_BEACONS.length) : [])].sort((a, b) => a - b);
  return { found, completed: value?.completed === true && found.length === NEON_BEACONS.length };
}

/** The player is a small disc, so buildings stop the full body at their walls. */
export function canWalkNeon(x: number, z: number): boolean {
  const r = 0.55;
  if (x < NEON_WORLD.minX + r || x > NEON_WORLD.maxX - r || z < NEON_WORLD.minZ + r || z > NEON_WORLD.maxZ - r) return false;
  return !NEON_BUILDINGS.some((b) => Math.abs(x - b.x) < b.w / 2 + r && Math.abs(z - b.z) < b.d / 2 + r);
}

export function collectNeonBeacons(x: number, z: number, found: ReadonlySet<number>): number[] {
  return NEON_BEACONS.flatMap((p, i) => !found.has(i) && Math.hypot(x - p.x, z - p.z) < 1.6 ? [i] : []);
}
