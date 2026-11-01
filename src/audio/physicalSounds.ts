/** Original physical-effect samples. No downloads, voices or runtime worklet. */
export function splashSamples(sampleRate: number, seed = 8173): Float32Array<ArrayBuffer> {
  const duration = 0.78, samples = new Float32Array(Math.ceil(sampleRate * duration));
  let smooth = 0;
  const noise = (): number => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 2147483648 - 1; };
  for (let i = 0; i < samples.length; i++) {
    const t = i / sampleRate, attack = Math.min(1, t / 0.006);
    smooth += (noise() - smooth) * 0.27;
    const rush = smooth * Math.exp(-t * 8) * 1.7;
    // Discrete falling droplets replace the dull bass thump of the previous
    // generic impact. Each bubble chirps down as its envelope closes.
    let drops = 0;
    for (const [start, freq, volume] of [[0.05, 620, 0.13], [0.14, 840, 0.10], [0.25, 510, 0.08], [0.39, 970, 0.06]] as const) {
      const d = t - start;
      if (d >= 0) drops += Math.sin(2 * Math.PI * freq * (d - 0.5 * d * d)) * Math.exp(-d * 35) * Math.min(1, d / 0.003) * volume;
    }
    const tail = Math.max(0, Math.min(1, (duration - t) / 0.05));
    samples[i] = (rush * attack + drops) * tail * 0.65;
  }
  return samples;
}

/** A quiet, band-limited stream/wind bed, shared by the regional scenes. */
export function environmentSamples(sampleRate: number, seconds = 3, seed = 1247): Float32Array<ArrayBuffer> {
  const samples = new Float32Array(Math.ceil(sampleRate * seconds));
  let low = 0;
  for (let i = 0; i < samples.length; i++) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    low += (seed / 2147483648 - 1 - low) * 0.1;
    // Close both ends at zero to avoid a click at the loop seam.
    const edge = Math.min(1, i / (sampleRate * 0.03), (samples.length - 1 - i) / (sampleRate * 0.03));
    samples[i] = low * edge;
  }
  return samples;
}
