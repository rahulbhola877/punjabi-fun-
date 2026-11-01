import { CANAL, CORE_WORLD } from "../world/region";

export interface WaterSample {
  surfaceY: number;
  bedY: number;
  currentX: number;
  currentZ: number;
}
export interface FluidVelocity { x: number; y: number; z: number }

/** Physical canal volume, including the water below bridges. Never infer it
 * from the player's Z alone: outside the authored canal there is no water. */
export function canalWaterAt(x: number, z: number): WaterSample | null {
  if (!Number.isFinite(x + z) || x < CORE_WORLD.minX || x > CORE_WORLD.maxX || z <= CANAL.z0 + 0.3 || z >= CANAL.z1 - 0.3) return null;
  const across = (z - CANAL.z0) / (CANAL.z1 - CANAL.z0);
  return { surfaceY: CANAL.waterY, bedY: CANAL.bedY, currentX: 0.18 + Math.sin(across * Math.PI) * 0.3, currentZ: 0 };
}

export function submergedFraction(bottomY: number, height: number, surfaceY: number): number {
  if (height <= 0 || !Number.isFinite(bottomY + height + surfaceY)) return 0;
  return Math.max(0, Math.min(1, (surfaceY - bottomY) / height));
}

/** Delta velocity from fluid only. Havok supplies gravity separately. The
 * exponential drag cannot reverse relative velocity even on a slow step.
 * densityRatio is displaced-water mass / body mass at full submersion. */
export function waterVelocityDelta(velocity: FluidVelocity, water: WaterSample, dt: number, fraction: number, densityRatio: number): FluidVelocity {
  if (!(dt > 0) || !Number.isFinite(dt + fraction + densityRatio)) return { x: 0, y: 0, z: 0 };
  const wet = Math.max(0, Math.min(1, fraction));
  const drag = 1 - Math.exp(-2.8 * wet * Math.min(dt, 0.25));
  return {
    x: (water.currentX - velocity.x) * drag,
    y: -velocity.y * drag + 9.81 * wet * Math.max(0, densityRatio) * Math.min(dt, 0.25),
    z: (water.currentZ - velocity.z) * drag,
  };
}

/** Swimmer response: strokes accelerate through the current rather than
 * replacing velocity each step; buoyancy is a damped spring with inertia. */
export function swimVelocity(velocity: FluidVelocity, desired: FluidVelocity, feetY: number, water: WaterSample, dt: number): FluidVelocity {
  const h = Math.max(0, Math.min(0.1, dt));
  const drag = 1 - Math.exp(-3 * h);
  const equilibrium = water.surfaceY - 1.1;
  return {
    x: velocity.x + (desired.x + water.currentX - velocity.x) * drag,
    y: Math.max(-3, Math.min(3, velocity.y + ((equilibrium - feetY) * 18 - velocity.y * 6) * h)),
    z: velocity.z + (desired.z + water.currentZ - velocity.z) * drag,
  };
}
