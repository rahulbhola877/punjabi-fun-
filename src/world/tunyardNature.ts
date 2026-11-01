import { Vector3 } from "../babylon";
import { rgb, shade } from "../render/GeoBuilder";
import { Rng } from "../render/textures";
import type { Kit } from "./Kit";

/**
 * Batched scenery adapted from the user's Tunyard rock cluster and mossy log
 * designs (rahulbhola877/tunyard, commit 4de2d594e9ea54553af1884ac1d2add62058a41b,
 * src/assets/rocks.ts and src/assets/extras/stumpLogs.ts). These are rebuilt
 * for the game's Babylon materials and chunked scenery rather than live Three
 * meshes. All dimensions are metres.
 */

/** Weathered boulders with smaller stones and a little moss. Footprint ~4 m. */
export function tunyardRockCluster(kit: Kit, x: number, z: number, seed: number, y?: number): void {
  const rng = new Rng(seed);
  kit.frame(x, z, rng.range(0, Math.PI * 2), y);
  const rock = kit.g("matte"), moss = kit.g("matte");
  const stone = rgb("#a59d8b"), green = rgb("#75835d");
  // Partly buried ellipsoids give each cluster a stable foot on the slope.
  rock.ellipsoid(0, 0.34, 0, 0.95, 0.72, 0.7, 9, 5, stone, -0.45, 1, 0.18);
  moss.ellipsoid(-0.16, 0.97, -0.03, 0.36, 0.08, 0.25, 8, 3, green, -0.15, 1);
  for (let i = 0; i < 3; i++) {
    const a = i * Math.PI * 2 / 3 + rng.range(-0.3, 0.3), d = rng.range(1.15, 1.55), r = rng.range(0.25, 0.42);
    rock.ellipsoid(Math.cos(a) * d, r * 0.38, Math.sin(a) * d, r * 1.2, r * 0.8, r, 7, 4, shade(stone, rng.range(0.85, 1.08)), -0.45, 1, 0.15);
  }
  kit.collide(0, 0.45, 0, 1.45, 0.9, 1.05);
}

/** A fallen trunk and stump with cut ends and modest moss. Footprint ~3 × 1 m. */
export function tunyardFallenLog(kit: Kit, x: number, z: number, rotation: number, y?: number): void {
  kit.frame(x, z, rotation, y);
  const bark = rgb("#75604b"), cut = rgb("#c4a778"), rings = rgb("#a3865f"), moss = rgb("#75865b");
  const wood = kit.g("wood");
  wood.cylinderX(0.32, 0.28, 0, 0.27, 2.05, 10, bark);
  // Cut faces and a thin inner ring, avoiding a flat dark cylinder end.
  wood.cylinderX(-0.71, 0.28, 0, 0.22, 0.015, 10, cut);
  wood.cylinderX(1.35, 0.28, 0, 0.22, 0.015, 10, cut);
  wood.cylinderX(1.36, 0.28, 0, 0.10, 0.018, 10, rings);
  wood.cylinder(-1.1, 0, 0.48, 0.33, 0.29, 0.48, 10, bark, true, 1, cut);
  // A pair of tapering broken branches and soft moss on top of the trunk.
  wood.tube(new Vector3(0.1, 0.45, 0.1), new Vector3(-0.15, 0.85, 0.32), 0.055, 5, bark);
  kit.g("matte").ellipsoid(0.45, 0.52, 0, 0.52, 0.09, 0.17, 8, 3, moss, -0.1, 1);
  kit.collide(0.32, 0.27, 0, 2.05, 0.54, 0.54);
}
