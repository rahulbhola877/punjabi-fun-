import { describe, expect, it } from "vitest";
import { dhundDensity, rushFactor, shiftPassed } from "../src/world/Rhythm";

describe("the day's rhythm", () => {
  it("empties the roads at night and fills them at the four o'clock shift change", () => {
    expect(rushFactor(2)).toBeLessThan(0.5);
    expect(rushFactor(16.5)).toBeGreaterThan(rushFactor(13) + 0.3);
    expect(rushFactor(17)).toBeGreaterThan(rushFactor(8.0));
    expect(rushFactor(25)).toBeCloseTo(rushFactor(1), 5);
    for (let h = 0; h < 24; h += 0.25) { expect(rushFactor(h)).toBeGreaterThan(0.3); expect(rushFactor(h)).toBeLessThanOrEqual(1.5); }
  });

  it("notices a shift change between two readings of the clock", () => {
    expect(shiftPassed(15.99, 16.01)).toBe(16);
    expect(shiftPassed(7.5, 8.2)).toBe(8);
    expect(shiftPassed(9, 10)).toBeNull();
    expect(shiftPassed(23.9, 0.1)).toBeNull();
  });
});

describe("dhund", () => {
  it("comes with the coldest months, at dawn, and is gone by noon and all summer", () => {
    expect(dhundDensity(2, 6.5)).toBeGreaterThan(0.01);
    expect(dhundDensity(3, 6.5)).toBe(dhundDensity(2, 6.5));
    expect(dhundDensity(1, 6.5)).toBeLessThan(dhundDensity(2, 6.5));
    expect(dhundDensity(2, 13)).toBe(0);
    expect(dhundDensity(8, 6.5)).toBe(0);
    expect(dhundDensity(9, 6.5)).toBe(0);
    expect(dhundDensity(2, 9.5)).toBeLessThan(dhundDensity(2, 7));
    for (let m = 0; m < 12; m++) for (let h = 0; h < 24; h += 0.5) expect(dhundDensity(m, h)).toBeLessThan(0.02);
  });
});
