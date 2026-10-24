/**
 * Bijli gayi: a power cut. They come in the evening when the load is highest and in heavy rain, last a minute or two
 * of real time, and end with the lights flickering back. While one lasts, lamps, tube lights and shop signs go dark
 * (the streets lean on the moon), an inverter beeps in the gali and a generator thumps in the bazaar.
 */
export class PowerCut {
  /** Power is off now. */
  on = false;
  /** 1 with power, 0 in a cut: what the lamps are multiplied by. */
  supply = 1;
  /** Seconds until the next cut can start; counts down only in the hours or the weather that cause them. */
  private next: number;
  private left = 0;
  private flicker = 0;
  onStart: (() => void) | null = null;
  onEnd: (() => void) | null = null;

  constructor(private rand: () => number = Math.random, first = 360 + 240 * Math.random()) {
    this.next = first;
  }

  /** Is this a time of day or a sky that makes the grid give up? */
  static prone(hour: number, rain: number): boolean {
    return (hour >= 17 && hour < 23.5) || rain > 0.6;
  }

  /** Start one now (the T menu, tests). */
  begin(seconds = 90): void {
    if (this.on) return;
    this.on = true;
    this.left = seconds;
    this.flicker = 0;
    this.onStart?.();
  }

  update(dt: number, hour: number, rain: number): void {
    if (this.on) {
      this.left -= dt;
      if (this.left <= 0) { this.on = false; this.flicker = 1.4; this.next = 480 + this.rand() * 600; this.onEnd?.(); }
    } else if (PowerCut.prone(hour, rain)) {
      this.next -= dt;
      if (this.next <= 0) this.begin(60 + this.rand() * 90);
    }
    let target = this.on ? 0 : 1;
    if (this.flicker > 0) {
      this.flicker -= dt;
      // Back, gone, back, gone, back for good.
      target = Math.floor(this.flicker * 3.5) % 2 === 1 ? 0 : 1;
    }
    this.supply += (target - this.supply) * Math.min(1, dt * 14);
  }
}
