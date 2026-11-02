/** Far, unobstructed civilian steering/sensing runs at 20 Hz. Accumulate its
 * real simulation time; physics and suspension retain their fixed 60 Hz clock.
 * Near traffic, hazards, signals, chases and buses request decisions immediately. */
export class TrafficDecisionClock {
  private elapsed=0;
  private first=true;
  advance(dt:number,urgent:boolean):number {
    this.elapsed+=dt;
    if(!this.first&&!urgent&&this.elapsed<.05-1e-8)return 0;
    const elapsed=this.elapsed;this.elapsed=0;this.first=false;return elapsed;
  }
}
