import { describe, expect, it } from "vitest";
import { PowerCut } from "../src/world/PowerCut";

const run = (p: PowerCut, secs: number, hour: number, rain = 0, dt = 0.1) => { for (let t = 0; t < secs; t += dt) p.update(dt, hour, rain); };

describe("power cuts", () => {
  it("do not come at noon in dry weather", () => {
    const p = new PowerCut(() => 0.5, 10);
    run(p, 3000, 12);
    expect(p.on).toBe(false);
    expect(p.supply).toBe(1);
  });
  it("come in the evening, darken the lamps, and end with a flicker", () => {
    let starts = 0, ends = 0;
    const p = new PowerCut(() => 0.5, 10);
    p.onStart = () => starts++; p.onEnd = () => ends++;
    run(p, 12, 19);
    expect(p.on).toBe(true);
    expect(starts).toBe(1);
    run(p, 5, 19);
    expect(p.supply).toBeLessThan(0.05);
    run(p, 120, 19);
    expect(ends).toBe(1);
    expect(p.on).toBe(false);
    run(p, 3, 19);
    expect(p.supply).toBeGreaterThan(0.95);
  });
  it("come in a storm at any hour", () => {
    const p = new PowerCut(() => 0.5, 5);
    run(p, 10, 11, 0.9);
    expect(p.on).toBe(true);
  });
  it("do not start another straight away", () => {
    const p = new PowerCut(() => 0.5, 5);
    run(p, 20, 20);
    p.begin(); // already on: ignored
    run(p, 200, 20);
    expect(p.on).toBe(false);
  });
});
