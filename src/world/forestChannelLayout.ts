/** Shared plan of the lined forest spring channel and its two outlets. */
export const FOREST_CHANNEL_TRUNK = [[-869, 1928], [-876, 1919], [-884, 1910]] as const;
export const FOREST_CHANNEL_POOL = [[-884, 1910], [-888, 1906], [-890, 1904]] as const;
export const FOREST_CHANNEL_HILLSIDE = [[-884, 1910], [-881, 1906], [-877, 1903]] as const;
export const FOREST_CHANNEL_POOL_BED = [[-890, 1905], [-890, 1903]] as const;

/** Clear the channel plus the maximum half-width of a crossed grass card. */
export function onForestChannel(x: number, z: number): boolean {
  if (x < -893 || x > -866 || z < 1900 || z > 1931) return false;
  const near = (path: ReadonlyArray<readonly [number, number]>, radius: number): boolean => {
    for (let i = 1; i < path.length; i++) {
      const [ax, az] = path[i - 1]!, [bx, bz] = path[i]!;
      const dx = bx - ax, dz = bz - az;
      const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz)));
      if (Math.hypot(x - ax - t * dx, z - az - t * dz) <= radius) return true;
    }
    return false;
  };
  // Banks extend 0.945 m from the centre; grass cards reach up to 0.375 m.
  return [FOREST_CHANNEL_TRUNK, FOREST_CHANNEL_POOL, FOREST_CHANNEL_HILLSIDE].some((path) => near(path, 1.32))
    || near(FOREST_CHANNEL_POOL_BED, 1.875);
}
