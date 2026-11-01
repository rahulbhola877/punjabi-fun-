import { describe, expect, it } from "vitest";
import { FixedClock, simulationFrameDelta } from "../src/app/FixedClock";

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
  it("catches up at 10 fps with stable physics steps when CPU time permits", () => {
    let wall = 0;
    const c = new FixedClock(1 / 60, 15, { guaranteedSteps: 5, maxMilliseconds: 12, now: () => wall });
    const steps: number[] = [];
    for (let i = 0; i < 20; i++) c.advance(simulationFrameDelta(0.1), (dt) => { steps.push(dt); wall += 0.5; });
    expect(c.simTime).toBeCloseTo(2, 5);
    expect(c.droppedTime).toBeCloseTo(0, 5);
    expect(steps.every((dt) => dt === 1 / 60)).toBe(true);
  });
  it("bounds expensive catch-up and does not carry a runaway backlog", () => {
    let wall = 0, count = 0;
    const c = new FixedClock(1 / 60, 15, { guaranteedSteps: 5, maxMilliseconds: 12, now: () => wall });
    c.advance(0.25, () => { count++; wall += 4; });
    expect(count).toBe(5);
    expect(c.droppedTime).toBeGreaterThan(0.15);
    c.advance(0, () => { count++; });
    expect(count).toBe(5);
  });
  it("does not let sustained expensive simulation exhaust the browser", () => {
    let wall = 0, count = 0;
    const c = new FixedClock(1 / 60, 15, { guaranteedSteps: 5, maxMilliseconds: 12, now: () => wall });
    for (let i = 0; i < 8; i++) c.advance(simulationFrameDelta(0.5), () => { count++; wall += 4; });
    // The guaranteed five steps may exceed the budget, but additional work
    // is stopped and old time is discarded on every frame instead of piling up.
    expect(count).toBe(40);
    expect(wall).toBe(160);
    expect(c.simTime).toBeCloseTo(2 / 3, 5);
    expect(c.droppedTime).toBeGreaterThan(1.2);
  });
  it("limits recovery from background-tab pauses without penalizing slow frames", () => {
    expect(simulationFrameDelta(0.2)).toBe(0.2);
    expect(simulationFrameDelta(0.4)).toBe(0.25);
    expect(simulationFrameDelta(10)).toBe(0.1);
    expect(simulationFrameDelta(NaN)).toBe(0);
    expect(simulationFrameDelta(-1)).toBe(0);
  });
  it("keeps catch-up bounded over sustained 2 fps and a long background pause", () => {
    let wall = 0, count = 0;
    const c = new FixedClock(1 / 60, 15, { guaranteedSteps: 5, maxMilliseconds: 12, now: () => wall });
    for (let i = 0; i < 8; i++) c.advance(simulationFrameDelta(0.5), (dt) => {
      expect(dt).toBe(1 / 60); count++; wall += 0.1;
    });
    // Four real seconds yield two simulated seconds because the frame-delta
    // clamp intentionally bounds recovery when rendering falls below 4 fps.
    expect(c.simTime).toBeCloseTo(2, 5);
    expect(count).toBe(120);
    const before = c.simTime;
    c.advance(simulationFrameDelta(60), () => { count++; wall += 0.1; });
    expect(c.simTime - before).toBeCloseTo(0.1, 5);
    expect(count).toBe(126);
  });
});
