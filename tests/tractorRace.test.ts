import { describe, expect, it } from "vitest";
import { LOOSE_TROLLEYS } from "../src/traffic/Trolley";
import { isOpenGround } from "../src/world/layout";
import {
  FINISHED, LAP, PRIZES, RIVALS, RIVAL_SPEEDS, START_SPOT, TIME_LIMIT, clockText, gridAt, loopAt, passGates,
  rivalStep, standings, toNextGate, type Point, type Racer,
} from "../src/minigames/TractorRace";

describe("the loop", () => {
  it("is four straight runs of 1320 m between the corners, closed back at A", () => {
    expect(LAP).toBeCloseTo(1320, 6);
    expect(loopAt(0)).toMatchObject({ x: -600, z: -400 });
    expect(loopAt(300)).toMatchObject({ x: -300, z: -400 });
    expect(loopAt(660)).toMatchObject({ x: -300, z: -760 });
    expect(loopAt(960)).toMatchObject({ x: -600, z: -760 });
    expect(loopAt(LAP)).toMatchObject({ x: -600, z: -400 });
  });

  it("heads east from A, and the grid stands on the stretch before it, heading for A", () => {
    expect(loopAt(10).yaw).toBeCloseTo(Math.PI / 2, 9);
    expect(gridAt(0)).toMatchObject({ x: -600, z: -406 });
    expect(gridAt(0).yaw).toBeCloseTo(0, 9);
    expect(gridAt(RIVALS)).toMatchObject({ x: -600, z: -424 });
  });
});

describe("gates", () => {
  it("count only in order: B, C and D, then A again finishes the lap", () => {
    let gate = 0;
    const at = (d: number) => {
      const p = loopAt(d);
      gate = passGates(gate, p.x, p.z);
      return gate;
    };
    expect(at(0)).toBe(0);
    expect(at(300)).toBe(1);
    expect(at(660)).toBe(2);
    expect(at(960)).toBe(3);
    expect(at(LAP)).toBe(FINISHED);
  });

  it("does not count a gate twice when a racer goes back over it", () => {
    let gate = 2;
    gate = passGates(gate, -300, -400);
    expect(gate).toBe(2);
  });

  it("gives the distance to the next gate, and zero once the lap is done", () => {
    expect(toNextGate(0, -300, -390)).toBeCloseTo(10, 9);
    expect(toNextGate(FINISHED, 0, 0)).toBe(0);
  });
});

describe("standings", () => {
  const r = (id: string, gate: number, dist: number, finishAt: number | null = null): Racer => ({ id, gate, dist, finishAt });

  it("puts finishers first by time, then the rest by gates passed, then by how near their next gate is", () => {
    const order = standings([r("a", 2, 50), r("b", 4, 0, 130), r("c", 4, 0, 120), r("d", 2, 20), r("e", 3, 90)]);
    expect(order.map((x) => x.id)).toEqual(["c", "b", "e", "d", "a"]);
  });
});

describe("prizes and the clock", () => {
  it("pays the top four places, best first, and nothing after", () => {
    expect(PRIZES).toHaveLength(RIVALS + 1);
    expect(PRIZES[0]!).toBeGreaterThan(PRIZES[1]!);
    expect(PRIZES[1]!).toBeGreaterThan(PRIZES[2]!);
    expect(PRIZES[3]).toBe(0);
  });

  it("shows the time as minutes and seconds", () => {
    expect(clockText(0)).toBe("0:00");
    expect(clockText(75.9)).toBe("1:15");
    expect(clockText(-3)).toBe("0:00");
  });
});

describe("rivals", () => {
  it("each one passes all four gates in turn and finishes the lap inside the time limit, even from the back of the grid", () => {
    for (const speed of RIVAL_SPEEDS) {
      const dt = 1 / 60;
      let d = -6 - 6 * RIVALS;
      let gate = 0, t = 0;
      while (gate < FINISHED && t < TIME_LIMIT) {
        d = rivalStep(d, speed, dt);
        const p = loopAt(d);
        gate = passGates(gate, p.x, p.z);
        t += dt;
      }
      expect(gate).toBe(FINISHED);
      expect(t).toBeLessThan(TIME_LIMIT);
    }
  });
});

describe("the course", () => {
  it("runs on open ground all the way round, with the grid and the start spot on it too", () => {
    const spots: Point[] = [START_SPOT];
    for (let d = -24; d <= LAP; d += 5) spots.push(loopAt(d));
    expect(spots.filter((p) => !isOpenGround(p.x, p.z))).toEqual([]);
  });

  it("keeps clear of the loose trolleys", () => {
    for (let d = 0; d < LAP; d += 10) {
      const p = loopAt(d);
      for (const t of LOOSE_TROLLEYS) expect(Math.hypot(p.x - t.x, p.z - t.z)).toBeGreaterThan(8);
    }
  });
});
