import { environmentSamples } from "./physicalSounds";
import type { Volumes } from "./Audio";

export type SoundRegion = "japan" | "china";

/**
 * A scene-owned, quiet physical soundscape. The main world's context remains
 * suspended: keyboard gestures here never revive its traffic or dialogue.
 * Water follows the authored pond/river; footsteps follow actual movement.
 * No synthetic speech, fake accents or downloaded assets.
 */
export class RegionalAudio {
  private ctx: AudioContext | null = null;
  private root: GainNode | null = null;
  private sfx: GainNode | null = null;
  private water: GainNode | null = null;
  private stepBuffer: AudioBuffer | null = null;
  private sources = new Set<AudioScheduledSourceNode>();
  private abort = new AbortController();
  private closed = false;
  private previous: { x: number; z: number } | null = null;
  private stride = 0;

  constructor(readonly region: SoundRegion, volumes: Pick<Volumes, "master" | "sfx" | "ambience" | "muted">) {
    if (typeof window === "undefined") return;
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    const ctx = this.ctx = new Ctor({ latencyHint: "playback" });
    this.root = ctx.createGain(); this.root.gain.value = volumes.muted ? 0 : volumes.master;
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -8; limiter.knee.value = 4; limiter.ratio.value = 10;
    this.root.connect(limiter).connect(ctx.destination);
    const ambience = ctx.createGain(); ambience.gain.value = volumes.ambience; ambience.connect(this.root);
    this.sfx = ctx.createGain(); this.sfx.gain.value = volumes.sfx; this.sfx.connect(this.root);
    const makeBuffer = (seconds: number, seed: number): AudioBuffer => {
      const samples = environmentSamples(ctx.sampleRate, seconds, seed), buffer = ctx.createBuffer(1, samples.length, ctx.sampleRate);
      buffer.copyToChannel(samples, 0); return buffer;
    };
    const noise = makeBuffer(4, region === "japan" ? 1441 : 7283);
    const loop = (cutoff: number, gain: number, destination: AudioNode): GainNode => {
      const source = ctx.createBufferSource(); source.buffer = noise; source.loop = true;
      const filter = ctx.createBiquadFilter(); filter.type = "lowpass"; filter.frequency.value = cutoff;
      const level = ctx.createGain(); level.gain.value = gain;
      source.connect(filter).connect(level).connect(destination); source.start(); this.sources.add(source);
      return level;
    };
    // A quiet air bed, distinct from the main map's recorded highway loop.
    loop(region === "japan" ? 450 : 650, 0.055, ambience);
    this.water = loop(region === "japan" ? 2200 : 1500, 0, ambience);
    this.stepBuffer = makeBuffer(0.095, 9151);
    const visibility = (): void => {
      if (this.closed) return;
      if (document.hidden) void ctx.suspend().catch(() => {});
      else void ctx.resume().catch(() => {});
    };
    document.addEventListener("visibilitychange", visibility, { signal: this.abort.signal });
    window.addEventListener("pagehide", () => { void ctx.suspend().catch(() => {}); }, { signal: this.abort.signal });
    window.addEventListener("pageshow", visibility, { signal: this.abort.signal });
    if (!document.hidden) void ctx.resume().catch(() => {});
  }

  update(x: number, z: number, dt: number): void {
    if (!this.ctx || !this.water || this.closed || document.hidden) return;
    const waterDistance = this.region === "japan" ? Math.hypot(x - 10.3, z - 27.2) : Math.abs(x);
    const near = this.region === "japan" ? Math.max(0, 1 - waterDistance / 18) : Math.max(0, 1 - waterDistance / 32);
    this.water.gain.setTargetAtTime(near * near * (this.region === "japan" ? 0.32 : 0.24), this.ctx.currentTime, 0.4);
    const old = this.previous; this.previous = { x, z };
    if (!old || dt <= 0 || dt > 0.5 || this.ctx.state !== "running") return;
    const distance = Math.hypot(x - old.x, z - old.z);
    if (distance > dt * 12) { this.stride = 0; return; } // teleport, not a stride
    this.stride += distance;
    if (this.stride < 1.55) return;
    this.stride %= 1.55;
    this.step();
  }

  private step(): void {
    if (!this.ctx || !this.stepBuffer || !this.sfx || this.sources.size >= 6) return;
    const ctx = this.ctx, source = ctx.createBufferSource(), gain = ctx.createGain();
    source.buffer = this.stepBuffer; source.playbackRate.value = 0.92 + Math.random() * 0.16;
    const filter = ctx.createBiquadFilter(); filter.type = "bandpass"; filter.frequency.value = 1250; filter.Q.value = 0.8;
    gain.gain.setValueAtTime(0.16, ctx.currentTime); gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.085);
    source.connect(filter).connect(gain).connect(this.sfx);
    this.sources.add(source); source.onended = () => { this.sources.delete(source); source.disconnect(); filter.disconnect(); gain.disconnect(); };
    source.start(); source.stop(ctx.currentTime + 0.1);
  }

  dispose(): void {
    if (this.closed) return;
    this.closed = true; this.abort.abort();
    for (const source of this.sources) { try { source.stop(); } catch { /* ended */ } source.disconnect(); }
    this.sources.clear(); this.root?.disconnect();
    if (this.ctx) void this.ctx.close().catch(() => {});
    this.ctx = null;
  }
}
