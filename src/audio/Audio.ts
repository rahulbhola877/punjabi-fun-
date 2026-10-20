import { Vector3 } from "../babylon";

/**
 * Game audio: recorded clips (engines, horns, animals, voices — see
 * docs/ASSETS.md) layered with WebAudio synthesis for footsteps, impacts,
 * bazaar ambience, birds, workshop clanks and tumbi/dhol stingers. Engines
 * and horns fall back to synthesis until their clips have loaded.
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
    // Equal-power, not HRTF: HRTF per engine overloaded phone audio threads (crackle).
    this.panner.panningModel = "equalpower";
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

  private sample: AudioBufferSourceNode | null = null;
  private sampleRate = 1;

  /** Switch from the synthesised engine to a recorded idle loop, pitched by rpm. */
  useSample(buf: AudioBuffer, baseRate: number): void {
    if (this.sample) return;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    // The clips are pre-crossfaded seamless WAV loops (MP3 padding would click).
    src.loop = true;
    src.playbackRate.value = baseRate;
    const g = this.ctx.createGain();
    // Recorded loops are hotter than the synth they replace; keep plenty of
    // headroom so a street full of engines still sums without clipping.
    g.gain.value = 1.15;
    src.connect(g).connect(this.out);
    src.start(0, Math.random() * buf.duration);
    this.am.gain.setTargetAtTime(0, this.ctx.currentTime, 0.1);
    this.sample = src;
    this.sampleRate = baseRate;
  }

  /**
   * 0 silences this engine entirely. The game only lets the nearest handful of
   * vehicles sound; without that a traffic jam sums into a wall of distortion.
   */
  budget = 1;

  /** rpm01: 0 idle → 1 redline; load: throttle; on: engine running. */
  set(rpm01: number, load: number, on: boolean, pos: Vector3): void {
    const t = this.ctx.currentTime;
    on = on && this.budget > 0;
    if (this.sample) this.sample.playbackRate.setTargetAtTime(this.sampleRate * (0.85 + rpm01 * 0.7 + load * 0.05), t, 0.08);
    const f = this.p.idle + (this.p.top - this.p.idle) * rpm01;
    this.osc.frequency.setTargetAtTime(f * 2, t, 0.05);
    this.sub.frequency.setTargetAtTime(f, t, 0.05);
    this.lfo.frequency.setTargetAtTime(f, t, 0.05);
    this.filter.frequency.setTargetAtTime(this.p.tone * (0.35 + rpm01 * 0.8 + load * 0.3), t, 0.08);
    this.out.gain.setTargetAtTime(on ? (0.12 + load * 0.09 + rpm01 * 0.06) * this.budget : 0, t, on ? 0.08 : 0.3);
    this.panner.positionX.setTargetAtTime(pos.x, t, 0.02);
    this.panner.positionY.setTargetAtTime(pos.y, t, 0.02);
    this.panner.positionZ.setTargetAtTime(-pos.z, t, 0.02);
  }

  dispose(): void {
    for (const n of [this.osc, this.sub, this.noise, this.lfo, ...(this.sample ? [this.sample] : [])]) {
      try { n.stop(); } catch { /* already stopped */ }
      n.disconnect();
    }
    this.out.disconnect();
    this.panner.disconnect();
  }
}

/** How busy the mix may get; follows the graphics quality preset. */
export type AudioDetail = "low" | "high" | "ultra";

/** Soft-clip curve (tanh): the last line of defence against a clipped, "fat" mix. */
function limiterCurve(): Float32Array<ArrayBuffer> {
  const n = 2048;
  const c = new Float32Array(new ArrayBuffer(n * 4));
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    c[i] = Math.tanh(x * 1.35) / Math.tanh(1.35);
  }
  return c;
}

export class AudioSystem {
  ctx: AudioContext | null = null;
  private master!: GainNode;
  private sfx!: GainNode;
  private amb!: GainNode;
  private music!: GainNode;
  private buffers: Record<string, AudioBuffer> = {};
  private started = false;
  /** Suspended because the tab/app went to the background (not the pause menu). */
  private hiddenPause = false;
  private manualPause = false;
  detail: AudioDetail = "high";
  /** One-shots playing right now; new ones past the cap are dropped. */
  private playing = 0;
  private get maxOneShots(): number {
    return this.detail === "low" ? 10 : this.detail === "ultra" ? 22 : 16;
  }
  /** Beyond this many metres a one-shot is not worth a voice. */
  private get earshot(): number {
    return this.detail === "low" ? 55 : 80;
  }
  volumes: Volumes = { master: 0.8, sfx: 0.9, ambience: 0.7, music: 0.7, muted: false };
  private nextBird = 0;
  private nextClank = 0;
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
      // A larger output buffer: fewer underruns (crackles) on busy phones.
      this.ctx = new Ctor({ latencyHint: "playback" });
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
    // Bus → glue compressor → soft limiter → out. The compressor rides the
    // level of a busy street; the limiter catches the transients it misses, so
    // a dozen horns at once get loud rather than crunchy.
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -20;
    comp.knee.value = 14;
    comp.ratio.value = 6;
    comp.attack.value = 0.004;
    comp.release.value = 0.22;
    const limiter = ctx.createWaveShaper();
    limiter.curve = limiterCurve();
    limiter.oversample = "none";
    const out = ctx.createGain();
    out.gain.value = 0.9;
    this.master.connect(comp).connect(limiter).connect(out).connect(ctx.destination);
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
    this.manualPause = p;
    if (!this.ctx) return;
    if (p) void this.ctx.suspend();
    else if (!this.hiddenPause) void this.ctx.resume();
  }

  /**
   * Stop the game being heard from a backgrounded tab or a locked phone.
   * Some mobile browsers keep a WebAudio context running when the page is
   * hidden, so hiding the page must suspend it explicitly — and `pagehide`
   * covers the iOS back-forward cache, where `visibilitychange` can be missed.
   */
  installLifecycle(): void {
    const hide = () => {
      this.hiddenPause = true;
      if (this.ctx && this.ctx.state === "running") void this.ctx.suspend();
    };
    const show = () => {
      this.hiddenPause = false;
      if (this.ctx && !this.manualPause && this.ctx.state === "suspended") void this.ctx.resume();
    };
    document.addEventListener("visibilitychange", () => (document.hidden ? hide() : show()));
    window.addEventListener("pagehide", hide);
    window.addEventListener("freeze", hide);
    window.addEventListener("pageshow", show);
    window.addEventListener("blur", () => { if (document.hidden) hide(); });
  }

  /** Is a sound at this world point worth a voice right now? */
  private audible(pos: Vector3 | null, max = this.earshot): boolean {
    if (this.playing >= this.maxOneShots) return false;
    if (!pos) return true;
    return Vector3.DistanceSquared(pos, this.listenerPos) < max * max;
  }

  /** Count a one-shot source against the budget until it ends. */
  private track(src: AudioScheduledSourceNode, seconds: number): void {
    this.playing++;
    let done = false;
    const end = () => { if (!done) { done = true; this.playing--; } };
    src.addEventListener("ended", end);
    // Belt and braces: some sources' "ended" never fires if the context is
    // suspended mid-sound, which would leak the budget away to nothing.
    setTimeout(end, (seconds + 0.5) * 1000);
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
    // One layer on low-end phones, three when there is room for them.
    for (let i = 0; i < (this.detail === "low" ? 1 : 3); i++) {
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

  createEngine(p: { idle: number; top: number; pulse: number; tone: number }, sample?: { clip: string; rate: number }): EngineVoice | null {
    if (!this.ctx) return null;
    const v = new EngineVoice(this.ctx, this.sfx, this.buffers.white!, p);
    if (sample) void this.loadVoice(sample.clip, "sfx").then((b) => { if (b) v.useSample(b, sample.rate); });
    return v;
  }

  /** A vehicle's horn: a recorded clip per kind of vehicle (synth until it has loaded). */
  vehicleHorn(base: string, hz: [number, number], pos: Vector3, gain = 0.9): void {
    if (!this.ready || !this.audible(pos)) return;
    // Two takes of each "horn_*" kind, so not every car beeps the same.
    const clip = base.startsWith("horn_") ? `${base}_${1 + Math.floor(Math.random() * 2)}` : base;
    const key = `sfx/${clip}`;
    if (!this.loaded.has(key)) {
      void this.loadVoice(clip, "sfx").then((b) => { if (b) this.loaded.add(key); });
      this.horn(hz, pos);
      return;
    }
    // Each driver's horn sounds a little different.
    this.clip(clip, pos, this.sfx, 7, gain, 0.92 + Math.random() * 0.16);
  }
  private loaded = new Set<string>();

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
    this.track(o, when + dur);
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
    this.track(s, when + dur);
  }

  horn(hz: [number, number], pos: Vector3): void {
    if (!this.ready || !this.audible(pos)) return;
    const d = this.at(this.worldToAudio(pos), this.sfx, 6);
    this.tone(hz[0], 0.45, "square", 0.12, d);
    this.tone(hz[1], 0.45, "square", 0.1, d);
  }

  /** Fight sounds: dull punch, sharp slap, air whoosh, body hitting the ground. */
  hit(kind: "punch" | "slap" | "whoosh" | "thud", pos: Vector3, strength: number): void {
    if (!this.ready || !this.audible(pos, 45)) return;
    const s = Math.min(1, strength);
    const d = this.at(this.worldToAudio(pos), this.sfx, 4);
    switch (kind) {
      case "punch": this.tone(120, 0.12, "sine", 0.35 * s, d, 0, 60); this.noiseHit(0.08, 700, 1.2, 0.3 * s, d); break;
      case "slap": this.noiseHit(0.06, 3200, 0.7, 0.5 * s, d, 0, "highpass"); this.noiseHit(0.1, 1600, 1, 0.25 * s, d, 0.01); break;
      case "whoosh": this.noiseHit(0.18, 900, 0.6, 0.08 * s, d); break;
      case "thud": this.tone(70, 0.3, "sine", 0.4 * s, d, 0, 35); this.noiseHit(0.25, 400, 0.8, 0.3 * s, d); break;
    }
  }

  /** Two-tone police siren (called every frame while it should sound). */
  private sirenT = 0;
  siren(pos: Vector3, time: number): void {
    if (!this.ready || time < this.sirenT || !this.audible(pos, 120)) return;
    this.sirenT = time + 0.5;
    const d = this.at(this.worldToAudio(pos), this.sfx, 10);
    const hi = Math.floor(time * 2) % 2 === 0;
    this.tone(hi ? 960 : 720, 0.48, "sawtooth", 0.05, d, 0, hi ? 920 : 760);
  }

  /** Brass cycle bell (purchasable scooter horn). */
  bell(pos: Vector3): void {
    if (!this.ready || !this.audible(pos)) return;
    const d = this.at(this.worldToAudio(pos), this.sfx, 6);
    for (const t of [0, 0.16]) for (const [f, g] of [[2350, 0.09], [4120, 0.05], [5900, 0.025]] as const) this.tone(f, 0.55, "sine", g, d, t);
  }

  /** Recorded voice clips in public/audio/voice (see docs/ASSETS.md). Decoded lazily, cached. */
  private voices = new Map<string, Promise<AudioBuffer | null>>();
  private voiceSrc: AudioBufferSourceNode | null = null;
  lastVoice = "";

  private nextCooker = 25;

  private loadVoice(name: string, dir = "voice"): Promise<AudioBuffer | null> {
    let p = this.voices.get(`${dir}/${name}`);
    if (!p) {
      const ctx = this.ctx!;
      // Engine loops ("eng_*") are WAV for gapless looping; everything else is MP3.
      p = fetch(`${import.meta.env.BASE_URL}audio/${dir}/${name}.${name.startsWith("eng_") ? "wav" : "mp3"}`)
        .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(String(r.status)))))
        .then((b) => ctx.decodeAudioData(b))
        .catch(() => null);
      this.voices.set(`${dir}/${name}`, p);
    }
    return p;
  }

  preloadVoices(names: string[]): void {
    if (this.ctx) for (const n of names) void this.loadVoice(n);
  }

  preloadSfx(names: string[]): void {
    if (this.ctx) for (const n of names) void this.loadVoice(n, "sfx").then((b) => { if (b) this.loaded.add(`sfx/${n}`); });
  }

  /** Speak a clip from a world position; a new line cuts off the previous one. */
  voice(name: string, pos: Vector3 | null): void {
    if (!this.ready || (pos && Vector3.DistanceSquared(pos, this.listenerPos) > 60 * 60)) return;
    this.lastVoice = name;
    void this.loadVoice(name).then((buf) => {
      if (!buf || !this.ctx || this.lastVoice !== name) return;
      try { this.voiceSrc?.stop(); } catch { /* already ended */ }
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      const g = this.ctx.createGain();
      g.gain.value = 1.1;
      src.connect(g).connect(this.at(pos ? this.worldToAudio(pos) : null, this.sfx, 5));
      src.start();
      this.track(src, buf.duration);
      this.voiceSrc = src;
      src.onended = () => { if (this.voiceSrc === src) this.voiceSrc = null; };
    });
  }

  /**
   * A recorded street call. Unlike `voice`, this does not cut off (or get cut
   * off by) a character's dialogue line — a sabzi-wala should never talk over
   * Bhola. Missing files fall back to silence; the caller uses `cry` instead.
   */
  callClip(name: string, pos: Vector3, gain = 0.85): void {
    if (!this.ready || !this.audible(pos, 40)) return;
    void this.loadVoice(name).then((buf) => {
      if (!buf || !this.ctx) return;
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      // A touch of pitch variation so repeats of one take are less obvious.
      src.playbackRate.value = 0.95 + Math.random() * 0.1;
      const g = this.ctx.createGain();
      g.gain.value = gain;
      src.connect(g).connect(this.at(this.worldToAudio(pos), this.amb, 7));
      src.start();
      this.track(src, buf.duration);
    });
  }

  /** Has a recorded take for this name been found? (false until it loads) */
  hasClip(name: string): boolean {
    return this.clipOk.get(`voice/${name}`) === true;
  }
  private clipOk = new Map<string, boolean>();

  /** Probe for optional recordings so callers can fall back to the synth. */
  probeClips(names: string[]): void {
    if (!this.ctx) return;
    for (const n of names) void this.loadVoice(n).then((b) => this.clipOk.set(`voice/${n}`, !!b));
  }

  /** One-shot recorded effect from public/audio/sfx. */
  private clip(name: string, pos: Vector3, bus: GainNode, ref: number, gain: number, rate = 1): void {
    void this.loadVoice(name, "sfx").then((buf) => {
      if (!buf || !this.ctx) return;
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      src.playbackRate.value = rate;
      const g = this.ctx.createGain();
      g.gain.value = gain;
      src.connect(g).connect(this.at(this.worldToAudio(pos), bus, ref));
      src.start();
      this.track(src, buf.duration / rate);
    });
  }

  /** Public one-shot of a recorded effect at a world position. */
  clipAt(name: string, pos: Vector3, gain = 0.8): void {
    if (!this.ready || !this.audible(pos)) return;
    this.clip(name, pos, this.sfx, 6, gain);
  }

  footstep(pos: Vector3, strength: number, surface: "stone" | "tile" | "dirt"): void {
    if (!this.ready || !this.audible(pos, 18)) return;
    const d = this.at(this.worldToAudio(pos), this.sfx, 2);
    const f = surface === "tile" ? 2400 : surface === "dirt" ? 600 : 1300;
    this.noiseHit(0.07, f, 1.2, 0.12 * strength, d);
    this.tone(90, 0.06, "sine", 0.1 * strength, d);
  }

  impact(pos: Vector3, strength: number): void {
    if (!this.ready || !this.audible(pos, 60)) return;
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
    if (time > this.nextClank) {
      this.nextClank = time + 2 + Math.random() * 5;
      const d = this.at(this.worldToAudio(this.workshopPos), this.amb, 3);
      const f = 700 + Math.random() * 900;
      for (const r of [1, 2.76, 5.4]) this.tone(f * r, 0.4 / r, "sine", 0.06 / r, d);
    }
    if (time > this.nextCooker) {
      this.nextCooker = time + 45 + Math.random() * 45;
      this.clip("pressure_cooker", this.dhabaPos, this.amb, 4, 0.7);
    }
  }

  /**
   * A street-seller's call: "Aaloo le lo!", "Doodh!", an auto-wala barking his
   * route. Synthesised as a few voiced syllables on a formant filter — enough
   * to read as a human shout at 20 m without a recording per line.
   */
  cry(kind: "sabzi" | "fruit" | "doodh" | "chaat" | "auto" | "bus" | "kabadi", pos: Vector3, syllables: number): void {
    if (!this.ready || !this.audible(pos, 42)) return;
    const d = this.at(this.worldToAudio(pos), this.amb, 7);
    // Pitch and shape per trade: the auto- and bus-walas bark short and flat,
    // the sabzi-wala sings his line out.
    const base = kind === "doodh" ? 150 : kind === "auto" || kind === "bus" ? 175 : kind === "kabadi" ? 135 : 200;
    const sung = kind === "sabzi" || kind === "fruit" || kind === "kabadi";
    const n = Math.max(2, Math.min(6, syllables));
    const gain = kind === "auto" || kind === "bus" ? 0.055 : 0.042;
    for (let i = 0; i < n; i++) {
      const t = i * (sung ? 0.26 : 0.19);
      const last = i === n - 1;
      const f = base * (sung && last ? 1.3 : 0.94 + (i % 2) * 0.16);
      const dur = last && sung ? 0.5 : 0.14;
      this.tone(f, dur, "sawtooth", gain, d, t, last && sung ? f * 0.7 : undefined);
      // Formant blip gives the vowel its colour.
      this.noiseHit(dur * 0.6, 900 + (i % 3) * 520, 7, gain * 0.5, d, t);
    }
  }
}
