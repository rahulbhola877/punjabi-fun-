import { Mesh, Vector3 } from "../babylon";
import type { Scene } from "../babylon";
import { GeoBuilder, mix, rgb, shade, type RGB } from "../render/GeoBuilder";
import type { Materials } from "../render/Materials";
import { PLANT, Rng } from "../render/textures";
import type { Plot } from "./region";
import { fieldNow, type FieldNow } from "./Calendar";
import { farmLandmark } from "./farmCorner";
import { RectIndex } from "./RectIndex";

/**
 * The plants in a field. Each row is a gently bending ribbon of cut-out plants (textures.ts plantAtlas) seen from any
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
  // A mature rice plant reaches roughly waist height, rather than the tiny
  // seedlings the old 0.45 m cap produced even at harvest. Calendar growth
  // still scales the new height down when the rice is young.
  const height = crop === "sugarcane" ? 2.7 : crop === "sarson" ? 1.15 : crop === "wheat" ? 0.95 : crop === "paddy" ? 0.85 : crop === "fodder" ? 0.4 : 0;
  return { spacing: base * (lean ? 1.7 : 1.25), height, seg: lean ? 4.4 : 2.6 };
}

/** Add the rows of a plot to a builder (world coordinates). Returns the vertex count it added. */
export function buildCropCards(g: GeoBuilder, p: Plot, lean: boolean, now?: FieldNow): number {
  const crop = now?.crop ?? p.crop;
  const grow = now?.grow ?? 1;
  if (crop === "fallow") return 0;
  const before = g.vertexCount;
  const landmark = farmLandmark(p);
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
  // A little lateral bend makes the flat cards visible from different angles.
  // Each row has its own slow drift; large, synchronised alternating bends made
  // the whole field look like a repeated chevron pattern from above.
  const amp = Math.min(0.25, spacing * 0.17);
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
    const phase = rowRng.range(0, Math.PI * 2);
    const frequency = rowRng.range(0.23, 0.42);
    const crossEvery = crop === "paddy" ? 3 : 5;
    const crossOffset = rowRng.int(0, crossEvery - 1);
    let flip = rowRng.next() < 0.5 ? 1 : -1;
    // Two vertices a column (foot and head), shared by the cards either side of it.
    let prev: [number, number] | null = null;
    let prevPos: [number, number, number, number] | null = null;
    for (let k = 0; k <= n; k++) {
      const t = along0 + k * step;
      const lat = a + amp * (0.55 * Math.sin(k * frequency + phase) + 0.45 * flip);
      flip = -flip;
      const lean2 = (lat - a) * 0.35;
      const P = (tt: number, l: number, y: number): [number, number, number] => (along ? [cx + tt, y, cz + l] : [cx + l, y, cz + tt]);
      const u = (t - along0) / tile;
      const f = P(t, lat, 0), h = P(t, lat + lean2, hh);
      const i0 = g.vertex(f[0], f[1], f[2], 0, 1, 0, u, vBot, tint);
      const i1 = g.vertex(h[0], h[1], h[2], 0, 1, 0, u, vTop, tint);
      // Leave a walkable clearing around the landmark, including the leaning
      // tops of the row cards. Existing fields without landmarks are unchanged.
      const blocked = landmark && prevPos &&
        Math.min(prevPos[0], prevPos[2], f[0], h[0]) < landmark.x + 2.3 && Math.max(prevPos[0], prevPos[2], f[0], h[0]) > landmark.x - 2.3 &&
        Math.min(prevPos[1], prevPos[3], f[2], h[2]) < landmark.z + 2.3 && Math.max(prevPos[1], prevPos[3], f[2], h[2]) > landmark.z - 2.3;
      if (prev && !blocked) { g.tri(prev[0], i0, i1); g.tri(prev[0], i1, prev[1]); }
      // Short cross-cards give the plants depth when looking down the row.
      // They are sparse and restricted to the full preset so the low-quality
      // streamer retains its old vertex budget. Their feet remain in the same
      // cultivated row, and the landmark clearance applies to them too.
      if (!lean && k > 0 && k < n && k % crossEvery === crossOffset) {
        const half = Math.min(0.35, spacing * 0.22);
        const outsideLandmark = !landmark || Math.abs(f[0] - landmark.x) > 2.3 + half || Math.abs(f[2] - landmark.z) > 2.3 + half;
        if (outsideLandmark) {
          const left = P(t, lat - half, 0), right = P(t, lat + half, 0);
          const high = hh * 0.8;
          const crossW = Math.max(0.2, half * 2 / tile);
          // Match the row-card normals. Side normals shaded the crossing
          // cards almost black, making a conspicuous grid of dark squares.
          const j0 = g.vertex(left[0], 0, left[2], 0, 1, 0, u, vBot, tint);
          const j1 = g.vertex(right[0], 0, right[2], 0, 1, 0, u + crossW, vBot, tint);
          const j2 = g.vertex(right[0], high, right[2], 0, 1, 0, u + crossW, vTop, tint);
          const j3 = g.vertex(left[0], high, left[2], 0, 1, 0, u, vTop, tint);
          g.tri(j0, j1, j2); g.tri(j0, j2, j3);
        }
      }
      prev = [i0, i1];
      prevPos = [f[0], f[2], h[0], h[2]];
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

/**
 * Seasonal cover for a rotated crop. The baked field tint represents the
 * plot's original crop, but a wheat field becomes paddy in the wet season.
 * A small, softly varied ground mesh makes the visible crop and its field
 * agree, instead of showing green rice as thin lines across a tan wheat plot.
 * It is visual only, and stays below paths, bunds and farm props.
 */
export function buildSeasonCover(g: GeoBuilder, p: Plot, now: FieldNow): void {
  if (now.crop === "fallow" || now.crop === p.crop) return;
  const palette: Record<Exclude<Plot["crop"], "fallow">, RGB> = {
    paddy: rgb("#91a16d"), wheat: rgb("#aea075"),
    sarson: rgb("#9fa56e"), sugarcane: rgb("#809c63"), fodder: rgb("#829e66"),
  };
  const base = palette[now.crop];
  const x0 = p.x0 + 0.55, x1 = p.x1 - 0.55, z0 = p.z0 + 0.55, z1 = p.z1 - 0.55;
  if (x1 <= x0 || z1 <= z0) return;
  // Shared vertices smoothly interpolate the natural changes in crop growth;
  // the field still has real rows, rather than a high contrast checkerboard.
  const cellsX = Math.max(1, Math.ceil((x1 - x0) / 24));
  const cellsZ = Math.max(1, Math.ceil((z1 - z0) / 24));
  const ids: number[][] = [];
  for (let z = 0; z <= cellsZ; z++) {
    const row: number[] = [];
    for (let x = 0; x <= cellsX; x++) {
      const wx = x0 + (x1 - x0) * x / cellsX, wz = z0 + (z1 - z0) * z / cellsZ;
      const variation = 0.96 + 0.06 * Math.sin(x * 1.63 + z * 2.37 + p.seed * 0.41);
      row.push(g.vertex(wx, 0.006, wz, 0, 1, 0, wx / 5, wz / 5, shade(base, variation)));
    }
    ids.push(row);
  }
  for (let z = 0; z < cellsZ; z++) for (let x = 0; x < cellsX; x++) {
    const a = ids[z]![x]!, b = ids[z]![x + 1]!, c = ids[z + 1]![x + 1]!, d = ids[z + 1]![x]!;
    g.tri(a, b, c); g.tri(a, c, d);
  }
}

/** Blend the replacement into the distant baked ground as crops stream out. */
export function seasonCoverOpacity(distance: number, range: number): number {
  return Math.max(0, Math.min(1, (range - distance) / 35));
}

/** Makes the plants for the fields near the player and drops them again behind. */
export class CropStreamer {
  private live = new Map<Plot, Mesh>();
  private coverLive = new Map<Plot, Mesh>();
  /** Bare earth over the fields that stand empty this month; seen from further off than the plants. */
  private bareLive = new Map<Plot, Mesh>();
  private month = 0;
  private dom = 0;
  /** Metres from the player within which an empty field shows its furrows. */
  bareRange = 420;
  /** Metres from the player within which a field has its plants. */
  range = 150;
  lean = false;

  private plotIndex: RectIndex<Plot>;

  constructor(private scene: Scene, private mats: Materials, plots: Plot[]) {
    this.plotIndex = new RectIndex(plots, 160);
  }

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
    const radius = Math.max(this.range, this.bareRange);
    const candidates = new Set(this.plotIndex.inRect({ x0: pos.x - radius, x1: pos.x + radius, z0: pos.z - radius, z1: pos.z + radius }));
    // Existing meshes must still be visited after a long teleport to dispose
    // them, even when their plot is outside the nearby index query.
    for (const p of this.live.keys()) candidates.add(p);
    for (const p of this.bareLive.keys()) candidates.add(p);
    for (const p of candidates) {
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
      if (m) {
        const cover = this.coverLive.get(p);
        if (cover) cover.visibility = seasonCoverOpacity(d, this.range);
        if (d > this.range + 60) { m.dispose(); this.live.delete(p); cover?.dispose(); this.coverLive.delete(p); }
      }
      else if (d < this.range) near.push({ p, d });
    }
    near.sort((a, b) => a.d - b.d);
    for (const { p, d } of near.slice(0, maxBuilds)) {
      const g = new GeoBuilder(1);
      buildCropCards(g, p, this.lean, fieldNow(p.crop, this.month, this.dom));
      if (g.isEmpty()) continue;
      const m = g.toMesh(`crop_${p.id}`, this.scene, this.mats.get("plant"));
      m.isPickable = false;
      m.receiveShadows = true;
      m.freezeWorldMatrix();
      this.live.set(p, m);
      if (fieldNow(p.crop, this.month, this.dom).crop !== p.crop) {
        const cover = new GeoBuilder(5);
        buildSeasonCover(cover, p, fieldNow(p.crop, this.month, this.dom));
        if (!cover.isEmpty()) {
          const ground = cover.toMesh(`crop_cover_${p.id}`, this.scene, this.mats.get("fieldCover"));
          ground.isPickable = false; ground.visibility = seasonCoverOpacity(d, this.range); ground.freezeWorldMatrix(); this.coverLive.set(p, ground);
        }
      }
    }
  }

  /** Drop everything (a new game, a change of preset). */
  clear(): void {
    for (const m of this.live.values()) m.dispose();
    this.live.clear();
    for (const m of this.bareLive.values()) m.dispose();
    this.bareLive.clear();
    for (const m of this.coverLive.values()) m.dispose();
    this.coverLive.clear();
  }
}
