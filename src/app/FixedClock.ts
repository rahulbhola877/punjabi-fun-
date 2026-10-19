/**
 * The single authoritative simulation clock. Real frame time is accumulated
 * and consumed in fixed steps; the remainder becomes the interpolation alpha
 * used by visuals. Time scale supports pause (0) and slow motion (<1).
 */
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
    while (this.accumulator >= this.dt && steps < this.maxSteps) {
      step(this.dt);
      this.accumulator -= this.dt;
      this.simTime += this.dt;
      this.stepCount++;
      steps++;
    }
    if (steps === this.maxSteps && this.accumulator >= this.dt) {
      // Drop excess backlog to stay responsive on slow machines.
      this.droppedTime += this.accumulator;
      this.accumulator = this.accumulator % this.dt;
    }
    return this.accumulator / this.dt;
  }

  reset(): void {
    this.accumulator = 0;
  }
}
