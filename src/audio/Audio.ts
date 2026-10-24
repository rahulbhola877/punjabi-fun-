import { Vector3 } from "../babylon";
import { zoneAt, type ZoneLife } from "../world/zones";
import { Radio, type StationId } from "./Radio";

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
  readonly out: GainNode;
  readonly panner: PannerNode;
  /** The running sources: built only while the engine can be heard. */
  private live: { stop: () => void; set: (f: number, rpm01: number, load: number, t: number) => void } | null = null;
  private buf: AudioBuffer | null = null;
  private sampleRate = 1;
  private quietT = 0;
  get running(): boolean { return !!this.live; }

  constructor(private ctx: AudioContext, private dest: AudioNode, private noiseBuf: AudioBuffer, private p: { idle: number; top: number; pulse: number; tone: number }) {
    this.panner = ctx.createPanner();
    // Equal-power, not HRTF: HRTF per engine overloaded phone audio threads (crackle).
    this.panner.panningModel = "equalpower";
    this.panner.distanceModel = "inverse";
    this.panner.refDistance = 3;
    this.panner.rolloffFactor = 1.2;
    this.out = ctx.createGain();
    this.out.gain.value = 0;
    this.out.connect(this.panner);
  }

  /** Use a recorded idle loop (pitched by rpm) instead of the synthesised engine. */
  useSample(buf: AudioBuffer, baseRate: number): void {
    if (this.buf) return;
    this.buf = buf;
    this.sampleRate = baseRate;
    // Rebuild on the recording if it is already sounding on the synth.
    if (this.live) { this.live.stop(); this.live = null; }
  }

  /**
   * Start the sources. Every source keeps the audio thread busy even at zero
   * gain, and a street can hold thirty vehicles: running them all is what
   * made busy chowks crackle and drop out. So an engine nobody can hear has
   * no sources at all, and gets them back when it comes within earshot.
   */
  private wake(): void {
    const ctx = this.ctx, p = this.p;
    if (this.buf) {
      const src = ctx.createBufferSource();
      src.buffer = this.buf;
      // The clips are pre-crossfaded seamless WAV loops (MP3 padding would click).
      src.loop = true;
      src.playbackRate.value = this.sampleRate;
      const g = ctx.createGain();
      g.gain.value = 1.15;
      src.connect(g).connect(this.out);
      src.start(0, Math.random() * this.buf.duration);
      this.live = {
        stop: () => { try { src.stop(); } catch { /* ended */ } src.disconnect(); g.disconnect(); },
        set: (_f, rpm01, load, t) => src.playbackRate.setTargetAtTime(this.sampleRate * (0.85 + rpm01 * 0.7 + load * 0.05), t, 0.08),
      };
      return;
    }
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.Q.value = 2.5;
    filter.frequency.value = p.tone * 0.5;
    const am = ctx.createGain();
    am.gain.value = 0.5;
    // Firing pulses: an LFO at the firing rate modulates amplitude.
    const lfo = ctx.createOscillator();
    lfo.type = "square";
    lfo.frequency.value = p.idle;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = p.pulse * 0.5;
    lfo.connect(lfoGain).connect(am.gain);
    const osc = ctx.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.value = p.idle * 2;
    const sub = ctx.createOscillator();
    sub.type = "square";
    sub.frequency.value = p.idle;
    const subG = ctx.createGain();
    subG.gain.value = 0.35;
    const noise = ctx.createBufferSource();
    noise.buffer = this.noiseBuf;
    noise.loop = true;
    const nG = ctx.createGain();
    nG.gain.value = 0.25;
    osc.connect(am);
    sub.connect(subG).connect(am);
    noise.connect(nG).connect(am);
    am.connect(filter).connect(this.out);
    for (const n of [osc, sub, noise, lfo]) n.start();
    this.live = {
      stop: () => { for (const n of [osc, sub, noise, lfo]) { try { n.stop(); } catch { /* ended */ } n.disconnect(); } for (const n of [am, filter, subG, nG, lfoGain]) n.disconnect(); },
      set: (f, rpm01, load, t) => {
        osc.frequency.setTargetAtTime(f * 2, t, 0.05);
        sub.frequency.setTargetAtTime(f, t, 0.05);
        lfo.frequency.setTargetAtTime(f, t, 0.05);
        filter.frequency.setTargetAtTime(p.tone * (0.35 + rpm01 * 0.8 + load * 0.3), t, 0.08);
      },
    };
  }

  /**
   * 0 silences this engine entirely. The game only lets the nearest handful of
   * vehicles sound; without that a traffic jam sums into a wall of distortion.
   */
  budget = 1;

  /** rpm01: 0 idle → 1 redline; load: throttle; on: engine running. */
  set(rpm01: number, load: number, on: boolean, pos: Vector3, dt = 1 / 60): void {
    const t = this.ctx.currentTime;
    on = on && this.budget > 0;
    if (on) {
      this.quietT = 0;
      if (!this.live) { this.wake(); this.panner.connect(this.dest); }
    } else if (this.live) {
      // Let the fade finish, then stop the sources for real.
      this.quietT += dt;
      if (this.quietT > 1.2) { this.live.stop(); this.live = null; this.panner.disconnect(); }
    }
    if (this.live) this.live.set(this.p.idle + (this.p.top - this.p.idle) * rpm01, rpm01, load, t);
    this.out.gain.setTargetAtTime(on ? (0.12 + load * 0.09 + rpm01 * 0.06) * this.budget : 0, t, on ? 0.08 : 0.3);
    this.panner.positionX.setTargetAtTime(pos.x, t, 0.02);
    this.panner.positionY.setTargetAtTime(pos.y, t, 0.02);
    this.panner.positionZ.setTargetAtTime(-pos.z, t, 0.02);
  }

  dispose(): void {
    this.live?.stop();
    this.live = null;
    this.out.disconnect();
    this.panner.disconnect();
  }
}

/** How busy the mix may get; follows the graphics quality preset. */
export type AudioDetail = "low" | "high" | "ultra";

type BedKind = ZoneLife["bed"];

/**
 * The ambience bed per zone: how loud the distant wash is, how bright it is
 * (a market roars close and mid-rangey; a highway is lorry rumble with the
 * top rolled off), and how much crowd murmur sits on top. These are the
 * floor of a place's sound — the horns, calls and quarrels layer over them.
 * Kept low, the way open-world games mix it: you should notice the bed only
 * when it stops. The cutoffs stay above ~500 Hz: below that, laptop and
 * phone speakers play almost nothing, and the game sounded silent. Dialogue sits well above it, and the life of a place comes
 * from the occasional spot sound (a bird, a horn, a call), not constant hiss.
 */
const BEDS: Record<BedKind, { wash: number; cut: number; murmur: number }> = {
  market: { wash: 0.2, cut: 1100, murmur: 1.0 },
  street: { wash: 0.16, cut: 800, murmur: 0.5 },
  quiet: { wash: 0.14, cut: 650, murmur: 0.2 },
  highway: { wash: 0.13, cut: 520, murmur: 0.04 },
  rural: { wash: 0.06, cut: 480, murmur: 0 },
};

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
  /** Recent voice lines and one-shot counts (for the debug probe). */
  readonly heard: string[] = [];
  get oneShots(): number { return this.playing; }
  private get maxOneShots(): number {
    return this.detail === "low" ? 8 : this.detail === "ultra" ? 16 : 12;
  }
  /** Beyond this many metres a one-shot is not worth a voice. */
  private get earshot(): number {
    return this.detail === "low" ? 55 : 80;
  }
  volumes: Volumes = { master: 0.8, sfx: 0.9, ambience: 0.5, music: 0.7, muted: false };
  /** Horns actually sounded, for measuring how tiring a place is. */
  hornCount = 0;
  private nextBird = 0;
  private nextClank = 0;
  /** The ambience bed, driven by the zone the listener is standing in. */
  private bed: BedKind = "street";
  private washGain: GainNode | null = null;
  private washLp: BiquadFilterNode | null = null;
  private murmurGain: GainNode | null = null;
  private listenerPos = new Vector3();
  /** World points for positional ambience. */
  workshopPos = new Vector3(14, 1, 24);
  dhabaPos = new Vector3(-14, 1, -34);
  treePositions: Vector3[] = [];

  // ---- radios (audio/Radio.ts)
  private carRadio: Radio | null = null;
  private shopRadios = new Map<string, { radio: Radio; panner: AudioNode; pos: Vector3 }>();

  /** The station the car radio is on; null while it is off. */
  get carStation(): StationId | null { return this.carRadio?.station ?? null; }

  /** Tune the radio in the cab you are driving (null = off). */
  tuneCar(id: StationId | null): void {
    if (!this.ready) return;
    if (id && !this.carRadio) this.carRadio = new Radio(this.ctx!, this.music, this.buffers.white!, 0.9);
    this.carRadio?.tune(id);
    if (id) this.heard.push(`radio:${id}`);
  }

  /**
   * The radios on shop counters: a station each, heard from the counter. Only the two
   * nearest within earshot play (and not while the listener is far off).
   */
  setShopRadios(list: Array<{ id: string; station: StationId; pos: Vector3 }>): void {
    if (!this.ready) return;
    const near = list
      .map((s) => ({ s, d: Vector3.Distance(s.pos, this.listenerPos) }))
      .filter((x) => x.d < (this.shopRadios.has(x.s.id) ? 36 : 28))
      .sort((a, b) => a.d - b.d)
      .slice(0, 2);
    const keep = new Set(near.map((x) => x.s.id));
    for (const [id, r] of this.shopRadios) {
      if (keep.has(id)) continue;
      r.radio.stop();
      r.panner.disconnect();
      this.shopRadios.delete(id);
    }
    for (const { s } of near) {
      if (this.shopRadios.has(s.id)) continue;
      const panner = this.at(this.worldToAudio(s.pos), this.music, 4);
      const radio = new Radio(this.ctx!, panner, this.buffers.white!, 0.5);
      radio.tune(s.station);
      this.shopRadios.set(s.id, { radio, panner, pos: s.pos.clone() });
      this.heard.push(`radio:${s.id}:${s.station}`);
    }
  }

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
    // Bus → headroom → one gentle limiter → out. Nothing else.
    //
    // This used to be headroom → a hard compressor (2 ms attack, 20:1 at
    // -16 dB) → a tanh "soft limiter" → ×1.25. Rendered offline, that chain
    // put 5.6% distortion on a single clean voice line and 7.5% on a busy
    // street — the "fata hua speaker" sound. The tanh curve bends every
    // sample, not just loud ones; the compressor's automatic make-up gain
    // pushed everything into it; and the ×1.25 after it could clip again.
    // A plain limiter that only acts on peaks measures 0% on a voice and
    // about 2% on a full street mix.
    const headroom = ctx.createGain();
    headroom.gain.value = 0.9;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -6;
    comp.knee.value = 3;
    comp.ratio.value = 12;
    comp.attack.value = 0.004;
    comp.release.value = 0.25;
    this.master.connect(headroom).connect(comp).connect(ctx.destination);
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

  /**
   * Rate-limit a kind of sound. Ten cars honking in a jam, or six people
   * trading blows, otherwise fire every frame and the sum is mush however
   * good the limiter is. Returns false when this kind has played too recently.
   */
  private throttle(kind: string, gap: number): boolean {
    const now = this.ctx!.currentTime;
    if (now - (this.lastOf.get(kind) ?? -99) < gap) return false;
    this.lastOf.set(kind, now);
    return true;
  }
  private lastOf = new Map<string, number>();

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
    // Distant wash. Its level and its cutoff both move with the zone: a
    // bazaar is a bright, close roar, a highway is low lorry rumble, a
    // field is almost nothing.
    const bed = ctx.createBufferSource();
    bed.buffer = this.buffers.brown!;
    bed.loop = true;
    this.washLp = ctx.createBiquadFilter();
    this.washLp.type = "lowpass";
    this.washLp.frequency.value = BEDS.street.cut;
    this.washGain = ctx.createGain();
    this.washGain.gain.value = BEDS.street.wash;
    // Gusts: two very slow, unrelated swells on the level and the brightness,
    // so the air breathes instead of hissing at one steady level.
    const gust = ctx.createGain();
    gust.gain.value = 1;
    for (const [hz, depth, cut] of [[0.043, 0.28, 60], [0.11, 0.14, 35]] as const) {
      const o = ctx.createOscillator();
      o.frequency.value = hz;
      const og = ctx.createGain();
      og.gain.value = depth;
      o.connect(og).connect(gust.gain);
      const oc = ctx.createGain();
      oc.gain.value = cut;
      o.connect(oc).connect(this.washLp.frequency);
      o.start();
    }
    bed.connect(this.washLp).connect(this.washGain).connect(gust).connect(this.amb);
    bed.start();
    // Crowd murmur: band-passed pink noise with slow formant wobble, summed
    // into one gain so the whole crowd can fade out when you walk into a
    // residential gali. One layer on low-end phones, three when there is room.
    this.murmurGain = ctx.createGain();
    this.murmurGain.gain.value = BEDS.street.murmur;
    this.murmurGain.connect(this.amb);
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
      gg.gain.value = 0.032;
      const pan = ctx.createStereoPanner();
      pan.pan.value = -0.6 + i * 0.6;
      src.connect(bp).connect(gg).connect(pan).connect(this.murmurGain);
      src.start();
      lfo.start();
    }
  }

  /**
   * Crossfade the bed to the zone the listener is standing in. Called every
   * frame; the time constant does the smoothing, so walking out of Chaura
   * Bazaar into a gali takes a couple of seconds to go quiet rather than
   * cutting off at the rectangle's edge.
   */
  private setBed(kind: BedKind): void {
    if (!this.washGain || !this.murmurGain || !this.washLp) return;
    const b = BEDS[kind];
    const t = this.ctx!.currentTime;
    this.washGain.gain.setTargetAtTime(b.wash, t, 1.2);
    this.murmurGain.gain.setTargetAtTime(b.murmur, t, 1.6);
    this.washLp.frequency.setTargetAtTime(b.cut, t, 1.2);
    this.bed = kind;
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
    if (!this.ready || !this.audible(pos) || !this.throttle("horn", 0.7)) return;
    this.hornCount++;
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

  private rainGain: GainNode | null = null;
  private rainLow: GainNode | null = null;

  /**
   * Rain on everything (0..1): a bright hiss of drops plus a low roar of
   * water on roofs and roads. Built the first time it rains.
   */
  setRain(level: number): void {
    if (!this.ready) return;
    const ctx = this.ctx!;
    if (!this.rainGain) {
      if (level < 0.01) return;
      this.rainGain = ctx.createGain();
      this.rainGain.gain.value = 0;
      this.rainLow = ctx.createGain();
      this.rainLow.gain.value = 0;
      const hiss = ctx.createBufferSource();
      hiss.buffer = this.buffers.pink!;
      hiss.loop = true;
      const hp = ctx.createBiquadFilter();
      hp.type = "highpass";
      hp.frequency.value = 1100;
      const lp = ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = 7500;
      hiss.connect(hp).connect(lp).connect(this.rainGain).connect(this.amb);
      const roar = ctx.createBufferSource();
      roar.buffer = this.buffers.brown!;
      roar.loop = true;
      roar.playbackRate.value = 1.3;
      const lp2 = ctx.createBiquadFilter();
      lp2.type = "lowpass";
      lp2.frequency.value = 520;
      roar.connect(lp2).connect(this.rainLow).connect(this.amb);
      hiss.start();
      roar.start();
    }
    const t = ctx.currentTime;
    this.rainGain.gain.setTargetAtTime(0.32 * level, t, 0.5);
    this.rainLow!.gain.setTargetAtTime(0.5 * level, t, 0.5);
  }

  /** Thunder `delay` seconds after the flash: a long low roll, with a crack first when it is near. */
  thunder(delay: number, near: boolean): void {
    if (!this.ready) return;
    const ctx = this.ctx!;
    const t = ctx.currentTime + delay;
    const s = ctx.createBufferSource();
    s.buffer = this.buffers.brown!;
    s.loop = true;
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.setValueAtTime(near ? 900 : 380, t);
    lp.frequency.exponentialRampToValueAtTime(90, t + 4);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(near ? 1.4 : 0.8, t + (near ? 0.04 : 0.5));
    g.gain.setTargetAtTime(0.3, t + 0.8, 0.6);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 5.5);
    s.connect(lp).connect(g).connect(this.amb);
    s.start(t, Math.random() * 2);
    s.stop(t + 5.6);
    this.track(s, delay + 5.6);
    if (near) this.noiseHit(0.35, 2500, 0.6, 0.5, this.amb, delay, "highpass");
  }

  horn(hz: [number, number], pos: Vector3): void {
    if (!this.ready || !this.audible(pos) || !this.throttle("horn", 0.7)) return;
    this.hornCount++;
    const d = this.at(this.worldToAudio(pos), this.sfx, 6);
    this.tone(hz[0], 0.45, "square", 0.12, d);
    this.tone(hz[1], 0.45, "square", 0.1, d);
  }

  /** Fight sounds: dull punch, sharp slap, air whoosh, body hitting the ground. */
  hit(kind: "punch" | "slap" | "whoosh" | "thud", pos: Vector3, strength: number): void {
    if (!this.ready || !this.audible(pos, 45) || !this.throttle(`hit_${kind}`, 0.07)) return;
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

  /** A doorbell: the two-note chime of a Punjabi house, "ding-dong", from inside the gate. */
  doorbell(pos: Vector3): void {
    if (!this.ready) return;
    const d = this.at(this.worldToAudio(pos), this.sfx, 5);
    for (const [f, t] of [[880, 0], [659, 0.38]] as const) {
      this.tone(f, 0.9, "sine", 0.16, d, t);
      this.tone(f * 2.76, 0.4, "sine", 0.05, d, t);
      this.tone(f * 5.4, 0.25, "sine", 0.02, d, t);
    }
    this.heard.push("doorbell");
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
  /** Audio-clock time the last recorded voice line (dialogue or street call) ends. */
  private voiceEnd = 0;
  /** Is a recorded voice line playing (or about to)? Only one plays at a time. */
  voiceBusy(): boolean { return !!this.ctx && this.ctx.currentTime < this.voiceEnd; }
  private holdVoice(secs: number): void { if (this.ctx) this.voiceEnd = Math.max(this.voiceEnd, this.ctx.currentTime + secs + 0.35); }
  lastVoice = "";

  private nextCooker = 25;
  private nextLife = 3;

  /**
   * Someone talking without a recorded line: a soft babble of syllables at
   * their pitch (a man low, a woman higher, a child higher still), as long as
   * the line, so a speech bubble is never silent.
   */
  mumble(pos: Vector3, pitch: number, words: number): void {
    if (!this.ready || !this.audible(pos, 25) || !this.throttle("mumble", 0.25)) return;
    const d = this.at(this.worldToAudio(pos.add(new Vector3(0, 1.5, 0))), this.sfx, 4);
    const n = Math.max(3, Math.min(12, Math.round(words * 1.6)));
    let t = 0;
    for (let i = 0; i < n; i++) {
      const f = pitch * (0.88 + Math.random() * 0.3) * (i === n - 1 ? 0.85 : 1);
      const dur = 0.08 + Math.random() * 0.07;
      this.tone(f, dur, "sawtooth", 0.05, d, t, f * (0.9 + Math.random() * 0.15));
      this.noiseHit(dur * 0.7, 600 + Math.random() * 1800, 6, 0.03, d, t);
      t += dur + 0.04 + (Math.random() < 0.2 ? 0.12 : 0);
    }
  }
  /** Hour of the day (for meal-time cookers); set by the game. */
  hour = 12;
  private tvNext = 0;
  private tvBar = 0;

  /**
   * The TV at home, a bar at a time while it is on: a newsreader's babble with
   * a jingle, cricket commentary over the crowd, a Punjabi song (dhol and
   * tumbi), or kirtan with harmonium. Call every frame while it is on.
   */
  tv(channel: "news" | "cricket" | "songs" | "gurbani", pos: Vector3): void {
    if (!this.ready || Vector3.DistanceSquared(pos, this.listenerPos) > 22 * 22) return;
    const ctx = this.ctx!;
    const now = ctx.currentTime;
    if (now < this.tvNext - 0.15) return;
    const start = Math.max(now, this.tvNext);
    const bar = channel === "songs" ? 8 * 0.2 : 1.6;
    this.tvNext = start + bar;
    this.tvBar++;
    if (this.tvBar % 8 === 1) this.heard.push(`tv:${channel}`);
    const when = start - now;
    // A TV fills the room: little fall-off across a baithak.
    const d = this.at(this.worldToAudio(pos), this.sfx, 9);
    const babble = (n: number, base: number, gain: number) => {
      for (let i = 0; i < n; i++) {
        const t = when + i * (bar / n) + Math.random() * 0.04;
        const f = base * (0.9 + Math.random() * 0.25);
        this.tone(f, 0.11 + Math.random() * 0.08, "sawtooth", gain, d, t, f * (0.92 + Math.random() * 0.1));
        this.noiseHit(0.08, 700 + Math.random() * 1500, 6, gain * 0.6, d, t);
      }
    };
    if (channel === "news") {
      if (this.tvBar % 8 === 1) [784, 988, 1175].forEach((f, i) => this.tone(f, 0.25, "triangle", 0.09, d, when + i * 0.14));
      else babble(7, 140, 0.07);
    } else if (channel === "cricket") {
      // The crowd swells, the commentator talks fast over it.
      this.noiseHit(bar, 900, 0.7, 0.09 + (this.tvBar % 5 === 0 ? 0.12 : 0), d, when);
      babble(9, 160, 0.06);
    } else if (channel === "songs") {
      const pat = [2, 0, 1, 2, 1, 1, 2, 1];
      pat.forEach((p, k) => { if (p) this.drum(when + k * 0.2, p === 2, d, 1.4); });
      const tune = [523, 587, 659, 587, 523, 494, 523, 659];
      for (let k = 0; k < 4; k++) this.tone(tune[(this.tvBar * 4 + k) % tune.length]! * 2, 0.16, "triangle", 0.07, d, when + k * 0.4);
    } else {
      const raag = [277, 311, 349, 370, 415, 370, 349, 311];
      this.reed(raag[this.tvBar % raag.length]!, when, bar, 0.035, d);
      this.sing(raag[(this.tvBar + 2) % raag.length]!, when, bar * 0.95, d);
    }
  }

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
    this.heard.push(`v:${name}`);
    this.holdVoice(0.6);
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
      this.holdVoice(buf.duration);
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
    this.heard.push(`c:${name}`);
    this.holdVoice(0.6);
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
      this.holdVoice(buf.duration / src.playbackRate.value);
    });
  }

  /**
   * Pick from a list without repeating the previous pick for this key. One
   * recording per trade, chosen at random, means the same line over and over
   * within a minute — which is what players hear as "they keep saying it".
   */
  pickFresh(key: string, from: readonly string[]): string {
    if (from.length === 0) return "";
    if (from.length === 1) return from[0]!;
    const last = this.lastPick.get(key);
    const pool = from.filter((x) => x !== last);
    const chosen = pool[Math.floor(Math.random() * pool.length)] ?? from[0]!;
    this.lastPick.set(key, chosen);
    return chosen;
  }
  private lastPick = new Map<string, string>();

  /** Of these clip names, the ones that actually exist. */
  presentClips(names: readonly string[]): string[] {
    return names.filter((n) => this.hasClip(n));
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
    if (!this.ready || !this.audible(pos, 18) || !this.throttle("step", 0.1)) return;
    const d = this.at(this.worldToAudio(pos), this.sfx, 2);
    const f = surface === "tile" ? 2400 : surface === "dirt" ? 600 : 1300;
    this.noiseHit(0.07, f, 1.2, 0.12 * strength, d);
    this.tone(90, 0.06, "sine", 0.1 * strength, d);
  }

  impact(pos: Vector3, strength: number): void {
    if (!this.ready || !this.audible(pos, 60) || !this.throttle("impact", 0.12)) return;
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
    this.carRadio?.update();
    for (const s of this.shopRadios.values()) s.radio.update();
    const z = zoneAt(this.listenerPos.x, this.listenerPos.z);
    if (z.life.bed !== this.bed) this.setBed(z.life.bed);
    // Birdsong belongs to the quiet places. In Chaura Bazaar you would not
    // hear a sparrow over the crowd, so do not spend a voice on one.
    const birdy = z.kind === "farm" || z.kind === "village" || z.kind === "residential";
    if (time > this.nextBird && this.treePositions.length && (birdy || z.kind === "civic")) {
      this.nextBird = time + (birdy ? 3 : 10) + Math.random() * (birdy ? 6 : 14);
      const tp = this.treePositions[Math.floor(Math.random() * this.treePositions.length)]!;
      const d = this.at(this.worldToAudio(tp.add(new Vector3(0, 5, 0))), this.amb, 4);
      const base = 2500 + Math.random() * 1500;
      const n = 2 + Math.floor(Math.random() * 4);
      for (let i = 0; i < n; i++) this.tone(base * (1 + Math.random() * 0.2), 0.08, "sine", 0.05, d, i * 0.11, base * 1.4);
    }
    // A colony or a pind is never silent: a scooter's horn round the corner, a
    // dog, a pressure cooker at meal times, a sabzi-wala or kabadi-wala calling.
    if (time > this.nextLife && (z.kind === "residential" || z.kind === "village")) {
      this.nextLife = time + 4 + Math.random() * 7;
      const a = Math.random() * Math.PI * 2, r = 18 + Math.random() * 30;
      const p = this.listenerPos.add(new Vector3(Math.cos(a) * r, 1.2, Math.sin(a) * r));
      const h = this.hour, meal = (h >= 7 && h < 9.5) || (h >= 12.5 && h < 14.5) || (h >= 19.5 && h < 21.5);
      const roll = Math.random();
      if (meal && roll < 0.3) this.clip("pressure_cooker", p, this.amb, 8, 0.9);
      else if (roll < 0.55) this.clip(`horn_${Math.random() < 0.7 ? "scooter" : "auto"}_${1 + Math.floor(Math.random() * 2)}`, p, this.amb, 8, 0.8);
      else if (roll < 0.75) this.clip("dog_bark", p, this.amb, 8, 0.8);
      else if (h > 6 && h < 20) this.cry(Math.random() < 0.6 ? "sabzi" : "kabadi", p, 3 + Math.floor(Math.random() * 3));
    }
    // The hours of the day. Night is crickets and a far dog; the small hours have a goods train somewhere;
    // dawn is a rooster and a bell. None of it plays in the bazaar crowd, where it could not be heard.
    if (this.cutOn && this.gen) this.gen.gain.gain.setTargetAtTime(z.life.bed === "market" ? 0.1 : z.life.bed === "street" ? 0.05 : 0.018, this.ctx!.currentTime, 0.5);
    if (this.cutOn && time > this.nextBeep) {
      this.nextBeep = time + 14 + Math.random() * 16;
      const a = Math.random() * Math.PI * 2;
      const d = this.at(this.worldToAudio(this.listenerPos.add(new Vector3(Math.cos(a) * 14, 1.5, Math.sin(a) * 14))), this.amb, 3);
      for (let i = 0; i < 3; i++) this.tone(1760, 0.12, "square", 0.02, d, i * 0.3);
    }
    const h = this.hour, quiet = z.life.bed !== "market";
    const night = h >= 21.3 || h < 5, dawn = h >= 4.8 && h < 6.6;
    if (night && quiet && time > this.nextCricket) {
      this.nextCricket = time + 0.9 + Math.random() * 1.6;
      const a = Math.random() * Math.PI * 2, r = 5 + Math.random() * 20;
      const d = this.at(this.worldToAudio(this.listenerPos.add(new Vector3(Math.cos(a) * r, 0.3, Math.sin(a) * r))), this.amb, 3);
      const f = 4300 + Math.random() * 600;
      for (let i = 0; i < 3 + Math.floor(Math.random() * 3); i++) this.tone(f, 0.035, "sine", 0.028, d, i * 0.07);
    }
    if (night && quiet && time > this.nextFarDog) {
      this.nextFarDog = time + 14 + Math.random() * 26;
      const a = Math.random() * Math.PI * 2;
      this.clip("dog_bark", this.listenerPos.add(new Vector3(Math.cos(a) * 55, 1, Math.sin(a) * 55)), this.amb, 10, 0.5);
    }
    if ((night || h < 6) && time > this.nextTrain) {
      this.nextTrain = time + 80 + Math.random() * 120;
      this.farTrain();
    }
    if (dawn && time > this.nextCrow && (z.kind === "village" || z.kind === "farm" || z.kind === "residential")) {
      this.nextCrow = time + 9 + Math.random() * 16;
      const a = Math.random() * Math.PI * 2;
      this.rooster(this.listenerPos.add(new Vector3(Math.cos(a) * 30, 1.5, Math.sin(a) * 30)));
    }
    // The workshop hammer and the dhaba cooker are fixed places: only worth
    // a voice when you are near enough to pick them out of the bed.
    if (time > this.nextClank && this.audible(this.workshopPos, 70)) {
      this.nextClank = time + 4 + Math.random() * 7;
      const d = this.at(this.worldToAudio(this.workshopPos), this.amb, 3);
      const f = 700 + Math.random() * 900;
      for (const r of [1, 2.76, 5.4]) this.tone(f * r, 0.4 / r, "sine", 0.035 / r, d);
    }
    if (time > this.nextCooker && this.audible(this.dhabaPos, 60)) {
      this.nextCooker = time + 45 + Math.random() * 45;
      this.clip("pressure_cooker", this.dhabaPos, this.amb, 4, 0.7);
    }
  }

  private railBellT = 0;
  private railHornRun = -1;
  private railVoice: { panner: PannerNode; gain: GainNode; clack: GainNode; lfo: OscillatorNode; srcs: AudioBufferSourceNode[] } | null = null;

  /**
   * The level crossing and the goods train (world/RailWorld.ts): the gate bell while the gates are coming down or
   * down, and the train's rumble and wheel-clack from wherever its nearest wagon is, with its horn on the approach.
   */
  rail(ringing: boolean, train: { x: number; dir: 1 | -1; k: number } | null, length: number, z: number, crossX: number): void {
    if (!this.ready) return;
    const ctx = this.ctx!, now = ctx.currentTime;
    const cross = new Vector3(crossX, 1.6, z);
    if (ringing && now > this.railBellT && Vector3.DistanceSquared(cross, this.listenerPos) < 110 * 110) {
      this.railBellT = now + 0.5;
      const d = this.at(this.worldToAudio(cross), this.sfx, 6);
      this.tone(1568, 0.55, "sine", 0.1, d);
      this.tone(2349, 0.3, "sine", 0.035, d);
    }
    let near = Infinity, at = new Vector3();
    if (train) {
      const a = train.x, b = train.x - train.dir * length;
      const px = Math.max(Math.min(a, b), Math.min(Math.max(a, b), this.listenerPos.x));
      at = new Vector3(px, 1.8, z);
      near = Vector3.Distance(at, this.listenerPos);
      // The horn: once per run, as the nose comes within 450 m of the crossing.
      if (train.k !== this.railHornRun && Math.abs(train.x - crossX) < 450 && train.dir * (crossX - train.x) > 0) {
        this.railHornRun = train.k;
        const hp = this.at(this.worldToAudio(new Vector3(train.x, 3, z)), this.sfx, 25);
        const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 1600;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, now);
        g.gain.linearRampToValueAtTime(0.28, now + 0.25);
        g.gain.setValueAtTime(0.28, now + 1.5);
        g.gain.linearRampToValueAtTime(0.0001, now + 2.2);
        lp.connect(g).connect(hp);
        for (const f of [392, 494]) { const o = ctx.createOscillator(); o.type = "sawtooth"; o.frequency.value = f; o.connect(lp); o.start(now); o.stop(now + 2.3); }
        this.heard.push("train_horn");
      }
    }
    if (near < 300) {
      if (!this.railVoice) {
        const panner = this.at(this.worldToAudio(at), this.sfx, 25) as PannerNode;
        const gain = ctx.createGain(); gain.gain.value = 0;
        gain.connect(panner);
        const rum = ctx.createBufferSource(); rum.buffer = this.buffers.brown!; rum.loop = true;
        const rl = ctx.createBiquadFilter(); rl.type = "lowpass"; rl.frequency.value = 170;
        rum.connect(rl).connect(gain);
        const cl = ctx.createBufferSource(); cl.buffer = this.buffers.white!; cl.loop = true;
        const cb = ctx.createBiquadFilter(); cb.type = "bandpass"; cb.frequency.value = 2200; cb.Q.value = 1.2;
        const clack = ctx.createGain(); clack.gain.value = 0;
        const lfo = ctx.createOscillator(); lfo.type = "square"; lfo.frequency.value = 6.5;
        const depth = ctx.createGain(); depth.gain.value = 0.35;
        lfo.connect(depth).connect(clack.gain);
        cl.connect(cb).connect(clack).connect(gain);
        rum.start(); cl.start(); lfo.start();
        this.railVoice = { panner, gain, clack, lfo, srcs: [rum, cl] };
        this.heard.push("train_rumble");
      }
      const v = this.railVoice;
      v.panner.positionX.value = at.x; v.panner.positionY.value = at.y; v.panner.positionZ.value = -at.z;
      v.gain.gain.setTargetAtTime(0.75, now, 0.3);
    } else if (this.railVoice) {
      this.railVoice.gain.gain.setTargetAtTime(0, now, 0.4);
      if (near > 420) {
        const v = this.railVoice;
        setTimeout(() => { for (const s of v.srcs) try { s.stop(); } catch { /* done */ } try { v.lfo.stop(); } catch { /* done */ } v.panner.disconnect(); }, 1500);
        this.railVoice = null;
      }
    }
  }

  private nextCricket = 0;
  private cutOn = false;
  private nextBeep = 0;
  private gen: { src: AudioBufferSourceNode; osc: OscillatorNode; gain: GainNode } | null = null;

  /** Bijli gayi: a generator thumps (loudest in the bazaar) and an inverter beeps now and then. */
  setPowerCut(on: boolean): void {
    this.cutOn = on;
    if (!this.ready) return;
    const ctx = this.ctx!;
    if (on && !this.gen) {
      const src = ctx.createBufferSource();
      src.buffer = this.buffers.brown!; src.loop = true;
      const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 160;
      const osc = ctx.createOscillator(); osc.type = "sawtooth"; osc.frequency.value = 47;
      const og = ctx.createGain(); og.gain.value = 0.25;
      const lfo = ctx.createOscillator(); lfo.frequency.value = 11; const lg = ctx.createGain(); lg.gain.value = 0.12;
      const gain = ctx.createGain(); gain.gain.value = 0;
      lfo.connect(lg).connect(gain.gain);
      src.connect(lp).connect(gain);
      osc.connect(og).connect(lp);
      gain.connect(this.amb);
      src.start(); osc.start(); lfo.start();
      this.gen = { src, osc, gain };
      this.heard.push("power_cut");
    } else if (!on && this.gen) {
      const g = this.gen;
      g.gain.gain.setTargetAtTime(0, ctx.currentTime, 0.3);
      setTimeout(() => { try { g.src.stop(); g.osc.stop(); } catch { /* done */ } }, 1500);
      this.gen = null;
    }
  }

  private nextFarDog = 0;
  private nextTrain = 20;
  private nextCrow = 0;

  /** A goods train a couple of kilometres off: two notes of a diesel horn, softened by the distance. */
  private farTrain(): void {
    const ctx = this.ctx!, t = ctx.currentTime;
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass"; lp.frequency.value = 700;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.05, t + 0.4);
    g.gain.setValueAtTime(0.05, t + 1.5);
    g.gain.linearRampToValueAtTime(0.0001, t + 2.6);
    lp.connect(g).connect(this.amb);
    for (const f of [311, 392]) {
      const o = ctx.createOscillator();
      o.type = "sawtooth"; o.frequency.value = f;
      o.connect(lp); o.start(t); o.stop(t + 2.7);
    }
    this.heard.push("far_train");
  }

  /** Kukrookoo: four glides on a sawtooth, a long note and a fall. */
  private rooster(pos: Vector3): void {
    const d = this.at(this.worldToAudio(pos), this.amb, 6);
    const notes: Array<[number, number, number, number]> = [[620, 900, 0.18, 0], [900, 720, 0.14, 0.2], [720, 1050, 0.22, 0.36], [1050, 560, 0.55, 0.6]];
    for (const [a, b, dur, at] of notes) this.tone(a, dur, "sawtooth", 0.035, d, at, b);
    this.heard.push("rooster");
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

  // ------------------------------------------------------------ Processions

  private procNext = 0;
  private procBar = 0;
  private megaCurve: WaveShaperNode | null = null;

  /**
   * The sound of a procession going by, scheduled a bar ahead from wherever
   * it is now: a baraat's dhol in the bhangra chaal, a nagar kirtan's
   * harmonium, tabla and chimta, or a rally jeep's loudspeaker shouting a
   * slogan and the crowd shouting it back. Call every frame while it runs.
   */
  procession(kind: "kirtan" | "rally" | "baraat", pos: Vector3): void {
    if (!this.ready) return;
    const ctx = this.ctx!;
    const now = ctx.currentTime;
    if (now < this.procNext - 0.15) return;
    const start = Math.max(now, this.procNext);
    const bar = kind === "baraat" ? 8 * 0.19 : kind === "kirtan" ? 4 * 0.46 : 4.2;
    this.procNext = start + bar;
    this.procBar++;
    if (!this.audible(pos, 110)) return;
    const when = start - now;
    const d = this.at(this.worldToAudio(pos.add(new Vector3(0, 1.5, 0))), this.sfx, kind === "rally" ? 10 : 7);
    if (kind === "baraat") {
      // Bhangra chaal: DHA . na DHA na na DHA na
      const pat = [2, 0, 1, 2, 1, 1, 2, 1];
      pat.forEach((p, k) => { if (p) this.drum(when + k * 0.19, p === 2, d, 1); });
    } else if (kind === "kirtan") {
      const raag = [277, 311, 349, 370, 415, 370, 349, 311, 277, 349, 415, 466, 415, 370, 349, 311];
      for (let k = 0; k < 4; k++) {
        const f = raag[(this.procBar * 4 + k) % raag.length]!;
        this.reed(f, when + k * 0.46, 0.5, 0.022, d);
        // Tabla: dha on the one, dhin after; the chimta's jingle on the off-beats.
        this.drum(when + k * 0.46, k === 0 || k === 3, d, 0.45, 520);
        this.noiseHit(0.06, 7000, 2, 0.05, d, when + k * 0.46 + 0.23, "highpass");
      }
      this.reed(138.5, when, bar, 0.012, d);
    } else {
      this.megaphone(when, d);
    }
  }

  private drum(when: number, low: boolean, dest: AudioNode, gain: number, ring = 0): void {
    const ctx = this.ctx!;
    const t = ctx.currentTime + when;
    const o = ctx.createOscillator();
    o.type = "sine";
    o.frequency.setValueAtTime(low ? 100 : 300, t);
    o.frequency.exponentialRampToValueAtTime(low ? 52 : 190, t + 0.16);
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain * (low ? 0.6 : 0.3), t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + (low ? 0.38 : 0.12));
    o.connect(g).connect(dest);
    o.start(t);
    o.stop(t + 0.45);
    this.track(o, when + 0.45);
    if (!low) this.noiseHit(0.05, 3800, 1, 0.14 * gain, dest, when);
    // A tabla's dayan rings at its tuned pitch.
    if (ring) this.tone(ring, 0.28, "sine", 0.08 * gain, dest, when);
  }

  /** One harmonium note: two slightly detuned reeds through a soft filter. */
  private reed(freq: number, when: number, dur: number, gain: number, dest: AudioNode): void {
    const ctx = this.ctx!;
    const t = ctx.currentTime + when;
    const f = ctx.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.value = 1700;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.04);
    g.gain.setValueAtTime(gain, t + dur - 0.06);
    g.gain.linearRampToValueAtTime(0, t + dur);
    f.connect(g).connect(dest);
    for (const det of [1, 1.004]) {
      const o = ctx.createOscillator();
      o.type = "sawtooth";
      o.frequency.value = freq * det;
      o.connect(f);
      o.start(t);
      o.stop(t + dur + 0.02);
      this.track(o, when + dur);
    }
  }

  /** "Zin-da-baad!" through a blown loudspeaker, and the crowd shouting it back. */
  private megaphone(when: number, dest: AudioNode): void {
    const ctx = this.ctx!;
    if (!this.megaCurve) {
      const ws = ctx.createWaveShaper();
      const c = new Float32Array(256);
      for (let i = 0; i < 256; i++) { const x = i / 128 - 1; c[i] = Math.tanh(x * 4); }
      ws.curve = c;
      this.megaCurve = ws;
    }
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 1500;
    bp.Q.value = 0.9;
    const pre = ctx.createGain();
    pre.gain.value = 1;
    const ws = ctx.createWaveShaper();
    ws.curve = this.megaCurve.curve;
    pre.connect(ws).connect(bp).connect(dest);
    // Leader: three syllables, the last one long and falling.
    const syl = [[0, 0.16, 210], [0.2, 0.14, 230], [0.38, 0.55, 250]] as const;
    for (const [at, dur, f] of syl) {
      this.tone(f, dur, "sawtooth", 0.09, pre, when + at, f * (dur > 0.3 ? 0.75 : 0.95));
      this.noiseHit(dur * 0.7, 1100 + at * 900, 6, 0.04, pre, when + at);
    }
    // The crowd: many voices, a little ragged, louder on the last syllable.
    for (let v = 0; v < 6; v++) {
      const base = 140 + v * 17, lag = 1.5 + Math.random() * 0.08;
      for (const [at, dur] of [[0, 0.16], [0.2, 0.14], [0.38, 0.6]] as const) this.tone(base * (1 + Math.random() * 0.05), dur, "sawtooth", 0.012, dest, when + lag + at, base * 0.85);
    }
    this.noiseHit(0.9, 700, 0.8, 0.05, dest, when + 1.5);
  }

  // ------------------------------------------------------------ Gurbani and aarti

  private shrineClock = new Map<string, { next: number; bar: number }>();
  private speakerCurve: Float32Array<ArrayBuffer> | null = null;

  /**
   * Morning music from a gurdwara's or a mandir's loudspeaker: call every
   * frame while it should play.
   *
   * Gurbani: the recorded Japji Sahib when it has loaded; until then a
   * synthesised ragi's voice (a sung "aa" through vocal formants) in
   * raag Bhairav, the harmonium following and droning Sa-Pa, tabla in
   * keherwa. Aarti: the big ghanti on every beat, manjeera in between, a
   * harmonium tune in Bilawal over a dholak, and the shankh blown at the
   * start of each round. Both through a horn speaker's narrow band.
   */
  shrine(id: string, kind: "gurbani" | "aarti", pos: Vector3, level = 1): void {
    if (!this.ready) return;
    const ctx = this.ctx!;
    const now = ctx.currentTime;
    const c = this.shrineClock.get(id) ?? { next: 0, bar: 0 };
    this.shrineClock.set(id, c);
    if (now < c.next - 0.2) return;
    // The recorded Japji Sahib (Mool Mantar, 30 s, public/audio/sfx/gurbani_japji.mp3) once it has loaded,
    // repeated with a short pause; the synthesised kirtan below stands in until then.
    if (kind === "gurbani" && this.gurbaniBuf === undefined) {
      this.gurbaniBuf = null;
      void this.loadVoice("gurbani_japji", "sfx").then((b) => { this.gurbaniBuf = b; });
    }
    if (kind === "gurbani" && this.gurbaniBuf) {
      const buf = this.gurbaniBuf;
      const start = Math.max(now, c.next);
      c.next = start + buf.duration + 4;
      if (Vector3.DistanceSquared(pos, this.listenerPos) > 260 * 260) return;
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.connect(this.speakerChain(pos, level));
      src.start(start);
      this.track(src, start - now + buf.duration);
      return;
    }
    const beat = kind === "gurbani" ? 0.5 : 0.42;
    const start = Math.max(now, c.next);
    c.next = start + beat * 8;
    c.bar++;
    if (Vector3.DistanceSquared(pos, this.listenerPos) > 260 * 260) return;
    const when = start - now;
    const lvl = this.speakerChain(pos, level);
    const sa = kind === "gurbani" ? 277.2 : 261.6;
    // Scale degrees as ratios: Bhairav (komal re and dha) for the morning shabad, Bilawal (major) for aarti.
    const scale = kind === "gurbani" ? [1, 16 / 15, 5 / 4, 4 / 3, 3 / 2, 8 / 5, 15 / 8, 2] : [1, 9 / 8, 5 / 4, 4 / 3, 3 / 2, 5 / 3, 15 / 8, 2];
    const tunes = kind === "gurbani"
      ? [[0, 0, 1, 2, 3, 3, 2, 1], [2, 3, 4, 4, 5, 4, 3, 2], [4, 5, 7, 7, 6, 5, 4, 4], [3, 2, 1, 1, 2, 1, 0, 0]]
      : [[2, 2, 3, 4, 4, 4, 3, 2], [2, 3, 4, 5, 4, 3, 2, 2], [4, 5, 7, 7, 5, 4, 3, 2], [3, 2, 1, 2, 3, 2, 1, 0]];
    const tune = tunes[c.bar % tunes.length]!;
    for (let k = 0; k < 8; k++) {
      const f = sa * scale[tune[k]!]!;
      const t = when + k * beat;
      // Hold a note when the tune repeats it.
      const held = k > 0 && tune[k] === tune[k - 1];
      if (!held) {
        let n = 1;
        while (k + n < 8 && tune[k + n] === tune[k]) n++;
        this.reed(f, t, beat * n * 0.95, 0.03, lvl);
        if (kind === "gurbani") this.sing(f, t + 0.04, beat * n * 0.97, lvl);
      }
      if (kind === "gurbani") {
        // Keherwa: dha ge na ti | na ka dhi na
        const bol = [2, 1, 0, 0, 0, 1, 2, 0][k]!;
        this.drum(t, bol === 2, lvl, bol ? 0.5 : 0.25, 0);
        if (!bol) this.tone(sa * 2, 0.18, "sine", 0.05, lvl, t);
      } else {
        this.ghanti(t, lvl, k % 4 === 0 ? 1 : 0.6);
        this.noiseHit(0.08, 8000, 3, 0.05, lvl, t + beat / 2, "highpass");
        this.drum(t, k % 2 === 0, lvl, 0.4, 0);
      }
    }
    this.reed(sa / 2, when, beat * 8, 0.014, lvl);
    this.reed(sa * 0.75, when, beat * 8, 0.01, lvl);
    if (kind === "aarti" && c.bar % 4 === 1) this.shankh(when, lvl);
  }

  /** undefined: not asked for yet; null: loading (or missing). */
  private gurbaniBuf: AudioBuffer | null | undefined;

  /** A horn loudspeaker up on the building: band-limited and a little driven, then placed in the world. Returns its input. */
  private speakerChain(pos: Vector3, level: number): GainNode {
    const ctx = this.ctx!;
    if (!this.speakerCurve) { this.speakerCurve = new Float32Array(256); for (let k = 0; k < 256; k++) { const x = k / 128 - 1; this.speakerCurve[k] = Math.tanh(x * 1.6); } }
    const out = this.at(this.worldToAudio(pos.add(new Vector3(0, 8, 0))), this.music, 22);
    const lvl = ctx.createGain();
    lvl.gain.value = level;
    const hp = ctx.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 220;
    const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 3800;
    const ws = ctx.createWaveShaper(); ws.curve = this.speakerCurve;
    lvl.connect(hp).connect(ws).connect(lp).connect(out);
    return lvl;
  }

  /** A sung "aa": a gently vibrating voice through two vowel formants. */
  private sing(freq: number, when: number, dur: number, dest: AudioNode): void {
    const ctx = this.ctx!;
    const t = ctx.currentTime + when;
    const o = ctx.createOscillator();
    o.type = "sawtooth";
    o.frequency.setValueAtTime(freq * 0.985, t);
    o.frequency.linearRampToValueAtTime(freq, t + 0.12);
    const vib = ctx.createOscillator(), vg = ctx.createGain();
    vib.frequency.value = 5.2; vg.gain.value = freq * 0.012;
    vib.connect(vg).connect(o.frequency);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.09, t + 0.08);
    g.gain.setValueAtTime(0.09, t + dur - 0.12);
    g.gain.linearRampToValueAtTime(0, t + dur);
    for (const [ff, q, a] of [[720, 7, 1], [1150, 8, 0.6], [2600, 10, 0.25]] as const) {
      const bp = ctx.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = ff; bp.Q.value = q;
      const ga = ctx.createGain(); ga.gain.value = a;
      o.connect(bp).connect(ga).connect(g);
    }
    g.connect(dest);
    o.start(t); vib.start(t);
    o.stop(t + dur + 0.05); vib.stop(t + dur + 0.05);
    this.track(o, when + dur);
  }

  /** The mandir's brass ghanti: inharmonic partials ringing out. */
  private ghanti(when: number, dest: AudioNode, gain: number): void {
    for (const [r, a, d] of [[1, 1, 1.8], [2.76, 0.5, 1.1], [5.4, 0.25, 0.6], [8.9, 0.12, 0.35]] as const) this.tone(820 * r, d, "sine", 0.05 * a * gain, dest, when);
    this.noiseHit(0.02, 5000, 2, 0.05 * gain, dest, when);
  }

  /** The shankh: a long brassy swell with a wavering pitch. */
  private shankh(when: number, dest: AudioNode): void {
    const ctx = this.ctx!;
    const t = ctx.currentTime + when;
    const o = ctx.createOscillator();
    o.type = "sawtooth";
    o.frequency.setValueAtTime(220, t);
    o.frequency.linearRampToValueAtTime(233, t + 0.6);
    const vib = ctx.createOscillator(), vg = ctx.createGain();
    vib.frequency.value = 4.5; vg.gain.value = 3;
    vib.connect(vg).connect(o.frequency);
    const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 1400; lp.Q.value = 2;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.07, t + 0.9);
    g.gain.setValueAtTime(0.07, t + 2.4);
    g.gain.linearRampToValueAtTime(0, t + 3.0);
    o.connect(lp).connect(g).connect(dest);
    o.start(t); vib.start(t);
    o.stop(t + 3.1); vib.stop(t + 3.1);
    this.track(o, when + 3.1);
  }
}
