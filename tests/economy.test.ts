import { describe, expect, it } from "vitest";
import { DISTRICTS, bandMultiplier, bandOf, districtAt, districtTier, priceOf } from "../src/economy/Prices";
import { Ledger, emptyEcon, sanitizeEcon, summaryRows } from "../src/economy/Ledger";
import { FESTIVALS, dateOf } from "../src/world/Calendar";

describe("districts", () => {
  it("find the places the game is built around", () => {
    expect(districtAt(0, 0)).toBe("ranggarh");
    expect(districtAt(-12, 316)).toBe("kotli");
    expect(districtAt(-415, -245)).toBe("ludhiana");
    expect(districtAt(468, -84)).toBe("nawan");
    expect(districtAt(-496, -125)).toBe("ludhiana");
    expect(districtAt(300, 700)).toBe("road");
    expect(new Set(DISTRICTS).size).toBe(5);
  });
});

describe("price bands", () => {
  it("make the village cheap and Ludhiana dear for the same thing on the same day", () => {
    const v = bandMultiplier("kotli", 5, "jalebi", "food"), l = bandMultiplier("ludhiana", 5, "jalebi", "food");
    expect(v).toBeLessThan(1);
    expect(l).toBeGreaterThan(1);
    expect(bandOf(v)).toBe("sasta");
    expect(bandOf(bandMultiplier("road", 5, "jalebi", "food", 0))).not.toBe("sasta");
  });

  it("are the same all day but not every day, and never move tools or clothes", () => {
    expect(bandMultiplier("ranggarh", 9, "atta", "goods")).toBe(bandMultiplier("ranggarh", 9, "atta", "goods"));
    const days = new Set<number>();
    for (let d = 0; d < 30; d++) days.add(Math.round(bandMultiplier("ranggarh", d, "atta", "goods") * 1000));
    expect(days.size).toBeGreaterThan(10);
    expect(bandMultiplier("road", 3, "bungee", "perk")).toBe(1);
    expect(bandMultiplier("road", 3, "kurta", "outfit")).toBe(1);
  });

  it("are dearer on a festival, and cheaper to someone the district knows", () => {
    const fest = FESTIVALS[0]!.month * 4 + FESTIVALS[0]!.dom;
    expect(dateOf(fest).festival).toBeTruthy();
    const plain = [0, 1, 2].map((d) => bandMultiplier("ranggarh", d, "x", "food")).reduce((a, b) => a + b) / 3;
    expect(bandMultiplier("ranggarh", fest, "x", "food")).toBeGreaterThan(plain);
    expect(bandMultiplier("ranggarh", 4, "x", "food", 60)).toBeLessThan(bandMultiplier("ranggarh", 4, "x", "food", 0));
    expect(districtTier(0).name).toBe("Anjaan");
    expect(districtTier(25).name).toBe("Maana hoya");
    expect(districtTier(500).next).toBeNull();
  });

  it("round to whole rupees, and to five above a hundred", () => {
    expect(priceOf(20, 1.08)).toBe(22);
    expect(priceOf(650, 1.08)).toBe(700);
    expect(priceOf(1, 0.6)).toBe(1);
  });
});

describe("the ledger", () => {
  it("closes a day and opens another, keeping the unread summary", () => {
    const l = new Ledger(emptyEcon(0));
    l.earn("tiffin", 120); l.spend("fuel", 40); l.repGain("ranggarh", 3);
    expect(l.roll(0)).toBe(false);
    expect(l.roll(1)).toBe(true);
    expect(l.f.last?.inc.tiffin).toBe(120);
    expect(l.f.today.day).toBe(1);
    expect(l.rep("ranggarh")).toBe(3);
    l.f.shown = 1;
    l.roll(2);
    expect(l.f.last).toBeNull();
  });

  it("reads out in rows with the net, the tiffins and tomorrow", () => {
    const l = new Ledger(emptyEcon(2));
    l.earn("delivery", 200); l.earn("tiffin", 300); l.spend("ingredients", 80);
    l.f.today.tiffins = 5;
    l.repGain("kotli", 4);
    const rows = summaryRows(l.f.today, l.f, 20400, 0, 2);
    expect(rows.find((r) => r[0] === "Aaj di bachat")?.[1]).toBe("+₹420");
    expect(rows.some((r) => r[0] === "Tiffins pahunche")).toBe(true);
    expect(rows.find((r) => r[0].startsWith("Pind Kotli"))).toBeTruthy();
    expect(rows[rows.length - 1]![0]).toBe("Kal");
  });

  it("survives a corrupt save", () => {
    expect(sanitizeEcon(null, 3).today.day).toBe(3);
    const f = sanitizeEcon({ today: { day: "x", inc: { fuel: "a", ok: 5 } }, districtRep: { "bad key!": 1, kotli: 2 }, tiffinDone: [1, "tailor"] }, 7);
    expect(f.today.inc).toEqual({ ok: 5 });
    expect(f.districtRep).toEqual({ kotli: 2 });
    expect(f.tiffinDone).toEqual(["tailor"]);
  });
});

import { TIFFIN, TIFFIN_CUSTOMERS, ordersFor, routeOf, settle } from "../src/economy/Tiffin";

describe("the tiffin round", () => {
  it("sends six to ten regulars, a different mix each day, more to someone the districts know", () => {
    const none = () => 0, known = () => 2;
    for (let d = 0; d < 20; d++) { const n = ordersFor(d, none).length; expect(n).toBeGreaterThanOrEqual(6); expect(n).toBeLessThanOrEqual(10); }
    expect(ordersFor(3, known).length).toBe(10);
    expect(ordersFor(3, none).map((c) => c.id)).toEqual(ordersFor(3, none).map((c) => c.id));
    const mixes = new Set<string>();
    for (let d = 0; d < 20; d++) mixes.add(ordersFor(d, none).map((c) => c.id).join());
    expect(mixes.size).toBeGreaterThan(5);
    expect(new Set(TIFFIN_CUSTOMERS.map((c) => c.id)).size).toBe(TIFFIN_CUSTOMERS.length);
  });

  it("pays a tip in the lunch rush only, and less for cold food", () => {
    const on = settle(12.5, 100), early = settle(9, 100), late = settle(14, 100), spilled = settle(12.5, 20);
    expect(on.kind).toBe("ontime"); expect(on.tip).toBeGreaterThan(0);
    expect(early.kind).toBe("early"); expect(early.tip).toBe(0);
    expect(late.kind).toBe("late"); expect(late.tip).toBe(0); expect(late.pay).toBeLessThan(on.pay);
    expect(spilled.pay).toBeLessThan(on.pay);
    expect(settle(12.5, 100, 1.2).tip).toBeGreaterThanOrEqual(on.tip);
    expect(TIFFIN.price - TIFFIN.cost).toBeGreaterThan(20);
  });

  it("visits the nearest customer first", () => {
    const route = routeOf(TIFFIN_CUSTOMERS.slice(0, 5), { x: 5, z: -30 });
    expect(route[0]!.id).toBe("tailor");
    expect(new Set(route.map((c) => c.id)).size).toBe(5);
  });
});
