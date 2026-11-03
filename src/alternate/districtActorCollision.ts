/** Grounded character footprints. Positions are the feet of each character. */
export interface DistrictActorPosition { x: number; y: number; z: number }
export const DISTRICT_ACTOR_RADIUS = 0.36;
export const DISTRICT_ACTOR_HEIGHT = 1.7;

/** Allow an already-overlapping pair to separate, including after landing. */
export function canMoveDistrictActor(
  actor: DistrictActorPosition, x: number, y: number, z: number,
  others: readonly DistrictActorPosition[],
): boolean {
  for (const other of others) {
    if (other === actor || y >= other.y + DISTRICT_ACTOR_HEIGHT || other.y >= y + DISTRICT_ACTOR_HEIGHT) continue;
    const before = Math.hypot(actor.x - other.x, actor.z - other.z);
    const after = Math.hypot(x - other.x, z - other.z);
    if (after < DISTRICT_ACTOR_RADIUS * 2 && after < before) return false;
  }
  return true;
}

/** Move a route walker by its intended displacement, without skipping the hero.
 * Keeping blocked displacement discarded lets the route reverse or resume naturally. */
export function moveDistrictWalker(
  actor: DistrictActorPosition, dz: number, hero: DistrictActorPosition,
  groundHeight: (x: number, z: number) => number,
): void {
  const steps = Math.max(1, Math.ceil(Math.abs(dz) / 0.05));
  const step = dz / steps;
  for (let i = 0; i < steps; i++) {
    const z = actor.z + step, y = groundHeight(actor.x, z);
    if (!canMoveDistrictActor(actor, actor.x, y, z, [hero])) break;
    actor.z = z; actor.y = y;
  }
}
