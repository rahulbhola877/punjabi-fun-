import { describe, expect, it } from "vitest";
import { tyreTraction } from "../src/vehicles/tyreTraction";

describe("tyre friction budget", () => {
  it("preserves impulses below the contact patch's grip limit", () => {
    expect(tyreTraction(-10, 20, 1000, 1 / 60, 2)).toEqual({ longitudinal: -10, lateral: 20 });
  });

  it("shares one grip budget between braking and cornering", () => {
    const load = 1000, dt = 1 / 60, grip = 0.6;
    const f = tyreTraction(-100, 100, load, dt, grip);
    expect(f.longitudinal).toBeLessThan(0);
    expect(f.lateral).toBeGreaterThan(0);
    expect(Math.hypot(f.longitudinal / (1.1 * load * dt * grip), f.lateral / (1.3 * load * dt * grip))).toBeCloseTo(1);
    expect(Math.abs(f.longitudinal)).toBeLessThan(1.1 * load * dt * grip);
    expect(f.lateral).toBeLessThan(1.3 * load * dt * grip);
  });

  it("cannot create tyre forces when the suspension is unloaded or friction is zero", () => {
    expect(tyreTraction(100, 100, 0, 1 / 60, 1)).toEqual({ longitudinal: 0, lateral: 0 });
    expect(tyreTraction(100, 100, 1000, 1 / 60, 0)).toEqual({ longitudinal: 0, lateral: 0 });
  });
});
