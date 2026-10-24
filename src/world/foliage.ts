import { Vector3 } from "../babylon";
import type { GeoBuilder, RGB } from "../render/GeoBuilder";
import { PLANT, type Rng } from "../render/textures";

/**
 * Leaves for the canopies. A crown used to be a few smooth blobs; now each is a smaller dark core (it casts the
 * shadow and gives mass) wrapped in cut-out cards of real leaves (textures.ts plantAtlas), so the edge of a tree
 * is ragged and the light comes through it.
 */
export type FoliageKind = "neem" | "peepal" | "oval" | "safeda" | "kikar";

/**
 * Scatter `n` leaf cards through an ellipsoid of radii (rx, ry, rz) centred at (cx, cy, cz), most of them near its
 * surface and facing out, tilted a little so no two lie flat the same way. `size` is the card's width in metres.
 */
export function leafCards(g: GeoBuilder, kind: FoliageKind, cx: number, cy: number, cz: number, rx: number, ry: number, rz: number, n: number, size: number, rng: Rng, tint: RGB): void {
  const strip = PLANT.strip[kind]!;
  const v1 = (strip * PLANT.h + PLANT.pad) / (PLANT.h * PLANT.rows), v0 = ((strip + 1) * PLANT.h - PLANT.pad) / (PLANT.h * PLANT.rows);
  const tmp = new Vector3();
  for (let i = 0; i < n; i++) {
    // A direction on the sphere, a radius biased to the shell.
    const th = rng.next() * Math.PI * 2, ph = Math.acos(rng.range(-0.55, 1));
    const dir = new Vector3(Math.sin(ph) * Math.cos(th), Math.cos(ph), Math.sin(ph) * Math.sin(th));
    const rad = rng.range(0.55, 1.0);
    const pos = new Vector3(cx + dir.x * rx * rad, cy + dir.y * ry * rad, cz + dir.z * rz * rad);
    // The card lies across the surface: its width along a horizontal tangent, tilted out by the direction's lift.
    const tx = -Math.sin(th + rng.range(-0.5, 0.5)), tz = Math.cos(th + rng.range(-0.5, 0.5));
    const w = size * rng.range(0.8, 1.2), h = w * 0.5;
    const tilt = rng.range(-0.25, 0.35) + dir.y * 0.5;
    // Up-the-card vector: mostly the surface's tilt away from vertical.
    const upx = dir.x * Math.sin(tilt) * 0.9, upz = dir.z * Math.sin(tilt) * 0.9, upy = Math.cos(tilt);
    const l = Math.hypot(upx, upy, upz) || 1;
    const ux = (upx / l) * h / 2, uy = (upy / l) * h / 2, uz = (upz / l) * h / 2;
    const ax = tx * w / 2, az = tz * w / 2;
    const shade = rng.range(0.82, 1.16) * (0.75 + 0.25 * Math.max(0, Math.min(1, (dir.y + 1) / 1.6)));
    const c: RGB = [Math.min(1.2, tint[0] * shade), Math.min(1.2, tint[1] * shade), Math.min(1.2, tint[2] * shade)];
    tmp.set(dir.x * 0.5, 0.9, dir.z * 0.5).normalize();
    const flip = rng.next() < 0.5 ? -1 : 1;
    const q = [
      [pos.x - ax - ux, pos.y - uy, pos.z - az - uz, flip < 0 ? 1 : 0, v0],
      [pos.x + ax - ux, pos.y - uy, pos.z + az - uz, flip < 0 ? 0 : 1, v0],
      [pos.x + ax + ux, pos.y + uy, pos.z + az + uz, flip < 0 ? 0 : 1, v1],
      [pos.x - ax + ux, pos.y + uy, pos.z - az + uz, flip < 0 ? 1 : 0, v1],
    ] as const;
    const ids = q.map((p) => g.vertex(p[0], p[1], p[2], tmp.x, tmp.y, tmp.z, p[3], p[4], c));
    g.tri(ids[0]!, ids[1]!, ids[2]!);
    g.tri(ids[0]!, ids[2]!, ids[3]!);
  }
}
