import { describe, expect, it } from "vitest";
import { RAIL, trainAt, tailOf, gateClosed, gateAhead } from "../src/world/Rail";

describe("the railway", () => {
  it("runs a train every four minutes, from the west and then from the east", () => {
    expect(trainAt(10)).toBeNull();
    const a = trainAt(RAIL.first + 5)!;
    expect(a.dir).toBe(1);
    expect(a.x).toBeCloseTo(-RAIL.reach + RAIL.speed * 5, 5);
    const b = trainAt(RAIL.first + RAIL.period + 5)!;
    expect(b.dir).toBe(-1);
    expect(b.x).toBeGreaterThan(0);
    // It is on the line about two minutes of every four.
    let on = 0;
    for (let t = RAIL.first; t < RAIL.first + RAIL.period * 4; t++) if (trainAt(t)) on++;
    const expected = 4 * (2 * RAIL.reach + RAIL.length) / RAIL.speed;
    expect(Math.abs(on - expected)).toBeLessThan(5);
  });
  it("the gates are down while the train crosses, up long before and after", () => {
    const cross = RAIL.first + RAIL.reach / RAIL.speed; // the nose reaches x = 0
    expect(gateClosed(RAIL.first + 3)).toBe(false);
    expect(gateClosed(cross - 8)).toBe(true);
    expect(gateClosed(cross)).toBe(true);
    expect(gateClosed(cross + RAIL.length / RAIL.speed)).toBe(true);
    expect(gateClosed(cross + RAIL.length / RAIL.speed + RAIL.openAfter / RAIL.speed + 2)).toBe(false);
    // Down for less than half a minute at a time.
    let down = 0;
    for (let t = RAIL.first; t < RAIL.first + RAIL.period; t += 0.5) if (gateClosed(t)) down += 0.5;
    expect(down).toBeGreaterThan(15);
    expect(down).toBeLessThan(40);
  });
  it("the nose and the tail", () => {
    const tr = trainAt(RAIL.first + 50)!;
    expect(tailOf(tr)).toBeCloseTo(tr.x - RAIL.length, 5);
    const w = trainAt(RAIL.first + RAIL.period + 50)!;
    expect(tailOf(w)).toBeCloseTo(w.x + RAIL.length, 5);
  });
  it("cars on the Kotli road stop short of a closed gate on either side, and not when it is open", () => {
    expect(gateAhead({ x: -2, z: RAIL.z - 30 }, 0, 1, true)).toBeCloseTo(30 - 8.2, 5);
    expect(gateAhead({ x: 2, z: RAIL.z + 30 }, 0, -1, true)).toBeCloseTo(30 - 8.2, 5);
    expect(gateAhead({ x: -2, z: RAIL.z - 30 }, 0, 1, false)).toBe(Infinity);
    // Past the gate already, or on another road.
    expect(gateAhead({ x: -2, z: RAIL.z - 4 }, 0, 1, true)).toBe(Infinity);
    expect(gateAhead({ x: 90, z: RAIL.z - 30 }, 0, 1, true)).toBe(Infinity);
  });
});
