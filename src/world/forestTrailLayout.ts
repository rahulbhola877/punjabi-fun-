/** A footpath from the ridge road down to the spring keeper's clearing. */
export const FOREST_ROUTE = [
  [-820, 1954], [-840, 1943], [-855, 1935], [-867, 1928],
  [-874, 1918], [-883, 1909], [-895, 1900], [-902, 1899.5],
] as const;
export const FOREST_TRAIL_WIDTH = 3;
export const FOREST_SHELTER = { x: -905, z: 1897 } as const;

/** Horizontal distance to the nearest point on the path centreline. */
export function forestTrailDistance(x: number, z: number): number {
  let best = Infinity;
  for (let i = 1; i < FOREST_ROUTE.length; i++) {
    const [ax, az] = FOREST_ROUTE[i - 1]!, [bx, bz] = FOREST_ROUTE[i]!;
    const dx = bx - ax, dz = bz - az;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz)));
    best = Math.min(best, Math.hypot(x - ax - t * dx, z - az - t * dz));
  }
  return best;
}
export function onForestTrail(x: number, z: number, extra = 0): boolean {
  const pad = FOREST_TRAIL_WIDTH / 2 + extra;
  if (x < -902 - pad || x > -820 + pad || z < 1899.5 - pad || z > 1954 + pad) return false;
  return forestTrailDistance(x, z) <= pad;
}
/** The shelter footprint plus an open approach from the keeper. */
export function inForestClearing(x: number, z: number, extra = 0): boolean {
  return Math.hypot(x - FOREST_SHELTER.x, z - FOREST_SHELTER.z) <= 6 + extra;
}
