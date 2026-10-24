import { describe, expect, it } from "vitest";
import { JUNCTIONS, CYCLE, axisLight, classLight, signalAhead, STOP_BACK } from "../src/world/Signals";
import { onRoad } from "../src/world/region";

const J = JUNCTIONS[0]!;

describe("signals", () => {
  it("every junction stands on two crossing streets", () => {
    expect(JUNCTIONS.length).toBe(12);
    for (const j of JUNCTIONS) {
      expect(onRoad(j.x, j.z, 0), j.id).toBeTruthy();
      expect(onRoad(j.x + j.hw + 2, j.z, 0), j.id + " east arm").toBeTruthy();
      expect(onRoad(j.x, j.z - j.hw - 2, 0), j.id + " south arm").toBeTruthy();
    }
  });
  it("the cycle: 20 green, 3 amber, then red; the other road is red while this one is green", () => {
    expect(classLight(0, 1)).toBe("green");
    expect(classLight(0, 21)).toBe("amber");
    expect(classLight(0, 30)).toBe("red");
    expect(classLight(1, 30)).toBe("green");
    expect(classLight(0, CYCLE + 1)).toBe("green");
    for (let t = 0; t < CYCLE * 2; t += 0.5) expect(axisLight(J, "ns", t) === "green" && axisLight(J, "ew", t) === "green").toBe(false);
  });
  it("a car on a red stops at the line; on a green it goes; a car already past the line goes on", () => {
    // Class-0 junction: ns is green at t=1, red at t=30.
    const j = JUNCTIONS.find((q) => q.cls === 0)!;
    const line = j.z - (j.hw + STOP_BACK);
    expect(signalAhead({ x: j.x - 2, z: line - 20 }, 0, 1, 10, 1)).toBe(Infinity);
    expect(signalAhead({ x: j.x - 2, z: line - 20 }, 0, 1, 10, 30)).toBeCloseTo(20, 5);
    expect(signalAhead({ x: j.x - 2, z: line + 3 }, 0, 1, 10, 30)).toBe(Infinity);
    // The other way (heading -z) stops on the far side of the junction.
    expect(signalAhead({ x: j.x + 2, z: j.z + j.hw + STOP_BACK + 12 }, 0, -1, 8, 30)).toBeCloseTo(12, 5);
    // East-west traffic is green when north-south is red.
    expect(signalAhead({ x: j.x - j.hw - STOP_BACK - 15, z: j.z + 2 }, 1, 0, 10, 30)).toBe(Infinity);
  });
  it("a car that cannot stop for the amber goes through it", () => {
    const j = JUNCTIONS.find((q) => q.cls === 0)!;
    const line = j.z - (j.hw + STOP_BACK);
    expect(signalAhead({ x: j.x, z: line - 4 }, 0, 1, 12, 21)).toBe(Infinity);
    expect(signalAhead({ x: j.x, z: line - 30 }, 0, 1, 8, 21)).toBeCloseTo(30, 5);
  });
});
