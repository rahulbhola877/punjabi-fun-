/** Short foreground stalls must not turn a 4 m/s walk into slow motion.
 * Background pauses are deliberately discarded rather than teleporting. */
export function districtFrameDelta(raw: number): number {
  return !Number.isFinite(raw) || raw <= 0 ? 0 : Math.min(raw, raw > 1 ? 0.05 : 0.25);
}

/** The simple district controllers use geometric footprints rather than the
 * main Havok world. Substeps preserve those footprints during low-FPS play;
 * testing only the endpoint of a long frame would skip narrow obstacles. */
export function moveInDistrict(
  player: { x: number; z: number }, dx: number, dz: number,
  speed: number, dt: number, canWalk: (x: number, z: number) => boolean,
): boolean {
  const length = Math.hypot(dx, dz);
  if (!length || dt <= 0) return false;
  const seconds = districtFrameDelta(dt), steps = Math.max(1, Math.ceil(seconds * 60));
  const sx = dx / length * speed * seconds / steps, sz = dz / length * speed * seconds / steps;
  let moved = false;
  for (let i = 0; i < steps; i++) {
    if (sx && canWalk(player.x + sx, player.z)) { player.x += sx; moved = true; }
    if (sz && canWalk(player.x, player.z + sz)) { player.z += sz; moved = true; }
  }
  return moved;
}
