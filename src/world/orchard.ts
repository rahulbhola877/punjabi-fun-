import { Mesh, PhysicsBody, PhysicsMotionType, PhysicsShapeMesh, Vector3, VertexData, type Scene } from "../babylon";
import { Group } from "../app/config";
import { rgb } from "../render/GeoBuilder";
import type { CountryDecor } from "./country";
import type { Kit } from "./Kit";
import { ORCHARD, ORCHARD_PICNIC, ORCHARD_STEP, orchardHeight } from "./orchardTerrain";
import { tunyardFallenLog, tunyardRockCluster } from "./tunyardNature";
import {punjabBroadleaf}from "./punjabTrees";
import {groundHeight}from "./groundHeight";
import { tunyardBench } from "./tunyardBench";
import { ORCHARD_BASKETS } from "../missions/OrchardRound";

/** The path connects the northern road to an orchard and a small hilltop rest. */
const PATH: ReadonlyArray<readonly [number, number]> = [
  [250, 1240], [270, 1270], [300, 1300], [340, 1320],
  [365, 1350], [400, 1372], [445, 1375], [490, 1360], [525, 1382],
];
const PATH_WIDTH = 3;

export function onOrchardPath(x: number, z: number, extra = 0): boolean {
  if (x < ORCHARD.x0 - extra || x > ORCHARD.x1 + extra || z < ORCHARD.z0 - extra || z > ORCHARD.z1 + extra) return false;
  for (let i = 1; i < PATH.length; i++) {
    const [ax, az] = PATH[i - 1]!, [bx, bz] = PATH[i]!;
    const dx = bx - ax, dz = bz - az;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz)));
    if (Math.hypot(x - ax - t * dx, z - az - t * dz) < PATH_WIDTH / 2 + extra) return true;
  }
  return false;
}

/** Draw and collide the same 4 m grid, keeping the underlying flat ground below it. */
export function orchardGround(kit: Kit): void {
  const step = ORCHARD_STEP, tile = 10;
  const nx = (ORCHARD.x1 - ORCHARD.x0) / step, nz = (ORCHARD.z1 - ORCHARD.z0) / step;
  for (let j0 = 0; j0 < nz; j0 += tile) for (let i0 = 0; i0 < nx; i0 += tile) {
    const i1 = Math.min(nx, i0 + tile), j1 = Math.min(nz, j0 + tile);
    const cx = ORCHARD.x0 + (i0 + i1) * step / 2, cz = ORCHARD.z0 + (j0 + j1) * step / 2;
    kit.frame(cx, cz, 0, 0);
    const g = kit.g("grass"), base = g.vertexCount, row = i1 - i0 + 1;
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const x = ORCHARD.x0 + i * step, z = ORCHARD.z0 + j * step;
      const sx = (orchardHeight(x - 1, z) - orchardHeight(x + 1, z)) / 2;
      const sz = (orchardHeight(x, z - 1) - orchardHeight(x, z + 1)) / 2;
      g.vertex(x - cx, orchardHeight(x, z), z - cz, sx, 1, sz, x / 3, z / 3, rgb("#b5c496"));
    }
    for (let j = 0; j < j1 - j0; j++) for (let i = 0; i < i1 - i0; i++) {
      const a = base + j * row + i;
      g.tri(a, a + 1, a + row + 1); g.tri(a, a + row + 1, a + row);
    }
  }
}

export function orchardCollider(scene: Scene): PhysicsBody {
  const step = ORCHARD_STEP, nx = (ORCHARD.x1 - ORCHARD.x0) / step + 1, nz = (ORCHARD.z1 - ORCHARD.z0) / step + 1;
  const positions: number[] = [], indices: number[] = [];
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const x = ORCHARD.x0 + i * step, z = ORCHARD.z0 + j * step;
    positions.push(x, orchardHeight(x, z), z);
  }
  for (let j = 0; j < nz - 1; j++) for (let i = 0; i < nx - 1; i++) {
    const a = j * nx + i;
    indices.push(a, a + 1, a + nx + 1, a, a + nx + 1, a + nx);
  }
  const mesh = new Mesh("orchard_collider", scene), data = new VertexData();
  data.positions = positions; data.indices = indices; data.applyToMesh(mesh);
  mesh.isVisible = false; mesh.isPickable = false;
  const shape = new PhysicsShapeMesh(mesh, scene);
  shape.material = { friction: 0.8, restitution: 0.05 }; shape.filterMembershipMask = Group.STATIC;
  const body = new PhysicsBody(mesh, PhysicsMotionType.STATIC, false, scene); body.shape = shape;
  return body;
}

export function buildOrchard(kit: Kit, decor: CountryDecor, cullDistance: number): void {
  orchardGround(kit);
  // Terrain stays visible like the rest of the ground; nearby detail uses
  // the same distance culling as the surrounding countryside.
  const previousCull = kit.cullDistance;
  kit.cullDistance = cullDistance;
  // A dirt ribbon follows the rise in short pieces, sampling the terrain.
  // Share each joint's direction between its adjoining segments to avoid gaps.
  const side = (i: number): readonly [number, number] => {
    const [ax, az] = PATH[Math.max(0, i - 1)]!, [bx, bz] = PATH[Math.min(PATH.length - 1, i + 1)]!;
    const len = Math.hypot(bx - ax, bz - az);
    return [(bz - az) / len * PATH_WIDTH / 2, -(bx - ax) / len * PATH_WIDTH / 2];
  };
  for (let i = 1; i < PATH.length; i++) {
    const [ax, az] = PATH[i - 1]!, [bx, bz] = PATH[i]!;
    const dx = bx - ax, dz = bz - az, len = Math.hypot(dx, dz), count = Math.ceil(len / 2);
    const [nax, naz] = side(i - 1), [nbx, nbz] = side(i);
    for (let j = 0; j < count; j++) {
      const x0 = ax + dx * j / count, z0 = az + dz * j / count, x1 = ax + dx * (j + 1) / count, z1 = az + dz * (j + 1) / count;
      const nx0 = nax + (nbx - nax) * j / count, nz0 = naz + (nbz - naz) * j / count;
      const nx1 = nax + (nbx - nax) * (j + 1) / count, nz1 = naz + (nbz - naz) * (j + 1) / count;
      const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
      kit.frame(cx, cz, 0, 0);
      const p = (x: number, z: number) => new Vector3(x - cx, orchardHeight(x, z) + 0.08, z - cz);
      kit.g("dirt").quad(p(x0 - nx0, z0 - nz0), p(x0 + nx0, z0 + nz0), p(x1 + nx1, z1 + nz1), p(x1 - nx1, z1 - nz1), rgb("#b9a181"));
    }
  }
  // Authored Tunyard trees use more geometry than the old procedural trees;
  // generous spacing keeps the grove walkable and its rendering cost bounded.
  void decor;
  for(const [bx,bz,cols,rows]of [[252,1266,13,8],[430,1340,16,12]]as const)for (let row = 0; row < rows; row++) for (let col = 0; col < cols; col++) {
    const x = bx + col * 9;
    const z = bz + row * 9;
    if (onOrchardPath(x, z, 5) || Math.hypot(x - 365, z - 1350) < 14) continue;
    punjabBroadleaf(kit,'kinnow',x,groundHeight(x,z),z,.92+.04*((row+col)%3),col*.8);
  }
  // A simple picnic rest at the high point.
  // Keep the table beside the trail rather than blocking the hilltop path.
  const { x, z } = ORCHARD_PICNIC;
  kit.frame(x, z, 0, orchardHeight(x, z));
  const wood = kit.g("wood"), timber = rgb("#a08059");
  wood.box(0, 0.8, 0, 2.3, 0.13, 1, timber);
  for (const a of [-0.85, 0.85]) for (const b of [-0.35, 0.35]) wood.box(a, 0.38, b, 0.11, 0.76, 0.11, timber);
  kit.collide(0, 0.45, 0, 2.3, 0.9, 1);
  // An open-sided shade canopy gives the picnic clearing a visible destination.
  // Posts sit clear of both the table and the adjacent path.
  for (const a of [-1.8, 1.8]) for (const b of [-1.45, 1.45]) {
    wood.box(a, 1.3, b, 0.14, 2.6, 0.14, timber);
    kit.collide(a, 1.3, b, 0.14, 2.6, 0.14);
  }
  wood.box(0, 2.65, 0, 4, 0.2, 3.3, rgb("#8b694c"));
  kit.collide(0,2.65,0,4,.2,3.3);
  for (const b of [-1.05, 1.05]) tunyardBench(kit, x, orchardHeight(x, z + b), z + b, b < 0 ? 0 : Math.PI);
  // Three fruit baskets beside the path make the picking round visible in-world.
  for (const p of ORCHARD_BASKETS) {
    kit.frame(p.x, p.z, 0, orchardHeight(p.x, p.z));
    const basket = kit.g("wood"), fruit = kit.g("matte");
    basket.cylinder(0, 0, 0, 0.4, 0.48, 0.38, 10, rgb("#b48a58"));
    basket.torus(0, 0.38, 0, 0.42, 0.045, 10, 4, rgb("#765333"));
    for (const [fx, fz] of [[-0.19, -0.12], [0.12, -0.15], [-0.11, 0.16], [0.18, 0.15], [0, 0]] as const) {
      fruit.ellipsoid(fx, 0.39, fz, 0.12, 0.11, 0.12, 7, 4, rgb("#b84f36"));
    }
  }
  for (const [rx, rz, seed] of [[315, 1360, 7], [460, 1320, 9], [560, 1400, 12]] as const) tunyardRockCluster(kit, rx, rz, seed, orchardHeight(rx, rz));
  for (const [lx, lz, a] of [[390, 1400, 0.5], [515, 1325, -0.3]] as const) tunyardFallenLog(kit, lx, lz, a, orchardHeight(lx, lz));
  kit.world();
  kit.cullDistance = previousCull;
}
