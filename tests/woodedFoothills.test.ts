import { describe, expect, it } from "vitest";
import { hillBase, hillY, terrainGrid } from "../src/world/hillTerrain";
import { OUTER_BUILDINGS, PLOTS, ROADS, SITES } from "../src/world/region";
import { RAIL } from "../src/world/Rail";
import { grassy } from "../src/world/grass";
import { onWoodlandTrail } from "../src/world/woodlandTrail";

describe("wooded foothills", () => {
  it("raises the woodland while easing to flat ground at the railway and the terrain edge", () => {
    expect(hillY(1260, 641)).toBeGreaterThan(9);
    expect(hillY(1390, 657)).toBeGreaterThan(12);
    for (const x of [1104, 1140, 1260, 1390, 1500]) {
      expect(hillY(x, RAIL.z + RAIL.half)).toBe(0);
      expect(hillY(x, 720)).toBe(0);
    }
  });

  it("keeps raised ground clear of existing roads, plots, buildings and sites", () => {
    const occupied = [...ROADS, ...PLOTS, ...OUTER_BUILDINGS, ...SITES];
    for (let x = 1140; x <= 1482; x += 2) for (let z = 572; z <= 720; z += 2) {
      if (hillBase(x, z) < 0.01) continue;
      expect(occupied.some((r) => x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1), `${x}, ${z}`).toBe(false);
    }
  });

  it("uses the same heights for visible terrain and its collision grid", () => {
    const grid = terrainGrid();
    for (const [x, z] of [[1260, 640], [1390, 656], [1300, 592]]) {
      const i = (x - grid.x0) / grid.step, j = (z - grid.z0) / grid.step;
      expect(grid.y[j * grid.nx + i]).toBeCloseTo(hillY(x, z), 5);
    }
  });

  it("keeps grass off the woodland trail while preserving nearby ground cover", () => {
    expect(onWoodlandTrail(1260, 641)).toBe(true);
    expect(grassy(1260, 641, [])).toBe(false);
    expect(onWoodlandTrail(1260, 630)).toBe(false);
    expect(grassy(1260, 630, [])).toBe(true);
  });
});
