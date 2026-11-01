import { describe, expect, it } from "vitest";
import { canadaFolk } from "../src/crowds/canadaFolk";
import { CANADA_SET, CANADA_CHECKIN, CANADA_ARRIVAL, CANADA_HOMES, CANADA_SIDEWALKS } from "../src/world/travelDistrictLayout";
import { isOpenGround, VEHICLE_SPAWNS } from "../src/world/layout";
import { SPECS } from "../src/vehicles/specs";
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

  it("parks the neighbourhood vehicles clear of sidewalks, homes and the arrival", () => {
    const parking = VEHICLE_SPAWNS.filter((v) => v.id === "car_canada" || v.id === "pickup_canada");
    expect(parking).toHaveLength(2);
    for (const v of parking) {
      const halfWidth = SPECS[v.type].halfWidth;
      for (const z of CANADA_SIDEWALKS) expect(Math.abs(v.z - z)).toBeGreaterThan(halfWidth + 1.5);
      expect(Math.hypot(v.x - CANADA_ARRIVAL.x, v.z - CANADA_ARRIVAL.z)).toBeGreaterThan(10);
      // Both cars face along X; 3m accounts for their half-length and margin.
      for (const home of CANADA_HOMES) {
        const xOverlap = Math.abs(v.x - home.x) < 5.2 * home.scale / 2 + 3;
        const zOverlap = Math.abs(v.z - home.z) < 4.2 * home.scale / 2 + halfWidth;
        expect(xOverlap && zOverlap).toBe(false);
      }
    }
  });

  it("provides a real café purchase at a clear outdoor shop approach", () => {
    const shop = OUTDOOR_SHOPS.find((s) => s.id === "canadaCafe");
    expect(shop).toBeDefined();
    expect(shop!.keeper).toBe("keeper_canadaCafe");
    expect(shop!.cx).toBe(1130);
    expect(shop!.cz).toBeGreaterThan(1832.5);
    expect(shop!.cz).toBeLessThan(1843);
    expect(isOpenGround(shop!.x, shop!.z)).toBe(true);
    expect(isOpenGround(shop!.cx, shop!.cz)).toBe(true);
    expect(CITY_SHOPS).not.toContain(shop);
    expect(ALL_CITY_SHOPS).toContain(shop);
    expect(TRADE[shop!.trade]!.items.some((item) => item.id === "canada_cocoa" && item.cost > 0 && item.kind === "food")).toBe(true);
    expect(TRADE[shop!.trade]!.items.some((item) => item.id === "canada_biscuit" && item.cost > 0 && item.kind === "goods")).toBe(true);
  });
});
