/** Experimental trails and landmarks. Coordinates are world X/Z metres. */
export const OUTER_PLACES = [
  { id: "forestCamp", label: "Forest Camp", x: -2250, z: 150, biome: "woodland" },
  { id: "duneOasis", label: "Dune Oasis", x: 150, z: -1650, biome: "dunes" },
  { id: "highlandLookout", label: "Highland Lookout", x: 2250, z: 450, biome: "highlands" },
  { id: "northCamp", label: "North Camp", x: 150, z: 3150, biome: "northland" },
] as const;

export const OUTER_PATHS: ReadonlyArray<ReadonlyArray<readonly [number, number]>> = [
  [[-1200, -160], [-1500, -160], [-1750, -50], [-2000, 100], [-2250, 150]],
  [[300, -1200], [300, -1370], [235, -1510], [150, -1650]],
  [[1500, -160], [1750, -160], [1930, 0], [2100, 260], [2250, 450]],
  [[0, 2100], [0, 2350], [80, 2700], [150, 2950], [150, 3150]],
];

export function distanceToOuterPaths(x: number, z: number): number {
  let best = Infinity;
  for (const path of OUTER_PATHS) for (let i = 1; i < path.length; i++) {
    const [ax, az] = path[i - 1]!, [bx, bz] = path[i]!;
    const dx = bx - ax, dz = bz - az;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz)));
    best = Math.min(best, Math.hypot(x - ax - t * dx, z - az - t * dz));
  }
  return best;
}
