export interface StopOrder { approach: number; elapsed: number; stopped: number; closest: number }
/** signed is the vehicle's position along the road relative to the checkpoint. */
export function advanceStop(order: StopOrder, dt: number, signed: number, distance: number, speed: number): "wait" | "stopped" | "refused" {
  order.elapsed += dt;
  order.closest = Math.min(order.closest, distance);
  order.stopped = speed < 0.5 && distance < 36 ? order.stopped + dt : 0;
  if (order.stopped >= 1) return "stopped";
  if (signed * order.approach < -5 || distance > 45 || order.elapsed > 3 && distance > order.closest + 12 || order.elapsed > 10 && speed > 2) return "refused";
  return "wait";
}
