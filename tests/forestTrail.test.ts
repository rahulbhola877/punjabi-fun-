import { describe, expect, it } from "vitest";
import { FOREST_ROUTE, FOREST_SHELTER, forestTrailDistance, inForestClearing, onForestTrail } from "../src/world/forestTrailLayout";
import { ridgeHeight, onRidgeRoad } from "../src/world/ridgeTerrain";
import { grassy } from "../src/world/grass";

describe("ridge spring trail", () => {
  it("joins the road and each keeper and water-control site", () => {
    const [startX, startZ] = FOREST_ROUTE[0];
    expect(onRidgeRoad(startX, startZ)).toBe(true);
    for (const [x, z] of [[-895, 1900], [-883, 1909], [-874, 1918], [-867, 1928]]) {
      expect(onForestTrail(x, z)).toBe(true);
      expect(grassy(x, z, [])).toBe(false);
    }
    expect(inForestClearing(FOREST_SHELTER.x, FOREST_SHELTER.z)).toBe(true);
    expect(grassy(FOREST_SHELTER.x, FOREST_SHELTER.z, [])).toBe(false);
  });

  it("follows traversable terrain and clears the entire path of grass", () => {
    let previous: number | undefined;
    for (let i = 1; i < FOREST_ROUTE.length; i++) {
      const [ax, az] = FOREST_ROUTE[i - 1]!, [bx, bz] = FOREST_ROUTE[i]!;
      const steps = Math.ceil(Math.hypot(bx - ax, bz - az));
      for (let j = 0; j <= steps; j++) {
        const x = ax + (bx - ax) * j / steps, z = az + (bz - az) * j / steps;
        expect(forestTrailDistance(x, z)).toBeLessThan(0.0001);
        expect(grassy(x, z, [])).toBe(false);
        const height = ridgeHeight(x, z);
        if (previous !== undefined) expect(Math.abs(height - previous)).toBeLessThan(0.35);
        previous = height;
      }
    }
  });
});
