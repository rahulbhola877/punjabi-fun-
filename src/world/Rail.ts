/**
 * The railway: one line across the whole map east–west at z = 560, with the Kotli road crossing it at x = 0 (a
 * level crossing with two boom gates). A goods train runs the line every four minutes, in turn from the west and
 * from the east. The gates close as it comes, so everything here is a function of the game clock.
 */

export const RAIL = {
  /** Centre line of the track (z). */
  z: 560,
  /** Where the Kotli road crosses (x). */
  crossX: 0,
  /** Half-width of the cleared corridor (ballast and verge). */
  half: 6,
  /** Seconds between trains, and the train's speed (m/s) and length (m). */
  period: 240,
  speed: 20,
  length: 108,
  /** The line is run from this far outside the map edge. */
  reach: 1100,
  /** The first train comes this many seconds into the game. */
  first: 70,
  /** The gates close when the train's nose is this near (m) and open when the tail is this far past. */
  closeAt: 210,
  openAfter: 24,
};

/** Seconds a gate takes to go up or down. */
export const GATE_SECONDS = 3.5;

export interface TrainAt {
  /** The nose of the train (x) and the way it goes (+1 east, -1 west). */
  x: number;
  dir: 1 | -1;
  /** Which run this is. */
  k: number;
}

/** The train that is on the line at time t (seconds), if any. */
export function trainAt(t: number): TrainAt | null {
  const s = t - RAIL.first;
  if (s < 0) return null;
  const k = Math.floor(s / RAIL.period);
  const tau = s - k * RAIL.period;
  const dir: 1 | -1 = k % 2 === 0 ? 1 : -1;
  const x = -dir * RAIL.reach + dir * RAIL.speed * tau;
  // Gone off the far end?
  if (dir === 1 ? x - RAIL.length > RAIL.reach : x + RAIL.length < -RAIL.reach) return null;
  return { x, dir, k };
}

/** Where the train's tail is (the end behind the nose). */
export function tailOf(tr: TrainAt): number {
  return tr.x - tr.dir * RAIL.length;
}

/**
 * Should the gates be down? From when the nose is `closeAt` metres short of the crossing until the tail is
 * `openAfter` metres past it. 0 is open, 1 is down; it eases over GATE_SECONDS.
 */
export function gateClosed(t: number): boolean {
  const base = Math.floor((t - RAIL.first) / RAIL.period);
  for (let k = Math.max(0, base - 1); k <= base + 1; k++) {
    const tau = t - RAIL.first - k * RAIL.period;
    const dir = k % 2 === 0 ? 1 : -1;
    const nose = -dir * RAIL.reach + dir * RAIL.speed * tau;
    const tail = nose - dir * RAIL.length;
    // How far the nose is short of the crossing (positive while it approaches), and how far the tail is past it.
    const before = dir * (RAIL.crossX - nose);
    const past = dir * (tail - RAIL.crossX);
    if (before < RAIL.closeAt && past < RAIL.openAfter) return true;
  }
  return false;
}

/**
 * How far ahead a car on the Kotli road must stop for a closed gate: the distance to the stop line, or Infinity.
 * `closed` is the state of the gates now (they take a moment to come down, cars stop when they start).
 */
export function gateAhead(pos: { x: number; z: number }, fx: number, fz: number, closed: boolean): number {
  if (!closed) return Infinity;
  if (Math.abs(pos.x - RAIL.crossX) > 6) return Infinity;
  const s = Math.sign(fz);
  if (!s || Math.abs(fz) < Math.abs(fx)) return Infinity;
  const line = RAIL.z - s * 8.2;
  const along = (pos.z - line) * -s;
  if (along < -0.5 || along > 45) return Infinity;
  return along;
}
