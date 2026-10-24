/**
 * The radio: four stations made on the spot, so the street has music without a
 * recording per song. The car's radio (N in a vehicle) and the radios on the
 * shop counters are the same thing: a Radio plays a station into a node, and
 * the audio system decides where that node sits (in the cab, or at a shop).
 *
 *  Punjab Beats   bhangra: a dhol on the chaal, a tumbi riff, a chimta on the off-beats
 *  Purane Gaane   old film songs: tabla on the keherwa, strings, a singing line
 *  Gurbani Radio  kirtan: harmonium drone and a slow line over soft tabla
 *  Vividh Bharati news and cricket: a newsreader, a commentator and a crowd
 *
 * The notes are written down below (scales and phrases); only the choice of
 * phrase varies from bar to bar, so a station sounds like itself.
 */

export type StationId = "bhangra" | "purane" | "gurbani" | "talk";

export interface Station { id: StationId; name: string; mhz: string; blurb: string }

export const STATIONS: Station[] = [
  { id: "bhangra", name: "Punjab Beats", mhz: "98.3", blurb: "bhangra" },
  { id: "purane", name: "Purane Gaane", mhz: "91.1", blurb: "old film songs" },
  { id: "gurbani", name: "Gurbani Radio", mhz: "104.0", blurb: "kirtan" },
  { id: "talk", name: "Vividh Bharati", mhz: "101.3", blurb: "news and cricket" },
];

export function stationName(id: StationId | null): string {
  const s = STATIONS.find((x) => x.id === id);
  return s ? `${s.name} ${s.mhz}` : "Radio off";
}

/** The next station on the dial; after the last one the radio goes off. */
export function nextStation(id: StationId | null): StationId | null {
  if (id === null) return STATIONS[0]!.id;
  const i = STATIONS.findIndex((s) => s.id === id);
  return STATIONS[i + 1]?.id ?? null;
}

// D mixolydian from D4: the tumbi's key.
const MIXO = [293.66, 329.63, 369.99, 392, 440, 493.88, 523.25, 587.33, 659.26];
const TUMBI: Array<Array<number | null>> = [
  [4, 5, 4, 2, 4, null, 2, 0],
  [0, 2, 4, 4, 5, 4, 2, null],
  [4, 4, 5, 7, 5, 4, 2, null],
  [7, 5, 4, 2, 4, 2, 0, null],
];
// C yaman from C4: the film song's key.
const YAMAN = [261.63, 293.66, 329.63, 369.99, 392, 440, 493.88, 523.25];
const FILM: Array<Array<[number, number]>> = [
  [[4, 2], [5, 1], [4, 1], [2, 2], [3, 2]],
  [[2, 2], [4, 2], [5, 2], [7, 1], [5, 1]],
  [[7, 2], [5, 1], [4, 1], [2, 2], [0, 2]],
  [[4, 1], [5, 1], [7, 2], [5, 2], [4, 2]],
];
const FILM_CHORDS: number[][] = [[261.63, 329.63, 392], [220, 261.63, 329.63], [174.61, 220, 261.63], [196, 246.94, 293.66]];
// C bhairavi from C4: the kirtan's key.
const BHAIRAVI = [261.63, 277.18, 311.13, 349.23, 392, 415.3, 466.16, 523.25];
const KIRTAN: Array<Array<[number, number]>> = [
  [[4, 2], [3, 1], [2, 1], [1, 2], [0, 2]],
  [[0, 2], [2, 2], [3, 2], [4, 2]],
  [[4, 1], [5, 1], [4, 2], [3, 2], [2, 2]],
  [[2, 2], [3, 1], [4, 1], [3, 2], [0, 2]],
];

export class Radio {
  station: StationId | null = null;
  private input: GainNode;
  private chain: AudioNode[] = [];
  private staticSrc: AudioBufferSourceNode | null = null;
  private staticGain: GainNode;
  private nextT = 0;
  private bar = 0;
  /** Cached tumbi plucks, by frequency. */
  private plucks = new Map<number, AudioBuffer>();
  private seed = 1;

  constructor(private ctx: AudioContext, dest: AudioNode, private noise: AudioBuffer, gain = 1) {
    // A small speaker: no bass under 200 Hz, nothing over 4 kHz, a little push at 1.5 kHz.
    this.input = ctx.createGain();
    this.input.gain.value = gain;
    const hp = ctx.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 200;
    const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 4200;
    const mid = ctx.createBiquadFilter(); mid.type = "peaking"; mid.frequency.value = 1500; mid.gain.value = 4; mid.Q.value = 0.8;
    this.input.connect(hp).connect(mid).connect(lp).connect(dest);
    this.chain = [this.input, hp, mid, lp];
    this.staticGain = ctx.createGain();
    this.staticGain.gain.value = 0;
    const bp = ctx.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = 2400; bp.Q.value = 0.5;
    this.staticGain.connect(bp).connect(this.input);
    this.chain.push(this.staticGain, bp);
  }

  tune(id: StationId | null): void {
    if (id === this.station) return;
    this.station = id;
    this.bar = 0;
    const now = this.ctx.currentTime;
    this.nextT = now + 0.35;
    // Between stations: a hiss that sweeps and fades.
    const t = now;
    this.staticGain.gain.cancelScheduledValues(t);
    this.staticGain.gain.setValueAtTime(0.5, t);
    this.staticGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.4);
    if (!this.staticSrc) {
      this.staticSrc = this.ctx.createBufferSource();
      this.staticSrc.buffer = this.noise;
      this.staticSrc.loop = true;
      this.staticSrc.connect(this.staticGain);
      this.staticSrc.start();
    }
    // Always a faint hiss under a station that is on: it is a radio.
    if (id) this.staticGain.gain.linearRampToValueAtTime(0.012, t + 0.8);
  }

  /** Call every frame: schedule the next bars when the last one is nearly done. */
  update(): void {
    if (!this.station) return;
    const now = this.ctx.currentTime;
    if (this.nextT < now) this.nextT = now + 0.05;
    let guard = 0;
    while (this.nextT < now + 0.7 && guard++ < 4) {
      const len = this.playBar(this.station, this.nextT, this.bar++);
      this.nextT += len;
    }
  }

  /** For tests and auditions: schedule some seconds of the station at once (an offline context has no clock). */
  renderAhead(seconds: number): void {
    if (!this.station) return;
    let t = this.nextT;
    const end = t + seconds;
    while (t < end) t += this.playBar(this.station, t, this.bar++);
  }

  stop(): void {
    this.station = null;
    try { this.staticSrc?.stop(); } catch { /* already stopped */ }
    this.staticSrc = null;
    for (const n of this.chain) { try { n.disconnect(); } catch { /* already gone */ } }
  }

  // ------------------------------------------------------------------ the stations

  private rand(): number {
    this.seed = (this.seed * 1664525 + 1013904223) >>> 0;
    return this.seed / 4294967296;
  }

  private playBar(id: StationId, t: number, bar: number): number {
    switch (id) {
      case "bhangra": return this.bhangra(t, bar);
      case "purane": return this.purane(t, bar);
      case "gurbani": return this.gurbani(t, bar);
      case "talk": return this.talk(t, bar);
    }
  }

  private bhangra(t: number, bar: number): number {
    const beat = 60 / 108, step = beat / 4;
    // The dhol on the chaal: 2 the dagga (bass head), 1 the tilli (treble stick).
    const dhol = [2, 0, 1, 0, 2, 0, 1, 1, 2, 0, 1, 0, 2, 1, 1, 0];
    dhol.forEach((p, i) => {
      if (p === 2) this.thump(t + i * step, 95, 55, 0.5, 0.32);
      else if (p === 1) { this.thump(t + i * step, 270, 190, 0.22, 0.11); this.hiss(t + i * step, 0.04, 4200, 1, 0.1); }
    });
    // The chimta on the off-beats, the bass on one and three.
    for (const i of [2, 6, 10, 14]) this.hiss(t + i * step, 0.05, 6500, 2, 0.08);
    this.tone(73.4, t, beat * 1.6, "sine", 0.22);
    this.tone(73.4, t + beat * 2, beat * 1.6, "sine", 0.2);
    // The tumbi riff: eight plucks to the bar, a phrase twice over.
    const phrase = TUMBI[(bar >> 1) % TUMBI.length]!;
    phrase.forEach((d, i) => { if (d !== null) this.pluck(MIXO[d]! * 2, t + i * beat * 0.5, 0.17); });
    // A sustained note under the second half of every fourth bar: the harmonium of the band.
    if (bar % 4 === 3) this.reed(146.8, t, beat * 4, 0.05);
    return beat * 4;
  }

  private purane(t: number, bar: number): number {
    const step = 0.4;
    // Keherwa on the tabla: dha ge na ti na ke dhi na.
    const bols: Array<[number, "dha" | "ge" | "na" | "ti" | "ke"]> = [[0, "dha"], [1, "ge"], [2, "na"], [3, "ti"], [4, "na"], [5, "ke"], [6, "ge"], [7, "na"]];
    for (const [i, b] of bols) this.tabla(t + i * step, b, 0.8);
    // The strings: one chord a bar, slow in and slow out.
    const chord = FILM_CHORDS[bar % FILM_CHORDS.length]!;
    for (const f of chord) { this.pad(f, t, step * 8 + 0.4, 0.028); this.pad(f * 2.003, t, step * 8 + 0.4, 0.012); }
    // The singer: a line of long notes with vibrato, resting every other bar.
    if (bar % 4 !== 3) {
      let at = 0;
      for (const [d, beats] of FILM[Math.floor(bar / 2) % FILM.length]!) {
        this.sing(YAMAN[d]! * 2, t + at * step * 2, step * 2 * beats - 0.05, 0.09);
        at += beats;
      }
    }
    return step * 8;
  }

  private gurbani(t: number, bar: number): number {
    const beat = 1.1;
    // The harmonium's drone: sa and pa, held across the bar.
    this.reed(130.81, t, beat * 8 + 0.3, 0.055);
    this.reed(196, t, beat * 8 + 0.3, 0.04);
    // The raagi sings a line, the sangat answers it.
    if (bar % 2 === 0) {
      let at = 0;
      for (const [d, beats] of KIRTAN[Math.floor(bar / 2) % KIRTAN.length]!) {
        this.sing(BHAIRAVI[d]! * 2, t + at * beat, beat * beats - 0.08, 0.11);
        at += beats;
      }
    } else {
      let at = 0;
      for (const [d, beats] of KIRTAN[Math.floor(bar / 2) % KIRTAN.length]!) {
        this.sing(BHAIRAVI[d]! * 2, t + at * beat + 0.04, beat * beats - 0.08, 0.06);
        this.sing(BHAIRAVI[d]! * 2.99, t + at * beat + 0.04, beat * beats - 0.08, 0.025);
        at += beats;
      }
    }
    // Soft tabla on the second and fourth beats.
    for (const i of [1, 3, 5, 7]) this.tabla(t + i * beat, i % 4 === 1 ? "na" : "dha", 0.5);
    return beat * 8;
  }

  /** News and cricket: a newsreader (a bulletin with its sting), then the commentator over a crowd. */
  private talk(t: number, bar: number): number {
    const len = 1.5;
    const seg = Math.floor(bar / 14) % 2; // 14 bars of news, 14 of cricket
    const at = bar % 14;
    if (at === 0) [784, 988, 1175].forEach((f, i) => this.tone(f, t + i * 0.14, 0.3, "triangle", 0.1));
    if (seg === 0) {
      if (at > 0) this.babble(t, len, 7, 135, 0.11);
    } else {
      // The crowd swells; the commentator is quick and loud; a four, now and then, brings the roar.
      this.hiss(t, len, 900, 0.7, 0.08 + (at % 5 === 0 ? 0.12 : 0));
      this.babble(t, len, 9, 160, 0.09);
    }
    return len;
  }

  // ------------------------------------------------------------------ voices

  private env(g: GainNode, t: number, dur: number, peak: number, attack = 0.005): void {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(dur, attack + 0.02));
  }

  private tone(freq: number, t: number, dur: number, type: OscillatorType, peak: number, slideTo?: number): void {
    const o = this.ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    const g = this.ctx.createGain();
    this.env(g, t, dur, peak, Math.min(0.02, dur / 3));
    o.connect(g).connect(this.input);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  private hiss(t: number, dur: number, freq: number, q: number, peak: number): void {
    const s = this.ctx.createBufferSource();
    s.buffer = this.noise;
    s.loop = true;
    const f = this.ctx.createBiquadFilter();
    f.type = "bandpass";
    f.frequency.value = freq;
    f.Q.value = q;
    const g = this.ctx.createGain();
    this.env(g, t, dur, peak, 0.004);
    s.connect(f).connect(g).connect(this.input);
    s.start(t, Math.random() * 1.5);
    s.stop(t + dur + 0.05);
  }

  /** A drum head: a sine that falls. */
  private thump(t: number, from: number, to: number, peak: number, dur: number): void {
    this.tone(from, t, dur, "sine", peak, to);
  }

  /** A plucked string (Karplus-Strong), cached by pitch. */
  private pluck(freq: number, t: number, peak: number): void {
    let buf = this.plucks.get(freq);
    if (!buf) {
      const sr = this.ctx.sampleRate;
      buf = this.ctx.createBuffer(1, Math.floor(sr * 0.6), sr);
      const d = buf.getChannelData(0);
      const period = Math.max(2, Math.floor(sr / freq));
      const ring = new Float32Array(period);
      for (let i = 0; i < period; i++) ring[i] = Math.random() * 2 - 1;
      let idx = 0;
      for (let i = 0; i < d.length; i++) {
        const next = (idx + 1) % period;
        d[i] = ring[idx]!;
        ring[idx] = (ring[idx]! + ring[next]!) * 0.4985;
        idx = next;
      }
      this.plucks.set(freq, buf);
    }
    const s = this.ctx.createBufferSource();
    s.buffer = buf;
    const g = this.ctx.createGain();
    g.gain.value = peak;
    s.connect(g).connect(this.input);
    s.start(t);
  }

  /** The harmonium: a few detuned saws behind a low-pass, a breath in and a breath out. */
  private reed(freq: number, t: number, dur: number, peak: number): void {
    const g = this.ctx.createGain();
    const lp = this.ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 1500;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + 0.12);
    g.gain.setValueAtTime(peak, t + Math.max(0.12, dur - 0.25));
    g.gain.linearRampToValueAtTime(0.0001, t + dur);
    lp.connect(g).connect(this.input);
    for (const det of [-5, 0, 6]) {
      const o = this.ctx.createOscillator();
      o.type = "sawtooth";
      o.frequency.value = freq;
      o.detune.value = det;
      o.connect(lp);
      o.start(t);
      o.stop(t + dur + 0.05);
    }
  }

  private pad(freq: number, t: number, dur: number, peak: number): void {
    const g = this.ctx.createGain();
    const lp = this.ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 1100;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + 0.35);
    g.gain.setValueAtTime(peak, t + Math.max(0.35, dur - 0.9));
    g.gain.linearRampToValueAtTime(0.0001, t + dur);
    lp.connect(g).connect(this.input);
    for (const det of [-7, 7]) {
      const o = this.ctx.createOscillator();
      o.type = "sawtooth";
      o.frequency.value = freq;
      o.detune.value = det;
      o.connect(lp);
      o.start(t);
      o.stop(t + dur + 0.05);
    }
  }

  /** A voice holding a note: a saw through two vowel formants, with vibrato. */
  private sing(freq: number, t: number, dur: number, peak: number): void {
    const o = this.ctx.createOscillator();
    o.type = "sawtooth";
    o.frequency.value = freq;
    const lfo = this.ctx.createOscillator();
    lfo.frequency.value = 5.2;
    const lg = this.ctx.createGain();
    lg.gain.value = freq * 0.012;
    lfo.connect(lg).connect(o.frequency);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + Math.min(0.12, dur / 3));
    g.gain.setValueAtTime(peak, t + Math.max(0.1, dur - 0.12));
    g.gain.linearRampToValueAtTime(0.0001, t + dur + 0.05);
    for (const [fc, q, gn] of [[760, 7, 1], [1150, 9, 0.6]] as const) {
      const f = this.ctx.createBiquadFilter();
      f.type = "bandpass";
      f.frequency.value = fc;
      f.Q.value = q;
      const fg = this.ctx.createGain();
      fg.gain.value = gn;
      o.connect(f).connect(fg).connect(g);
    }
    g.connect(this.input);
    o.start(t); lfo.start(t);
    o.stop(t + dur + 0.1); lfo.stop(t + dur + 0.1);
  }

  /** Tabla: dayan (right, tuned) and bayan (left, a falling boom). */
  private tabla(t: number, bol: "dha" | "ge" | "na" | "ti" | "ke", level: number): void {
    const l = level;
    if (bol === "dha" || bol === "ge") this.thump(t, 140, 80, 0.32 * l, 0.28);
    if (bol === "dha" || bol === "na") this.tone(392, t, 0.16, "sine", 0.16 * l, 380);
    if (bol === "ti") this.tone(523, t, 0.1, "triangle", 0.12 * l);
    if (bol === "ke") this.hiss(t, 0.05, 1800, 2, 0.1 * l);
  }

  /** Talk: voiced syllables at a few pitches. */
  private babble(t: number, len: number, n: number, base: number, peak: number): void {
    for (let i = 0; i < n; i++) {
      const at = t + (i * len) / n + this.rand() * 0.05;
      const f = base * (0.85 + this.rand() * 0.35);
      const dur = 0.09 + this.rand() * 0.09;
      const o = this.ctx.createOscillator();
      o.type = "sawtooth";
      o.frequency.setValueAtTime(f, at);
      o.frequency.linearRampToValueAtTime(f * (0.9 + this.rand() * 0.2), at + dur);
      const fl = this.ctx.createBiquadFilter();
      fl.type = "bandpass";
      fl.frequency.value = 500 + this.rand() * 1400;
      fl.Q.value = 3;
      const g = this.ctx.createGain();
      this.env(g, at, dur, peak, 0.012);
      o.connect(fl).connect(g).connect(this.input);
      o.start(at);
      o.stop(at + dur + 0.05);
    }
  }
}
