import { JAPAN_POND } from "./japanMap";

export interface KoiPose { x: number; z: number; yaw: number; tail: number }

/**
 * A slow, lateral-swimming circuit with a gentle feeding-side gathering.
 * `feeding` is a smooth 0..1 blend, not a teleport, and keeps the full fish
 * safely away from the pond edge. The +Z-facing head follows the tangent.
 */
export function koiPose(time: number, index: number, feeding: number): KoiPose {
  const blend = Math.max(0, Math.min(1, feeding));
  const phase = time * (0.38 + index * 0.035) + index * (Math.PI * 2 / 3);
  const rx = 1.85 * (1 - blend) + 0.48 * blend;
  const rz = 1.2 * (1 - blend) + 0.48 * blend;
  const cx = JAPAN_POND.x - 1.45 * blend;
  const x = cx + Math.cos(phase) * rx, z = JAPAN_POND.z + Math.sin(phase) * rz;
  const yaw = Math.atan2(-Math.sin(phase) * rx, Math.cos(phase) * rz) + Math.sin(time * 2.2 + index) * 0.035;
  return { x, z, yaw, tail: Math.sin(time * 2.2 + index * 1.1) * 0.24 };
}
