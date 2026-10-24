import { Mesh, Vector3 } from "../babylon";
import type { Scene } from "../babylon";
import { GeoBuilder, mix, shade, type RGB } from "../render/GeoBuilder";
import type { Materials } from "../render/Materials";
import { PLANT, Rng } from "../render/textures";
import type { Plot } from "./region";
import { fieldNow, type FieldNow } from "./Calendar";

/**
 * The plants in a field. Each row is a zig-zag ribbon of cut-out plants (textures.ts plantAtlas) seen from any
 * side. A field has about a thousand vertices of them and there are a thousand fields, so the plants are not
 * baked into the world: they are made for the fields near the player and dropped again as they fall behind
 * (`CropStreamer`). Far off, a field is its coloured ground, which is how a field looks from far off anyway.
 */

export const CROP_TINT: Record<Plot["crop"], RGB> = {
  wheat: [0.98, 0.94, 0.82], sarson: [1, 1, 0.9], sugarcane: [0.95, 1, 0.9], paddy: [0.95, 1, 0.92], fodder: [0.95, 1, 0.9], fallow: [1, 1, 1],
};

/** The row spacing, height and shape of each crop (metres). */
export function cropShape(crop: Plot["crop"], lean: boolean): { spacing: number; height: number; seg: number } {
  const base = crop === "sugarcane" ? 1.7 : crop === "fodder" ? 1.1 : crop === "paddy" ? 0.9 : 1.25;
  const height = crop === "sugarcane" ? 2.7 : crop === "sarson" ? 1.15 : crop === "wheat" ? 0.95 : crop === "paddy" ? 0.45 : crop === "fodder" ? 0.4 : 0;
  return { spacing: base * (lean ? 1.7 : 1.25), height, seg: lean ? 4.4 : 2.6 };
}

/** Add the rows of a plot to a builder (world coordinates). Returns the vertex count it added. */
export function buildCropCards(g: GeoBuilder, p: Plot, lean: boolean, now?: FieldNow): number {
  const crop = now?.crop ?? p.crop;
  const grow = now?.grow ?? 1;
  if (crop === "fallow") return 0;
  const before = g.vertexCount;
  const cx = (p.x0 + p.x1) / 2, cz = (p.z0 + p.z1) / 2;
  const hx = (p.x1 - p.x0) / 2, hz = (p.z1 - p.z0) / 2;
  const along = p.rowsAlongX;
  const shape = cropShape(crop, lean);
  const { spacing, seg } = shape;
  // A young crop is short; the nearer it gets to harvest the taller it is.
  const height = shape.height * (0.22 + 0.78 * grow);
  const span = along ? hz : hx;
  const rowRng = new Rng(p.seed * 29 + 3);
  const strip = PLANT.strip[crop]!;
  const vTop = (strip * PLANT.h + PLANT.pad) / (PLANT.h * PLANT.rows), vBot = ((strip + 1) * PLANT.h - PLANT.pad) / (PLANT.h * PLANT.rows);
  const amp = Math.min(0.42, spacing * 0.26);
  const along0 = -(along ? hx : hz) + 1, along1 = (along ? hx : hz) - 1;
  const len = along1 - along0;
  const n = Math.max(1, Math.round(len / seg));
  const step = len / n;
  const base = CROP_TINT[crop];
  // Ripe grain turns gold.
  const ripe = crop === "wheat" || crop === "paddy" ? Math.max(0, (grow - 0.85) / 0.15) : 0;
  for (let a = -span + 1.2; a < span - 1.0; a += spacing) {
    const hh = height * rowRng.range(0.9, 1.08);
    const tint = shade(mix(mix([1, 1, 1], base, 0.6), [1, 0.88, 0.5], ripe * 0.55), rowRng.range(0.88, 1.06));
    const tile = hh * 2.0;
    let flip = rowRng.next() < 0.5 ? 1 : -1;
    // Two vertices a column (foot and head), shared by the cards either side of it.
    let prev: [number, number] | null = null;
    for (let k = 0; k <= n; k++) {
      const t = along0 + k * step;
      const lat = a + amp * flip;
      flip = -flip;
      const lean2 = (lat - a) * 0.35;
      const P = (tt: number, l: number, y: number): [number, number, number] => (along ? [cx + tt, y, cz + l] : [cx + l, y, cz + tt]);
      const u = (t - along0) / tile;
      const f = P(t, lat, 0), h = P(t, lat + lean2, hh);
      const i0 = g.vertex(f[0], f[1], f[2], 0, 1, 0, u, vBot, tint);
      const i1 = g.vertex(h[0], h[1], h[2], 0, 1, 0, u, vTop, tint);
      if (prev) { g.tri(prev[0], i0, i1); g.tri(prev[0], i1, prev[1]); }
      prev = [i0, i1];
    }
  }
  return g.vertexCount - before;
}

/** A cut or not yet sown field: a patch of earth with furrows over the green the world was built with. */
export function buildBare(g: GeoBuilder, p: Plot): void {
  const cx = (p.x0 + p.x1) / 2, cz = (p.z0 + p.z1) / 2;
  const hx = (p.x1 - p.x0) / 2 - 0.4, hz = (p.z1 - p.z0) / 2 - 0.4;
  const soil: RGB = [0.5, 0.39, 0.28], furrow = shade(soil, 0.8);
  const quad = (x0: number, z0: number, x1: number, z1: number, y: number, c: RGB) =>
    g.quad(new Vector3(cx + x0, y, cz + z0), new Vector3(cx + x1, y, cz + z0), new Vector3(cx + x1, y, cz + z1), new Vector3(cx + x0, y, cz + z1), c);
  quad(-hx, -hz, hx, hz, 0.03, soil);
  const along = p.rowsAlongX, span = along ? hz : hx;
  for (let a = -span + 1; a < span - 1; a += 1.15) {
    if (along) quad(-hx + 0.6, a - 0.22, hx - 0.6, a + 0.22, 0.04, furrow);
    else quad(a - 0.22, -hz + 0.6, a + 0.22, hz - 0.6, 0.04, furrow);
  }
}

/** Makes the plants for the fields near the player and drops them again behind. */
export class CropStreamer {
  private live = new Map<Plot, Mesh>();
  /** Bare earth over the fields that stand empty this month; seen from further off than the plants. */
  private bareLive = new Map<Plot, Mesh>();
  private month = 0;
  private dom = 0;
  /** Metres from the player within which an empty field shows its furrows. */
  bareRange = 420;
  /** Metres from the player within which a field has its plants. */
  range = 150;
  lean = false;

  constructor(private scene: Scene, private mats: Materials, private plots: Plot[]) {}

  get count(): number { return this.live.size; }

  /** The month changed: fields are sown, grown, cut. Everything is made again for the new month. */
  setDate(month: number, dom: number): void {
    if (month === this.month && dom === this.dom) return;
    const monthChanged = month !== this.month || (month === 6 && (dom < 1) !== (this.dom < 1));
    this.month = month; this.dom = dom;
    if (monthChanged) this.clear();
  }

  /** Call a couple of times a second with the player's (or camera's) position. */
  update(pos: Vector3, maxBuilds = 3): void {
    const near: Array<{ p: Plot; d: number }> = [];
    let bareBuilds = maxBuilds * 2;
    for (const p of this.plots) {
      if (p.crop === "fallow") continue;
      const dx = Math.max(p.x0 - pos.x, 0, pos.x - p.x1), dz = Math.max(p.z0 - pos.z, 0, pos.z - p.z1);
      const d = Math.hypot(dx, dz);
      const now = fieldNow(p.crop, this.month, this.dom);
      if (now.crop === "fallow") {
        const b = this.bareLive.get(p);
        if (b) { if (d > this.bareRange + 80) { b.dispose(); this.bareLive.delete(p); } }
        else if (d < this.bareRange && bareBuilds > 0) {
          bareBuilds--;
          const g = new GeoBuilder(1);
          buildBare(g, p);
          const bm = g.toMesh(`bare_${p.id}`, this.scene, this.mats.get("dirt"));
          bm.isPickable = false;
          bm.receiveShadows = true;
          bm.freezeWorldMatrix();
          this.bareLive.set(p, bm);
        }
        continue;
      }
      const m = this.live.get(p);
      if (m) { if (d > this.range + 60) { m.dispose(); this.live.delete(p); } }
      else if (d < this.range) near.push({ p, d });
    }
    near.sort((a, b) => a.d - b.d);
    for (const { p } of near.slice(0, maxBuilds)) {
      const g = new GeoBuilder(1);
      buildCropCards(g, p, this.lean, fieldNow(p.crop, this.month, this.dom));
      if (g.isEmpty()) continue;
      const m = g.toMesh(`crop_${p.id}`, this.scene, this.mats.get("plant"));
      m.isPickable = false;
      m.receiveShadows = true;
      m.freezeWorldMatrix();
      this.live.set(p, m);
    }
  }

  /** Drop everything (a new game, a change of preset). */
  clear(): void {
    for (const m of this.live.values()) m.dispose();
    this.live.clear();
    for (const m of this.bareLive.values()) m.dispose();
    this.bareLive.clear();
  }
}
