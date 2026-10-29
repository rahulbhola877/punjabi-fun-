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
export const WORLD_BOUNDS = { minX: -1200, maxX: 1500, minZ: -1200, maxZ: 1200 } as const;

/**
 * Test tools: the T menu (street events on demand, rain, time of day, the naka
 * and the chowki) and the F1 line that mentions it. Players do not see them.
 * Open the page with ?probe to use them, the way the test scripts do.
 */
export const DEV_TOOLS = typeof location !== "undefined" && new URLSearchParams(location.search).has("probe");
