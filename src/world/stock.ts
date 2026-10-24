import { Matrix, Mesh } from "../babylon";
import type { Scene } from "../babylon";
import type { Materials } from "../render/Materials";
import { Rng as RngClass } from "../render/textures";
import type { OuterBuilding } from "./region";
import { GeoBuilder, rgb, shade, type RGB } from "../render/GeoBuilder";
import type { Rng } from "../render/textures";

/**
 * What is on the shelves of a city shop. A shop used to be rows of coloured boxes; now each trade stocks its own
 * things: bottles and jars, cartons with a label, rolls and folded stacks of cloth, tyres, books, phone boxes,
 * televisions, trays of sweets, hanging shawls. Local frame: x along the front (0..w), the shelves against the
 * back wall at z = -2.95, the counter in front of them. Everything is small and cheap (a few sides each).
 */

type Item = (g: GeoBuilder, x: number, y: number, z: number, rng: Rng, c: RGB) => number;

const P = (...h: string[]) => h.map(rgb);

const PALETTE = {
  bright: P("#c0392b", "#e67e22", "#f1c40f", "#27ae60", "#2980b9", "#8e44ad", "#ecf0f1", "#d35400"),
  cloth: P("#b3202a", "#1f5fa8", "#e0a526", "#2e8b57", "#7a3b8f", "#e9e4d6", "#d9534f", "#2b2f55", "#c76e1e", "#3aa6a0"),
  pharma: P("#f4f6f7", "#cfe8f3", "#f5e6c8", "#d9f0d8", "#e8d5e8", "#fff2cc"),
  book: P("#7a1f1f", "#1f3a7a", "#2f6b3a", "#c9a227", "#4a2f6b", "#8c4a1c", "#1c5f6b", "#a83255"),
  amber: P("#8c4a14", "#a8651f", "#2f6d3a", "#1f3a7a"),
  steel: P("#bfc5c9", "#aeb4b8", "#d3d8db"),
  gold: P("#d9a92a", "#e8c24a", "#c99a1f"),
  sweet: P("#e8a317", "#f2c14a", "#d9731f", "#f4e1b0", "#c24a1c"),
  tech: P("#1c1c20", "#26262c", "#d8d8dc", "#2d3a5c"),
};

const pick = <T,>(rng: Rng, a: readonly T[]): T => a[Math.floor(rng.next() * a.length) % a.length]!;

/** A bottle: a body, a shoulder, a neck and a cap. Returns its width. */
const bottle = (g: GeoBuilder, x: number, y: number, z: number, rng: Rng, c: RGB): number => {
  const h = rng.range(0.22, 0.34), r = rng.range(0.035, 0.05);
  g.cylinder(x, y, z, r, r, h * 0.62, 6, c, true);
  g.cylinder(x, y + h * 0.62, z, r, r * 0.4, h * 0.2, 6, c, false);
  g.cylinder(x, y + h * 0.82, z, r * 0.4, r * 0.4, h * 0.18, 5, rgb("#d9d4c4"), true);
  g.cylinder(x, y + h * 0.12, z, r * 1.02, r * 1.02, h * 0.3, 6, rgb("#f1ead6"), false);
  return r * 2 + 0.04;
};
const jar = (g: GeoBuilder, x: number, y: number, z: number, rng: Rng, c: RGB): number => {
  const h = rng.range(0.18, 0.3), r = rng.range(0.07, 0.1);
  g.cylinder(x, y, z, r, r, h, 7, c, true);
  g.cylinder(x, y + h, z, r * 1.04, r * 1.04, 0.035, 7, pick(rng, PALETTE.steel), true);
  g.cylinder(x, y + h * 0.25, z, r * 1.02, r * 1.02, h * 0.45, 7, rgb("#f4ead0"), false);
  return r * 2 + 0.03;
};
const carton = (g: GeoBuilder, x: number, y: number, z: number, rng: Rng, c: RGB): number => {
  const w = rng.range(0.12, 0.26), h = rng.range(0.16, 0.34), d = rng.range(0.12, 0.2);
  g.boxMinMax(x - w / 2, y, z - d / 2, x + w / 2, y + h, z + d / 2, c, 0b111111 & ~0b000100 & ~0b001000);
  // A lighter label band on the face you see, and a dark lid line.
  g.boxMinMax(x - w * 0.4, y + h * 0.3, z + d / 2, x + w * 0.4, y + h * 0.7, z + d / 2 + 0.004, shade(c, 1.45), 0b100000);
  g.boxMinMax(x - w / 2, y + h * 0.88, z + d / 2, x + w / 2, y + h * 0.9, z + d / 2 + 0.003, shade(c, 0.6), 0b100000);
  return w + 0.03;
};
const roll = (g: GeoBuilder, x: number, y: number, z: number, rng: Rng, c: RGB): number => {
  const len = rng.range(0.35, 0.5), r = rng.range(0.07, 0.1);
  g.cylinderZ(x, y + r, z, r, len, 8, c);
  g.cylinderZ(x, y + r, z, 0.012, len + 0.03, 4, rgb("#ddd2b0"));
  return r * 2 + 0.01;
};
/** A stack of folded cloth: a few slabs, each a little off the one below, in two colours. */
const stack = (g: GeoBuilder, x: number, y: number, z: number, rng: Rng, c: RGB): number => {
  const w = rng.range(0.3, 0.4), d = 0.28, n = rng.int(3, 6);
  for (let i = 0; i < n; i++) {
    const h = 0.045;
    const o = rng.range(-0.012, 0.012);
    g.boxMinMax(x - w / 2 + o, y + i * h, z - d / 2, x + w / 2 + o, y + (i + 1) * h - 0.004, z + d / 2, i % 2 ? shade(c, 1.12) : c, 0b101111);
  }
  return w + 0.05;
};
const sack = (g: GeoBuilder, x: number, y: number, z: number, rng: Rng, c: RGB): number => {
  const r = rng.range(0.15, 0.22);
  g.ellipsoid(x, y + r * 0.8, z, r, r * 0.85, r * 0.8, 7, 4, c, -0.2, 1, 0.3);
  g.cylinder(x, y + r * 1.55, z, r * 0.3, r * 0.22, 0.05, 6, shade(c, 0.7), true);
  return r * 2 + 0.04;
};
const tyre = (g: GeoBuilder, x: number, y: number, z: number, _rng: Rng, c: RGB): number => {
  g.torus(x, y + 0.34, z, 0.28, 0.1, 14, 6, [1, 1, 1], "x");
  g.cylinderZ(x, y + 0.34, z, 0.17, 0.12, 8, c);
  return 0.62;
};
const book = (g: GeoBuilder, x: number, y: number, z: number, rng: Rng, c: RGB): number => {
  const w = rng.range(0.03, 0.06), h = rng.range(0.18, 0.3), d = rng.range(0.14, 0.2);
  g.boxMinMax(x - w / 2, y, z - d / 2, x + w / 2, y + h, z + d / 2, c, 0b110011);
  g.boxMinMax(x - w / 2, y + h * 0.6, z + d / 2, x + w / 2, y + h * 0.7, z + d / 2 + 0.003, rgb("#e8d9a8"), 0b100000);
  return w + 0.006;
};
const phone = (g: GeoBuilder, x: number, y: number, z: number, rng: Rng, c: RGB): number => {
  const w = 0.09, h = 0.17, d = 0.05;
  g.boxMinMax(x - w / 2, y, z - d / 2, x + w / 2, y + h, z + d / 2, c, 0b110011);
  g.boxMinMax(x - w * 0.38, y + h * 0.18, z + d / 2, x + w * 0.38, y + h * 0.8, z + d / 2 + 0.003, rng.next() < 0.5 ? rgb("#101418") : rgb("#e8eef2"), 0b100000);
  return w + 0.01;
};
/** A television: a dark slab with a lit screen, on a small foot. */
const tv = (g: GeoBuilder, x: number, y: number, z: number, rng: Rng, _c: RGB): number => {
  const w = rng.range(0.5, 0.8), h = w * 0.58;
  g.boxMinMax(x - w / 2, y + 0.06, z - 0.05, x + w / 2, y + 0.06 + h, z + 0.05, [1, 1, 1], 0b100011 | 0b001100);
  g.boxMinMax(x - w / 2 + 0.03, y + 0.09, z + 0.05, x + w / 2 - 0.03, y + 0.03 + h, z + 0.054, rng.next() < 0.5 ? rgb("#5d8fb8") : rgb("#8aa56a"), 0b100000);
  g.boxMinMax(x - 0.12, y, z - 0.05, x + 0.12, y + 0.06, z + 0.05, rgb("#2b2b2e"));
  return w + 0.06;
};
const tray = (g: GeoBuilder, x: number, y: number, z: number, rng: Rng, c: RGB): number => {
  // A steel tray of round sweets.
  const w = 0.55;
  g.boxMinMax(x - w / 2, y, z - 0.2, x + w / 2, y + 0.04, z + 0.2, rgb("#c7ccd0"));
  for (let i = 0; i < 4; i++) for (let j = 0; j < 2; j++) g.ellipsoid(x - w / 2 + 0.08 + i * 0.13, y + 0.07, z - 0.1 + j * 0.2, 0.055, 0.045, 0.055, 6, 3, shade(c, rng.range(0.9, 1.1)), -0.2, 1, 0);
  return w + 0.04;
};
const coil = (g: GeoBuilder, x: number, y: number, z: number, _rng: Rng, c: RGB): number => {
  // A heap of jalebi: orange coils.
  for (let i = 0; i < 6; i++) g.torus(x + Math.cos(i * 1.1) * 0.06, y + 0.05 + (i % 2) * 0.05, z + Math.sin(i * 1.1) * 0.06, 0.05, 0.016, 8, 4, c);
  return 0.3;
};
const gem = (g: GeoBuilder, x: number, y: number, z: number, rng: Rng, c: RGB): number => {
  // A velvet bust with a necklace, or a gold bangle on a stand.
  if (rng.next() < 0.5) {
    g.cylinder(x, y, z, 0.09, 0.06, 0.2, 6, [0.4, 0.05, 0.1], true);
    g.torus(x, y + 0.14, z, 0.08, 0.012, 10, 4, c);
  } else {
    g.cylinder(x, y, z, 0.05, 0.05, 0.14, 6, [0.4, 0.05, 0.1], true);
    for (let i = 0; i < 4; i++) g.torus(x, y + 0.04 + i * 0.03, z, 0.06, 0.008, 10, 4, c);
  }
  return 0.22;
};
const hanging = (g: GeoBuilder, x: number, y: number, z: number, rng: Rng, c: RGB): number => {
  // A shawl or a suit length on a hanger: a drape of cloth, a stripe at the hem.
  const w = rng.range(0.4, 0.55), h = rng.range(0.7, 1.0);
  g.cylinderX(x, y + h + 0.02, z, 0.008, w + 0.08, 4, rgb("#9aa0a4"));
  g.boxMinMax(x - w / 2, y, z - 0.02, x + w / 2, y + h, z + 0.02, c);
  g.boxMinMax(x - w / 2, y, z + 0.02, x + w / 2, y + 0.08, z + 0.024, shade(c, 0.55), 0b100000);
  return w + 0.05;
};
const machine = (g: GeoBuilder, x: number, y: number, z: number, rng: Rng, c: RGB): number => {
  const w = rng.range(0.4, 0.7), h = rng.range(0.4, 0.8);
  g.boxMinMax(x - w / 2, y, z - 0.22, x + w / 2, y + h, z + 0.22, c);
  g.boxMinMax(x - w * 0.3, y + h * 0.5, z + 0.22, x + w * 0.3, y + h * 0.85, z + 0.225, [1, 1, 1], 0b100000);
  g.cylinder(x + w * 0.3, y + h, z, 0.05, 0.05, 0.1, 6, rgb("#c62828"), true);
  return w + 0.08;
};

interface Plan { tiers: number; items: Array<[Item, readonly RGB[], number]>; counter?: Array<[Item, readonly RGB[]]> }

const PLANS: Record<string, Plan> = {
  cMithai: { tiers: 2, items: [[carton, PALETTE.sweet, 3], [jar, PALETTE.bright, 1], [tray, PALETTE.sweet, 2]], counter: [[tray, PALETTE.sweet], [coil, PALETTE.sweet]] },
  cMobile: { tiers: 3, items: [[phone, PALETTE.tech.concat(PALETTE.bright), 6], [carton, PALETTE.tech, 1]], counter: [[phone, PALETTE.bright]] },
  cCloth: { tiers: 3, items: [[roll, PALETTE.cloth, 3], [stack, PALETTE.cloth, 3], [hanging, PALETTE.cloth, 1]] },
  lHosiery: { tiers: 3, items: [[stack, PALETTE.cloth, 4], [carton, PALETTE.cloth, 2], [roll, PALETTE.cloth, 1]] },
  lKnit: { tiers: 3, items: [[stack, PALETTE.cloth, 5], [hanging, PALETTE.cloth, 2]] },
  lShawl: { tiers: 2, items: [[hanging, PALETTE.cloth, 4], [stack, PALETTE.cloth, 2]] },
  cElectro: { tiers: 2, items: [[tv, PALETTE.tech, 3], [carton, PALETTE.tech.concat(PALETTE.steel), 3]] },
  cJewel: { tiers: 2, items: [[gem, PALETTE.gold, 1]], counter: [[gem, PALETTE.gold]] },
  cTyre: { tiers: 1, items: [[tyre, PALETTE.steel, 1]] },
  cHotel: { tiers: 2, items: [[jar, PALETTE.steel, 2], [bottle, PALETTE.amber, 2], [carton, PALETTE.bright, 1]] },
  cDhaba: { tiers: 2, items: [[jar, PALETTE.steel, 3], [sack, PALETTE.cloth, 1], [carton, PALETTE.bright, 1]] },
  cLassi: { tiers: 2, items: [[jar, PALETTE.steel, 3], [bottle, PALETTE.bright, 2], [tray, PALETTE.sweet, 1]] },
  cMedical: { tiers: 3, items: [[carton, PALETTE.pharma, 4], [bottle, PALETTE.amber, 3]], counter: [[bottle, PALETTE.amber]] },
  cBooks: { tiers: 3, items: [[book, PALETTE.book, 1]] },
  cSalon: { tiers: 1, items: [[bottle, PALETTE.bright, 3], [jar, PALETTE.steel, 1]] },
  lCycle: { tiers: 2, items: [[tyre, PALETTE.steel, 2], [carton, PALETTE.steel, 2]] },
  lMachine: { tiers: 2, items: [[machine, PALETTE.steel, 1]] },
};

/** Stock the shelves of a shopfront `w` wide. Falls back to a general store for a trade it does not know. */
export function shopStock(g: GeoBuilder, shop: string, w: number, rng: Rng, lean = false): void {
  const plan = PLANS[shop] ?? { tiers: 3, items: [[carton, PALETTE.bright, 3], [jar, PALETTE.bright, 2], [bottle, PALETTE.amber, 1]] as Array<[Item, readonly RGB[], number]> };
  const total = plan.items.reduce((s, i) => s + i[2], 0);
  const zBack = -2.78;
  const tiers = plan.tiers;
  for (let t = 0; t < tiers; t++) {
    const y = tiers === 1 ? 0.04 : 0.56 + t * (tiers === 2 ? 1.0 : 0.78);
    if (tiers > 1 || plan.items[0]![0] !== tyre) g.boxMinMax(0.4, y - 0.04, -2.95, w - 0.4, y, -2.55, rgb("#6e4b2c"));
    // Fill the shelf from the left, an item after another with a small gap.
    let x = 0.55;
    while (x < w - 0.55) {
      let r = rng.next() * total, it = plan.items[0]!;
      for (const i of plan.items) { r -= i[2]; if (r <= 0) { it = i; break; } }
      // A tyre stack runs floor to ceiling: three high.
      if (it[0] === tyre) {
        for (let k = 0; k < 3; k++) it[0](g, x + 0.3, 0.04 + k * 0.62, -2.62, rng, pick(rng, it[1]));
        x += 0.66;
        continue;
      }
      const c = pick(rng, it[1]);
      const adv = it[0](g, x + 0.12, y, zBack + rng.range(-0.04, 0.04), rng, shade(c, rng.range(0.88, 1.1)));
      x += adv + rng.range(0, 0.05) + (lean ? 0.2 : 0);
      if (it[0] === hanging || it[0] === tv) { /* tall or wide things take the shelf's height: carry on */ }
    }
    // The tyre shop is a single floor-to-ceiling tier.
    if (plan.items[0]![0] === tyre) break;
  }
  // Things on the counter, in front of the shopkeeper: a few, spaced.
  if (plan.counter) {
    let x = 1.0;
    while (x < w - 1.0) {
      const [it, cols] = plan.counter[Math.floor(rng.next() * plan.counter.length)]!;
      x += it(g, x, 0.95, -1.15, rng, pick(rng, cols)) + 0.15;
    }
  }
}

/** The matrix of a shopfront's own frame (x along the front, z out of it), like Kit.frame at the front-left corner. */
function frontMatrix(b: OuterBuilding): { m: Matrix; w: number } {
  const f = b.face, eps = 1e-3;
  let x = b.x1, z = b.z1, rot = Math.PI / 2, w = b.z1 - b.z0;
  if (Math.abs(f) < eps) { x = b.x0; z = b.z1; rot = 0; w = b.x1 - b.x0; }
  else if (Math.abs(f - Math.PI) < eps) { x = b.x1; z = b.z0; rot = Math.PI; w = b.x1 - b.x0; }
  else if (Math.abs(f + Math.PI / 2) < eps) { x = b.x0; z = b.z0; rot = -Math.PI / 2; w = b.z1 - b.z0; }
  return { m: Matrix.RotationY(rot).multiply(Matrix.Translation(x, 0, z)), w };
}

const CIVIC_KEYS = new Set(["cBank", "cAtm", "cPost"]);

/**
 * The goods are small and a shop has hundreds of vertices of them, and there are two hundred and fifty shops: so
 * they are made for the shops near the player and dropped again behind, one mesh each.
 */
export class StockStreamer {
  private live = new Map<OuterBuilding, Mesh>();
  private shops: OuterBuilding[];
  range = 60;
  lean = false;

  constructor(private scene: Scene, private mats: Materials, buildings: OuterBuilding[]) {
    this.shops = buildings.filter((b) => b.style === "city" && b.shop && !CIVIC_KEYS.has(b.shop));
  }

  update(x: number, z: number, maxBuilds = 2): void {
    const near: Array<{ b: OuterBuilding; d: number }> = [];
    for (const b of this.shops) {
      const d = Math.hypot((b.x0 + b.x1) / 2 - x, (b.z0 + b.z1) / 2 - z);
      const m = this.live.get(b);
      if (m) { if (d > this.range + 40) { m.dispose(); this.live.delete(b); } }
      else if (d < this.range) near.push({ b, d });
    }
    near.sort((a, c) => a.d - c.d);
    for (const { b } of near.slice(0, maxBuilds)) {
      const g = new GeoBuilder(1);
      const { m, w } = frontMatrix(b);
      g.setTransform(m);
      shopStock(g, b.shop!, w, new RngClass(b.seed * 13 + 7), this.lean);
      if (g.isEmpty()) continue;
      const mesh = g.toMesh(`stock_${b.id}`, this.scene, this.mats.get("paint"));
      mesh.isPickable = false;
      mesh.receiveShadows = true;
      mesh.freezeWorldMatrix();
      this.live.set(b, mesh);
    }
  }

  clear(): void {
    for (const m of this.live.values()) m.dispose();
    this.live.clear();
  }
}
