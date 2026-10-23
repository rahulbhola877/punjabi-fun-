import { describe, expect, it } from "vitest";
import { kitLookFor } from "../src/crowds/kitLooks";
import { randomAppearance, constableLook } from "../src/characters/appearances";
import { getOutfit, communityOf } from "../src/kit/outfits";

describe("kit looks for residents", () => {
  const looks = Array.from({ length: 600 }, (_, i) => ({ id: `r${i}`, a: randomAppearance(100 + i * 13) }));

  it("always gives an outfit made for the archetype, the same one every time", () => {
    for (const { id, a } of looks) {
      const l = kitLookFor(id, a);
      const o = getOutfit(l.outfit)!;
      expect(o, l.outfit).toBeTruthy();
      expect(o.for).toContain(l.archetype);
      expect(kitLookFor(id, a)).toEqual(l);
    }
  });

  it("keeps age and sex, turbans stay Sikh, and the crowd is mixed", () => {
    const comm = new Set<string>(), outfits = new Set<string>();
    for (const { id, a } of looks) {
      const l = kitLookFor(id, a);
      const want = a.age === "child" ? (a.sex === "f" ? "girl" : "boy") : a.age === "elder" ? (a.sex === "f" ? "aunty" : "uncle") : a.sex === "f" ? "female" : "male";
      expect(l.archetype).toBe(want);
      if (a.sex === "m" && a.headwear === "turban") expect(communityOf(getOutfit(l.outfit)!)).toBe("sikh");
      comm.add(communityOf(getOutfit(l.outfit)!));
      outfits.add(l.outfit);
    }
    for (const c of ["sikh", "hindu", "muslim", "christian", "universal"]) expect(comm.has(c), c).toBe(true);
    expect(outfits.size).toBeGreaterThan(20);
  });

  it("dresses constables in uniform", () => {
    for (let i = 0; i < 6; i++) expect(kitLookFor(`beat${i}`, constableLook(i), true).outfit).toMatch(/^police/);
  });
});
