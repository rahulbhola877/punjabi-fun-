import { Vector3 } from "../babylon";
import { rgb, shade } from "../render/GeoBuilder";
import { Rng } from "../render/textures";
import type { Kit } from "./Kit";
import { tunyardSnowyPine } from "./tunyardPine";
import { WORLD_BOUNDS } from "../app/config";

/** Distinct, irregular tree groups beyond the street and a distant skyline.
 * The hill ribbon is beyond the playable boundary and is scenery only; trees
 * in the playable area use the original Tunyard geometry and trunk colliders. */
export function buildWinterBackdrop(kit: Kit): void {
  const rng = new Rng(48192), placed: Array<{ x: number; z: number }> = [];
  const groups = [
    { x: 1055, z: 1905, rx: 44, rz: 20 },
    { x: 1147, z: 1933, rx: 48, rz: 24 },
    { x: 1248, z: 1905, rx: 45, rz: 20 },
    { x: 1350, z: 1941, rx: 42, rz: 25 },
    { x: 1088, z: 2001, rx: 57, rz: 20 },
    { x: 1285, z: 2004, rx: 56, rz: 20 },
  ];
  for (const group of groups) {
    let count = 0;
    for (let tries = 0; tries < 45 && count < 6; tries++) {
      const x = group.x + rng.range(-group.rx, group.rx), z = group.z + rng.range(-group.rz, group.rz);
      if (placed.some(p => Math.hypot(p.x - x, p.z - z) < 9)) continue;
      placed.push({ x, z }); count++;
      tunyardSnowyPine(kit, x, 0, z, rng.range(1.0, 1.55), rng.range(0, Math.PI * 2));
    }
  }
  // The painted skyline was outside the former boundary. Outer terrain now
  // occupies that space and supplies a walkable, collidable landscape.
  if (WORLD_BOUNDS.maxZ > 2100) return;
  const oldCull = kit.cullDistance;
  kit.cullDistance = 0;
  // Gentle snowy hills beyond the map, softened by the normal world fog. A
  // continuous, low-profile silhouette avoids a row of identical cones.
  const skyline: ReadonlyArray<readonly [number, number]> = [
    [850, 0], [915, 13], [978, 28], [1040, 17], [1115, 38], [1182, 19],
    [1248, 33], [1320, 16], [1390, 30], [1460, 13], [1530, 0],
  ];
  const rock = rgb("#9fb4bc"), snow = rgb("#d5e1df"), z = 2120;
  for (let i = 1; i < skyline.length; i++) {
    const [x0, h0] = skyline[i - 1]!, [x1, h1] = skyline[i]!;
    const cx = (x0 + x1) / 2;
    kit.frame(cx, z, 0, 0);
    const v = (x: number, y: number, dz = 0) => new Vector3(x - cx, y, dz);
    // Face the playable district (south); GeoBuilder computes normals using
    // cross(p3 - p0, p1 - p0), so the order matters for backface culling.
    kit.g("matte").quad(v(x0, -1), v(x1, -1), v(x1, h1), v(x0, h0), shade(rock, 0.95 + 0.03 * (i % 3)));
    if (h0 > 7 && h1 > 7) {
      // Move the snowy cap toward the viewer to avoid coplanar depth flicker.
      kit.g("matte").quad(v(x0, h0 * 0.76, -1), v(x1, h1 * 0.76, -1), v(x1, h1 + 0.1, -1), v(x0, h0 + 0.1, -1), snow);
    }
  }
  kit.cullDistance = oldCull;
  kit.world();
}
