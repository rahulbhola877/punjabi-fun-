/** Global tuning constants and collision groups shared by every system. */

/** The game's name: "gedi" is the Punjabi joyride round town with no particular place to go. */
export const GAME_NAME = "Gedi Route";
export const GAME_NAME_PA = "ਗੇੜੀ ਰੂਟ";

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


/** Playable bounds of the whole open world (metres, world XZ); see world/region.ts. */
export const WORLD_BOUNDS = { minX: -1000, maxX: 1000, minZ: -1000, maxZ: 1000 } as const;

/**
 * Free play: prices are still shown, but nothing is charged — shops, upgrades,
 * fares, bribes, lassi, dangal entry, the knock-out "lighter pocket". Set to
 * false to bring the economy back.
 */
export const FREE_PLAY = true;
