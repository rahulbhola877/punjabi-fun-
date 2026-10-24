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

/**
 * Turf: what open ground looks like from standing height. Mottled greens and straw over a dark soil, with fine
 * blade strokes in every direction so it reads as grass at a metre and as a soft green field from afar. Neutral
 * enough that the vertex colour can lean it greener, drier or yellower from tile to tile.
 */
export function turfTexture(): TexturePair {
  const rng = new Rng(311);
  const big = fbm(512, rng, [3, 9, 27]);
  const mid = fbm(512, rng, [48, 120]);
  const t = paint(512, (x, y) => {
    const a = big(x, y), m = mid(x, y);
    // Soil shows through in thin places; elsewhere green, with straw patches.
    const thin = Math.max(0, 0.42 - m) * 2.2;
    const straw = Math.max(0, a - 0.55) * 2.4;
    const g = 128 + (m - 0.5) * 90 + (a - 0.5) * 40;
    const r = g * (0.62 + straw * 0.55 + thin * 0.35);
    const b = g * (0.32 + thin * 0.2);
    return [Math.min(255, r), Math.min(255, g * (1 - thin * 0.25)), Math.min(255, b), m];
  });
  // Blades: short strokes in several greens, every direction, a few thousand of them.
  const ctx = t.albedo.getContext("2d")!;
  ctx.lineCap = "round";
  const cols = ["#5c7f2c", "#6f9438", "#86a845", "#4d6e25", "#9bb552", "#a79f56", "#7d9a3a"];
  for (let i = 0; i < 9000; i++) {
    const x = rng.next() * 512, y = rng.next() * 512, a = rng.range(0, Math.PI * 2), l = rng.range(5, 15);
    ctx.strokeStyle = cols[i % cols.length]!;
    ctx.globalAlpha = rng.range(0.35, 0.8);
    ctx.lineWidth = rng.range(0.8, 1.9);
    for (const [ox, oy] of [[0, 0], [512, 0], [-512, 0], [0, 512], [0, -512]] as const) {
      const px = x + ox, py = y + oy;
      if (px < -20 || px > 532 || py < -20 || py > 532) continue;
      ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px + Math.cos(a) * l, py + Math.sin(a) * l); ctx.stroke();
    }
  }
  ctx.globalAlpha = 1;
  return t;
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

/** Crop rows: dense vertical stalks with a lighter tip band; neutral so vertex colour sets the crop. */
export function cropTexture(): TexturePair {
  const rng = new Rng(131);
  const n = fbm(256, rng, [8, 32]);
  const stalk = new Float32Array(256);
  for (let i = 0; i < 256; i++) stalk[i] = rng.next();
  return paint(256, (x, y) => {
    const s = stalk[x]!;
    const v = n(x, y);
    // Vertical stripes of varied brightness, darker toward the base (y large).
    const stripe = 0.72 + s * 0.35 + (v - 0.5) * 0.25;
    const base = 1 - (y / 256) * 0.35;
    const g = Math.max(0, Math.min(255, 215 * stripe * base));
    return [g, g, g * 0.92, s * 0.6 + v * 0.4];
  });
}

/** Rippled water for the canal (scrolled at runtime). */
export function waterTexture(): TexturePair {
  const rng = new Rng(149);
  const n = fbm(256, rng, [4, 16, 48]);
  return paint(256, (x, y) => {
    const v = n(x, y);
    const b = 150 + (v - 0.5) * 60;
    return [b * 0.55, b * 0.85, b * 0.8, v];
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

/**
 * The crop plants, one strip per crop, stacked in one atlas and tiled along the rows (the strips wrap sideways).
 * Each strip is a few metres of the crop seen from the side: stalks, ears, flowers, leaves, on a clear background
 * (the material cuts out the clear part), so a row card reads as plants and not a coloured slab.
 */
export const PLANT = {
  /** Strip pixel size, and the width in metres that one tile covers along a row. */
  w: 512, h: 256, tile: 2.6, pad: 6,
  /** Strip index by crop. */
  strip: { wheat: 0, sarson: 1, sugarcane: 2, paddy: 3, fodder: 4, neem: 5, peepal: 6, oval: 7, safeda: 8, kikar: 9, grass: 10, weeds: 11 } as Record<string, number>,
  rows: 12,
};

export function plantAtlas(): HTMLCanvasElement {
  const [c, ctx] = canvas(PLANT.w);
  c.width = PLANT.w;
  c.height = PLANT.h * PLANT.rows;
  const rng = new Rng(2718);
  const W = PLANT.w, H = PLANT.h, P = PLANT.pad;
  const base = (i: number) => (i + 1) * H - P;        // y of the ground in strip i
  const stalk = (x0: number, y0: number, x1: number, y1: number, bend: number, w: number, col: string) => {
    ctx.strokeStyle = col; ctx.lineWidth = w; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.quadraticCurveTo((x0 + x1) / 2 + bend, (y0 + y1) / 2, x1, y1); ctx.stroke();
  };
  // Draw a plant twice, once at the right edge, once wrapped at the left, so the strip tiles.
  const wrap = (x: number, r: number, f: (dx: number) => void) => { f(0); if (x < r) f(W); if (x > W - r) f(-W); };
  const leaf = (x: number, y: number, tx: number, ty: number, wd: number, col: string, bend = 0) => {
    // A tapering leaf blade from (x,y) to the tip (tx,ty).
    const mx = (x + tx) / 2 + bend, my = (y + ty) / 2;
    const nx = -(ty - y), ny = tx - x, nl = Math.hypot(nx, ny) || 1;
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(mx + (nx / nl) * wd, my + (ny / nl) * wd, tx, ty);
    ctx.quadraticCurveTo(mx - (nx / nl) * wd, my - (ny / nl) * wd, x, y);
    ctx.fill();
  };

  // ---- wheat: thin golden stalks with ears and awns, a few green leaves low down.
  {
    const i = PLANT.strip.wheat!, b = base(i), top = i * H + P;
    for (let layer = 0; layer < 3; layer++) {
      const n = 46;
      for (let k = 0; k < n; k++) {
        const x = rng.next() * W, hgt = (b - top) * rng.range(0.62, 0.98) * (0.85 + layer * 0.08), lean = rng.range(-10, 10);
        const gold = layer === 0 ? "#b8963f" : layer === 1 ? "#cfa94a" : "#e0bb5a";
        wrap(x, 24, (dx) => {
          stalk(x + dx, b, x + dx + lean, b - hgt, lean * 0.4, 2.2, gold);
          // The ear: a plump ellipse along the tip, a darker rim, awns.
          const ex = x + dx + lean, ey = b - hgt;
          ctx.save(); ctx.translate(ex, ey); ctx.rotate(lean * 0.02);
          ctx.fillStyle = layer === 2 ? "#e8c868" : "#d2a83e";
          ctx.beginPath(); ctx.ellipse(0, -9, 3.6, 12, 0, 0, Math.PI * 2); ctx.fill();
          ctx.strokeStyle = "#a98530"; ctx.lineWidth = 0.8;
          for (let a = -2; a <= 2; a++) { ctx.beginPath(); ctx.moveTo(a * 1.3, -14); ctx.lineTo(a * 2.8, -30 - Math.abs(a) * 2); ctx.stroke(); }
          ctx.restore();
          if (k % 4 === 0) leaf(x + dx, b, x + dx + lean * 1.6 + 16, b - hgt * 0.55, 3, "#7d8f3b", 6);
        });
      }
    }
  }
  // ---- sarson: green stalks, broad lower leaves, heads of yellow flowers.
  {
    const i = PLANT.strip.sarson!, b = base(i), top = i * H + P;
    for (let k = 0; k < 40; k++) {
      const x = rng.next() * W, hgt = (b - top) * rng.range(0.6, 0.95), lean = rng.range(-12, 12);
      wrap(x, 40, (dx) => {
        stalk(x + dx, b, x + dx + lean, b - hgt, lean * 0.3, 2.6, "#5f8a34");
        leaf(x + dx, b - 6, x + dx - 22, b - hgt * 0.35, 6, "#6f9a3d", -6);
        leaf(x + dx, b - 20, x + dx + 24, b - hgt * 0.45, 6, "#5f8a34", 6);
        // Branches ending in flower clusters.
        for (let br = 0; br < 3; br++) {
          const by = b - hgt * (0.55 + br * 0.17), bx = x + dx + lean * (0.5 + br * 0.2), ox = (br - 1) * 15;
          stalk(bx, by, bx + ox, by - 18, ox * 0.2, 1.4, "#6a9638");
          for (let f = 0; f < 11; f++) {
            ctx.fillStyle = f % 3 ? "#f1d82a" : "#ffe94a";
            ctx.beginPath(); ctx.arc(bx + ox + rng.range(-9, 9), by - 18 + rng.range(-10, 8), rng.range(2.2, 4.2), 0, Math.PI * 2); ctx.fill();
          }
        }
      });
    }
  }
  // ---- sugarcane: tall thick jointed stalks, a crown of long arching leaves, dry leaves hanging low.
  {
    const i = PLANT.strip.sugarcane!, b = base(i), top = i * H + P;
    for (let layer = 0; layer < 3; layer++) {
      for (let k = 0; k < 19; k++) {
        const x = rng.next() * W, hgt = (b - top) * rng.range(0.7, 0.88), lean = rng.range(-6, 6);
        const col = layer === 0 ? "#7c9236" : layer === 1 ? "#8da23f" : "#a5b552";
        wrap(x, 70, (dx) => {
          const tx = x + dx + lean, ty = b - hgt;
          stalk(x + dx, b, tx, ty, lean * 0.2, 6.5, col);
          // Joints.
          ctx.strokeStyle = "#6f7f2d"; ctx.lineWidth = 1.3;
          for (let j = 1; j < 7; j++) { const yy = b - (hgt * j) / 7; const xx = x + dx + lean * (j / 7) * 0.9; ctx.beginPath(); ctx.moveTo(xx - 4, yy); ctx.lineTo(xx + 4, yy); ctx.stroke(); }
          // The crown: leaves out and over.
          for (let l = 0; l < 8; l++) {
            const a = -1.4 + l * 0.4 + rng.range(-0.1, 0.1), len = rng.range(70, 120);
            leaf(tx, ty + 6, tx + Math.sin(a) * len, ty - Math.cos(a) * len * 0.55 + len * 0.35, 4.5, l % 2 ? "#5f8f2f" : "#74a23a", Math.sin(a) * 10);
          }
          // Dry leaves on the lower stalk.
          leaf(x + dx, b - hgt * 0.4, x + dx - 24, b - hgt * 0.15, 3, "#b9a76a", -5);
          leaf(x + dx, b - hgt * 0.5, x + dx + 26, b - hgt * 0.2, 3, "#c4b377", 5);
        });
      }
    }
  }
  // ---- paddy: clumps of thin bright blades arching out.
  {
    const i = PLANT.strip.paddy!, b = base(i), top = i * H + P;
    for (let layer = 0; layer < 2; layer++) {
      for (let k = 0; k < 15; k++) {
        const cx = rng.next() * W;
        wrap(cx, 40, (dx) => {
          for (let bl = 0; bl < 11; bl++) {
            const a = rng.range(-0.9, 0.9), len = (b - top) * rng.range(0.45, 0.9);
            const tx = cx + dx + Math.sin(a) * len * 0.8, ty = b - Math.cos(a) * len;
            stalk(cx + dx + rng.range(-3, 3), b, tx, ty, Math.sin(a) * 14, 2.4, (bl + layer) % 3 ? "#7fb446" : "#9cd05a");
          }
        });
      }
    }
  }
  // ---- fodder (berseem / jowar): lush, broad leaves.
  {
    const i = PLANT.strip.fodder!, b = base(i), top = i * H + P;
    for (let k = 0; k < 44; k++) {
      const x = rng.next() * W, hgt = (b - top) * rng.range(0.4, 0.9), lean = rng.range(-16, 16);
      wrap(x, 40, (dx) => {
        stalk(x + dx, b, x + dx + lean, b - hgt, lean * 0.3, 2.4, "#4f8f2e");
        for (let l = 0; l < 4; l++) {
          const yy = b - hgt * (0.2 + l * 0.22), side = l % 2 ? 1 : -1;
          leaf(x + dx + lean * (l / 4), yy, x + dx + lean * (l / 4) + side * rng.range(16, 28), yy - rng.range(10, 20), 5.5, l % 2 ? "#5da13a" : "#6fb446", side * 4);
        }
      });
    }
  }
  // ---- Tree foliage: sprays of leaves, to be stood on cards in the canopy.
  const spray = (i: number, draw: (b: number, top: number) => void) => { const b = base(i), top = i * H + P; draw(b, top); };
  const mid = (i: number) => i * H + H / 2;
  // neem: pinnate sprays, many narrow leaflets down a curved stem.
  spray(PLANT.strip.neem!, () => {
    const cy = mid(PLANT.strip.neem!);
    for (let sp = 0; sp < 4; sp++) {
      const x0 = rng.range(20, 120), y0 = cy + rng.range(-40, 50), len = rng.range(300, 440), arc = rng.range(-50, 50);
      ctx.strokeStyle = "#4e6b2a"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.quadraticCurveTo(x0 + len / 2, y0 + arc, x0 + len, y0 + arc * 0.4); ctx.stroke();
      for (let k = 0; k < 15; k++) {
        const t = k / 14, px = x0 + len * t, py = y0 + arc * (2 * t * (1 - t)) + arc * 0.4 * t * t;
        for (const side of [-1, 1]) leaf(px, py, px + 12 + t * 8, py + side * (30 - t * 10), 5.5, k % 2 ? "#5a8a30" : "#6c9d3b", 0);
      }
    }
  });
  // peepal: heart-shaped leaves with long drip tips on slim stalks.
  spray(PLANT.strip.peepal!, () => {
    const cy = mid(PLANT.strip.peepal!);
    for (let k = 0; k < 26; k++) {
      const x = rng.range(30, W - 30), y = cy + rng.range(-85, 85), a = rng.range(0, Math.PI * 2), sz = rng.range(20, 30);
      ctx.save(); ctx.translate(x, y); ctx.rotate(a);
      ctx.fillStyle = k % 3 ? "#5e9a3a" : "#74ac48";
      ctx.beginPath(); ctx.moveTo(0, 0);
      ctx.bezierCurveTo(sz * 0.9, -sz * 0.3, sz * 0.8, sz * 0.9, 0, sz * 0.55);
      ctx.bezierCurveTo(-sz * 0.8, sz * 0.9, -sz * 0.9, -sz * 0.3, 0, 0);
      ctx.fill();
      ctx.beginPath(); ctx.moveTo(0, sz * 0.5); ctx.quadraticCurveTo(sz * 0.1, sz * 1.1, sz * 0.05, sz * 1.5); ctx.lineTo(-sz * 0.05, sz * 1.5); ctx.quadraticCurveTo(-sz * 0.1, sz * 1.1, 0, sz * 0.5); ctx.fill();
      ctx.strokeStyle = "#a6cf7d"; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, sz * 1.3); ctx.stroke();
      ctx.restore();
    }
  });
  // oval: shisham and mango, small to medium glossy leaves in bunches.
  spray(PLANT.strip.oval!, () => {
    const cy = mid(PLANT.strip.oval!);
    for (let k = 0; k < 64; k++) {
      const x = rng.range(24, W - 24), y = cy + rng.range(-90, 90), a = rng.range(0, Math.PI * 2), r = rng.range(9, 15);
      ctx.save(); ctx.translate(x, y); ctx.rotate(a);
      ctx.fillStyle = ["#4f8a2e", "#5f9a38", "#6aa843", "#437a28"][k % 4]!;
      ctx.beginPath(); ctx.ellipse(0, 0, r * 0.55, r, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = "rgba(190,220,140,.7)"; ctx.lineWidth = 0.9; ctx.beginPath(); ctx.moveTo(0, -r * 0.9); ctx.lineTo(0, r * 0.9); ctx.stroke();
      ctx.restore();
    }
  });
  // safeda: long narrow grey-green blades hanging down.
  spray(PLANT.strip.safeda!, () => {
    const cy = mid(PLANT.strip.safeda!);
    for (let k = 0; k < 30; k++) {
      const x = rng.range(20, W - 20), y = cy - 70 + rng.range(-20, 30), len = rng.range(80, 140);
      leaf(x, y, x + rng.range(-25, 25), y + len, 4, k % 2 ? "#7f9a6a" : "#93ad7d", rng.range(-18, 18));
    }
  });
  // kikar (acacia): fine feathery sprays and a few pale thorns.
  spray(PLANT.strip.kikar!, () => {
    const cy = mid(PLANT.strip.kikar!);
    for (let sp = 0; sp < 7; sp++) {
      const x0 = rng.range(10, W - 140), y0 = cy + rng.range(-70, 70), len = rng.range(110, 190), arc = rng.range(-40, 40);
      ctx.strokeStyle = "#6b6a3a"; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.quadraticCurveTo(x0 + len / 2, y0 + arc, x0 + len, y0 + arc * 0.6); ctx.stroke();
      for (let k = 0; k < 20; k++) {
        const t = k / 19, px = x0 + len * t, py = y0 + arc * (2 * t * (1 - t)) + arc * 0.6 * t * t;
        for (const side of [-1, 1]) { ctx.strokeStyle = k % 2 ? "#8da24f" : "#9fb35a"; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px + 5, py + side * 15); ctx.stroke(); }
      }
    }
  });
  // ---- Ground cover: a tuft of grass, and weeds with small flowers.
  {
    const i = PLANT.strip.grass!, b = base(i), top = i * H + P;
    for (let layer = 0; layer < 3; layer++) {
      for (let k = 0; k < 24; k++) {
        const cx = rng.next() * W;
        wrap(cx, 40, (dx) => {
          for (let bl = 0; bl < 7; bl++) {
            const a = rng.range(-0.8, 0.8), len = (b - top) * rng.range(0.4, 0.95) * (0.7 + layer * 0.15);
            const col = ["#6f8f36", "#7ea23f", "#5d7d2e", "#8fb04a", "#a2a95a"][(k + bl + layer) % 5]!;
            stalk(cx + dx + rng.range(-3, 3), b, cx + dx + Math.sin(a) * len * 0.7, b - Math.cos(a) * len, Math.sin(a) * 10, 2.2, col);
          }
        });
      }
    }
  }
  {
    const i = PLANT.strip.weeds!, b = base(i), top = i * H + P;
    for (let k = 0; k < 20; k++) {
      const x = rng.next() * W, hgt = (b - top) * rng.range(0.35, 0.8);
      wrap(x, 50, (dx) => {
        stalk(x + dx, b, x + dx + rng.range(-8, 8), b - hgt, 3, 1.8, "#5f8a34");
        for (let l = 0; l < 4; l++) leaf(x + dx, b - hgt * (0.15 + l * 0.2), x + dx + (l % 2 ? 20 : -20), b - hgt * (0.3 + l * 0.2), 5, l % 2 ? "#6f9a3d" : "#5a8a30", l % 2 ? 5 : -5);
        if (k % 2 === 0) { ctx.fillStyle = k % 4 === 0 ? "#f6f1d8" : "#f2d64a"; ctx.beginPath(); ctx.arc(x + dx, b - hgt - 3, 5, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = "#e1a21f"; ctx.beginPath(); ctx.arc(x + dx, b - hgt - 3, 2, 0, Math.PI * 2); ctx.fill(); }
      });
    }
  }
  return c;
}
