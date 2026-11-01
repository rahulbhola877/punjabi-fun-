import { Mesh, PhysicsBody, PhysicsMotionType, PhysicsShapeMesh, Vector3, VertexData, type Scene } from "../babylon";
import { Group } from "../app/config";
import { mix, rgb, shade } from "../render/GeoBuilder";
import type { Kit } from "./Kit";
import { RIDGE_BOUNDS, RIDGE_ROAD, RIDGE_ROAD_WIDTH, RIDGE_STEP, RIDGE_VIEW, onRidgeRoad, ridgeHeight, ridgeVertexHeight } from "./ridgeTerrain";
import { tunyardBroadleaf } from "./tunyardTree";
import { tunyardBench } from "./tunyardBench";
import { tunyardRockCluster } from "./tunyardNature";
import { Rng } from "../render/textures";
import { inForestClearing, onForestTrail } from "./forestTrailLayout";
import { buildForestStation } from "./forestStation";

/** Terrain is rendered and collided from the same grid. */
export function buildRidgeGround(kit: Kit): void {
  const { x0, x1, z0, z1 } = RIDGE_BOUNDS, step = RIDGE_STEP, tile = 20;
  const nx = (x1 - x0) / step, nz = (z1 - z0) / step;
  const grass = rgb("#a6b993"), rock = rgb("#a49b85");
  for (let j0 = 0; j0 < nz; j0 += tile) for (let i0 = 0; i0 < nx; i0 += tile) {
    const i1 = Math.min(nx, i0 + tile), j1 = Math.min(nz, j0 + tile);
    const cx = x0 + (i0 + i1) * step / 2, cz = z0 + (j0 + j1) * step / 2;
    kit.frame(cx, cz, 0, 0);
    const g = kit.g("grass"), base = g.vertexCount, row = i1 - i0 + 1;
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const x = x0 + i * step, z = z0 + j * step, y = ridgeVertexHeight(x, z);
      const sx = (ridgeVertexHeight(x - step, z) - ridgeVertexHeight(x + step, z)) / (step * 2);
      const sz = (ridgeVertexHeight(x, z - step) - ridgeVertexHeight(x, z + step)) / (step * 2);
      const slope = Math.min(0.5, Math.hypot(sx, sz) * 1.4);
      const color = shade(mix(grass, rock, slope), 0.98 + 0.02 * Math.sin(x * 0.021 + z * 0.016));
      g.vertex(x - cx, y, z - cz, sx, 1, sz, x / 3, z / 3, color);
    }
    for (let j = 0; j < j1 - j0; j++) for (let i = 0; i < i1 - i0; i++) {
      const a = base + j * row + i;
      g.tri(a, a + 1, a + row + 1); g.tri(a, a + row + 1, a + row);
    }
  }
}

export function buildRidgeCollider(scene: Scene): PhysicsBody {
  const { x0, x1, z0, z1 } = RIDGE_BOUNDS, step = RIDGE_STEP;
  const nx = (x1 - x0) / step + 1, nz = (z1 - z0) / step + 1;
  const positions: number[] = [], indices: number[] = [];
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const x = x0 + i * step, z = z0 + j * step;
    positions.push(x, ridgeVertexHeight(x, z), z);
  }
  for (let j = 0; j < nz - 1; j++) for (let i = 0; i < nx - 1; i++) {
    const a = j * nx + i;
    indices.push(a, a + 1, a + nx + 1, a, a + nx + 1, a + nx);
  }
  const mesh = new Mesh("ridge_collider", scene), data = new VertexData();
  data.positions = positions; data.indices = indices; data.applyToMesh(mesh);
  mesh.isVisible = false; mesh.isPickable = false;
  const shape = new PhysicsShapeMesh(mesh, scene);
  shape.material = { friction: 0.8, restitution: 0.05 }; shape.filterMembershipMask = Group.STATIC;
  const body = new PhysicsBody(mesh, PhysicsMotionType.STATIC, false, scene); body.shape = shape;
  return body;
}

/** A broad packed-earth lane rises from the paved spur to a lookout. */
export function buildRidgeRoad(kit: Kit): void {
  const side = (i: number): readonly [number, number] => {
    const [ax, az] = RIDGE_ROAD[Math.max(0, i - 1)]!, [bx, bz] = RIDGE_ROAD[Math.min(RIDGE_ROAD.length - 1, i + 1)]!;
    const length = Math.hypot(bx - ax, bz - az);
    return [(bz - az) / length * RIDGE_ROAD_WIDTH / 2, -(bx - ax) / length * RIDGE_ROAD_WIDTH / 2];
  };
  let distance = 0;
  for (let i = 1; i < RIDGE_ROAD.length; i++) {
    const [ax, az] = RIDGE_ROAD[i - 1]!, [bx, bz] = RIDGE_ROAD[i]!;
    const dx = bx - ax, dz = bz - az, length = Math.hypot(dx, dz), count = Math.ceil(length / 1.4);
    const [sx0, sz0] = side(i - 1), [sx1, sz1] = side(i);
    for (let j = 0; j < count; j++) {
      const t0 = j / count, t1 = (j + 1) / count;
      const x0 = ax + t0 * dx, z0 = az + t0 * dz, x1 = ax + t1 * dx, z1 = az + t1 * dz;
      const nx0 = sx0 + t0 * (sx1 - sx0), nz0 = sz0 + t0 * (sz1 - sz0);
      const nx1 = sx0 + t1 * (sx1 - sx0), nz1 = sz0 + t1 * (sz1 - sz0);
      const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
      kit.frame(cx, cz, 0, 0);
      const p = (x: number, z: number) => new Vector3(x - cx, ridgeHeight(x, z) + 0.08, z - cz);
      kit.g("dirt").quad(p(x0 - nx0, z0 - nz0), p(x0 + nx0, z0 + nz0),
        p(x1 + nx1, z1 + nz1), p(x1 - nx1, z1 - nz1), rgb("#b6a485"), RIDGE_ROAD_WIDTH / 5, (length / count) / 5, [0, distance / 5]);
      distance += length / count;
    }
  }

}

/** A sparse ridge landscape that keeps trees and rocks away from the road. */
export function buildRidge(kit: Kit, cullDistance: number): void {
  buildRidgeGround(kit);
  const previousCull = kit.cullDistance;
  kit.cullDistance = cullDistance;
  buildRidgeRoad(kit);
  // Broadleaf trees are original Tunyard geometry. A small set is placed
  // away from the driving line to keep startup and rendering costs bounded.
  const trees: Array<{ x: number; z: number }> = [];
  for (let i = 0; i < 26; i++) {
    const x = -930 + (i % 7) * 85 + Math.sin(i * 1.31) * 15;
    const z = 1810 + Math.floor(i / 7) * 60 + Math.cos(i * 1.71) * 13;
    if (onForestTrail(x, z, 7) || inForestClearing(x, z, 6) || onRidgeRoad(x, z, 11) || Math.hypot(x - RIDGE_VIEW.x, z - RIDGE_VIEW.z) < 19) continue;
    trees.push({ x, z });
    tunyardBroadleaf(kit, x, ridgeHeight(x, z), z, 0.8 + (i % 3) * 0.12, i * 1.24);
  }
  // Uneven clusters along the ascent give the lane a sense of enclosure
  // without placing trunk colliders close to vehicles or forming a rigid row.
  const rng = new Rng(8302);
  for (let i = 1; i < RIDGE_ROAD.length; i++) {
    const [ax, az] = RIDGE_ROAD[i - 1]!, [bx, bz] = RIDGE_ROAD[i]!;
    const dx = bx - ax, dz = bz - az, len = Math.hypot(dx, dz);
    const count = Math.max(1, Math.floor(len / 22));
    for (let j = 0; j < count; j++) for (const side of [-1, 1]) {
      if (rng.next() < 0.24) continue;
      const t = (j + rng.range(0.2, 0.8)) / count;
      const offset = side * rng.range(12, 29);
      const x = ax + dx * t + dz / len * offset, z = az + dz * t - dx / len * offset;
      if (onForestTrail(x, z, 7) || inForestClearing(x, z, 6) || onRidgeRoad(x, z, 8) || Math.hypot(x - RIDGE_VIEW.x, z - RIDGE_VIEW.z) < 20) continue;
      if (trees.some((tree) => Math.hypot(tree.x - x, tree.z - z) < 7)) continue;
      trees.push({ x, z });
      tunyardBroadleaf(kit, x, ridgeHeight(x, z), z, rng.range(0.85, 1.25), rng.range(0, Math.PI * 2));
    }
  }
  // A small grove frames the optional boar encounter. Leave the clearing
  // itself open and keep every trunk away from the nearby driving line.
  for (const [x, z, scale, yaw] of [
    [-768, 1882, 1.0, 0.3], [-759, 1873, 1.15, 1.2], [-742, 1869, 0.95, 2.4],
    [-727, 1876, 1.1, 3.1], [-718, 1889, 0.9, 4.2], [-718, 1904, 1.05, 5.0],
    [-729, 1916, 0.95, 5.8],
  ] as const) {
    if (onForestTrail(x, z, 7) || inForestClearing(x, z, 6) || onRidgeRoad(x, z, 10) || trees.some((tree) => Math.hypot(tree.x - x, tree.z - z) < 7)) continue;
    trees.push({ x, z });
    tunyardBroadleaf(kit, x, ridgeHeight(x, z), z, scale, yaw);
  }
  for (const [x, z, seed] of [[-883, 1874, 3], [-860, 1994, 8], [-727, 1984, 12], [-536, 1860, 15], [-438, 1930, 19]] as const) {
    if (!onForestTrail(x, z, 7) && !inForestClearing(x, z, 6) && !onRidgeRoad(x, z, 8)) tunyardRockCluster(kit, x, z, seed, ridgeHeight(x, z));
  }
  buildForestStation(kit, trees);
  // Two seats face across the western fields; they stand clear of the lane.
  for (const x of [RIDGE_VIEW.x - 3, RIDGE_VIEW.x + 3]) {
    tunyardBench(kit, x, ridgeHeight(x, RIDGE_VIEW.z), RIDGE_VIEW.z, Math.PI);
  }
  kit.world();
  kit.cullDistance = previousCull;
}
