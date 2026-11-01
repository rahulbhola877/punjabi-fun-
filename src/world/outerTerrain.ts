/**
 * Outer-world heightfield. Terrain and collision must be installed together
 * before admitting a player to these coordinates.
 *
 * The 8.1 km square contains the existing 2.7 × 3.3 km district
 * exactly on tile boundaries. 300 m tiles keep the number of simultaneously
 * resident meshes bounded. Heights are sampled every 20 m and interpolated in
 * the same diagonal as the eventual collision triangles.
 */
import { OUTER_PLACES } from "./outerPaths";

export const OUTER_EXTENT = { minX: -3900, maxX: 4200, minZ: -3600, maxZ: 4500 } as const;
export const OUTER_CORE = { minX: -1200, maxX: 1500, minZ: -1200, maxZ: 2100 } as const;
export const OUTER_TILE = 300;
export const OUTER_STEP = 20;
export type OuterBiome = "woodland" | "highlands" | "dunes" | "northland";

const smooth = (x: number): number => { const t = Math.max(0, Math.min(1, x)); return t * t * (3 - 2 * t); };

/** Choose broad, named landscape regions rather than random field tiles. */
export function outerBiome(x: number, z: number): OuterBiome {
  if (z < OUTER_CORE.minZ) return "dunes";
  if (z > OUTER_CORE.maxZ) return "northland";
  return x < OUTER_CORE.minX ? "woodland" : "highlands";
}

export function inOuterExtent(x: number, z: number): boolean {
  return x >= OUTER_EXTENT.minX && x <= OUTER_EXTENT.maxX && z >= OUTER_EXTENT.minZ && z <= OUTER_EXTENT.maxZ;
}

export function inOuterCore(x: number, z: number): boolean {
  return x >= OUTER_CORE.minX && x <= OUTER_CORE.maxX && z >= OUTER_CORE.minZ && z <= OUTER_CORE.maxZ;
}

/** Sample at a terrain vertex. The core edges and its east/west highway stay flat. */
function rawHeight(x: number, z: number): number {
  if (!inOuterExtent(x, z) || inOuterCore(x, z)) return 0;
  const dx = Math.max(OUTER_CORE.minX - x, 0, x - OUTER_CORE.maxX);
  const dz = Math.max(OUTER_CORE.minZ - z, 0, z - OUTER_CORE.maxZ);
  const edge = smooth(Math.hypot(dx, dz) / 260);
  const road = 1 - smooth((Math.abs(z + 160) - 10) / 50);
  // Cross-fade terrain formulae over broad boundaries: biome selection for
  // scenery must never create a vertical cliff at a region corner.
  const west = 7 + 4 * Math.sin(x * 0.0024) * Math.cos(z * 0.0026) + 2 * Math.sin(x * 0.004);
  const east = 16 + 10 * Math.sin(x * 0.0021) * Math.cos(z * 0.0017) + 5 * Math.sin(z * 0.0034);
  const north = 14 + 8 * Math.sin(x * 0.0016 + 0.4) * Math.cos(z * 0.0021) + 4 * Math.sin(z * 0.003);
  const south = 5 + 3.5 * Math.sin(x * 0.0022 + z * 0.0038) + 2.5 * Math.sin(x * 0.0047 - z * 0.0011);
  const ew = smooth((x + 300) / 600);
  const ns = north * smooth((z - OUTER_CORE.maxZ) / 350) + south * smooth((OUTER_CORE.minZ - z) / 350);
  const vertical = Math.min(1, smooth((z - OUTER_CORE.maxZ) / 350) + smooth((OUTER_CORE.minZ - z) / 350));
  const h = (west * (1 - ew) + east * ew) * (1 - vertical) + ns;
  return Math.max(0, h) * edge * (1 - road);
}

export function outerVertexHeight(x: number, z: number): number {
  const h = rawHeight(x, z);
  for (const p of OUTER_PLACES) {
    const d = Math.hypot(x - p.x, z - p.z);
    // The oasis courtyard has buildings and an irrigation channel. Leave a
    // level apron beneath their foundations, then blend back into the dunes.
    const inner = p.id === "duneOasis" ? 45 : 25;
    if (d < inner + 30) {
      const blend = 1 - smooth((d - inner) / 30);
      return h * (1 - blend) + rawHeight(p.x, p.z) * blend;
    }
  }
  return h;
}

/** Exact height of the piecewise planar mesh; the x/z grid is world-aligned. */
export function outerHeight(x: number, z: number): number {
  if (!inOuterExtent(x, z) || inOuterCore(x, z)) return 0;
  const x0 = Math.floor(x / OUTER_STEP) * OUTER_STEP, z0 = Math.floor(z / OUTER_STEP) * OUTER_STEP;
  const u = (x - x0) / OUTER_STEP, v = (z - z0) / OUTER_STEP;
  const a = outerVertexHeight(x0, z0), b = outerVertexHeight(x0 + OUTER_STEP, z0);
  const c = outerVertexHeight(x0, z0 + OUTER_STEP), d = outerVertexHeight(x0 + OUTER_STEP, z0 + OUTER_STEP);
  return u >= v ? a * (1 - u) + b * (u - v) + d * v : a * (1 - v) + d * u + c * (v - u);
}

export interface OuterTile { id: string; x0: number; x1: number; z0: number; z1: number; biome: OuterBiome }

/** Non-overlapping tiles omit the existing core, avoiding replacement of its roads or saves. */
export function outerTiles(): OuterTile[] {
  const tiles: OuterTile[] = [];
  for (let x = OUTER_EXTENT.minX; x < OUTER_EXTENT.maxX; x += OUTER_TILE) for (let z = OUTER_EXTENT.minZ; z < OUTER_EXTENT.maxZ; z += OUTER_TILE) {
    const cx = x + OUTER_TILE / 2, cz = z + OUTER_TILE / 2;
    if (inOuterCore(cx, cz)) continue;
    tiles.push({ id: `outer_${x}_${z}`, x0: x, x1: x + OUTER_TILE, z0: z, z1: z + OUTER_TILE, biome: outerBiome(cx, cz) });
  }
  return tiles;
}
