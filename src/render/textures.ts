/**
 * Procedural, painterly surface textures drawn into canvases at startup.
 * Every texture is original and generated here (see docs/ASSETS.md).
 * Albedo maps are mostly light/neutral so per-vertex colour can tint them.
 */

export class Rng {
  private s: number;
  constructor(seed: number) {
    this.s = (seed * 2654435761) >>> 0 || 1;
  }
  next(): number {
    // xorshift32
    let x = this.s;
    x ^= x << 13; x >>>= 0;
    x ^= x >>> 17;
    x ^= x << 5; x >>>= 0;
    this.s = x;
    return x / 4294967296;
  }
  range(a: number, b: number): number {
    return a + (b - a) * this.next();
  }
  int(a: number, b: number): number {
    return Math.floor(this.range(a, b + 1));
  }
  pick<T>(arr: readonly T[]): T {
    return arr[Math.floor(this.next() * arr.length) % arr.length]!;
  }
}

/** Tileable value noise on a size×size lattice. */
function makeNoise(size: number, cells: number, rng: Rng): (x: number, y: number) => number {
  const g = new Float32Array(cells * cells);
  for (let i = 0; i < g.length; i++) g[i] = rng.next();
  const at = (i: number, j: number) => g[((j % cells + cells) % cells) * cells + ((i % cells + cells) % cells)]!;
  return (x: number, y: number) => {
    const fx = (x / size) * cells, fy = (y / size) * cells;
    const i = Math.floor(fx), j = Math.floor(fy);
    const tx = fx - i, ty = fy - j;
    const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
    const a = at(i, j), b = at(i + 1, j), c = at(i, j + 1), d = at(i + 1, j + 1);
    return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
  };
}

function fbm(size: number, rng: Rng, octaves: number[]): (x: number, y: number) => number {
  const ns = octaves.map((c) => makeNoise(size, c, rng));
  const total = octaves.reduce((s, _c, i) => s + 1 / (i + 1), 0);
  return (x, y) => {
    let v = 0;
    for (let i = 0; i < ns.length; i++) v += ns[i]!(x, y) / (i + 1);
    return v / total;
  };
}

export interface TexturePair {
  albedo: HTMLCanvasElement;
  /** Height map used to derive a normal map. */
  height: HTMLCanvasElement | null;
}

function canvas(size: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d", { willReadFrequently: true })!;
  return [c, ctx];
}

/** Fill a canvas from a per-pixel function returning [r,g,b] 0..255 and height 0..1. */
function paint(size: number, fn: (x: number, y: number) => [number, number, number, number]): TexturePair {
  const [a, actx] = canvas(size);
  const [h, hctx] = canvas(size);
  const ai = actx.createImageData(size, size);
  const hi = hctx.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const [r, g, b, ht] = fn(x, y);
      const o = (y * size + x) * 4;
      ai.data[o] = r; ai.data[o + 1] = g; ai.data[o + 2] = b; ai.data[o + 3] = 255;
      const hv = Math.max(0, Math.min(255, ht * 255));
      hi.data[o] = hi.data[o + 1] = hi.data[o + 2] = hv; hi.data[o + 3] = 255;
    }
  }
  actx.putImageData(ai, 0, 0);
  hctx.putImageData(hi, 0, 0);
  return { albedo: a, height: h };
}

/** Soft painterly brush strokes layered over a texture (wraps at edges). */
function strokes(c: HTMLCanvasElement, rng: Rng, count: number, colors: string[], alpha: number, len: number, width: number): void {
  const ctx = c.getContext("2d")!;
  const size = c.width;
  ctx.lineCap = "round";
  for (let i = 0; i < count; i++) {
    const x = rng.next() * size, y = rng.next() * size;
    const ang = rng.range(-0.5, 0.5) + (rng.next() < 0.5 ? 0 : Math.PI / 2) * 0.2;
    const l = len * rng.range(0.5, 1.4);
    ctx.strokeStyle = rng.pick(colors);
    ctx.globalAlpha = alpha * rng.range(0.4, 1);
    ctx.lineWidth = width * rng.range(0.5, 1.5);
    for (const [ox, oy] of [[0, 0], [size, 0], [-size, 0], [0, size], [0, -size]] as const) {
      ctx.beginPath();
      ctx.moveTo(x + ox, y + oy);
      ctx.quadraticCurveTo(x + ox + Math.cos(ang) * l * 0.5, y + oy + Math.sin(ang) * l * 0.5 + rng.range(-3, 3), x + ox + Math.cos(ang) * l, y + oy + Math.sin(ang) * l);
      ctx.stroke();
    }
  }
  ctx.globalAlpha = 1;
}

export function plasterTexture(): TexturePair {
  const rng = new Rng(11);
  const n = fbm(512, rng, [4, 9, 23, 61]);
  const fine = makeNoise(512, 128, rng);
  const t = paint(512, (x, y) => {
    const v = n(x, y);
    const f = fine(x, y);
    const base = 214 + (v - 0.5) * 46 + (f - 0.5) * 14;
    return [base + 6, base, base - 10, v * 0.7 + f * 0.3];
  });
  strokes(t.albedo, rng, 260, ["#fff8ea", "#d9cdb8", "#ece3d2"], 0.18, 60, 14);
  return t;
}

export function brickTexture(): TexturePair {
  const rng = new Rng(23);
  const n = fbm(512, rng, [8, 32, 90]);
  const bw = 64, bh = 24; // 8 bricks across 512 px; at 2 m/tile ≈ 0.25 × 0.094 m
  const tones: Array<[number, number, number]> = [];
  for (let i = 0; i < 200; i++) tones.push([rng.range(150, 190), rng.range(72, 98), rng.range(52, 72)]);
  return paint(512, (x, y) => {
    const row = Math.floor(y / bh);
    const off = row % 2 ? bw / 2 : 0;
    const col = Math.floor((x + off) / bw);
    const lx = (x + off) % bw, ly = y % bh;
    const mortar = lx < 3 || ly < 3;
    const v = n(x, y);
    if (mortar) {
      const m = 170 + v * 30;
      return [m, m - 6, m - 16, 0.15];
    }
    const t = tones[(row * 13 + col * 7) % tones.length]!;
    const k = 0.85 + v * 0.3;
    return [t[0] * k, t[1] * k, t[2] * k, 0.6 + v * 0.4];
  });
}

export function woodTexture(): TexturePair {
  const rng = new Rng(31);
  const n = fbm(512, rng, [3, 12, 40]);
  const plank = 64;
  return paint(512, (x, y) => {
    const p = Math.floor(x / plank);
    const grain = Math.sin((y * 0.08 + n(x * 0.3, y) * 9 + p * 3.1)) * 0.5 + 0.5;
    const edge = x % plank < 2 ? 0.6 : 1;
    const v = (150 + grain * 50 + (n(x, y) - 0.5) * 40) * edge;
    return [v * 1.0, v * 0.78, v * 0.55, grain * 0.4 + (edge < 1 ? 0 : 0.5)];
  });
}

export function shutterTexture(): TexturePair {
  const rng = new Rng(41);
  const n = fbm(256, rng, [6, 24]);
  return paint(256, (x, y) => {
    const rib = Math.sin((y / 256) * Math.PI * 2 * 16);
    const v = 190 + rib * 28 + (n(x, y) - 0.5) * 40;
    return [v, v, v * 0.98, rib * 0.5 + 0.5];
  });
}

export function fabricTexture(): TexturePair {
  const rng = new Rng(53);
  const n = fbm(256, rng, [8, 32]);
  return paint(256, (x, y) => {
    const weave = ((x >> 1) + (y >> 1)) % 2 ? 0.94 : 1;
    const stripe = Math.floor(x / 32) % 2 ? 1 : 0.82;
    const v = 235 * weave * stripe * (0.92 + n(x, y) * 0.12);
    return [v, v, v, weave * 0.5];
  });
}

export function asphaltTexture(): TexturePair {
  const rng = new Rng(61);
  const n = fbm(512, rng, [4, 16, 64, 200]);
  const patches = makeNoise(512, 5, rng);
  const t = paint(512, (x, y) => {
    const v = n(x, y);
    const p = patches(x, y);
    const speck = rng.next() < 0.02 ? 30 : 0;
    const base = 88 + (v - 0.5) * 30 + (p - 0.5) * 10 + speck;
    return [base + 4, base + 2, base, v];
  });
  strokes(t.albedo, rng, 40, ["#5a5550", "#77706a"], 0.15, 120, 6);
  return t;
}

export function paverTexture(): TexturePair {
  const rng = new Rng(71);
  const n = fbm(512, rng, [8, 40]);
  const tile = 128; // 4×4 tiles per texture
  const tones: number[] = [];
  for (let i = 0; i < 64; i++) tones.push(rng.range(0.85, 1.08));
  return paint(512, (x, y) => {
    const tx = Math.floor(x / tile), ty = Math.floor(y / tile);
    const lx = x % tile, ly = y % tile;
    const joint = lx < 4 || ly < 4;
    const k = tones[(tx * 5 + ty * 3) % 64]!;
    const v = joint ? 120 : (186 + (n(x, y) - 0.5) * 34) * k;
    return [v + 10, v + 2, v - 12, joint ? 0 : 0.7 + n(x, y) * 0.3];
  });
}

export function dirtTexture(): TexturePair {
  const rng = new Rng(83);
  const n = fbm(512, rng, [4, 12, 48, 160]);
  return paint(512, (x, y) => {
    const v = n(x, y);
    const r = 168 + (v - 0.5) * 60, g = 140 + (v - 0.5) * 50, b = 102 + (v - 0.5) * 40;
    return [r, g, b, v];
  });
}

export function leafTexture(): TexturePair {
  const rng = new Rng(97);
  const n = fbm(256, rng, [16, 48, 128]);
  return paint(256, (x, y) => {
    const v = n(x, y);
    const g = 160 + (v - 0.5) * 70;
    return [g * 0.7, g, g * 0.5, v];
  });
}

export function concreteTexture(): TexturePair {
  const rng = new Rng(101);
  const n = fbm(512, rng, [6, 24, 96]);
  return paint(512, (x, y) => {
    const v = 175 + (n(x, y) - 0.5) * 50;
    return [v, v - 2, v - 6, n(x, y)];
  });
}

/** Convert a height canvas to a tangent-space normal map canvas. */
export function heightToNormal(h: HTMLCanvasElement, strength: number): HTMLCanvasElement {
  const size = h.width;
  const src = h.getContext("2d")!.getImageData(0, 0, size, size).data;
  const [out, ctx] = canvas(size);
  const img = ctx.createImageData(size, size);
  const H = (x: number, y: number) => src[(((y + size) % size) * size + ((x + size) % size)) * 4]! / 255;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (H(x + 1, y) - H(x - 1, y)) * strength;
      const dy = (H(x, y + 1) - H(x, y - 1)) * strength;
      const len = Math.hypot(dx, dy, 1);
      const o = (y * size + x) * 4;
      img.data[o] = (-dx / len * 0.5 + 0.5) * 255;
      img.data[o + 1] = (-dy / len * 0.5 + 0.5) * 255;
      img.data[o + 2] = (1 / len * 0.5 + 0.5) * 255;
      img.data[o + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return out;
}

/** Character atlas: left half soft cloth weave, right half flat (skin, faces). */
export function characterTexture(): TexturePair {
  const rng = new Rng(131);
  const n = fbm(256, rng, [8, 32, 96]);
  return paint(256, (x, y) => {
    if (x >= 128) return [246, 246, 246, 0.5];
    const weave = ((x >> 1) + (y >> 1)) % 2 ? 0.95 : 1;
    const v = 240 * weave * (0.93 + n(x, y) * 0.1);
    return [v, v, v, weave * 0.6];
  });
}
