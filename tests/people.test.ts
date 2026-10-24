import { describe, expect, it } from "vitest";
import { countryFolk } from "../src/crowds/countryFolk";
import { dress, withNightShift } from "../src/crowds/cast";
import { onShift } from "../src/crowds/Crowd";
import { People, FAMILY_AT, FRIEND_AT, partOfDay, type Known } from "../src/crowds/People";

const lala: Known = { tie: "Mummy ji's ration shop", asks: "Mummy ji", gift: "biscuit" };
const first = () => 0;

describe("people who know the family", () => {
  it("starts everyone as known, and warms with kindness, cools with a slap", () => {
    const p = new People();
    expect(p.tier("a")).toBe("known");
    p.bump("a", FRIEND_AT);
    expect(p.tier("a")).toBe("friend");
    p.bump("a", FAMILY_AT);
    expect(p.tier("a")).toBe("family");
    expect(p.bump("b", -3)).toEqual({ tier: "cold", moved: true });
    expect(p.bump("b", -1).moved).toBe(false);
  });

  it("keeps rep inside its range", () => {
    const p = new People();
    p.bump("a", 500);
    expect(p.file("a").rep).toBe(30);
    p.bump("a", -500);
    expect(p.file("a").rep).toBe(-10);
  });

  it("the first meeting of a game day warms a little; more on the same day do not", () => {
    const p = new People();
    p.meet("a", 3); p.meet("a", 3); p.meet("a", 3);
    expect(p.file("a").met).toBe(3);
    expect(p.file("a").rep).toBe(0.5);
    p.meet("a", 4);
    expect(p.file("a").rep).toBe(1);
    // Ten days of calling in makes a friend.
    for (let d = 5; d < 14; d++) p.meet("a", d);
    expect(p.tier("a")).toBe("friend");
  });

  it("greets by name and by the hour; friends ask after the family", () => {
    const p = new People();
    const known = p.greet("a", lala, "Jaggi", 9, first);
    expect(known).toContain("Jaggi");
    expect(known).not.toContain("Mummy ji");
    p.bump("a", FRIEND_AT);
    expect(p.greet("a", lala, "Jaggi", 9, first)).toContain("Mummy ji");
    p.bump("b", -2);
    expect(p.greet("b", lala, "Jaggi", 14, first)).toMatch(/Hmph|Door|Oye/);
    expect(partOfDay(6)).toBe("morning");
    expect(partOfDay(13)).toBe("day");
    expect(partOfDay(19)).toBe("evening");
    expect(partOfDay(23)).toBe("night");
    expect(partOfDay(2)).toBe("night");
  });

  it("every tier has a line for every part of the day", () => {
    const p = new People();
    for (const tier of [-1, 0, FRIEND_AT, FAMILY_AT]) {
      p.files.t = { rep: tier, met: 0, day: -1, gifted: -1 };
      for (const h of [6, 13, 19, 23]) expect(p.greet("t", lala, "Jaggi", h, first).length).toBeGreaterThan(8);
    }
  });

  it("a friend hands over a gift once a day, a stranger never", () => {
    const p = new People();
    expect(p.giftToday("a", lala, 2)).toBeNull();
    p.bump("a", FRIEND_AT);
    expect(p.giftToday("a", lala, 2)?.item).toBe("biscuit");
    expect(p.giftToday("a", lala, 2)).toBeNull();
    expect(p.giftToday("a", lala, 3)?.item).toBe("biscuit");
    expect(p.giftToday("a", { tie: "x" }, 9)).toBeNull();
  });

  it("round-trips through the save without the people you never met", () => {
    const p = new People();
    p.meet("a", 1); p.bump("b", 0); p.bump("c", 2.345);
    const back = new People(JSON.parse(JSON.stringify(p.toJSON())));
    expect(Object.keys(back.files).sort()).toEqual(["a", "c"]);
    expect(back.file("c").rep).toBe(2.35);
    expect(back.file("a").met).toBe(1);
  });

  it("lists the people you have met, warmest first, with their names, and keeps them in the save", () => {
    const p = new People();
    p.label("a", "Lali uncle", "Mummy ji's ration shop"); p.meet("a", 1);
    p.label("b", "Tony", "Simran's recharge"); p.bump("b", FRIEND_AT); p.meet("b", 1);
    p.label("c", "Sethi ji", "cloth"); // never met, no opinion: not listed
    const list = p.list();
    expect(list.map((x) => x.name)).toEqual(["Tony", "Lali uncle"]);
    expect(list[0]!.tier).toBe("friend");
    const back = new People(JSON.parse(JSON.stringify(p.toJSON())));
    expect(back.list().map((x) => x.name)).toEqual(["Tony", "Lali uncle"]);
  });

  it("the families that know yours stand at their gates in the evening, and are home by dinner", () => {
    const gates = countryFolk().groups.flatMap((g) => g.defs).filter((d) => d.id.startsWith("gate_"));
    expect(gates.length).toBeGreaterThanOrEqual(8);
    for (const d of gates) {
      const who = dress(d);
      expect(who.known, d.id).toBeTruthy();
      expect(who.name).toMatch(/aunty|bebe/);
      expect(onShift(18.5, who.shift!)).toBe(true);
      expect(onShift(10, who.shift!)).toBe(false);
      expect(onShift(22, who.shift!)).toBe(false);
    }
  });

  it("school children and staff keep school hours; ordinary street folk go home at night", () => {
    const kid = withNightShift({ id: "student1", name: "School kid", role: "roamer", x: 0, z: 0, yaw: 0, look: { sex: "m", age: "child", topColor: "#f5f5f5", bottomColor: "#1a237e" } as never });
    expect(onShift(10, kid.shift!)).toBe(true);
    expect(onShift(17, kid.shift!)).toBe(false);
    const walker = withNightShift({ id: "ludh5", name: "Shehri", role: "walker", x: 0, z: 0, yaw: 0, look: { sex: "m", age: "adult" } as never });
    expect(onShift(15, walker.shift!)).toBe(true);
    expect(onShift(23.9, walker.shift!)).toBe(false);
    expect(onShift(3, walker.shift!)).toBe(false);
  });
});
