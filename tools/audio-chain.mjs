import { chromium } from "playwright";
// Renders real clips through master-bus variants offline and reports peak and waveform distortion.
// Usage: node tools/audio-chain.mjs (with a preview server on :4173).
const b = await chromium.launch();
const p = await b.newPage();
await p.goto("http://localhost:4173/");
const r = await p.evaluate(async () => {
  const load = async (ctx, u) => ctx.decodeAudioData(await (await fetch(u)).arrayBuffer());
  const curve = () => { const n = 2048, c = new Float32Array(n); for (let i = 0; i < n; i++) { const x = (i / (n - 1)) * 2 - 1; c[i] = Math.tanh(x * 1.35) / Math.tanh(1.35); } return c; };
  async function render(chain, clips) {
    const ctx = new OfflineAudioContext(1, 44100 * 4, 44100);
    const master = ctx.createGain(); master.gain.value = 0.8;
    const sfx = ctx.createGain(); sfx.gain.value = 0.9; sfx.connect(master);
    const dry = ctx.createGain(); dry.gain.value = 0.8 * 0.9;
    let end = chain(ctx, master);
    end.connect(ctx.destination);
    // A linear reference of the same mix (for distortion).
    const ref = new OfflineAudioContext(1, 44100 * 4, 44100);
    for (const [u, g] of clips) {
      const buf = await load(ctx, u);
      const s = ctx.createBufferSource(); s.buffer = buf; const gg = ctx.createGain(); gg.gain.value = g; s.connect(gg).connect(sfx); s.start(0.1);
      const buf2 = await load(ref, u);
      const s2 = ref.createBufferSource(); s2.buffer = buf2; const g2 = ref.createGain(); g2.gain.value = g * 0.72; s2.connect(g2).connect(ref.destination); s2.start(0.1);
    }
    const out = (await ctx.startRendering()).getChannelData(0);
    const lin = (await ref.startRendering()).getChannelData(0);
    let peak = 0, clip = 0, e = 0, en = 0;
    // Best scale of lin to out (so gain changes don't count, only shape changes).
    // Align (the compressor looks ahead ~6 ms), then fit gain in 50 ms windows
    // so slow gain riding is not counted, only waveform damage.
    let lag = 0, best = -1;
    for (let L = 0; L < 800; L++) { let c = 0; for (let i = 4410; i < 4410 + 44100; i += 3) c += out[i + L] * lin[i]; if (c > best) { best = c; lag = L; } }
    const W = 2205;
    for (let w = 0; w + W + lag < out.length; w += W) {
      let num = 0, den = 0;
      for (let i = w; i < w + W; i++) { num += out[i + lag] * lin[i]; den += lin[i] * lin[i]; }
      const k = num / (den || 1e-9);
      for (let i = w; i < w + W; i++) { const o = out[i + lag]; e += (o - k * lin[i]) ** 2; en += o * o; }
    }
    for (let i = 0; i < out.length; i++) { const a = Math.abs(out[i]); peak = Math.max(peak, a); if (a >= 0.999) clip++; }
    return { peak: +peak.toFixed(3), clipped: clip, distortionPct: +(100 * Math.sqrt(e / (en || 1))).toFixed(1) };
  }
  const OLD = (ctx, m) => { const h = ctx.createGain(); h.gain.value = 0.55; const c = ctx.createDynamicsCompressor(); c.threshold.value = -16; c.knee.value = 6; c.ratio.value = 20; c.attack.value = 0.002; c.release.value = 0.18; const s = ctx.createWaveShaper(); s.curve = curve(); s.oversample = "2x"; const o = ctx.createGain(); o.gain.value = 1.25; m.connect(h).connect(c).connect(s).connect(o); return o; };
  const NEW = (ctx, m) => { const h = ctx.createGain(); h.gain.value = 0.6; const c = ctx.createDynamicsCompressor(); c.threshold.value = -6; c.knee.value = 4; c.ratio.value = 12; c.attack.value = 0.004; c.release.value = 0.25; m.connect(h).connect(c); return c; };
  const mk = (h0, t, r, a) => (ctx, m) => { const h = ctx.createGain(); h.gain.value = h0; const c = ctx.createDynamicsCompressor(); c.threshold.value = t; c.knee.value = 3; c.ratio.value = r; c.attack.value = a; c.release.value = 0.25; m.connect(h).connect(c); return c; };
  const voice = [["audio/voice/panga_bhen.mp3", 1.1]];
  const busy = [["audio/voice/panga_bhen.mp3", 1.1], ["audio/sfx/horn_car_1.mp3", 1.0], ["audio/sfx/eng_auto.wav", 0.6], ["audio/sfx/horn_jeep_2.mp3", 0.9]];
  const crowd = [...busy, ["audio/sfx/eng_truck.wav", 0.8], ["audio/sfx/eng_car.wav", 0.8], ["audio/sfx/truck_horn.mp3", 1], ["audio/voice/aunty_fight_2.mp3", 1.1]];
  const out = {};
  for (const [n, f] of Object.entries({ A_h09_t6: mk(0.9, -6, 12, 0.004), B_h1_t3: mk(1.0, -3, 20, 0.003), C_h085_t4: mk(0.85, -4, 16, 0.005) }))
    out[n] = { voice: await render(f, voice), busy: await render(f, busy), crowd: await render(f, crowd) };
  out.old_crowd = await render(OLD, crowd);
  return out;
  return { oldVoice: await render(OLD, voice), newVoice: await render(NEW, voice), oldBusy: await render(OLD, busy), newBusy: await render(NEW, busy) };
});
console.log(JSON.stringify(r, null, 1));
await b.close();
