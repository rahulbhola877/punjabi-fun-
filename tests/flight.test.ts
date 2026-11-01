import { describe, expect, it } from "vitest";
import { flightForces, flightSavePosition, type FlightInput } from "../src/vehicles/flight";
import { VEHICLE_SPAWNS } from "../src/world/layout";
import { NORTH_AIRFIELD } from "../src/world/travelDistrictLayout";
import { PLOTS } from "../src/world/region";

const base: FlightInput = { mass: 1100, forwardSpeed: 0, noseUp: 0, rightUp: 0, throttle: 1, pitch: 0, turn: 0 };

describe("light-plane aerodynamics", () => {
  it("does not hover or turn on its wings while stationary", () => {
    const f = flightForces({ ...base, pitch: 1, turn: 1 });
    expect(f.lift).toBe(0);
    expect(f.yawRate).toBe(0);
    expect(Math.abs(f.pitchRate)).toBe(0);
  });
  it("gains lift and pitch control with airspeed", () => {
    const slow = flightForces({ ...base, forwardSpeed: 8, pitch: 1 });
    const fast = flightForces({ ...base, forwardSpeed: 23, pitch: 1 });
    expect(slow.lift).toBeLessThan(base.mass * 9.81);
    expect(fast.lift).toBeGreaterThan(base.mass * 9.81);
    expect(fast.pitchRate).toBeLessThan(0);
  });
  it("banks and turns in the requested direction, then levels when released", () => {
    const f = flightForces({ ...base, forwardSpeed: 25, turn: 1 });
    expect(f.yawRate).toBeGreaterThan(0);
    expect(f.rollRate).toBeLessThan(0);
    expect(flightForces({ ...base, forwardSpeed: 25, rightUp: -0.3 }).rollRate).toBeGreaterThan(0);
  });
  it("loses lift and thrust when slowing down and throttling back", () => {
    const cruise = flightForces({ ...base, forwardSpeed: 24 });
    const approach = flightForces({ ...base, forwardSpeed: 13, throttle: 0 });
    expect(approach.lift).toBeLessThan(cruise.lift);
    expect(approach.forward).toBeLessThan(0);
  });
  it("parks the plane on the airfield apron, away from generated fields", () => {
    const p = VEHICLE_SPAWNS.find(v => v.id === "plane_airfield")!;
    expect(p.type).toBe("plane");
    expect(p.x).toBeGreaterThan(NORTH_AIRFIELD.x0);
    expect(p.x).toBeLessThan(NORTH_AIRFIELD.x1);
    expect(p.z).toBeGreaterThan(NORTH_AIRFIELD.z0);
    expect(p.z).toBeLessThan(NORTH_AIRFIELD.z1);
    expect(PLOTS.some(r => p.x >= r.x0 - 6 && p.x <= r.x1 + 6 && p.z >= r.z0 - 6 && p.z <= r.z1 + 6)).toBe(false);
  });
  it("preserves a parked plane on save and returns an airborne one to the apron", () => {
    const apron = { x: 405, y: 0.05, z: 1858, yaw: Math.PI / 2 };
    const parked = { x: 630, y: 0.1, z: 1891, yaw: 0 };
    expect(flightSavePosition(parked, 0, apron)).toEqual(parked);
    expect(flightSavePosition({ ...parked, y: 55 }, 0, apron)).toEqual(apron);
    // A high-elevation landing is still a ground save.
    expect(flightSavePosition({ ...parked, y: 22.1 }, 22, apron).y).toBe(22.1);
  });
});
