import { describe, expect, it } from "vitest";
import { FESTIVALS, YEAR_DAYS, dateLabel, dateOf, fieldNow, nextFestival } from "../src/world/Calendar";

describe("the year", () => {
  it("starts on the first of Katak and has twelve months of four days", () => {
    expect(dateLabel(0)).toBe("1 Katak");
    expect(dateOf(YEAR_DAYS).year).toBe(1);
    expect(dateOf(YEAR_DAYS).month).toBe(0);
    expect(dateOf(7).name).toBe("Maghar");
  });

  it("has six festivals, each on a day of its own", () => {
    expect(FESTIVALS).toHaveLength(6);
    const seen = new Set<number>();
    for (let d = 0; d < YEAR_DAYS; d++) if (dateOf(d).festival) seen.add(d);
    expect(seen.size).toBe(6);
    expect(dateOf(3).festival?.id).toBe("diwali");
    expect(nextFestival(0)).toMatchObject({ inDays: 3 });
    expect(nextFestival(4).festival.id).toBe("gurpurab");
    // It wraps into next year.
    expect(nextFestival(40).festival.id).toBe("diwali");
  });
});

describe("the fields", () => {
  it("grow wheat through the cold months, cut it in Vaisakh, plant paddy in the rains", () => {
    expect(fieldNow("wheat", 1).bare).toBe(true);
    const a = fieldNow("wheat", 2), b = fieldNow("wheat", 4), c = fieldNow("wheat", 5);
    expect(a.crop).toBe("wheat");
    expect(a.grow).toBeLessThan(b.grow);
    expect(c.grow).toBe(1);
    expect(fieldNow("wheat", 6, 0).grow).toBe(1);
    expect(fieldNow("wheat", 6, 2).bare).toBe(true);
    expect(fieldNow("wheat", 7).bare).toBe(true);
    expect(fieldNow("wheat", 9).crop).toBe("paddy");
    expect(fieldNow("wheat", 0).crop).toBe("paddy");
  });

  it("keeps cane standing all year and fallow bare", () => {
    for (let m = 0; m < 12; m++) {
      expect(fieldNow("sugarcane", m).bare).toBe(false);
      expect(fieldNow("fallow", m).crop).toBe("fallow");
    }
  });

  it("never gives a bare field a crop, or a growing one none", () => {
    for (const base of ["wheat", "sarson", "paddy", "fodder"] as const) {
      for (let m = 0; m < 12; m++) {
        const f = fieldNow(base, m);
        expect(f.bare).toBe(f.crop === "fallow");
        if (!f.bare) expect(f.grow).toBeGreaterThan(0);
      }
    }
  });
});
