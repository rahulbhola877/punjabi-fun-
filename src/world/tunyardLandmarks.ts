import { Vector3 } from "../babylon";
import { rgb } from "../render/GeoBuilder";
import type { Kit } from "./Kit";

/**
 * Small, batched Babylon adaptations of Tunyard's procedural farm windpump and
 * stone well designs (rahulbhola877/tunyard, commit 4de2d594e9ea54553af1884ac1d2add62058a41b,
 * src/assets/farm/windpump.ts and src/assets/well.ts). Geometry is rebuilt with
 * this game's material and collision kit; there is no Three.js runtime asset.
 */

/** A compact wind-driven irrigation pump. Footprint: 3.4 × 3.4 m. */
export function tunyardWindpump(kit: Kit, x: number, z: number, rot = 0): void {
  kit.frame(x, z, rot);
  const steel = rgb("#a9aaa3"), dark = rgb("#535653"), vane = rgb("#a95a43");
  const metal = kit.g("metal");
  const p = (x: number, y: number, z: number) => new Vector3(x, y, z);
  const beam = (a: Vector3, b: Vector3, r = 0.035) => metal.tube(a, b, r, 5, steel);
  kit.g("concrete").box(0, 0.07, 0, 3.0, 0.14, 3.0, rgb("#c3bba9"));
  const bottom = 1.05, top = 0.25, h = 7.3;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    beam(p(sx * bottom, 0.14, sz * bottom), p(sx * top, h, sz * top), 0.045);
  }
  const half = (y: number) => bottom + (top - bottom) * (y - 0.14) / (h - 0.14);
  for (let i = 0; i < 5; i++) {
    const y0 = 0.25 + i * 1.4, y1 = Math.min(h, y0 + 1.4), a = half(y0), b = half(y1);
    for (const sign of [-1, 1]) {
      beam(p(-a, y0, sign * a), p(a, y0, sign * a), 0.025);
      beam(p(sign * a, y0, -a), p(sign * a, y0, a), 0.025);
      beam(p(-a, y0, sign * a), p(b, y1, sign * b), 0.02);
      beam(p(a, y0, sign * a), p(-b, y1, sign * b), 0.02);
      beam(p(sign * a, y0, -a), p(sign * b, y1, b), 0.02);
      beam(p(sign * a, y0, a), p(sign * b, y1, -b), 0.02);
    }
  }
  metal.box(0, h + 0.12, 0, 0.5, 0.3, 0.65, dark);
  beam(p(0, h + 0.2, 0), p(0, h + 0.2, -1.65), 0.04);
  const v0 = p(0, h - 0.1, -1.25), v1 = p(0, h - 0.1, -1.9), v2 = p(0, h + 0.65, -1.9), v3 = p(0, h + 0.5, -1.25);
  metal.quad(v0, v1, v2, v3, vane);
  metal.quad(v3, v2, v1, v0, vane);
  // Twelve individual blades are combined in the same chunked metal mesh.
  const cy = h + 0.28, cz = 0.42, n = 12;
  for (let i = 0; i < n; i++) {
    const a = i * Math.PI * 2 / n, b = a + 0.33;
    const at = (r: number, t: number) => p(Math.cos(t) * r, cy + Math.sin(t) * r, cz);
    const a0 = at(0.45, a), a1 = at(1.45, a), b1 = at(1.45, b), b0 = at(0.45, b);
    metal.quad(a0, a1, b1, b0, steel);
    metal.quad(b0, b1, a1, a0, steel);
  }
  metal.cylinderZ(0, cy, cz + 0.02, 0.17, 0.16, 10, dark);
  // Small pump housing and water outlet at ground level.
  metal.cylinder(0, 0.14, 0, 0.16, 0.12, 0.68, 8, dark);
  beam(p(0, 0.72, 0), p(1.3, 0.72, 0), 0.045);
  kit.collide(0, 0.7, 0, 2.2, 1.4, 2.2);
}

/** An open masonry well with a winch and bucket. Footprint: 2.4 × 2.4 m. */
export function tunyardWell(kit: Kit, x: number, z: number, rot = 0): void {
  kit.frame(x, z, rot);
  const stone = rgb("#d4c4a6"), wood = rgb("#a1815d"), iron = rgb("#5e5b53");
  kit.g("brick").cylinder(0, 0, 0, 0.86, 0.86, 0.85, 16, stone);
  kit.g("dark").cylinder(0, 0.855, 0, 0.65, 0.65, 0.01, 16, [1, 1, 1]);
  kit.g("concrete").torus(0, 0.88, 0, 0.76, 0.12, 16, 6, stone);
  for (const sx of [-1, 1]) kit.g("wood").box(sx * 0.77, 1.55, 0, 0.13, 1.45, 0.13, wood);
  kit.g("wood").cylinderX(0, 1.82, 0, 0.12, 1.65, 8, wood);
  kit.g("metal").tube(new Vector3(0.85, 1.82, 0), new Vector3(0.85, 1.45, 0), 0.035, 5, iron);
  kit.g("fabric").box(0, 1.37, 0, 0.025, 0.85, 0.025, rgb("#cab895"));
  kit.g("metal").cylinder(0, 0.88, 0, 0.17, 0.2, 0.27, 10, iron);
  kit.collide(0, 0.5, 0, 1.75, 1, 1.75);
}
