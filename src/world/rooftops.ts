import { OUTER_BUILDINGS } from "./region";

/** A spot on a kothi's flat roof where someone can stand (just behind the front parapet). */
export interface RoofSpot { id: string; x: number; y: number; z: number; /** Facing the street. */ yaw: number }

/**
 * Where to stand on each colony kothi's roof. Mirrors kothi() in country.ts:
 * the yard is yd deep, the house front at local z = -yd, the roof at
 * plinth + floors × 3.15; local (u, z) maps to the world through the same
 * frame frontFrame() sets.
 */
export const ROOF_SPOTS: RoofSpot[] = OUTER_BUILDINGS.filter((b) => b.style === "kothi").map((b) => {
  const f = b.face, eps = 1e-3;
  let ox: number, oz: number, rot: number, w: number, d: number;
  if (Math.abs(f) < eps) { ox = b.x0; oz = b.z1; rot = 0; w = b.x1 - b.x0; d = b.z1 - b.z0; }
  else if (Math.abs(f - Math.PI) < eps) { ox = b.x1; oz = b.z0; rot = Math.PI; w = b.x1 - b.x0; d = b.z1 - b.z0; }
  else if (Math.abs(f + Math.PI / 2) < eps) { ox = b.x0; oz = b.z0; rot = -Math.PI / 2; w = b.z1 - b.z0; d = b.x1 - b.x0; }
  else { ox = b.x1; oz = b.z1; rot = Math.PI / 2; w = b.z1 - b.z0; d = b.x1 - b.x0; }
  const yd = Math.min(4.5, Math.max(3, d * 0.27));
  const u = w * 0.5, z = -yd - 1.4;
  const c = Math.cos(rot), s = Math.sin(rot);
  return { id: b.id, x: ox + u * c + z * s, y: 0.45 + b.floors * 3.15, z: oz - u * s + z * c, yaw: f };
});
