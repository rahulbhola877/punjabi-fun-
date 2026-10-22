import { describe, expect, it } from "vitest";
import { newSave, validate } from "../src/save/schema";
import { SHOPS, TRADE, goodsItem } from "../src/missions/Shops";
import { CITY_SHOPS } from "../src/world/cityShops";
import { OUTER_BUILDINGS } from "../src/world/region";
import { isOpenGround } from "../src/world/layout";

describe("shops with goods", () => {
  it("keeps the bag in the save, dropping junk", () => {
    const d = { ...newSave("preet", { x: 0, z: 0, yaw: 0 }, []), bag: { atta: 2, shawl: 500, bad: -1, "<x>": 3, kara: "1" } };
    expect(validate(d, ["preet"], { minX: -9, maxX: 9, minZ: -9, maxZ: 9 }).bag).toEqual({ atta: 2, shawl: 99 });
    const old = { ...newSave("preet", { x: 0, z: 0, yaw: 0 }, []) } as Record<string, unknown>;
    delete old.bag;
    expect(validate(old, ["preet"], { minX: -9, maxX: 9, minZ: -9, maxZ: 9 }).bag).toEqual({});
  });
  it("prices every item and finds every bag item by id", () => {
    for (const shop of [...SHOPS, ...Object.values(TRADE)]) {
      expect(shop.items.length).toBeGreaterThan(0);
      for (const it of shop.items) {
        expect(it.cost).toBeGreaterThan(0);
        if (it.kind === "goods") expect(goodsItem(it.id)).toBeTruthy();
        if (it.snack) expect(it.heal).toBeGreaterThan(0);
      }
    }
  });
  it("puts a counter in front of signed city shops, on the street, keeper inside", () => {
    expect(CITY_SHOPS.length).toBeGreaterThan(100);
    const kinds = new Set(CITY_SHOPS.map((c) => c.trade));
    for (const k of ["cMobile", "cCloth", "cMithai", "lHosiery"]) expect(kinds.has(k)).toBe(true);
    const inside = (x: number, z: number) => OUTER_BUILDINGS.some((b) => x > b.x0 && x < b.x1 && z > b.z0 && z < b.z1);
    for (const c of CITY_SHOPS) {
      expect(inside(c.cx, c.cz), `${c.id} counter`).toBe(false);
      expect(isOpenGround(c.cx, c.cz), `${c.id} counter on open ground`).toBe(true);
      const b = OUTER_BUILDINGS.find((q) => q.id === c.id)!;
      expect(c.x > b.x0 && c.x < b.x1 && c.z > b.z0 && c.z < b.z1, `${c.id} keeper`).toBe(true);
    }
  });
});
