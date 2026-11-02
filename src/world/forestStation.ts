import { Vector3 } from "../babylon";
import { rgb } from "../render/GeoBuilder";
import type { Kit } from "./Kit";
import { FOREST_ROUTE, FOREST_SHELTER, FOREST_TRAIL_WIDTH, inForestClearing, onForestTrail } from "./forestTrailLayout";
import { onRidgeRoad, ridgeHeight } from "./ridgeTerrain";
import { tunyardBroadleaf } from "./tunyardTree";
import { tunyardFallenLog } from "./tunyardNature";

/** A hand-cut walking trail follows the very same heightfield as the collider. */
function buildForestTrail(kit: Kit): void {
  const side = (i: number): readonly [number, number] => {
    const [ax, az] = FOREST_ROUTE[Math.max(0, i - 1)]!;
    const [bx, bz] = FOREST_ROUTE[Math.min(FOREST_ROUTE.length - 1, i + 1)]!;
    const len = Math.hypot(bx - ax, bz - az);
    return [(bz - az) / len * FOREST_TRAIL_WIDTH / 2, -(bx - ax) / len * FOREST_TRAIL_WIDTH / 2];
  };
  let distance = 0;
  for (let i = 1; i < FOREST_ROUTE.length; i++) {
    const [ax, az] = FOREST_ROUTE[i - 1]!, [bx, bz] = FOREST_ROUTE[i]!;
    const dx = bx - ax, dz = bz - az, length = Math.hypot(dx, dz), count = Math.ceil(length / 1.4);
    const [sx0, sz0] = side(i - 1), [sx1, sz1] = side(i);
    for (let j = 0; j < count; j++) {
      const t0 = j / count, t1 = (j + 1) / count;
      const x0 = ax + t0 * dx, z0 = az + t0 * dz, x1 = ax + t1 * dx, z1 = az + t1 * dz;
      const nx0 = sx0 + t0 * (sx1 - sx0), nz0 = sz0 + t0 * (sz1 - sz0);
      const nx1 = sx0 + t1 * (sx1 - sx0), nz1 = sz0 + t1 * (sz1 - sz0);
      const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
      kit.frame(cx, cz, 0, 0);
      const p = (x: number, z: number) => new Vector3(x - cx, ridgeHeight(x, z) + 0.1, z - cz);
      kit.g("dirt").quad(p(x0 - nx0, z0 - nz0), p(x0 + nx0, z0 + nz0),
        p(x1 + nx1, z1 + nz1), p(x1 - nx1, z1 - nz1), rgb("#9c886a"), FOREST_TRAIL_WIDTH / 5, length / count / 5, [0, distance / 5]);
      distance += length / count;
    }
  }
}

/** Open-sided keeper's shelter, supported at the actual height of each corner. */
function buildShelter(kit: Kit): void {
  const { x, z } = FOREST_SHELTER;
  const corners = [[-2.4, -1.7], [2.4, -1.7], [-2.4, 1.7], [2.4, 1.7]] as const;
  const deck = Math.max(...corners.map(([dx, dz]) => ridgeHeight(x + dx, z + dz))) + 0.2;
  kit.frame(x, z, 0, 0);
  const wood = rgb("#806344"), dark = rgb("#4f4535"), roof = rgb("#67634c");
  kit.solid("wood", 0, deck - 0.12, 0, 5.5, 0.24, 4, wood);
  for (const [dx, dz] of corners) {
    const ground = ridgeHeight(x + dx, z + dz);
    kit.solid("wood", dx, (ground + deck + 2.7) / 2, dz, 0.23, deck + 2.7 - ground, 0.23, dark);
  }
  // A shaded overhang, a back rail, and a built-in seat make the shelter legible from the approach.
  kit.g("wood").box(0, deck + 2.7, 0, 6.1, 0.18, 4.6, roof);
  kit.collide(0,deck+2.7,0,6.1,.18,4.6);
  kit.solid("wood", 0, deck + 0.9, -1.7, 4.7, 0.14, 0.14, dark);
  kit.g("wood").box(0, deck + 0.48, -1.15, 3.3, 0.14, 0.65, wood);
  for (const dx of [-1.35, 1.35]) kit.g("wood").box(dx, deck + 0.22, -1.15, 0.12, 0.44, 0.5, dark);
}

/** Authored groves and natural debris frame the spring path without blocking it. */
export function buildForestStation(kit: Kit, existingTrees: Array<{ x: number; z: number }>): void {
  buildForestTrail(kit);
  // A readable trailhead stands beside the road rather than in its driving line.
  kit.frame(-824, 1947, 2.3, ridgeHeight(-824, 1947));
  kit.solid("wood", 0, 0.85, 0, 0.16, 1.7, 0.16, rgb("#594731"));
  kit.g("wood").box(0, 1.55, 0.04, 2.45, 0.65, 0.1, rgb("#594731"));
  kit.sign("forestSpring", 0, 1.55, 0.105, 2.3);
  buildShelter(kit);
  // Irregular positions, not a repeated row; all trunks clear the walking route.
  const grove = [
    [-833, 1930, 1.06, 0.3], [-847, 1925, 0.93, 1.1], [-856, 1918, 1.12, 2.5],
    [-862, 1904, 0.88, 4.1], [-872, 1895, 1.02, 5.5], [-884, 1888, 1.1, 0.8],
    [-902, 1884, 0.91, 3.3], [-916, 1889, 1.14, 4.7], [-920, 1902, 0.95, 2.2],
    [-913, 1913, 1.08, 5.9], [-906, 1922, 0.89, 1.4], [-895, 1930, 1.03, 2.8],
    [-886, 1940, 0.9, 3.8], [-871, 1944, 1.14, 0.5], [-857, 1951, 0.97, 5.0],
    [-845, 1958, 1.05, 2.1],
    // The deeper stands beyond the clearing create a wooded backdrop, with
    // open sight lines down the path and room to walk between the trunks.
    [-935, 1874, 1.18, 1.5], [-923, 1877, 0.96, 4.0], [-910, 1868, 1.12, 2.3],
    [-896, 1872, 0.94, 5.1], [-880, 1874, 1.08, 0.7], [-865, 1880, 1.16, 3.9],
    [-851, 1885, 0.99, 1.9], [-838, 1895, 1.09, 5.6], [-825, 1903, 0.96, 2.6],
    [-936, 1892, 0.92, 4.5], [-929, 1910, 1.11, 0.4], [-928, 1927, 1.02, 3.0],
    [-918, 1940, 0.95, 5.8], [-904, 1946, 1.17, 1.7], [-888, 1955, 1.03, 4.2],
    [-874, 1963, 0.91, 2.5], [-860, 1971, 1.1, 0.1], [-844, 1974, 0.98, 3.6],
    [-837, 1911, 1.08, 1.2], [-826, 1917, 0.94, 4.9], [-816, 1925, 1.13, 2.0],
    // Taller mature trees group into irregular stands behind the clearing,
    // filling the visible hillside while preserving the spring's open path.
    [-955, 1885, 1.55, 0.9], [-965, 1894, 1.35, 4.3], [-949, 1902, 1.75, 2.1],
    [-938, 1903, 1.38, 5.5], [-945, 1914, 1.6, 1.6], [-957, 1917, 1.27, 3.9],
    [-968, 1924, 1.7, 0.4], [-949, 1929, 1.42, 4.8], [-939, 1936, 1.8, 2.8],
    [-960, 1940, 1.38, 5.7], [-971, 1949, 1.55, 1.8], [-949, 1950, 1.67, 4.0],
    [-933, 1954, 1.33, 0.2], [-922, 1955, 1.65, 3.4], [-910, 1958, 1.47, 5.4],
    [-966, 1961, 1.75, 2.9], [-954, 1965, 1.35, 0.6], [-942, 1969, 1.58, 4.5],
    [-929, 1973, 1.43, 1.1], [-917, 1971, 1.72, 3.8], [-904, 1977, 1.34, 5.9],
    [-888, 1975, 1.61, 2.0], [-876, 1980, 1.4, 4.6], [-861, 1987, 1.68, 0.8],
    [-972, 1979, 1.42, 4.0], [-959, 1984, 1.65, 1.4], [-945, 1982, 1.36, 5.2],
    [-932, 1991, 1.7, 2.7], [-916, 1992, 1.46, 0.5], [-901, 1997, 1.6, 3.2],
    [-884, 1994, 1.32, 5.4], [-869, 2000, 1.57, 1.9],
  ] as const;
  for (const [x, z, scale, yaw] of grove) {
    if (onForestTrail(x, z, 6) || inForestClearing(x, z, 3) || onRidgeRoad(x, z, 9) ||
        existingTrees.some((t) => Math.hypot(t.x - x, t.z - z) < 7)) continue;
    existingTrees.push({ x, z });
    tunyardBroadleaf(kit, x, ridgeHeight(x, z), z, scale, yaw);
  }
  for (const [x, z, yaw] of [[-908, 1928, 0.5], [-860, 1909, -0.7]] as const) {
    if (!onForestTrail(x, z, 5) && !inForestClearing(x, z, 3)) tunyardFallenLog(kit, x, z, yaw, ridgeHeight(x, z));
  }
}
