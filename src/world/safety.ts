import { WORLD_BOUNDS } from "../app/config";
export { SAFE_SPOTS } from "./layout";

/** Bounds beyond which any actor is considered lost and recovered. */
export const WORLD_BOUNDS_PAD = {
  minX: WORLD_BOUNDS.minX - 4, maxX: WORLD_BOUNDS.maxX + 4,
  minZ: WORLD_BOUNDS.minZ - 4, maxZ: WORLD_BOUNDS.maxZ + 4,
};
