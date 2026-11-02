import { Mesh, PhysicsBody, PhysicsMotionType, PhysicsShapeMesh, type Scene, Vector3, VertexData } from "../babylon";
import { Group } from "../app/config";
import { rgb } from "../render/GeoBuilder";
import type { Materials } from "../render/Materials";
import { Rng } from "../render/textures";
import type { SignAtlas } from "../render/Signs";
import { loadKitRegion, type KitRegionResources } from "./KitRegion";
import { LazyRegionStreamer, type LazyRegion, type RegionAnchor, type RegionUpdate } from "./LazyRegionStreamer";
import { OUTER_STEP, OUTER_TILE, outerHeight, outerTiles, type OuterTile } from "./outerTerrain";
import { distanceToOuterPaths, OUTER_PATHS, OUTER_PLACES } from "./outerPaths";
import type { Kit } from "./Kit";
import { tunyardBench } from "./tunyardBench";
import { tunyardFallenLog, tunyardRockCluster } from "./tunyardNature";
import { tunyardSnowyPine } from "./tunyardPine";
import { tunyardBroadleaf } from "./tunyardTree";
import { oasisCourtyard } from "./oasis";

/** Shared resources are owned by World. Every loaded tile owns its own meshes and physics. */
export interface OuterRegionHooks {
  loaded?: (r: KitRegionResources) => void;
  unloading?: (r: KitRegionResources) => void;
}

const tileSeed = (t: OuterTile): number => ((Math.imul(t.x0, 73856093) ^ Math.imul(t.z0, 19349663)) >>> 0) + 1;
const colours = { woodland: "#b3c79b", highlands: "#abb990", dunes: "#b69a73", northland: "#b9cacc" } as const;

/** Clip the centreline to the tile so the path and its LOD remain local. */
function clipLine(ax: number, az: number, bx: number, bz: number, t: OuterTile): [number, number, number, number] | null {
  const dx = bx - ax, dz = bz - az;
  let lo = 0, hi = 1;
  for (const [p, q] of [[-dx, ax - t.x0], [dx, t.x1 - ax], [-dz, az - t.z0], [dz, t.z1 - az]]) {
    if (Math.abs(p!) < 1e-9) { if (q! < 0) return null; continue; }
    const v = q! / p!;
    if (p! < 0) lo = Math.max(lo, v); else hi = Math.min(hi, v);
    if (lo > hi) return null;
  }
  return [ax + lo * dx, az + lo * dz, ax + hi * dx, az + hi * dz];
}

function pathPieces(kit: Kit, tile: OuterTile): void {
  const colour = rgb(tile.biome === "dunes" ? "#ba9871" : "#b4a17c");
  for (const path of OUTER_PATHS) for (let n = 1; n < path.length; n++) {
    const a = path[n - 1]!, b = path[n]!;
    const clipped = clipLine(a[0], a[1], b[0], b[1], tile);
    if (!clipped) continue;
    const [ax, az, bx, bz] = clipped, dx = bx - ax, dz = bz - az, len = Math.hypot(dx, dz);
    if (len < 0.01) continue;
    const nx = dz / len * 3.5, nz = -dx / len * 3.5, pieces = Math.ceil(len / 5);
    for (let i = 0; i < pieces; i++) {
      const x0 = ax + dx * i / pieces, z0 = az + dz * i / pieces;
      const x1 = ax + dx * (i + 1) / pieces, z1 = az + dz * (i + 1) / pieces;
      const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
      kit.frame(cx, cz, 0, 0);
      const p = (x: number, z: number) => new Vector3(x - cx, outerHeight(x, z) + 0.08, z - cz);
      kit.g("dirt").quad(p(x0 - nx, z0 - nz), p(x0 + nx, z0 + nz), p(x1 + nx, z1 + nz), p(x1 - nx, z1 - nz), colour);
    }
  }
  // Painted posts at bends give walkers a physical cue as well as a map line.
  for (const path of OUTER_PATHS) for (let i = 1; i < path.length - 1; i++) {
    const [x, z] = path[i]!;
    if (x < tile.x0 || x >= tile.x1 || z < tile.z0 || z >= tile.z1 || OUTER_PLACES.some((p) => Math.hypot(p.x - x, p.z - z) < 30)) continue;
    kit.frame(x + 5, z, 0, outerHeight(x + 5, z));
    kit.solid("wood", 0, 0.65, 0, 0.16, 1.3, 0.16, rgb("#67513d"));
    kit.g("paint").box(0, 1.08, 0, 0.25, 0.28, 0.25, rgb("#e8bb58"));
  }
}

/** Grounded low-poly plants and outcrops give the dry regions their own shapes. */
function dryFeature(kit: Kit, x: number, z: number, biome: OuterTile["biome"], rng: Rng): void {
  const y = outerHeight(x, z), h = rng.range(1.3, 3.1);
  kit.frame(x, z, rng.range(0, Math.PI * 2), y);
  if (biome === "dunes") {
    const green = rgb("#708c63"), plant = kit.g("matte");
    plant.cylinder(0, 0, 0, 0.28, 0.22, h, 7, green);
    plant.tube(new Vector3(0.12, h * 0.45, 0), new Vector3(0.72, h * 0.55, 0), 0.13, 6, green);
    plant.tube(new Vector3(0.72, h * 0.55, 0), new Vector3(0.72, h * 0.82, 0), 0.13, 6, green);
    kit.collide(0, h / 2, 0, 0.5, h, 0.5);
  } else {
    const rock = kit.g("matte"), stone = rgb("#928e7c");
    rock.ellipsoid(0, h * 0.25, 0, h * 0.8, h * 0.55, h * 0.55, 8, 5, stone, -0.4, 1, 0.2);
    kit.collide(0, h * 0.3, 0, h, h * 0.6, h * 0.7);
  }
}

/** Small, different landmarks; each leaves a clear 9 m interaction circle. */
function landmark(kit: Kit, tile: OuterTile): void {
  for (const p of OUTER_PLACES) {
    if (p.x < tile.x0 || p.x >= tile.x1 || p.z < tile.z0 || p.z >= tile.z1) continue;
    const y = outerHeight(p.x, p.z);
    if (p.id === "duneOasis") {
      oasisCourtyard(kit);
    } else if (p.id === "highlandLookout") {
      kit.frame(p.x + 14, p.z, 0, y);
      kit.g("wood").box(0, 0.12, 0, 10, 0.24, 7, rgb("#a98c70"));
      kit.collide(0, 0.12, 0, 10, 0.24, 7);
      tunyardBench(kit, p.x + 14, y + 0.24, p.z - 1.5, 0);
    } else {
      const x = p.x + 15;
      kit.frame(x, p.z, 0, y);
      const cloth = rgb(p.id === "northCamp" ? "#bac3af" : "#b98960");
      // A low A-frame shelter with open ends; its supports stay outside the
      // interaction circle and are collision-tested with the same frame.
      const a = new Vector3(-3, 0.1, -3), b = new Vector3(3, 0.1, -3), top = new Vector3(0, 3.2, -3);
      kit.g("fabric").quad(a, top, new Vector3(0, 3.2, 3), new Vector3(-3, 0.1, 3), cloth);
      kit.g("fabric").quad(top, b, new Vector3(3, 0.1, 3), new Vector3(0, 3.2, 3), cloth);
      for (const z of [-2.8, 2.8]) kit.solid("wood", 0, 1.5, z, 0.18, 3, 0.18, rgb("#7a624d"));
      tunyardBench(kit, p.x + 15, y, p.z - 5, 0);
      // A composed grove close enough to frame the camp rather than appearing
      // as specks on the horizon. Keep the fire-side and incoming trail clear.
      const grove = [[-28, 25], [-18, 35], [-5, 44], [12, 39], [30, 29], [42, 12], [-40, 4], [-35, -15]] as const;
      for (const [i, [dx, dz]] of grove.entries()) {
        const x = p.x + dx, z = p.z + dz, h = outerHeight(x, z);
        if (distanceToOuterPaths(x, z) < 12) continue;
        if (p.id === "northCamp") tunyardSnowyPine(kit, x, h, z, 1 + (i % 3) * 0.12, i * 1.7);
        else tunyardBroadleaf(kit, x, h, z, 0.95 + (i % 3) * 0.14, i * 1.7);
      }
    }
  }
}

/**
 * Build the visible terrain, its exact triangle-mesh collider and a small
 * number of authored-source landscape objects. The east/west highway corridor
 * is kept free of props. Callers must preload before moving any simulated
 * actor into a tile and include every such actor when updating the streamer.
 */
export function loadOuterTile(scene: Scene, mats: Materials, signs: SignAtlas, tile: OuterTile, hooks: OuterRegionHooks = {}, scenery = true): KitRegionResources {
  const segments = OUTER_TILE / OUTER_STEP, row = segments + 1;
  const positions: number[] = [], indices: number[] = [];
  // A narrow overlap makes rays on shared Havok triangle edges reliable.
  const edge = 0.12;
  for (let j = 0; j <= segments; j++) for (let i = 0; i <= segments; i++) {
    const x = tile.x0 + i * OUTER_STEP + (i === 0 ? -edge : i === segments ? edge : 0);
    const z = tile.z0 + j * OUTER_STEP + (j === 0 ? -edge : j === segments ? edge : 0);
    positions.push(x, outerHeight(x, z), z);
  }
  for (let j = 0; j < segments; j++) for (let i = 0; i < segments; i++) {
    const a = j * row + i;
    indices.push(a, a + 1, a + row + 1, a, a + row + 1, a + row);
  }

  let shape: PhysicsShapeMesh | null = null, body: PhysicsBody | null = null, collision: Mesh | null = null;
  let visible: KitRegionResources | null = null;
  try {
    visible = loadKitRegion(scene, mats, signs, (kit) => {
      kit.chunkSize = OUTER_TILE;
      kit.cullDistance = 550;
      kit.frame((tile.x0 + tile.x1) / 2, (tile.z0 + tile.z1) / 2, 0, 0);
      const g = kit.g(tile.biome === "dunes" || tile.biome === "northland" ? "matte" : "grass"), base = g.vertexCount, c = rgb(colours[tile.biome]);
      // Positions are supplied relative to this frame; collision stays in world coordinates.
      const cx = (tile.x0 + tile.x1) / 2, cz = (tile.z0 + tile.z1) / 2;
      for (let i = 0; i < positions.length; i += 3) {
        const x = positions[i]!, y = positions[i + 1]!, z = positions[i + 2]!;
        const sx = (outerHeight(x - 2, z) - outerHeight(x + 2, z)) / 4;
        const sz = (outerHeight(x, z - 2) - outerHeight(x, z + 2)) / 4;
        const variation = 0.94 + 0.06 * Math.sin(x * 0.007 + z * 0.004);
        g.vertex(x - cx, y, z - cz, sx, 1, sz, x / 3, z / 3, [c[0] * variation, c[1] * variation, c[2] * variation]);
      }
      for (let i = 0; i < indices.length; i += 3) g.tri(base + indices[i]!, base + indices[i + 1]!, base + indices[i + 2]!);
      if (!scenery) return;
      pathPieces(kit, tile);
      landmark(kit, tile);
      const rng = new Rng(tileSeed(tile));
      // Loose groves and outcrops have a varied silhouette at walking height,
      // while a fixed upper bound keeps synchronous chunk loading affordable.
      const groups = tile.biome === "woodland" || tile.biome === "northland" ? 4 : 6;
      const placed: Array<{ x: number; z: number }> = [];
      for (let i = 0; i < groups; i++) {
        const gx = rng.range(tile.x0 + 30, tile.x1 - 30), gz = rng.range(tile.z0 + 30, tile.z1 - 30);
        const count = tile.biome === "woodland" || tile.biome === "northland" ? 2 + Math.floor(rng.next() * 3) : 1 + Math.floor(rng.next() * 3);
        for (let j = 0; j < count; j++) {
          const x = gx + rng.range(-12, 12), z = gz + rng.range(-12, 12);
          if (distanceToOuterPaths(x, z) < 14 || OUTER_PLACES.some((p) => Math.hypot(p.x - x, p.z - z) < 60)
              || placed.some((p) => Math.hypot(p.x - x, p.z - z) < 6)) continue;
          placed.push({ x, z });
          const y = outerHeight(x, z), yaw = rng.range(0, Math.PI * 2);
          if (tile.biome === "woodland") tunyardBroadleaf(kit, x, y, z, rng.range(0.8, 1.25), yaw);
          else if (tile.biome === "northland") tunyardSnowyPine(kit, x, y, z, rng.range(0.8, 1.25), yaw);
          else dryFeature(kit, x, z, tile.biome, rng);
        }
        const fx = gx + 14;
        if (distanceToOuterPaths(fx, gz) < 14 || OUTER_PLACES.some((p) => Math.hypot(p.x - fx, p.z - gz) < 60)) continue;
        if (tile.biome === "woodland" && i % 2 === 0) tunyardFallenLog(kit, fx, gz, rng.range(0, Math.PI * 2), outerHeight(fx, gz));
        else if (tile.biome !== "dunes") tunyardRockCluster(kit, fx, gz, tileSeed(tile) + i * 17, outerHeight(fx, gz));
      }
    }, hooks);
    // Keep the region identity available to the debug probe for measuring the
    // streaming cost separately from the pre-existing main world.
    for (const mesh of visible.meshes) mesh.metadata = { ...mesh.metadata, outerTile: tile.id };
    collision = new Mesh(`${tile.id}_collision`, scene);
    const data = new VertexData(); data.positions = positions; data.indices = indices; data.applyToMesh(collision);
    collision.isVisible = false; collision.isPickable = false;
    shape = new PhysicsShapeMesh(collision, scene);
    shape.material = { friction: 0.8, restitution: 0.05 }; shape.filterMembershipMask = Group.STATIC;
    body = new PhysicsBody(collision, PhysicsMotionType.STATIC, false, scene); body.shape = shape;
    const ownedVisible = visible, ownedBody = body, ownedShape = shape, ownedCollision = collision;
    let disposed = false;
    return {
      colliderBoxes: ownedVisible.colliderBoxes,
      meshes: ownedVisible.meshes, casters: ownedVisible.casters,
      dispose() {
        if (disposed) return;
        disposed = true;
        ownedBody.dispose(); ownedShape.dispose(); ownedCollision.dispose(); ownedVisible.dispose();
      },
    };
  } catch (error) {
    body?.dispose(); shape?.dispose(); collision?.dispose(); visible?.dispose();
    throw error;
  }
}

/** Experimental and deliberately opt-in until all game actors and travel paths are anchored. */
export class OuterRegions {
  private readonly stream: LazyRegionStreamer;
  constructor(scene: Scene, mats: Materials, signs: SignAtlas, hooks: OuterRegionHooks = {}, scenery = true) {
    const regions: LazyRegion[] = outerTiles().map((t) => ({ ...t, load: () => loadOuterTile(scene, mats, signs, t, hooks, scenery) }));
    this.stream = new LazyRegionStreamer(regions, 620, 900);
  }
  get activeCount(): number { return this.stream.activeCount; }
  // One ordinary tile load per tick limits traversal hitches; collision in
  // the immediate 120 m around every actor always loads synchronously.
  // Explicit teleport/spawn preload below remains fully synchronous.
  update(anchors: readonly RegionAnchor[], maxLoads = 1): RegionUpdate { return this.stream.update(anchors, maxLoads, 120); }
  preload(anchors: readonly RegionAnchor[]): void { this.stream.preload(anchors); }
  dispose(): void { this.stream.dispose(); }
}
