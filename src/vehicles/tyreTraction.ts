/** Contact impulses share a finite tyre friction budget. A wheel cannot use
 * full braking and full cornering grip simultaneously (the friction ellipse).
 * Load is the actual spring support force, so an unloaded wheel has no grip. */
export function tyreTraction(longitudinal: number, lateral: number, load: number, dt: number, grip: number): { longitudinal: number; lateral: number } {
  const support = Math.max(0, load) * dt * Math.max(0, grip);
  if (support <= 0) return { longitudinal: 0, lateral: 0 };
  const use = Math.hypot(longitudinal / (1.1 * support), lateral / (1.3 * support));
  const scale = use > 1 ? 1 / use : 1;
  return { longitudinal: longitudinal * scale, lateral: lateral * scale };
}
