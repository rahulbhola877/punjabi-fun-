/** The northern ridge is reserved for a driveable trail and viewpoints. */
export const RIDGE_BOUNDS = { x0: -980, x1: -320, z0: 1580, z1: 2040 } as const;
export const RIDGE_STEP = 4;
export const RIDGE_ROAD_WIDTH = 7;

/** World-space centre line, starting at the end of the northern spur. */
export const RIDGE_ROAD: ReadonlyArray<readonly [number, number]> = [
  [-600, 1766], [-612, 1795], [-638, 1822], [-670, 1850],
  [-708, 1880], [-750, 1908], [-790, 1932], [-820, 1954],
];
export const RIDGE_VIEW = { x: -823, z: 1965 } as const;

function mound(x: number, z: number, cx: number, cz: number, rx: number, rz: number, height: number): number {
  const d = Math.hypot((x - cx) / rx, (z - cz) / rz);
  return d >= 1 ? 0 : height * (0.5 + 0.5 * Math.cos(Math.PI * d));
}

/** Terrain vertex height; all hills ease to flat ground outside the reserve. */
export function ridgeVertexHeight(x: number, z: number): number {
  return mound(x, z, -785, 1905, 190, 135, 22)
    + mound(x, z, -470, 1910, 125, 125, 11);
}

/**
 * Height of the actual triangles in the 4 m terrain mesh. Using the same
 * interpolation for scenery, player spawns and the road avoids floating or
 * buried features between grid vertices.
 */
export function ridgeHeight(x: number, z: number): number {
  if (x < RIDGE_BOUNDS.x0 || x > RIDGE_BOUNDS.x1 || z < RIDGE_BOUNDS.z0 || z > RIDGE_BOUNDS.z1) return 0;
  const gx = Math.min((RIDGE_BOUNDS.x1 - RIDGE_BOUNDS.x0) / RIDGE_STEP - 1, Math.floor((x - RIDGE_BOUNDS.x0) / RIDGE_STEP));
  const gz = Math.min((RIDGE_BOUNDS.z1 - RIDGE_BOUNDS.z0) / RIDGE_STEP - 1, Math.floor((z - RIDGE_BOUNDS.z0) / RIDGE_STEP));
  const x0 = RIDGE_BOUNDS.x0 + gx * RIDGE_STEP, z0 = RIDGE_BOUNDS.z0 + gz * RIDGE_STEP;
  const fx = (x - x0) / RIDGE_STEP, fz = (z - z0) / RIDGE_STEP;
  const h00 = ridgeVertexHeight(x0, z0), h10 = ridgeVertexHeight(x0 + RIDGE_STEP, z0);
  const h01 = ridgeVertexHeight(x0, z0 + RIDGE_STEP), h11 = ridgeVertexHeight(x0 + RIDGE_STEP, z0 + RIDGE_STEP);
  return fx >= fz ? h00 * (1 - fx) + h10 * (fx - fz) + h11 * fz
    : h00 * (1 - fz) + h11 * fx + h01 * (fz - fx);
}

/** Clearance shared by road geometry and ground-cover placement. */
export function onRidgeRoad(x: number, z: number, extra = 0): boolean {
  if (x < RIDGE_BOUNDS.x0 - extra || x > RIDGE_BOUNDS.x1 + extra || z < 1755 - extra || z > RIDGE_BOUNDS.z1 + extra) return false;
  for (let i = 1; i < RIDGE_ROAD.length; i++) {
    const [ax, az] = RIDGE_ROAD[i - 1]!, [bx, bz] = RIDGE_ROAD[i]!;
    const dx = bx - ax, dz = bz - az;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz)));
    if (Math.hypot(x - ax - t * dx, z - az - t * dz) <= RIDGE_ROAD_WIDTH / 2 + extra) return true;
  }
  return false;
}
