import { describe, expect, it } from "vitest";
import { canTakeWheel, type TrafficCar } from "../src/traffic/Traffic";

/** A traffic car with only the flags the rule reads. */
const car = (flags: Partial<Pick<TrafficCar, "police" | "patrol" | "bus">> = {}) => flags as TrafficCar;

describe("who you can take the wheel of", () => {
  it("never a police car, whatever it is doing", () => {
    expect(canTakeWheel("police", undefined, 0)).toBe(false);
    expect(canTakeWheel("police", car({ police: true }), 0)).toBe(false);
  });

  it("never a parked public bus: it has no driver to pull out and no route to leave", () => {
    expect(canTakeWheel("prtc", undefined, 0)).toBe(false);
    expect(canTakeWheel("roadways", undefined, 0)).toBe(false);
  });

  it("never a bus on its timetable, even when it is stopped", () => {
    expect(canTakeWheel("prtc", car({ bus: true }), 0)).toBe(false);
    expect(canTakeWheel("roadways", car({ bus: true }), 0)).toBe(false);
  });

  it("a PRTC or private bus on the country roads, as traffic: when it is stopped, not when it is moving", () => {
    expect(canTakeWheel("prtc", car(), 0)).toBe(true);
    expect(canTakeWheel("privateGreen", car(), 1)).toBe(true);
    expect(canTakeWheel("privateMaroon", car(), 9)).toBe(false);
  });

  it("an ordinary car, as traffic, only when it is stopped: you pull the driver out", () => {
    expect(canTakeWheel("mint", car(), 0)).toBe(true);
    expect(canTakeWheel("mint", car(), 5)).toBe(false);
  });

  it("an owned vehicle, parked or not in traffic, is yours", () => {
    expect(canTakeWheel("mint", undefined, 0)).toBe(true);
    expect(canTakeWheel("tractorRed", undefined, 7)).toBe(true);
  });
});
