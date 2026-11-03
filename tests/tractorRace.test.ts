import { describe, expect, it, vi } from "vitest";
import { Vector3 } from "../src/babylon";
import { newSave, readSave, writeSave, type KV } from "../src/save/schema";
import type { Vehicle } from "../src/vehicles/Vehicle";
import type { VehicleModel } from "../src/vehicles/models";
import { LOOSE_TROLLEYS } from "../src/traffic/Trolley";
import { isOpenGround } from "../src/world/layout";
import {
  FINISHED, LAP, PRIZES, RIVALS, RIVAL_SPEEDS, START_SPOT, TIME_LIMIT, clockText, gridAt, loopAt, passGates,
  rivalStep, standings, toNextGate, COUNTDOWN, GATES, TractorRace, type RaceHost, type Point, type Racer,
} from "../src/minigames/TractorRace";

function storyRace() {
  const tractor = { position: new Vector3() } as Vehicle;
  const host: RaceHost = {
    playerPos: () => tractor.position, driving: () => tractor,
    gridTractor: (x, z) => { tractor.position.set(x, 0, z); return tractor; }, occupied: () => false,
    rivalModel: () => ({ root: { position: new Vector3(), rotationQuaternion: null } }) as unknown as VehicleModel,
    dropModel: vi.fn(), toast: vi.fn(), hud: vi.fn(), sting: vi.fn(),
    results: vi.fn(async () => "ok"), reward: vi.fn(), persist: vi.fn(), onStoryEvent: vi.fn(),
  };
  return { tractor, host, race: new TractorRace(host) };
}

describe("story race events", () => {
  it("completes the accepted attempt once before its checkpoint and preserves normal prizes", () => {
    const { race, host, tractor } = storyRace();
    expect(race.start(12)).toBe(true);
    expect(race.start(99)).toBe(false);
    race.update(COUNTDOWN);
    for (const gate of GATES) { tractor.position.set(gate.x, 0, gate.z); race.update(0.1); }
    expect(host.onStoryEvent).toHaveBeenCalledExactlyOnceWith({ kind: "complete", attemptId: 12, finished: true, rank: 1, elapsed: 0.4 });
    expect(vi.mocked(host.onStoryEvent!).mock.invocationCallOrder[0]).toBeLessThan(vi.mocked(host.persist).mock.invocationCallOrder[0]!);
    expect(host.reward).toHaveBeenCalledExactlyOnceWith(PRIZES[0], 3);
    expect(host.results).toHaveBeenCalledOnce();
    race.update(1); race.stop(); race.stop();
    expect(host.onStoryEvent).toHaveBeenCalledOnce();
  });

  it("reports a timeout as an unfinished completion once", () => {
    const { race, host } = storyRace();
    race.start(3); race.update(COUNTDOWN); race.update(TIME_LIMIT);
    expect(host.onStoryEvent).toHaveBeenCalledExactlyOnceWith({ kind: "complete", attemptId: 3, finished: false, rank: expect.any(Number), elapsed: TIME_LIMIT });
    race.stop(); race.update(1);
    expect(host.onStoryEvent).toHaveBeenCalledOnce();
    expect(host.persist).toHaveBeenCalledWith("tractorRace");
    expect(host.results).toHaveBeenCalledOnce();
  });

  it("interrupts an active story attempt once on stop or leaving its tractor", () => {
    for (const leave of [false, true]) {
      const { race, host } = storyRace();
      race.start(0);
      if (leave) { host.driving = () => null; race.update(0.1); } else race.stop();
      race.stop(); race.update(1);
      expect(host.onStoryEvent).toHaveBeenCalledExactlyOnceWith({ kind: "interrupted", attemptId: 0 });
      expect(host.reward).not.toHaveBeenCalled();
      expect(host.results).not.toHaveBeenCalled();
    }
  });

  it("emits no story event for blocked starts or generic races", () => {
    const { race, host, tractor } = storyRace();
    host.occupied = () => true;
    expect(race.start(4)).toBe(false);
    race.stop();
    expect(host.onStoryEvent).not.toHaveBeenCalled();
    host.occupied = () => false;
    race.start(); race.stop();
    race.start(); race.update(COUNTDOWN);
    for (const gate of GATES) { tractor.position.set(gate.x, 0, gate.z); race.update(0.1); }
    race.stop();
    expect(host.onStoryEvent).not.toHaveBeenCalled();
    expect(host.reward).toHaveBeenCalledExactlyOnceWith(PRIZES[0], 3);
  });
});

describe("race reward checkpoint", () => {
  it("saves the prize before pending results and never pays again on later frames or dismissal", async () => {
    const save = newSave("preet", { x: 0, z: 0, yaw: 0 }, []);
    const initialMoney = save.money, initialRep = save.rep;
    const data = new Map<string, string>();
    const kv: KV = { getItem: (key) => data.get(key) ?? null,
      setItem: (key, value) => { data.set(key, value); }, removeItem: (key) => { data.delete(key); } };
    expect(writeSave(kv, save).ok).toBe(true);
    let dismiss!: (value: string) => void;
    const pending = new Promise<string>((resolve) => { dismiss = resolve; });
    const tractor = { position: new Vector3() } as Vehicle;
    const host: RaceHost = {
      playerPos: () => tractor.position, driving: () => tractor,
      gridTractor: (x, z) => { tractor.position.set(x, 0, z); return tractor; }, occupied: () => false,
      rivalModel: () => ({ root: { position: new Vector3(), rotationQuaternion: null } }) as unknown as VehicleModel,
      dropModel: vi.fn(), toast: vi.fn(), hud: vi.fn(), sting: vi.fn(),
      results: vi.fn(() => pending), reward: vi.fn((money, rep) => { save.money += money; save.rep += rep; }),
      persist: vi.fn(() => { expect(writeSave(kv, save).ok).toBe(true); }),
    };
    const race = new TractorRace(host);
    expect(race.nextGate).toBeNull();
    expect(race.start()).toBe(true);
    expect(race.nextGate).toEqual(GATES[0]);
    expect(race.nextGate).not.toBe(GATES[0]);
    race.update(COUNTDOWN);
    const names = ["B", "C", "D", "A (finish)"];
    for (const [index, gate] of GATES.entries()) {
      expect(race.nextGate).toEqual(gate);
      expect(host.hud).toHaveBeenLastCalledWith(expect.objectContaining({
        lines: expect.arrayContaining([`Next gate ${index + 1} of ${FINISHED} · ${names[index]}`]),
      }));
      // Revisiting A before its turn must not change either the rule or guidance.
      tractor.position.set(GATES[3]!.x, 0, GATES[3]!.z);
      if (index !== 3) { race.update(1 / 60); expect(race.nextGate).toEqual(gate); }
      tractor.position.set(gate.x, 0, gate.z);
      race.update(1 / 60);
    }
    expect(race.active).toBe(false);
    expect(race.nextGate).toBeNull();
    expect(host.results).toHaveBeenCalledOnce();
    const reload = () => readSave(kv, ["preet"], { minX: -2000, maxX: 2000, minZ: -2000, maxZ: 2000 }).data!;
    expect(reload().money).toBe(initialMoney + PRIZES[0]!);
    expect(reload().rep).toBe(initialRep + 3);
    expect(host.persist).toHaveBeenCalledWith("tractorRace");
    race.update(1);
    dismiss("ok");
    await pending;
    await Promise.resolve();
    race.update(1);
    expect(host.reward).toHaveBeenCalledExactlyOnceWith(PRIZES[0], 3);
    expect(host.persist).toHaveBeenCalledOnce();
    expect(reload().money).toBe(save.money);
    expect(reload().rep).toBe(save.rep);
    expect(race.start()).toBe(true);
    expect(race.nextGate).toEqual(GATES[0]);
    race.stop();
    expect(race.nextGate).toBeNull();
  });
});

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
