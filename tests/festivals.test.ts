import { describe, expect, it } from "vitest";
import { FESTIVALS, dateOf } from "../src/world/Calendar";
import { FEST_HOURS, FEST_PROCESSIONS, bonfireSpots, festivalNow, melaSpot, swingSpot } from "../src/world/Festivals";
import { SITES } from "../src/world/region";

const dayOf = (id: string) => { const f = FESTIVALS.find((x) => x.id === id)!; return f.month * 4 + f.dom; };

describe("festival days", () => {
  it("know their own hours", () => {
    for (const f of FESTIVALS) {
      expect(FEST_HOURS[f.id], f.id).toBeTruthy();
      const d = dayOf(f.id);
      expect(dateOf(d).festival?.id).toBe(f.id);
      const [a, b] = FEST_HOURS[f.id]!;
      expect(festivalNow(d, a + 0.1)?.on).toBe(true);
      expect(festivalNow(d, a - 0.5)?.on).toBe(false);
      if (b < 24) expect(festivalNow(d, b + 0.1)?.on).toBe(false);
    }
    expect(festivalNow(1, 12)).toBeNull();
    // They come round again next year.
    expect(festivalNow(dayOf("lohri") + 48, 19)?.festival.id).toBe("lohri");
  });

  it("send their processions out inside their hours", () => {
    for (const [id, list] of Object.entries(FEST_PROCESSIONS)) for (const p of list) {
      const [a, b] = FEST_HOURS[id]!;
      expect(p.at).toBeGreaterThanOrEqual(a);
      expect(p.at + 1.5).toBeLessThanOrEqual(b + 1.5);
    }
  });

  it("light a bonfire in every colony park and by the chaupal, and put the mela and the swing on real ground", () => {
    const spots = bonfireSpots();
    expect(spots.length).toBeGreaterThanOrEqual(5);
    expect(spots.some((s) => s.id === "chaupal")).toBe(true);
    expect(new Set(spots.map((s) => s.id)).size).toBe(spots.length);
    const k = SITES.find((s) => s.id === "kabaddi")!;
    const m = melaSpot();
    expect(m.x).toBeGreaterThan(k.x0); expect(m.x).toBeLessThan(k.x1);
    const sw = swingSpot(), c = SITES.find((s) => s.id === "chaupal")!;
    expect(sw.x).toBeGreaterThan(c.x0); expect(sw.x).toBeLessThan(c.x1); expect(sw.z).toBeGreaterThan(c.z0); expect(sw.z).toBeLessThan(c.z1);
  });
});
