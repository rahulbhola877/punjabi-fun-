import { describe, expect, it } from "vitest";
import { inOuterCore, OUTER_CORE, OUTER_EXTENT, OUTER_STEP, OUTER_TILE, outerBiome, outerHeight, outerTiles, outerVertexHeight } from "../src/world/outerTerrain";

describe("experimental outer terrain", () => {
  it("partitions a 7x area around the untouched existing district", () => {
    const width = OUTER_EXTENT.maxX - OUTER_EXTENT.minX, depth = OUTER_EXTENT.maxZ - OUTER_EXTENT.minZ;
    const core = (OUTER_CORE.maxX - OUTER_CORE.minX) * (OUTER_CORE.maxZ - OUTER_CORE.minZ);
    expect(width * depth).toBeGreaterThanOrEqual(7 * core);
    const tiles = outerTiles();
    expect(tiles.length * OUTER_TILE ** 2 + core).toBe(width * depth);
    expect(new Set(tiles.map((t) => t.id)).size).toBe(tiles.length);
    for (const t of tiles) expect(inOuterCore((t.x0 + t.x1) / 2, (t.z0 + t.z1) / 2)).toBe(false);
    expect(new Set(tiles.map((t) => t.biome))).toEqual(new Set(["woodland", "highlands", "dunes", "northland"]));
  });

  it("joins the old district and its highway at ground height", () => {
    for (let x = OUTER_CORE.minX; x <= OUTER_CORE.maxX; x += OUTER_STEP) {
      expect(outerHeight(x, OUTER_CORE.minZ)).toBe(0);
      expect(outerHeight(x, OUTER_CORE.maxZ)).toBe(0);
    }
    for (let z = OUTER_CORE.minZ; z <= OUTER_CORE.maxZ; z += OUTER_STEP) {
      expect(outerHeight(OUTER_CORE.minX, z)).toBe(0);
      expect(outerHeight(OUTER_CORE.maxX, z)).toBe(0);
    }
    for (let x = OUTER_EXTENT.minX; x <= OUTER_EXTENT.maxX; x += OUTER_STEP) expect(outerHeight(x, -160)).toBe(0);
  });

  it("uses the same vertices and continuous interpolation on tile joins", () => {
    for (const [x, z] of [[-2400, 300], [2400, 600], [0, 3000], [600, -1800]]) {
      expect(outerHeight(x, z)).toBeCloseTo(outerVertexHeight(x, z), 6);
      expect(Math.abs(outerHeight(x - 0.001, z) - outerHeight(x + 0.001, z))).toBeLessThan(0.01);
      expect(Math.abs(outerHeight(x, z - 0.001) - outerHeight(x, z + 0.001))).toBeLessThan(0.01);
    }
    expect(outerBiome(-2500, 0)).toBe("woodland");
    expect(outerBiome(2500, 0)).toBe("highlands");
    expect(outerBiome(0, -2000)).toBe("dunes");
    expect(outerBiome(0, 3000)).toBe("northland");
  });

  it("keeps the oasis workshop and courtyard foundations grounded", () => {
    const ground = outerHeight(150, -1650);
    for (const x of [129.5, 138.5, 166.5]) for (const z of [-1660, -1652, -1636]) {
      expect(outerHeight(x, z), `${x}, ${z}`).toBeCloseTo(ground, 6);
    }
  });
});
