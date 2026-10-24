import { Mesh } from "../babylon";
import type { Scene, Vector3 } from "../babylon";
import { GeoBuilder, type RGB } from "../render/GeoBuilder";
import type { Materials } from "../render/Materials";
import { PLANT } from "../render/textures";
import type { Rect } from "./layout";
import { CITY, LUDHIANA, PLOTS, SITES, TOWN, VILLAGE, isOpenCountry, onRoad } from "./region";

/**
 * Ground cover: grass tufts and small weeds on open ground near the player, thicker along the road verges and
 * in patches, with none on tarmac, in fields, in a built-up street or on a paved site. They are made for a disc
 * round the player and made again when the player has walked a way (`update`), each tuft growing in toward the
 * edge so nothing pops. Which cells get a tuft depends only on the cell, so the grass stays where it was.
 */

const CELL = 0.8;
const hash = (a: number, b: number) => {
  let h = (Math.imul(a, 374761393) + Math.imul(b, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

const BUILT: Rect[] = [TOWN, CITY, LUDHIANA, VILLAGE];
const PAVED_SITES = SITES.filter((s) => s.kind !== "park" && s.kind !== "colonyPark" && s.kind !== "toba");
const inRect = (r: Rect, x: number, z: number, pad = 0) => x > r.x0 - pad && x < r.x1 + pad && z > r.z0 - pad && z < r.z1 + pad;

/** Is there bare ground here for grass to grow in? */
export function grassy(x: number, z: number, plots: Rect[]): boolean {
  if (!isOpenCountry(x, z)) return false;
  for (const r of BUILT) if (inRect(r, x, z)) return false;
  for (const s of PAVED_SITES) if (inRect(s, x, z, 1)) return false;
  if (onRoad(x, z, 0.6)) return false;
  for (const p of plots) if (inRect(p, x, z, 0.2)) return false;
  return true;
}

/** Build the tufts of a disc round (px, pz) into `g`. Returns the number of tufts. */
export function buildGrass(g: GeoBuilder, px: number, pz: number, radius: number, density: number, plots: Rect[]): number {
  const strip = (name: string) => {
    const i = PLANT.strip[name]!;
    return { v1: (i * PLANT.h + PLANT.pad) / (PLANT.h * PLANT.rows), v0: ((i + 1) * PLANT.h - PLANT.pad) / (PLANT.h * PLANT.rows) };
  };
  const grass = strip("grass"), weeds = strip("weeds");
  const i0 = Math.floor((px - radius) / CELL), i1 = Math.ceil((px + radius) / CELL), j0 = Math.floor((pz - radius) / CELL), j1 = Math.ceil((pz + radius) / CELL);
  let n = 0;
  for (let i = i0; i <= i1; i++) {
    for (let j = j0; j <= j1; j++) {
      const r = hash(i, j);
      const x = (i + hash(i + 7, j)) * CELL, z = (j + hash(i, j + 13)) * CELL;
      const d = Math.hypot(x - px, z - pz);
      if (d > radius) continue;
      // Patchy: a slow wave over the ground decides where it is thick; the verges are always thicker.
      const patch = 0.5 + 0.5 * Math.sin(x * 0.047 + Math.sin(z * 0.031) * 2) * Math.sin(z * 0.053 - x * 0.021);
      const verge = onRoad(x, z, 4.5) ? 0.35 : 0;
      if (r > (0.5 + patch * 0.5 + verge) * density) continue;
      if (!grassy(x, z, plots)) continue;
      // Grows in over the last fifth of the radius.
      const grow = Math.min(1, (radius - d) / (radius * 0.2));
      const kind = hash(i + 91, j + 5) < 0.2 ? weeds : grass;
      const h = (0.35 + hash(i + 3, j + 11) * 0.45) * grow * (kind === weeds ? 0.9 : 1);
      const w = (0.55 + hash(i + 17, j + 3) * 0.4) * (kind === weeds ? 0.8 : 1);
      const tint: RGB = [0.82 + hash(i, j + 29) * 0.3, 0.9 + hash(i + 5, j) * 0.2, 0.7 + hash(i + 2, j + 2) * 0.3];
      // Two crossed cards.
      for (const a of [hash(i, j + 41) * Math.PI, hash(i, j + 41) * Math.PI + 1.57]) {
        const dx = Math.cos(a) * w / 2, dz = Math.sin(a) * w / 2;
        const v = [
          g.vertex(x - dx, 0, z - dz, 0, 1, 0, 0, kind.v0, tint), g.vertex(x + dx, 0, z + dz, 0, 1, 0, 1, kind.v0, tint),
          g.vertex(x + dx, h, z + dz, 0, 1, 0, 1, kind.v1, tint), g.vertex(x - dx, h, z - dz, 0, 1, 0, 0, kind.v1, tint),
        ];
        g.tri(v[0]!, v[1]!, v[2]!);
        g.tri(v[0]!, v[2]!, v[3]!);
      }
      n++;
    }
  }
  return n;
}

export class GrassStreamer {
  private mesh: Mesh | null = null;
  private at: { x: number; z: number } | null = null;
  radius = 30;
  density = 1;

  constructor(private scene: Scene, private mats: Materials) {}

  update(pos: Vector3): void {
    if (this.at && Math.hypot(pos.x - this.at.x, pos.z - this.at.z) < this.radius * 0.22) return;
    this.rebuild(pos.x, pos.z);
  }

  rebuild(x: number, z: number): void {
    this.mesh?.dispose();
    this.mesh = null;
    this.at = { x, z };
    const near = PLOTS.filter((p) => p.x1 > x - this.radius - 5 && p.x0 < x + this.radius + 5 && p.z1 > z - this.radius - 5 && p.z0 < z + this.radius + 5);
    const g = new GeoBuilder(1);
    if (buildGrass(g, x, z, this.radius, this.density, near) === 0) return;
    const m = g.toMesh("grass_cover", this.scene, this.mats.get("plant"));
    m.isPickable = false;
    m.receiveShadows = true;
    m.freezeWorldMatrix();
    this.mesh = m;
  }

  clear(): void {
    this.mesh?.dispose();
    this.mesh = null;
    this.at = null;
  }
}
