import { describe, expect, it } from "vitest";
import { FixedClock } from "../src/app/FixedClock";

describe("FixedClock", () => {
  it("steps a fixed number of times for elapsed time", () => {
    const c = new FixedClock(1 / 60, 5);
    let n = 0;
    c.advance(1 / 30, () => n++);
    expect(n).toBe(2);
  });
  it("returns interpolation alpha in [0,1)", () => {
    const c = new FixedClock(0.1, 5);
    const a = c.advance(0.15, () => undefined);
    expect(a).toBeCloseTo(0.5, 5);
  });
  it("bounds catch-up steps and drops backlog", () => {
    const c = new FixedClock(1 / 60, 5);
    let n = 0;
    c.advance(0.25, () => n++);
    expect(n).toBe(5);
    expect(c.droppedTime).toBeGreaterThan(0);
    n = 0;
    c.advance(0, () => n++);
    expect(n).toBe(0);
  });
  it("time scale 0 pauses the simulation", () => {
    const c = new FixedClock(1 / 60, 5);
    c.timeScale = 0;
    let n = 0;
    c.advance(0.1, () => n++);
    expect(n).toBe(0);
  });
  it("clamps negative and huge deltas", () => {
    const c = new FixedClock(1 / 60, 100);
    let n = 0;
    c.advance(-5, () => n++);
    expect(n).toBe(0);
    c.advance(10, () => n++);
    expect(n).toBe(15); // clamped to 0.25 s
  });
});
