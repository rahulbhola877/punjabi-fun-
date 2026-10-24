import { describe, expect, it } from "vitest";
import { Fuel, TANKS, CAN } from "../src/vehicles/Fuel";

describe("fuel", () => {
  it("your Bullet starts full and runs down with distance", () => {
    const f = new Fuel({});
    expect(f.level("bullet_ghar", "motorcycle")).toBe(1);
    const l = f.burn("bullet_ghar", "motorcycle", TANKS.motorcycle!.range / 2);
    expect(l).toBeCloseTo(0.5, 5);
    f.burn("bullet_ghar", "motorcycle", 1e9);
    expect(f.level("bullet_ghar", "motorcycle")).toBe(0);
  });
  it("another vehicle starts with something in it, between 40% and 99%", () => {
    const f = new Fuel({});
    for (const id of ["auto_3", "car_9", "tractor_1", "jeep_2"]) {
      const l = f.level(id, "auto");
      expect(l).toBeGreaterThanOrEqual(0.4);
      expect(l).toBeLessThan(1);
    }
  });
  it("a fill costs what is missing, a can gives a third", () => {
    const f = new Fuel({ x: 0.5 });
    expect(f.cost("x", "motorcycle")).toBe(125);
    f.add("x", "motorcycle", CAN.gives);
    expect(f.level("x", "motorcycle")).toBeCloseTo(0.8, 5);
    f.fillUp("x");
    expect(f.cost("x", "motorcycle")).toBe(0);
    expect(f.toJSON()).toEqual({ x: 1 });
  });
  it("cycles have no tank", () => {
    const f = new Fuel({});
    expect(f.level("b", "bicycle")).toBe(1);
    expect(f.burn("b", "bicycle", 1e6)).toBe(1);
  });
});
