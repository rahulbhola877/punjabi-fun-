/**
 * The single authoritative simulation clock. Real frame time is accumulated
 * and consumed in fixed steps; the remainder becomes the interpolation alpha
 * used by visuals. Time scale supports pause (0) and slow motion (<1).
 */
/** Keep short slow frames without simulating long background-tab pauses. */
export function simulationFrameDelta(raw: number): number {
  if (!Number.isFinite(raw) || raw <= 0) return 0;
  return Math.min(raw, raw > 1 ? 0.1 : 0.25);
}

/** Optional catch-up limit: retain normal physics steps even if a slow frame
 * has spare time, but never let additional simulation monopolize the browser. */
export interface CatchUpBudget {
  /** Steps always permitted, matching the previous fixed-step cap. */
  guaranteedSteps: number;
  /** Wall-clock budget for all steps in a catch-up frame. */
  maxMilliseconds: number;
  /** Injectable monotonic timer for deterministic tests. */
  now?: () => number;
}

export class FixedClock {
  private accumulator = 0;
  /** Total simulated seconds. */
  simTime = 0;
  /** Number of fixed steps executed since creation. */
  stepCount = 0;
  timeScale = 1;
  /** Steps dropped because a frame exceeded the step budget. */
  droppedTime = 0;

  constructor(
    readonly dt: number,
    readonly maxSteps: number,
    private readonly budget?: CatchUpBudget,
  ) {}

  /**
   * Advance by a real frame delta (seconds) and invoke `step` for each fixed
   * step due. Returns the interpolation alpha in [0, 1).
   */
  advance(realDelta: number, step: (dt: number) => void): number {
    // Clamp absurd deltas (tab switches, breakpoints) before scaling.
    const clamped = Math.min(Math.max(realDelta, 0), 0.25);
    this.accumulator += clamped * this.timeScale;
    let steps = 0;
    // Most frames need at most a couple of steps and avoid timer reads. When
    // catching up, count the cost of the guaranteed steps too, so extra work
    // never compounds a CPU-bound slow frame into a runaway backlog.
    const guaranteed = Math.max(1, Math.min(this.maxSteps, this.budget?.guaranteedSteps ?? this.maxSteps));
    const timing = !!this.budget && this.accumulator >= this.dt * (guaranteed + 1);
    const now = this.budget?.now ?? (() => performance.now());
    const start = timing ? now() : 0;
    while (this.accumulator >= this.dt && steps < this.maxSteps) {
      if (timing && steps >= guaranteed && now() - start >= this.budget!.maxMilliseconds) break;
      step(this.dt);
      this.accumulator -= this.dt;
      this.simTime += this.dt;
      this.stepCount++;
      steps++;
    }
    if (this.accumulator >= this.dt) {
      // Drop excess backlog to stay responsive on slow machines.
      const remainder = this.accumulator % this.dt;
      this.droppedTime += this.accumulator - remainder;
      this.accumulator = remainder;
    }
    return this.accumulator / this.dt;
  }

  reset(): void {
    this.accumulator = 0;
  }
}
