import { Mesh } from "../babylon";
import type { Scene, Vector3 } from "../babylon";
import { GeoBuilder, type RGB } from "../render/GeoBuilder";
import type { Materials } from "../render/Materials";
import type { Rect } from "./layout";
import { hillY } from "./hillTerrain";
import { onWoodlandTrail } from "./woodlandTrail";
import { onOrchardPath } from "./orchard";
import { inTravelDistrict } from "./travelDistrictLayout";
import { ORCHARD_PICNIC } from "./orchardTerrain";
import { onRidgeRoad } from "./ridgeTerrain";
import { inForestClearing, onForestTrail } from "./forestTrailLayout";
import { onWaysideSurface } from "./northWaysideLayout";
import { onCanalGroveSurface, onCanalLanding } from "./canalLandingLayout";
import { BRIDGES, CANAL, CITY, LUDHIANA, PLOTS, SITES, TOWN, VILLAGE, isOpenCountry, onRoad } from "./region";
import { RectIndex } from "./RectIndex";
import { inOuterCore, outerBiome } from "./outerTerrain";
import { distanceToOuterPaths, OUTER_PLACES } from "./outerPaths";

/**
 * Ground cover: grass tufts and small weeds on open ground near the player, thicker along the road verges and
 * in patches, with none on tarmac, in the cultivated interiors of fields, in a built-up street or on a paved site.
 * The narrow field margins remain grassy, softening the transition between a crop and its earthen bund. They are made for a disc
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
const PLOT_INDEX = new RectIndex(PLOTS, 160);
const inRect = (r: Rect, x: number, z: number, pad = 0) => x > r.x0 - pad && x < r.x1 + pad && z > r.z0 - pad && z < r.z1 + pad;

/** Is there bare ground here for grass to grow in? */
export function grassy(x: number, z: number, plots: Rect[]): boolean {
  if (inTravelDistrict(x, z)) return false;
  if (!isOpenCountry(x, z)) return false;
  if (!inOuterCore(x, z)) {
    const biome = outerBiome(x, z);
    if (biome === "dunes" || biome === "northland") return false;
    if (distanceToOuterPaths(x, z) < 4 || OUTER_PLACES.some((p) => Math.hypot(p.x - x, p.z - z) < 11)) return false;
  }
  if (onWoodlandTrail(x, z, 0.2)) return false;
  if (onOrchardPath(x, z, 0.2)) return false;
  if (onRidgeRoad(x, z, 0.5)) return false;
  if (onForestTrail(x, z, 0.5) || inForestClearing(x, z, 0.5)) return false;
  if (onWaysideSurface(x, z)) return false;
  if (onCanalLanding(x, z, 0.45)) return false;
  if (onCanalGroveSurface(x, z, 0.45)) return false;
  // Leave room around the shelter for the full width of the crossed grass cards.
  if (Math.abs(x - ORCHARD_PICNIC.x) <= ORCHARD_PICNIC.halfWidth + 0.5 &&
      Math.abs(z - ORCHARD_PICNIC.z) <= ORCHARD_PICNIC.halfDepth + 0.5) return false;
  for (const r of BUILT) if (inRect(r, x, z)) return false;
  for (const s of PAVED_SITES) if (inRect(s, x, z, 1)) return false;
  // Colony pavements extend 1.5 m beyond the paved street. Keep the full
  // width of the grass cards off those paving stones, not just the asphalt.
  if (onRoad(x, z, 1.9)?.kind === "street") return false;
  if (onRoad(x, z, 0.6)) return false;
  // Bridge decks extend beyond the road width to include their parapets and
  // pavements. The canal query permits walking on bridges, but they are paved.
  if (z >= CANAL.z0 - 1.5 && z <= CANAL.z1 + 1.5 && BRIDGES.some((b) => Math.abs(x - b.x) <= b.w / 2)) return false;
  // Leave a narrow, walkable strip of wild growth along each bund; crops still
  // occupy the interior. This uses the same streamed geometry and culling as
  // the rest of the grass, so distant fields do not add permanent meshes.
  for (const p of plots) if (inRect(p, x, z, -0.9)) return false;
  return true;
}

/** Build the tufts of a disc round (px, pz) into `g`. Returns the number of tufts. */
export function buildGrass(g: GeoBuilder, px: number, pz: number, radius: number, density: number, plots: Rect[]): number {
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
      const flowers = hash(i + 91, j + 5) < 0.12;
      const h = (0.34 + hash(i + 3, j + 11) * 0.24) * grow;
      const w = 0.5 + hash(i + 17, j + 3) * 0.25;
      const variation = 0.86 + hash(i, j + 29) * 0.18;
      const tint: RGB = [variation, variation, variation * 0.98];
      const u0 = flowers ? 0.501 : 0.001, u1 = flowers ? 0.999 : 0.499;
      const y0 = hillY(x, z);
      // Two crossed cards.
      for (const a of [hash(i, j + 41) * Math.PI, hash(i, j + 41) * Math.PI + 1.57]) {
        const dx = Math.cos(a) * w / 2, dz = Math.sin(a) * w / 2;
        const v = [
          g.vertex(x - dx, y0, z - dz, 0, 1, 0, u0, 0, tint), g.vertex(x + dx, y0, z + dz, 0, 1, 0, u1, 0, tint),
          g.vertex(x + dx, y0 + h, z + dz, 0, 1, 0, u1, 1, tint), g.vertex(x - dx, y0 + h, z - dz, 0, 1, 0, u0, 1, tint),
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
    const r = this.radius + 5;
    const near = PLOT_INDEX.inRect({ x0: x - r, x1: x + r, z0: z - r, z1: z + r });
    const g = new GeoBuilder(1);
    if (buildGrass(g, x, z, this.radius, this.density, near) === 0) return;
    const m = g.toMesh("grass_cover", this.scene, this.mats.get("tunyardGrass"));
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
