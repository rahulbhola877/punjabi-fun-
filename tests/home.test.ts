import { describe, expect, it } from "vitest";
import { mealAt } from "../src/missions/Home";
import { newSave, validate } from "../src/save/schema";
import { HOME } from "../src/world/home";
import { openHouseAt, openPlotAt } from "../src/world/openHouses";

describe("home", () => {
  it("has breakfast, lunch and dinner at the right hours", () => {
    expect(mealAt(6.9)).toBe(-1);
    expect(mealAt(7.5)).toBe(0);
    expect(mealAt(13.2)).toBe(1);
    expect(mealAt(16)).toBe(-1);
    expect(mealAt(20.5)).toBe(2);
    expect(mealAt(23)).toBe(-1);
  });

  it("keeps the home record in the save and starts with pocket money", () => {
    const s = newSave("jaggi", { x: 0, z: 0, yaw: 0 }, []);
    expect(s.money).toBe(20000);
    s.home = { day: 3, bless: 3, meal1: 2, bad: Number.NaN };
    const v = validate(JSON.parse(JSON.stringify(s)), ["jaggi"], { minX: -1000, maxX: 1000, minZ: -1000, maxZ: 1000 });
    expect(v.home).toEqual({ day: 3, bless: 3, meal1: 2 });
    expect(validate({ ...JSON.parse(JSON.stringify(s)), home: undefined }, ["jaggi"], { minX: -1000, maxX: 1000, minZ: -1000, maxZ: 1000 }).home).toEqual({});
  });

  it("puts the bed and the sofa inside the house, the Bullet and the start outside on the gali", () => {
    const H = HOME!;
    for (const p of [H.bed, H.bedSide, H.sofaFront, H.tv]) expect(openHouseAt(p.x, p.z)?.id).toBe(H.house.id);
    for (const p of [H.bike, H.start]) expect(openPlotAt(p.x, p.z)).toBe(null);
  });
});
