import { describe, expect, it } from "vitest";
import { daytime, doorResponse, quietHours, sessionHour } from "../src/world/dailyLife";
import { withNightShift } from "../src/crowds/cast";
import { randomAppearance } from "../src/characters/appearances";
import { SpatialGrid } from "../src/world/SpatialGrid";
import { advanceStop, type StopOrder } from "../src/combat/stopOrder";

describe("daily life and stop orders", () => {
  it("only familiar households invite visitors; nighttime wakes nobody for a visit", () => {
    expect(doorResponse(9, false)).toBe("stranger");
    expect(doorResponse(9, true)).toBe("welcome");
    expect(doorResponse(23, false)).toBe("night");
    expect(doorResponse(23, true)).toBe("night");
    expect(doorResponse(14, false)).toBe("siesta");
    expect(doorResponse(14, true)).toBe("welcome");
    expect(doorResponse(16, false)).toBe("stranger");
  });
  it("starts stale nighttime saves in daylight, while preserving explicit test hours", () => {
    for (const h of [0, 3, 19, 23, NaN]) expect(sessionHour(h)).toBe(9);
    expect(sessionHour(12)).toBe(12);
    expect(sessionHour(9, 23)).toBe(23);
    expect(daytime(9)).toBe(true); expect(daytime(23)).toBe(false);
    expect(quietHours(22)).toBe(true); expect(quietHours(6)).toBe(false);
  });
  it("sends children and vendors home but retains explicitly staffed night shifts", () => {
    const d = { id: "test", name: "Test", role: "keeper" as const, x: 0, z: 0, yaw: 0, look: randomAppearance(7) };
    expect(withNightShift(d).shift).toEqual([7, 22]);
    expect(withNightShift({ ...d, role: "child" }).shift).toEqual([7.5, 18.5]);
    expect(withNightShift({ ...d, shift: [22, 6] }).shift).toEqual([22, 6]);
    expect(withNightShift({ ...d, faction: "police" }).shift).toBeUndefined();
  });
  const order = (): StopOrder => ({ approach: -1, elapsed: 0, closest: 30, stopped: 0 });
  it("accepts a full stop and pursues driving through even at moderate speed", () => {
    const a = order();
    expect(advanceStop(a, 0.5, -20, 20, 0)).toBe("wait");
    expect(advanceStop(a, 0.6, -20, 20, 0)).toBe("stopped");
    expect(advanceStop(order(), 0.1, 6, 8, 4)).toBe("refused");
    expect(advanceStop(order(), 0.1, -46, 46, 4)).toBe("refused");
  });
  it("does not count a rolling slowdown or disconnected stops as compliance", () => {
    expect(advanceStop(order(), 1.2, -20, 20, 0.8)).toBe("wait");
    const a = order();
    expect(advanceStop(a, 0.6, -20, 20, 0)).toBe("wait");
    expect(advanceStop(a, 0.6, -18, 18, 3)).toBe("wait");
    expect(advanceStop(a, 0.6, -18, 18, 0)).toBe("wait");
  });
});

describe("crowd spatial queries", () => {
  it("includes every nearby pedestrian across negative and positive cell boundaries", () => {
    const points = Array.from({ length: 600 }, (_, i) => ({ x: (i * 13 % 97) - 48, z: (i * 17 % 103) - 51 }));
    const grid = new SpatialGrid<typeof points[number]>(3); grid.rebuild(points, p => p);
    for (const p of points) {
      const found = new Set(grid.near(p.x, p.z, 1.5));
      for (const q of points.filter(q => Math.hypot(p.x - q.x, p.z - q.z) < 1.5)) expect(found.has(q)).toBe(true);
    }
    grid.rebuild([], p => p); expect([...grid.near(0, 0, 99)]).toEqual([]);
  });
});
