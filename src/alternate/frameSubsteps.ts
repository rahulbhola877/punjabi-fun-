/** Foreground stalls count in full. A pause/visibility transition resets the
 * clock instead of treating suspended time as movement on the next frame. */
export class ForegroundFrameClock {
  private interrupted = true;

  interrupt(): void { this.interrupted = true; }

  preview(rawSeconds: number, suspended: boolean): number {
    return suspended || this.interrupted || !Number.isFinite(rawSeconds) || rawSeconds <= 0 ? 0 : rawSeconds;
  }

  read(rawSeconds: number, suspended: boolean): number {
    const seconds = this.preview(rawSeconds, suspended);
    this.interrupted = suspended;
    return seconds;
  }
}

/** At the fastest lunar burst (18 m/s) each collision probe is at most 0.3 m
 * apart, smaller than a player's footprint. No foreground time is truncated.
 * Input edges, interactions and presentation belong outside this loop. */
export function forEachFrameSubstep(seconds: number, step: (dt: number) => void): void {
  if (!Number.isFinite(seconds) || seconds <= 0) return;
  const count = Math.ceil(seconds * 60), dt = seconds / count;
  for (let i = 0; i < count; i++) step(dt);
}
