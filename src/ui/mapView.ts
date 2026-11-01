import { WORLD_BOUNDS } from "../app/config";

/** The full view fits the asymmetric world; closer views follow the player. */
export function mapView(width: number, height: number, zoom: number, player: { x: number; z: number }): { cx: number; cz: number; scale: number } {
  const span = zoom <= 1
    ? Math.max(WORLD_BOUNDS.maxX - WORLD_BOUNDS.minX, WORLD_BOUNDS.maxZ - WORLD_BOUNDS.minZ) * 1.04
    : 2000 / zoom;
  return {
    cx: zoom <= 1 ? (WORLD_BOUNDS.minX + WORLD_BOUNDS.maxX) / 2 : player.x,
    cz: zoom <= 1 ? (WORLD_BOUNDS.minZ + WORLD_BOUNDS.maxZ) / 2 : player.z,
    scale: Math.min(width, height) / span,
  };
}

/** Convert a canvas fraction to the world coordinates used by drawMap. */
export function mapPoint(width: number, height: number, fx: number, fy: number, view: { cx: number; cz: number; scale: number }): { x: number; z: number } {
  return { x: view.cx + (fx * width - width / 2) / view.scale, z: view.cz - (fy * height - height / 2) / view.scale };
}
