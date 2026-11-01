/** Global tuning constants and collision groups shared by every system. */
import { outerWorldEnabled } from "./outerGate";

/** The game's name: "gedi" is the Punjabi joyride round town with no particular place to go. */
export const GAME_NAME = "Gedi Multiverse";
export const GAME_NAME_PA = "ਗੇੜੀ ਮਲਟੀਵਰਸ";

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


/**
 * Test tools: the T menu (street events on demand, rain, time of day, the naka
 * and the chowki) and the F1 line that mentions it. Players do not see them.
 * Open the page with ?probe to use them, the way the test scripts do.
 */
export const DEV_TOOLS = typeof location !== "undefined" && new URLSearchParams(location.search).has("probe");

/** Sparse experimental terrain is available only to local development probes.
 * It must not expand normal play or a production build. */
export const OUTER_WORLD_ENABLED = outerWorldEnabled(typeof location === "undefined" ? "" : location.search, import.meta.env.DEV);

/** Playable bounds of the open world (metres, world XZ); see world/region.ts. */
export const WORLD_BOUNDS = OUTER_WORLD_ENABLED
  ? { minX: -3900, maxX: 4200, minZ: -3600, maxZ: 4500 }
  : { minX: -1200, maxX: 1500, minZ: -1200, maxZ: 2100 };
