import { districtFrameDelta } from "./districtMovement";

/** Grounded character footprints. Positions are the feet of each character. */
export interface DistrictActorPosition { x: number; y: number; z: number }
export const DISTRICT_ACTOR_RADIUS = 0.36;
export const DISTRICT_ACTOR_HEIGHT = 1.7;
const diameter = DISTRICT_ACTOR_RADIUS * 2;
const maxStep = 0.05;
const epsilon = 1e-10;

/** Sweep the whole displacement, including a grazing chord whose endpoints are
 * both clear. An existing overlap may separate, but cannot cross through its centre. */
export function canMoveDistrictActor(
  actor: DistrictActorPosition, x: number, y: number, z: number,
  others: readonly DistrictActorPosition[],
): boolean {
  const dx = x - actor.x, dz = z - actor.z, distance2 = dx * dx + dz * dz;
  for (const other of others) {
    if (other === actor || Math.min(actor.y, y) >= other.y + DISTRICT_ACTOR_HEIGHT ||
      other.y >= Math.max(actor.y, y) + DISTRICT_ACTOR_HEIGHT) continue;
    const ox = actor.x - other.x, oz = actor.z - other.z;
    const before2 = ox * ox + oz * oz, outward = ox * dx + oz * dz;
    if (before2 < diameter * diameter - epsilon) {
      if (outward < -epsilon) return false;
      continue;
    }
    const t = distance2 ? Math.max(0, Math.min(1, -outward / distance2)) : 0;
    if ((ox + dx * t) ** 2 + (oz + dz * t) ** 2 < diameter * diameter - epsilon) return false;
  }
  return true;
}

/** Player motion with circular actor sliding and the district's static footprint
 * checks. Every candidate is short and checks both kinds of obstacle; sliding
 * cannot push a character through a neighbouring body or into scenery. */
export function moveDistrictPlayer(
  actor: DistrictActorPosition, dx: number, dz: number, speed: number, dt: number,
  others: readonly DistrictActorPosition[], canWalk: (x: number, z: number) => boolean,
  groundHeight: (x: number, z: number) => number, elevation = 0,
): boolean {
  actor.y = groundHeight(actor.x, actor.z) + elevation;
  const length = Math.hypot(dx, dz), seconds = districtFrameDelta(dt);
  if (!Number.isFinite(length) || !length || !Number.isFinite(speed) || speed <= 0 || !seconds) return false;
  const distance = Math.min(1, length) * speed * seconds;
  const steps = Math.max(1, Math.ceil(distance / maxStep));
  const sx = dx / length * distance / steps, sz = dz / length * distance / steps;
  let moved = false;
  const tryStep = (vx: number, vz: number): boolean => {
    if (Math.hypot(vx, vz) < epsilon) return false;
    const x = actor.x + vx, z = actor.z + vz, y = groundHeight(x, z) + elevation;
    if (!canWalk(x, z) || !canMoveDistrictActor(actor, x, y, z, others)) return false;
    actor.x = x; actor.y = y; actor.z = z; moved = true;
    return true;
  };
  for (let i = 0; i < steps; i++) {
    if (tryStep(sx, sz)) continue;
    let slideX = sx, slideZ = sz;
    for (const other of others) {
      if (canMoveDistrictActor(actor, actor.x + slideX,
        groundHeight(actor.x + slideX, actor.z + slideZ) + elevation, actor.z + slideZ, [other])) continue;
      const nx = actor.x - other.x, nz = actor.z - other.z, normal2 = nx * nx + nz * nz;
      const inward = slideX * nx + slideZ * nz;
      if (normal2 && inward < 0) { slideX -= nx * inward / normal2; slideZ -= nz * inward / normal2; }
    }
    if (tryStep(slideX, slideZ)) continue;
    // Preserve the established wall-slide controls for rectangular scenery.
    tryStep(sx, 0); tryStep(0, sz);
  }
  return moved;
}

/** Follow the authored route target at a bounded speed. Blocked distance is not
 * banked: clearing the route cannot teleport the walker, or shift its endpoints.
 * Walkers wait on their lane and can reverse without pushing stationary actors. */
export function moveDistrictWalker(
  actor: DistrictActorPosition, targetZ: number, maxDistance: number,
  others: readonly DistrictActorPosition[], groundHeight: (x: number, z: number) => number,
  canWalk: (x: number, z: number) => boolean,
): boolean {
  if (!Number.isFinite(targetZ) || !Number.isFinite(maxDistance) || maxDistance <= 0) return false;
  const dz = Math.max(-maxDistance, Math.min(maxDistance, targetZ - actor.z));
  if (!dz) return false;
  const steps = Math.max(1, Math.ceil(Math.abs(dz) / maxStep)), step = dz / steps;
  let moved = false;
  for (let i = 0; i < steps; i++) {
    const z = actor.z + step, y = groundHeight(actor.x, z);
    if (!canWalk(actor.x, z) || !canMoveDistrictActor(actor, actor.x, y, z, others)) break;
    actor.z = z; actor.y = y; moved = true;
  }
  return moved;
}
