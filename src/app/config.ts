/** Global tuning constants and collision groups shared by every system. */

export const FIXED_DT = 1 / 60;
/** Upper bound on simulation steps per rendered frame (prevents spiral of death). */
export const MAX_STEPS_PER_FRAME = 5;
export const GRAVITY = -9.81;

/** Havok collision filter bits. */
export const Group = {
  STATIC: 1,
  PROP: 2,
  VEHICLE: 4,
  RESIDENT: 8,
  PLAYER: 16,
  TRIGGER: 32,
  /** Big street animals (buffaloes, cows): solid to vehicles, ignored by suspension rays. */
  ANIMAL: 64,
} as const;

/** Raycast mask used for "solid world" checks (camera, ground probes, exits). */
export const SOLID_MASK = Group.STATIC | Group.PROP | Group.VEHICLE;

/** Playable bounds of the whole open world (metres, world XZ); see world/region.ts. */
export const WORLD_BOUNDS = { minX: -700, maxX: 700, minZ: -700, maxZ: 700 } as const;
