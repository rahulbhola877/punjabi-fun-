import { describe, expect, it } from "vitest";
import { ORCHARD_BASKETS, finishOrchardRound, orchardAvailable, orchardStep, pickOrchardBasket, startOrchardRound } from "../src/missions/OrchardRound";

describe("orchard picking round", () => {
  it("requires the three baskets in order and pays only after returning", () => {
    const home: Record<string, number> = {};
    expect(finishOrchardRound(home, 0)).toBe(false);
    expect(startOrchardRound(home, 0)).toBe(true);
    expect(startOrchardRound(home, 0)).toBe(false);
    expect(pickOrchardBasket(home, 2)).toBe(false);
    for (let i = 0; i < ORCHARD_BASKETS.length; i++) {
      expect(pickOrchardBasket(home, i)).toBe(true);
      expect(pickOrchardBasket(home, i)).toBe(false);
    }
    expect(orchardStep(home)).toBe(4);
    expect(finishOrchardRound(home, 0)).toBe(true);
    expect(finishOrchardRound(home, 0)).toBe(false);
    expect(orchardAvailable(home, 0)).toBe(false);
    expect(orchardAvailable(home, 1)).toBe(true);
  });

  it("keeps progress across a save round trip and ignores invalid progress", () => {
    const home: Record<string, number> = {};
    startOrchardRound(home, 3);
    pickOrchardBasket(home, 0);
    const restored = JSON.parse(JSON.stringify(home)) as Record<string, number>;
    expect(orchardStep(restored)).toBe(2);
    expect(pickOrchardBasket(restored, 1)).toBe(true);
    expect(orchardStep({ orchardRoundStep: 99 })).toBe(0);
  });
});
