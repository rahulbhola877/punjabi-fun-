import { describe, expect, it } from "vitest";
import { WORLD_BOUNDS } from "../src/app/config";
import { BRIDGES, CANAL, ROADS, WORLD, inCanal, OUTER_BUILDINGS, PLOTS, SITES } from "../src/world/region";
import { buildRoadGraph } from "../src/world/nav";
import { BUS_ROUTES } from "../src/world/busRoutes";
import { COLONIES } from "../src/world/colonies";
import { CITY_SHOPS } from "../src/world/cityShops";
import { ROUTE_PLACES } from "../src/missions/Places";
import { planRoutes } from "../src/traffic/busPlan";
import { RAIL, RAIL_CROSSINGS, gateAheadAtTime, gateClosed } from "../src/world/Rail";
import { NORTH_WAYSIDE, onWaysideSurface } from "../src/world/northWaysideLayout";

describe("expanded district", () => {
  it("adds inhabited streets, usable shops and bus-connected destinations", () => {
    const c = COLONIES.find(c => c.id === "bypass")!;
    expect(OUTER_BUILDINGS.filter(b => b.id.startsWith("bypassH")).length).toBeGreaterThan(20);
    expect(CITY_SHOPS.filter(s => s.id.startsWith("bypass")).length).toBe(6);
    const g = buildRoadGraph(), start = g.nearest(0, -160);
    for (const r of c.roads) expect(g.path(start, g.nearest((r.x0+r.x1)/2,(r.z0+r.z1)/2)).length).toBeGreaterThan(1);
    for (const s of SITES.filter(s => s.id.startsWith("bypass"))) expect(ROUTE_PLACES.some(p => p.id === s.id)).toBe(true);
    expect(BUS_ROUTES.find(r => r.id === "r4")!.stops).toContain("bypassMandi");
  });
  it("shares playable bounds and connects every bypass to the original network", () => {
    expect(WORLD).toBe(WORLD_BOUNDS);
    // The northern extension adds the orchard while keeping the old district.
    expect(WORLD.maxZ).toBeGreaterThanOrEqual(1500);
    const g = buildRoadGraph(), start = g.nearest(0, -160);
    const orchardRoad = ROADS.find(r => r.id === "orchardEast")!;
    expect(g.path(start, g.nearest(orchardRoad.x1 - 2, 1230)).length).toBeGreaterThan(1);
    for (const r of ROADS.filter(r => r.id.startsWith("bypass"))) {
      const x = (r.x0 + r.x1) / 2, z = (r.z0 + r.z1) / 2;
      expect(g.path(start, g.nearest(x,z)).length, r.id).toBeGreaterThan(1);
      for (const b of [...OUTER_BUILDINGS, ...SITES]) {
        expect(r.x0 < b.x1 && r.x1 > b.x0 && r.z0 < b.z1 && r.z1 > b.z0, `${r.id}/${b.id}`).toBe(false);
      }
    }
    expect(planRoutes(g).map(p => p.route.id).sort()).toEqual(BUS_ROUTES.map(r => r.id).sort());
  });
  it("builds a hill station across the canal, reached from the Eastern Bypass, with its own civic sites", () => {
    const c = COLONIES.find(c => c.id === "hill")!;
    expect(c.kerbTree).toBe("pine");
    expect(c.rect.x1).toBeLessThanOrEqual(WORLD.maxX);
    expect(inCanal(c.centre.x, c.centre.z)).toBe(false);
    for (const id of ["hillBusAdda", "hillPetrol", "hillThana", "hillClock", "hillMandir", "hillView"]) expect(SITES.some(s => s.id === id), id).toBe(true);
    expect(OUTER_BUILDINGS.filter(b => b.id.startsWith("hillShop")).length).toBeGreaterThan(10);
    const g = buildRoadGraph();
    expect(g.path(g.nearest(0, -160), g.nearest(c.centre.x, c.centre.z)).length).toBeGreaterThan(1);
  });
  it("builds real bridges for both new canal crossings", () => {
    for (const x of [-1100, 1100]) {
      expect(BRIDGES.some(b => b.x === x && b.w >= 12)).toBe(true);
      expect(inCanal(x, (CANAL.z0 + CANAL.z1) / 2)).toBe(false);
    }
  });
  it("connects the northern ridge approach while keeping generated fields clear of its road", () => {
    expect(WORLD.maxZ).toBeGreaterThanOrEqual(2100);
    const roads = ROADS.filter(r => r.id.startsWith("northRidge"));
    expect(roads).toHaveLength(4);
    const g = buildRoadGraph();
    expect(g.path(g.nearest(0, -160), g.nearest(-600, 1765)).length).toBeGreaterThan(1);
    for (const r of roads) for (const p of PLOTS) {
      expect(r.x0 < p.x1 && r.x1 > p.x0 && r.z0 < p.z1 && r.z1 > p.z0, `${r.id}/${p.id}`).toBe(false);
    }
    expect(ROUTE_PLACES.some(p => p.id === "northRidge")).toBe(true);
    expect(ROUTE_PLACES.some(p => p.id === "northWayside")).toBe(true);
    expect(ROUTE_PLACES.some(p => p.id === "northAirfield")).toBe(true);
    expect(PLOTS.some(p => p.x0 < NORTH_WAYSIDE.x1 && p.x1 > NORTH_WAYSIDE.x0 && p.z0 < NORTH_WAYSIDE.z1 && p.z1 > NORTH_WAYSIDE.z0)).toBe(false);
    expect(onWaysideSurface(196, 1563)).toBe(true);
    expect(onWaysideSurface(201, 1591)).toBe(true);
    expect(onWaysideSurface(185, 1605)).toBe(false);
  });
  it("closes each crossing for the train at that crossing, in both directions", () => {
    for (const c of RAIL_CROSSINGS) for (const dir of [1,-1]) {
      const t = RAIL.first + (dir === -1 ? RAIL.period : 0) + (RAIL.reach + dir * c.x) / RAIL.speed;
      expect(gateClosed(t,c.x)).toBe(true);
      expect(gateAheadAtTime({x:c.x-2,z:RAIL.z-30},0,1,t)).toBeCloseTo(21.8);
      expect(gateClosed(t+30,c.x)).toBe(false);
    }
  });
});
