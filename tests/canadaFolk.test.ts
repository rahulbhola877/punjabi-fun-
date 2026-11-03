import { describe, expect, it } from "vitest";
import { canadaFolk } from "../src/crowds/canadaFolk";
import { CANADA_SET, CANADA_CHECKIN, CANADA_ARRIVAL } from "../src/world/travelDistrictLayout";
import { VEHICLE_SPAWNS } from "../src/world/layout";
import { countryFolk } from "../src/crowds/countryFolk";
import { ROUTE_PLACES } from "../src/missions/Places";
import { ALL_CITY_SHOPS, CITY_SHOPS, OUTDOOR_SHOPS } from "../src/world/cityShops";
import { TRADE } from "../src/missions/Shops";

describe("Canada-inspired neighbourhood residents", () => {
  it("has unique conversational residents inside the district, clear of arrivals", () => {
    const groups = canadaFolk();
    const defs = groups.flatMap((group) => group.defs);
    expect(new Set(defs.map((def) => def.id)).size).toBe(defs.length);
    expect(defs.length).toBeGreaterThanOrEqual(10);
    for (const def of defs) {
      expect(def.x).toBeGreaterThan(CANADA_SET.x0);
      expect(def.x).toBeLessThan(CANADA_SET.x1);
      expect(def.z).toBeGreaterThan(CANADA_SET.z0);
      expect(def.z).toBeLessThan(CANADA_SET.z1);
      expect(def.lines?.length).toBeGreaterThan(0);
      expect(def.locale).toBe("en-CA");
      expect(Math.hypot(def.x - CANADA_CHECKIN.x, def.z - CANADA_CHECKIN.z)).toBeGreaterThan(3);
      expect(Math.hypot(def.x - CANADA_ARRIVAL.x, def.z - CANADA_ARRIVAL.z)).toBeGreaterThan(3);
    }
  });

  it("keeps roaming destinations on the authored sidewalk strips", () => {
    const walkers = canadaFolk().flatMap((group) => group.defs).filter((def) => def.role === "roamer");
    expect(walkers.length).toBeGreaterThan(0);
    for (const def of walkers) {
      expect([1809, 1831]).toContain(def.z);
      expect(def.wander).toBeDefined();
      expect(def.wander!.x0).toBeGreaterThanOrEqual(1080);
      expect(def.wander!.x1).toBeLessThanOrEqual(1280);
      expect(def.wander!.z0).toBeGreaterThanOrEqual(def.z - 0.6);
      expect(def.wander!.z1).toBeLessThanOrEqual(def.z + 0.6);
    }
  });

  it("does not register retired population, vehicles, shops or routes", () => {
    const historicalIds = new Set(canadaFolk().flatMap(g => g.defs).map(d => d.id));
    const active = countryFolk().groups.flatMap(g => g.defs);
    expect(active.some(d => historicalIds.has(d.id) || d.id === "keeper_canadaCafe")).toBe(false);
    expect(VEHICLE_SPAWNS.filter(v => v.id === "car_canada" || v.id === "pickup_canada")).toHaveLength(0);
    expect([...ALL_CITY_SHOPS, ...CITY_SHOPS, ...OUTDOOR_SHOPS].some(s => s.id === "canadaCafe")).toBe(false);
    expect(ROUTE_PLACES.some(p => p.id === "canadaSet")).toBe(false);
  });

  it("retains item definitions for historical inventory", () => {
    expect(TRADE.canadaCafe!.items.some(item => item.id === "canada_cocoa" && item.kind === "food")).toBe(true);
    expect(TRADE.canadaCafe!.items.some(item => item.id === "canada_biscuit" && item.kind === "goods")).toBe(true);
  });
});
