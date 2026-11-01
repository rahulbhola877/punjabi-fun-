import { describe, expect, it } from "vitest";
import { CORE_WORLD, PLOTS, ROADS } from "../src/world/region";

describe("the original district", () => {
  it("keeps its authored bounds and through roads when the playable world grows", () => {
    expect(CORE_WORLD).toEqual({ minX: -1200, maxX: 1500, minZ: -1200, maxZ: 2100 });
    for (const id of ["gt", "nehar"]) {
      const road = ROADS.find((r) => r.id === id)!;
      expect(road.x0).toBe(-1192);
      expect(road.x1).toBe(1492);
    }
  });

  it("keeps existing seeded plots stable for saved locations", () => {
    expect(PLOTS.find((p) => p.id === "plot0")).toEqual({ id: "plot0", x0: -1186, x1: -1109, z0: -1186, z1: -1109, crop: "wheat", rowsAlongX: false, seed: 1 });
    expect(PLOTS.find((p) => p.id === "plot1014")).toEqual({ id: "plot1014", x0: 251.7434068404138, x1: 292, z0: 1125.4269265055657, z1: 1186, crop: "fallow", rowsAlongX: false, seed: 1015 });
    expect(PLOTS.find((p) => p.id === "plot2031")).toEqual({ id: "plot2031", x0: 1437.6225936496924, x1: 1486, z0: 1438.308993692083, z1: 1486, crop: "paddy", rowsAlongX: true, seed: 2032 });
  });
});
