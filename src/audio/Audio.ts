import { Vector3 } from "../babylon";

/**
 * All game audio is synthesised at runtime with WebAudio (no sample files):
 * engines, horns, footsteps, impacts, layered bazaar ambience, birds,
 * workshop clanks and short tumbi/dhol stingers. See docs/ASSETS.md.
 */
export interface Volumes { master: number; sfx: number; ambience: number; music: number; muted: boolean }

function noiseBuffer(ctx: AudioContext, seconds: number, color: "white" | "pink" | "brown"): AudioBuffer {
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  let b0 = 0, b1 = 0, b2 = 0, last = 0;
  for (let i = 0; i < len; i++) {
    const w = Math.random() * 2 - 1;
    if (color === "white") d[i] = w;
    else if (color === "pink") {
      b0 = 0.99765 * b0 + w * 0.099046;
      b1 = 0.963 * b1 + w * 0.2965164;
      b2 = 0.57 * b2 + w * 1.0526913;
      d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.2;
    } else {
      last = (last + 0.02 * w) / 1.02;
      d[i] = last * 3.5;
    }
  }
  return buf;
}

export class EngineVoice {
  private osc: OscillatorNode;
  private sub: OscillatorNode;
  private noise: AudioBufferSourceNode;
  private am: GainNode;
  private lfo: OscillatorNode;
  private lfoGain: GainNode;
  private filter: BiquadFilterNode;
  readonly out: GainNode;
  readonly panner: PannerNode;

  constructor(private ctx: AudioContext, dest: AudioNode, noiseBuf: AudioBuffer, private p: { idle: number; top: number; pulse: number; tone: number }) {
    this.panner = ctx.createPanner();
    this.panner.panningModel = "HRTF";
    this.panner.distanceModel = "inverse";
    this.panner.refDistance = 3;
    this.panner.rolloffFactor = 1.2;
    this.out = ctx.createGain();
    this.out.gain.value = 0;
    this.filter = ctx.createBiquadFilter();
    this.filter.type = "lowpass";
    this.filter.Q.value = 2.5;
    this.filter.frequency.value = p.tone * 0.5;
    this.am = ctx.createGain();
    this.am.gain.value = 0.5;
    // Firing pulses: an LFO at the firing rate modulates amplitude.
    this.lfo = ctx.createOscillator();
    this.lfo.type = "square";
    this.lfo.frequency.value = p.idle;
    this.lfoGain = ctx.createGain();
    this.lfoGain.gain.value = p.pulse * 0.5;
    this.lfo.connect(this.lfoGain).connect(this.am.gain);
    this.osc = ctx.createOscillator();
    this.osc.type = "sawtooth";
    this.osc.frequency.value = p.idle * 2;
    this.sub = ctx.createOscillator();
    this.sub.type = "square";
    this.sub.frequency.value = p.idle;
    const subG = ctx.createGain();
    subG.gain.value = 0.35;
    this.noise = ctx.createBufferSource();
    this.noise.buffer = noiseBuf;
    this.noise.loop = true;
    const nG = ctx.createGain();
    nG.gain.value = 0.25;
    this.osc.connect(this.am);
    this.sub.connect(subG).connect(this.am);
    this.noise.connect(nG).connect(this.am);
    this.am.connect(this.filter).connect(this.out).connect(this.panner).connect(dest);
    this.osc.start();
    this.sub.start();
    this.noise.start();
    this.lfo.start();
  }

  /** rpm01: 0 idle → 1 redline; load: throttle; on: engine running. */
  set(rpm01: number, load: number, on: boolean, pos: Vector3): void {
    const t = this.ctx.currentTime;
    const f = this.p.idle + (this.p.top - this.p.idle) * rpm01;
    this.osc.frequency.setTargetAtTime(f * 2, t, 0.05);
    this.sub.frequency.setTargetAtTime(f, t, 0.05);
    this.lfo.frequency.setTargetAtTime(f, t, 0.05);
    this.filter.frequency.setTargetAtTime(this.p.tone * (0.35 + rpm01 * 0.8 + load * 0.3), t, 0.08);
    this.out.gain.setTargetAtTime(on ? 0.18 + load * 0.12 + rpm01 * 0.08 : 0, t, on ? 0.08 : 0.3);
    this.panner.positionX.setTargetAtTime(pos.x, t, 0.02);
    this.panner.positionY.setTargetAtTime(pos.y, t, 0.02);
    this.panner.positionZ.setTargetAtTime(-pos.z, t, 0.02);
  }

  dispose(): void {
    for (const n of [this.osc, this.sub, this.noise, this.lfo]) {
      try { n.stop(); } catch { /* already stopped */ }
      n.disconnect();
    }
    this.out.disconnect();
    this.panner.disconnect();
  }
}

export class AudioSystem {
  ctx: AudioContext | null = null;
  private master!: GainNode;
  private sfx!: GainNode;
  private amb!: GainNode;
  private music!: GainNode;
  private buffers: Record<string, AudioBuffer> = {};
  private started = false;
  volumes: Volumes = { master: 0.8, sfx: 0.9, ambience: 0.7, music: 0.7, muted: false };
  private nextBird = 0;
  private nextChatter = 0;
  private nextClank = 0;
  private nextCall = 0;
  private listenerPos = new Vector3();
  /** World points for positional ambience. */
  workshopPos = new Vector3(14, 1, 24);
  dhabaPos = new Vector3(-14, 1, -34);
  treePositions: Vector3[] = [];

  /** Create/resume the context; must be called from a user gesture. */
  unlock(): void {
    if (!this.ctx) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      this.ctx = new Ctor();
      this.build();
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
  }

  get ready(): boolean {
    return !!this.ctx && this.ctx.state === "running";
  }

  private build(): void {
    const ctx = this.ctx!;
    this.master = ctx.createGain();
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 4;
    this.master.connect(comp).connect(ctx.destination);
    this.sfx = ctx.createGain();
    this.amb = ctx.createGain();
    this.music = ctx.createGain();
    this.sfx.connect(this.master);
    this.amb.connect(this.master);
    this.music.connect(this.master);
    this.buffers.white = noiseBuffer(ctx, 2, "white");
    this.buffers.pink = noiseBuffer(ctx, 4, "pink");
    this.buffers.brown = noiseBuffer(ctx, 4, "brown");
    this.applyVolumes();
    this.startAmbienceBed();
  }

  applyVolumes(): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(this.volumes.muted ? 0 : this.volumes.master, t, 0.05);
    this.sfx.gain.setTargetAtTime(this.volumes.sfx, t, 0.05);
    this.amb.gain.setTargetAtTime(this.volumes.ambience, t, 0.05);
    this.music.gain.setTargetAtTime(this.volumes.music, t, 0.05);
  }

  /** Suspend everything while paused. */
  setPaused(p: boolean): void {
    if (!this.ctx) return;
    if (p) void this.ctx.suspend();
    else void this.ctx.resume();
  }

  private startAmbienceBed(): void {
    if (this.started) return;
    this.started = true;
    const ctx = this.ctx!;
    // Distant city wash.
    const bed = ctx.createBufferSource();
    bed.buffer = this.buffers.brown!;
    bed.loop = true;
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 500;
    const g = ctx.createGain();
    g.gain.value = 0.22;
    bed.connect(lp).connect(g).connect(this.amb);
    bed.start();
    // Crowd murmur: band-passed pink noise with slow formant wobble.
    for (let i = 0; i < 3; i++) {
      const src = ctx.createBufferSource();
      src.buffer = this.buffers.pink!;
      src.loop = true;
      src.playbackRate.value = 0.9 + i * 0.07;
      const bp = ctx.createBiquadFilter();
      bp.type = "bandpass";
      bp.frequency.value = 420 + i * 260;
      bp.Q.value = 2.2;
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 0.6 + i * 0.37;
      const lg = ctx.createGain();
      lg.gain.value = 120;
      lfo.connect(lg).connect(bp.frequency);
      const gg = ctx.createGain();
      gg.gain.value = 0.05;
      const pan = ctx.createStereoPanner();
      pan.pan.value = -0.6 + i * 0.6;
      src.connect(bp).connect(gg).connect(pan).connect(this.amb);
      src.start();
      lfo.start();
    }
  }

  setListener(pos: Vector3, forward: Vector3): void {
    if (!this.ctx) return;
    const l = this.ctx.listener;
    const t = this.ctx.currentTime;
    this.listenerPos.copyFrom(pos);
    if (l.positionX) {
      l.positionX.setTargetAtTime(pos.x, t, 0.02);
      l.positionY.setTargetAtTime(pos.y, t, 0.02);
      l.positionZ.setTargetAtTime(-pos.z, t, 0.02);
      // WebAudio is right-handed; Babylon is left-handed, so flip Z.
      l.forwardX.setTargetAtTime(forward.x, t, 0.02);
      l.forwardY.setTargetAtTime(forward.y, t, 0.02);
      l.forwardZ.setTargetAtTime(-forward.z, t, 0.02);
      l.upX.value = 0; l.upY.value = 1; l.upZ.value = 0;
    }
  }

  /** Positional helper: a panner at a world point (Z flipped for WebAudio). */
  private at(pos: Vector3 | null, dest: AudioNode, ref = 3): AudioNode {
    if (!pos) return dest;
    const p = this.ctx!.createPanner();
    p.panningModel = "equalpower";
    p.distanceModel = "inverse";
    p.refDistance = ref;
    p.rolloffFactor = 1.1;
    p.positionX.value = pos.x;
    p.positionY.value = pos.y;
    p.positionZ.value = pos.z; // caller already converted via worldToAudio
    p.connect(dest);
    return p;
  }

  /** Listener uses flipped Z too, so keep both consistent. */
  worldToAudio(v: Vector3): Vector3 {
    return new Vector3(v.x, v.y, -v.z);
  }

  createEngine(p: { idle: number; top: number; pulse: number; tone: number }): EngineVoice | null {
    if (!this.ctx) return null;
    return new EngineVoice(this.ctx, this.sfx, this.buffers.white!, p);
  }

  private tone(freq: number, dur: number, type: OscillatorType, gain: number, dest: AudioNode, when = 0, slideTo?: number): void {
    const ctx = this.ctx!;
    const t = ctx.currentTime + when;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(dest);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  private noiseHit(dur: number, freq: number, q: number, gain: number, dest: AudioNode, when = 0, type: BiquadFilterType = "bandpass"): void {
    const ctx = this.ctx!;
    const t = ctx.currentTime + when;
    const s = ctx.createBufferSource();
    s.buffer = this.buffers.white!;
    s.playbackRate.value = 0.8 + Math.random() * 0.4;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f).connect(g).connect(dest);
    s.start(t, Math.random());
    s.stop(t + dur + 0.05);
  }

  horn(hz: [number, number], pos: Vector3): void {
    if (!this.ready) return;
    const d = this.at(this.worldToAudio(pos), this.sfx, 6);
    this.tone(hz[0], 0.45, "square", 0.12, d);
    this.tone(hz[1], 0.45, "square", 0.1, d);
  }

  /** Brass cycle bell (purchasable scooter horn). */
  bell(pos: Vector3): void {
    if (!this.ready) return;
    const d = this.at(this.worldToAudio(pos), this.sfx, 6);
    for (const t of [0, 0.16]) for (const [f, g] of [[2350, 0.09], [4120, 0.05], [5900, 0.025]] as const) this.tone(f, 0.55, "sine", g, d, t);
  }

  footstep(pos: Vector3, strength: number, surface: "stone" | "tile" | "dirt"): void {
    if (!this.ready) return;
    const d = this.at(this.worldToAudio(pos), this.sfx, 2);
    const f = surface === "tile" ? 2400 : surface === "dirt" ? 600 : 1300;
    this.noiseHit(0.07, f, 1.2, 0.12 * strength, d);
    this.tone(90, 0.06, "sine", 0.1 * strength, d);
  }

  impact(pos: Vector3, strength: number): void {
    if (!this.ready) return;
    const s = Math.min(1, strength);
    const d = this.at(this.worldToAudio(pos), this.sfx, 4);
    this.tone(70, 0.25, "sine", 0.4 * s, d, 0, 40);
    this.noiseHit(0.18, 900, 0.8, 0.35 * s, d);
    if (s > 0.5) this.noiseHit(0.3, 3500, 3, 0.15 * s, d, 0.02);
  }

  ui(kind: "click" | "open" | "pickup" | "error" | "cash"): void {
    if (!this.ready) return;
    switch (kind) {
      case "click": this.tone(880, 0.06, "triangle", 0.08, this.sfx); break;
      case "open": this.tone(520, 0.1, "triangle", 0.07, this.sfx); this.tone(780, 0.12, "triangle", 0.06, this.sfx, 0.06); break;
      case "pickup": this.tone(660, 0.1, "sine", 0.12, this.sfx); this.tone(990, 0.15, "sine", 0.1, this.sfx, 0.08); break;
      case "error": this.tone(220, 0.2, "sawtooth", 0.06, this.sfx, 0, 160); break;
      case "cash":
        for (let i = 0; i < 4; i++) this.noiseHit(0.06, 6000 + i * 500, 6, 0.12, this.sfx, i * 0.05);
        this.tone(1320, 0.3, "sine", 0.08, this.sfx, 0.15);
        break;
    }
  }

  /** Karplus–Strong plucked string, a nod to the tumbi. */
  private pluck(freq: number, when: number, gain: number): void {
    const ctx = this.ctx!;
    const sr = ctx.sampleRate;
    const dur = 0.9;
    const buf = ctx.createBuffer(1, Math.floor(sr * dur), sr);
    const d = buf.getChannelData(0);
    const period = Math.max(2, Math.floor(sr / freq));
    const ring = new Float32Array(period);
    for (let i = 0; i < period; i++) ring[i] = Math.random() * 2 - 1;
    let idx = 0;
    for (let i = 0; i < d.length; i++) {
      const next = (idx + 1) % period;
      const v = (ring[idx]! + ring[next]!) * 0.4985;
      d[i] = ring[idx]!;
      ring[idx] = v;
      idx = next;
    }
    const s = ctx.createBufferSource();
    s.buffer = buf;
    const g = ctx.createGain();
    g.gain.value = gain;
    const hp = ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 300;
    s.connect(hp).connect(g).connect(this.music);
    s.start(ctx.currentTime + when);
  }

  private dhol(when: number, low: boolean): void {
    const ctx = this.ctx!;
    const t = ctx.currentTime + when;
    const o = ctx.createOscillator();
    o.type = "sine";
    o.frequency.setValueAtTime(low ? 95 : 260, t);
    o.frequency.exponentialRampToValueAtTime(low ? 55 : 180, t + 0.18);
    const g = ctx.createGain();
    g.gain.setValueAtTime(low ? 0.5 : 0.25, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + (low ? 0.35 : 0.12));
    o.connect(g).connect(this.music);
    o.start(t);
    o.stop(t + 0.4);
    if (!low) this.noiseHit(0.05, 4000, 1, 0.12, this.music, when);
  }

  /** Short success stinger: dhol groove + tumbi riff. */
  success(big = false): void {
    if (!this.ready) return;
    const beat = 0.14;
    const pattern = big ? [1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 1, 0] : [1, 0, 1, 0, 0, 1];
    pattern.forEach((p, i) => this.dhol(i * beat, p === 1));
    const riff = big ? [880, 988, 1175, 988, 880, 1175, 1319] : [880, 1175, 1319];
    riff.forEach((f, i) => this.pluck(f, 0.05 + i * beat, 0.35));
  }

  fail(): void {
    if (!this.ready) return;
    [660, 587, 494].forEach((f, i) => this.pluck(f, i * 0.18, 0.3));
  }

  /** Randomly scheduled ambience one-shots near the listener. */
  update(time: number): void {
    if (!this.ready) return;
    if (time > this.nextBird && this.treePositions.length) {
      this.nextBird = time + 1.5 + Math.random() * 4;
      const tp = this.treePositions[Math.floor(Math.random() * this.treePositions.length)]!;
      const d = this.at(this.worldToAudio(tp.add(new Vector3(0, 5, 0))), this.amb, 4);
      const base = 2500 + Math.random() * 1500;
      const n = 2 + Math.floor(Math.random() * 4);
      for (let i = 0; i < n; i++) this.tone(base * (1 + Math.random() * 0.2), 0.08, "sine", 0.05, d, i * 0.11, base * 1.4);
    }
    if (time > this.nextChatter) {
      this.nextChatter = time + 0.6 + Math.random() * 1.6;
      // Indistinct voice-like blips placed around the listener.
      const a = Math.random() * Math.PI * 2;
      const p = this.listenerPos.add(new Vector3(Math.cos(a) * 8, 0, Math.sin(a) * 8));
      const d = this.at(this.worldToAudio(p), this.amb, 5);
      const f0 = 140 + Math.random() * 120;
      const syll = 2 + Math.floor(Math.random() * 4);
      for (let i = 0; i < syll; i++) this.tone(f0 * (0.9 + Math.random() * 0.3), 0.09, "triangle", 0.015, d, i * 0.12);
    }
    if (time > this.nextClank) {
      this.nextClank = time + 2 + Math.random() * 5;
      const d = this.at(this.worldToAudio(this.workshopPos), this.amb, 3);
      const f = 700 + Math.random() * 900;
      for (const r of [1, 2.76, 5.4]) this.tone(f * r, 0.4 / r, "sine", 0.06 / r, d);
    }
    if (time > this.nextCall) {
      this.nextCall = time + 9 + Math.random() * 12;
      // Distant hawker's two-note call.
      const a = Math.random() * Math.PI * 2;
      const p = this.listenerPos.add(new Vector3(Math.cos(a) * 25, 2, Math.sin(a) * 25));
      const d = this.at(this.worldToAudio(p), this.amb, 8);
      this.tone(330, 0.5, "triangle", 0.04, d, 0, 300);
      this.tone(392, 0.7, "triangle", 0.04, d, 0.5, 350);
    }
  }
}
