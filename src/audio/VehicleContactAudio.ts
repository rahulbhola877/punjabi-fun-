import type { Vector3 } from "../babylon";

export interface VehicleContact {
  pos: Vector3;
  speed: number;
  lateralSpeed: number;
  grounded: boolean;
  gravel: boolean;
  braking: boolean;
}

/** Contact noise for the player's current ride, independent of its engine. */
export class VehicleContactAudio {
  private active: { rolling: GainNode; skid: GainNode; filter: BiquadFilterNode; panner: PannerNode; sources: AudioScheduledSourceNode[]; nodes: AudioNode[] } | null = null;
  private quiet = 0;

  constructor(private ctx: AudioContext, private destination: AudioNode, private noise: AudioBuffer) {}

  update(contact: VehicleContact | null, dt: number): void {
    const speed = contact ? Math.abs(contact.speed) : 0;
    const rolling = contact?.grounded && speed > 1 ? Math.min(1, speed / 18) * (contact.gravel ? 0.24 : 0.055) : 0;
    // Real sideways velocity produces the squeal, not steering input. Braking
    // alone does not imply a lock-up; it only changes a skid that already exists.
    const skid = contact?.grounded && !contact.gravel && speed > 2 ? Math.max(0, Math.min(1, (Math.abs(contact.lateralSpeed) - 1.6) / 5)) * (contact.braking ? 0.075 : 0.055) : 0;
    if (rolling + skid > 0.001) { this.quiet = 0; this.wake(); }
    else this.quiet += dt;
    const live = this.active;
    if (!live) return;
    const time = this.ctx.currentTime;
    live.rolling.gain.setTargetAtTime(rolling, time, 0.08);
    live.skid.gain.setTargetAtTime(skid, time, 0.06);
    live.filter.frequency.setTargetAtTime(contact?.gravel ? 1500 : 650, time, 0.08);
    if (contact) {
      live.panner.positionX.setTargetAtTime(contact.pos.x, time, 0.02);
      live.panner.positionY.setTargetAtTime(contact.pos.y, time, 0.02);
      live.panner.positionZ.setTargetAtTime(-contact.pos.z, time, 0.02);
    }
    if (this.quiet > 0.5) this.dispose();
  }

  private wake(): void {
    if (this.active) return;
    const ctx = this.ctx, source = ctx.createBufferSource(), tyre = ctx.createOscillator();
    source.buffer = this.noise; source.loop = true;
    tyre.type = "triangle"; tyre.frequency.value = 1260;
    const filter = ctx.createBiquadFilter(); filter.type = "lowpass"; filter.frequency.value = 650;
    const rolling = ctx.createGain(), skid = ctx.createGain(); rolling.gain.value = 0; skid.gain.value = 0;
    const panner = ctx.createPanner(); panner.panningModel = "equalpower"; panner.distanceModel = "inverse"; panner.refDistance = 4; panner.rolloffFactor = 1;
    source.connect(filter).connect(rolling).connect(panner); tyre.connect(skid).connect(panner); panner.connect(this.destination);
    source.start(); tyre.start();
    this.active = { rolling, skid, filter, panner, sources: [source, tyre], nodes: [filter, rolling, skid, panner] };
  }

  dispose(): void {
    if (!this.active) return;
    for (const source of this.active.sources) { try { source.stop(); } catch { /* ended */ } source.disconnect(); }
    for (const node of this.active.nodes) node.disconnect();
    this.active = null;
  }
}
