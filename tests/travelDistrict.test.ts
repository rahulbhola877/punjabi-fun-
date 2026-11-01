import { describe, expect, it } from "vitest";
import { WORLD_BOUNDS } from "../src/app/config";
import { grassy } from "../src/world/grass";
import { buildRoadGraph } from "../src/world/nav";
import { PLOTS } from "../src/world/region";
import { AIRFIELD_ARRIVAL, AIRFIELD_CHECKIN, CANADA_ARRIVAL, CANADA_CHECKIN, CANADA_SET, NORTH_AIRFIELD } from "../src/world/travelDistrictLayout";

const inRect = (p: {x: number; z: number}, r: {x0: number; x1: number; z0: number; z1: number}) =>
  p.x >= r.x0 && p.x <= r.x1 && p.z >= r.z0 && p.z <= r.z1;

describe("regional travel locations", () => {
  it("keeps the arrival and check-in points in their authored areas, inside the playable world", () => {
    for (const p of [AIRFIELD_ARRIVAL, AIRFIELD_CHECKIN]) expect(inRect(p, NORTH_AIRFIELD)).toBe(true);
    for (const p of [CANADA_ARRIVAL, CANADA_CHECKIN]) expect(inRect(p, CANADA_SET)).toBe(true);
    for (const p of [AIRFIELD_ARRIVAL, AIRFIELD_CHECKIN, CANADA_ARRIVAL, CANADA_CHECKIN]) {
      expect(p.x).toBeGreaterThan(WORLD_BOUNDS.minX);
      expect(p.x).toBeLessThan(WORLD_BOUNDS.maxX);
      expect(p.z).toBeGreaterThan(WORLD_BOUNDS.minZ);
      expect(p.z).toBeLessThan(WORLD_BOUNDS.maxZ);
      expect(grassy(p.x, p.z, PLOTS)).toBe(false);
    }
  });
  it("connects the airfield approach to the old road network", () => {
    const graph = buildRoadGraph();
    expect(graph.path(graph.nearest(0, -160), graph.nearest(635, 1665)).length).toBeGreaterThan(1);
  });
  it("connects the local Canadian-themed streets", () => {
    const graph = buildRoadGraph();
    expect(graph.path(graph.nearest(1045, 1710), graph.nearest(1280, 1820)).length).toBeGreaterThan(1);
    expect(graph.path(graph.nearest(635, 1665), graph.nearest(1280, 1820)).length).toBeGreaterThan(1);
  });
});
