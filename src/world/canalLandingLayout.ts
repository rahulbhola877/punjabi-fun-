/** The ghat's bank-side landing, between the canal wall and Nehar Bank Road. */
export const CANAL_LANDING = { x: 45, z: 183, halfWidth: 9.6, halfDepth: 3.8 } as const;
/** Scenery and streamed grass share this footprint so paving stays clean. */
export function onCanalLanding(x: number, z: number, margin = 0): boolean {
  const dx = (x - CANAL_LANDING.x) / (CANAL_LANDING.halfWidth + margin);
  const dz = (z - CANAL_LANDING.z) / (CANAL_LANDING.halfDepth + margin);
  return dx * dx + dz * dz <= 1 || (Math.abs(x - 45) <= 1.7 + margin && z >= 182 && z <= 188 + margin);
}
/** Reserve the tiny bank-side clearing for its own complete authored trees. */
export function inCanalLandingTreeReserve(x: number, z: number): boolean {
  return x >= 30 && x <= 61 && z >= 179 && z <= 187;
}

/** Walkable picnic grove south of Nehar Road, away from the houses. */
export const CANAL_GROVE = { x: 30, z: 127, rx: 6, rz: 5 } as const;
export function onCanalGroveSurface(x: number, z: number, margin = 0): boolean {
  const dx = (x - CANAL_GROVE.x) / (CANAL_GROVE.rx + margin), dz = (z - CANAL_GROVE.z) / (CANAL_GROVE.rz + margin);
  if (dx * dx + dz * dz <= 1) return true;
  // Distance to the short worn path from the road to the clearing.
  for (const [ax, az, bx, bz] of [[34, 146, 34, 139], [34, 139, 30, 130]] as const) {
    const vx = bx - ax, vz = bz - az;
    const t = Math.max(0, Math.min(1, ((x - ax) * vx + (z - az) * vz) / (vx * vx + vz * vz)));
    if (Math.hypot(x - ax - t * vx, z - az - t * vz) <= 1.35 + margin) return true;
  }
  return false;
}
