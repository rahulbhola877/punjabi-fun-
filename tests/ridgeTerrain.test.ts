import { describe, expect, it } from "vitest";
import { RIDGE_BOUNDS, RIDGE_ROAD, RIDGE_STEP, RIDGE_VIEW, onRidgeRoad, ridgeHeight, ridgeVertexHeight } from "../src/world/ridgeTerrain";
import { hillY } from "../src/world/hillTerrain";
import { PLOTS } from "../src/world/region";
import { grassy } from "../src/world/grass";

describe("northern ridge", () => {
  it("joins the existing road and fades to level ground at its boundary", () => {
    const r = RIDGE_BOUNDS;
    for (let x = r.x0; x <= r.x1; x += RIDGE_STEP) {
      expect(ridgeHeight(x, r.z0)).toBeCloseTo(0, 7);
      expect(ridgeHeight(x, r.z1)).toBeCloseTo(0, 7);
    }
    for (let z = r.z0; z <= r.z1; z += RIDGE_STEP) {
      expect(ridgeHeight(r.x0, z)).toBeCloseTo(0, 7);
      expect(ridgeHeight(r.x1, z)).toBeCloseTo(0, 7);
    }
    expect(ridgeHeight(-600, 1766)).toBe(0);
    expect(ridgeHeight(RIDGE_VIEW.x, RIDGE_VIEW.z)).toBeGreaterThan(10);
  });

  it("uses the rendered terrain heights for the shared player and vehicle height", () => {
    for (const [x, z] of [[-788, 1932], [-760, 1912], [-820, 1964], [-632, 1832]]) {
      expect(ridgeHeight(x, z)).toBeCloseTo(ridgeVertexHeight(x, z), 6);
      expect(hillY(x, z)).toBeCloseTo(ridgeHeight(x, z), 6);
    }
  });

  it("keeps the road on a gently graded, continuous ascent", () => {
    let last = -Infinity;
    for (let i = 1; i < RIDGE_ROAD.length; i++) {
      const [ax, az] = RIDGE_ROAD[i - 1]!, [bx, bz] = RIDGE_ROAD[i]!;
      const length = Math.hypot(bx - ax, bz - az);
      const n = Math.ceil(length);
      for (let j = 0; j <= n; j++) {
        const x = ax + (bx - ax) * j / n, z = az + (bz - az) * j / n;
        const h = ridgeHeight(x, z);
        expect(onRidgeRoad(x, z)).toBe(true);
        expect(grassy(x, z, [])).toBe(false);
        if (Number.isFinite(last)) expect(Math.abs(h - last)).toBeLessThan(0.32);
        last = h;
      }
    }
  });

  it("reserves the ridge from generated crop plots", () => {
    for (const p of PLOTS) {
      expect(p.x0 < RIDGE_BOUNDS.x1 && p.x1 > RIDGE_BOUNDS.x0 && p.z0 < RIDGE_BOUNDS.z1 && p.z1 > RIDGE_BOUNDS.z0).toBe(false);
    }
  });
});
