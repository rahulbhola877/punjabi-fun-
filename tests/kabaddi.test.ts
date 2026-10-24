import { describe, expect, it } from "vitest";
import { BREATH, court, inEnemyHalf, oppScore, outOfCourt, resultOf, stepHold } from "../src/minigames/Kabaddi";
import { Rng } from "../src/render/textures";

describe("kabaddi rules", () => {
  it("count the other half from the midline", () => {
    const c = court();
    expect(inEnemyHalf(c.cx - 1, c.cx)).toBe(false);
    expect(inEnemyHalf(c.cx + 1, c.cx)).toBe(true);
    expect(outOfCourt(c.cx, c.cz, c)).toBe(false);
    expect(outOfCourt(c.cx + c.r + 2, c.cz, c)).toBe(true);
    expect(BREATH).toBeGreaterThan(8);
  });

  it("catch you when two defenders hold on for a moment, or one for two seconds", () => {
    let h = { two: 0, one: 0 };
    let held = false;
    for (let i = 0; i < 20; i++) { const s = stepHold(h, [1.0, 1.1, 5], 0.05); h = s.hold; held = held || s.held; }
    expect(held).toBe(true);
    h = { two: 0, one: 0 }; held = false;
    for (let i = 0; i < 20; i++) { const s = stepHold(h, [0.8, 4], 0.05); h = s.hold; held = held || s.held; }
    expect(held).toBe(false);
    for (let i = 0; i < 60; i++) { const s = stepHold(h, [0.8, 4], 0.05); h = s.hold; held = held || s.held; }
    expect(held).toBe(true);
  });

  it("let go of you when the defenders fall away", () => {
    let h = { two: 0.5, one: 1.8 };
    for (let i = 0; i < 10; i++) h = stepHold(h, [4, 5], 0.1).hold;
    expect(h.two).toBe(0);
    expect(h.one).toBeLessThan(0.1);
    expect(stepHold(h, [], 0.1).held).toBe(false);
  });

  it("score the other side's raid and judge the match", () => {
    const rng = new Rng(5);
    const seen = new Set<number>();
    for (let i = 0; i < 60; i++) seen.add(oppScore(rng, false));
    expect([...seen].sort()).toEqual([0, 1, 2]);
    const cup = new Set<number>();
    for (let i = 0; i < 60; i++) cup.add(oppScore(rng, true));
    expect(Math.max(...cup)).toBe(3);
    expect(resultOf(4, 2)).toBe("win");
    expect(resultOf(1, 3)).toBe("lose");
    expect(resultOf(2, 2)).toBe("draw");
  });
});
