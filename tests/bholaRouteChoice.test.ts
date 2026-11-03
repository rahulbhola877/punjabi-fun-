import { describe, expect, it, vi } from "vitest";
import { Vector3 } from "../src/babylon";
import { INTRO, Missions, type MissionHost } from "../src/missions/Missions";
import { newSave } from "../src/save/schema";
import { PLAYER_START } from "../src/world/layout";
import { buildRoadGraph } from "../src/world/nav";

function setup(deliveries = 2) {
  const save = newSave("preet", PLAYER_START, []); save.introStage = INTRO.DONE; save.stats.deliveries = deliveries;
  const state = { otherJob: false, carrying: false };
  const dialogue = vi.fn<MissionHost["dialogue"]>();
  let missions: Missions;
  const persist = vi.fn(() => { save.activeJob = missions.snapshot(); });
  const host: MissionHost = {
    save, playerPos: () => new Vector3(), vehicleSpeed: () => null, vehicleType: () => null,
    setCarrying: (value) => { state.carrying = value; }, dialogue, results: async () => "ok", toast: () => {},
    reward: () => {}, repTier: () => 0, sting: () => {}, residentSay: () => {}, residentGesture: () => {},
    voice: () => {}, persist, roadGraph: buildRoadGraph(), spillFactor: () => 1, tipMultiplier: () => 1,
    takeWarmthBonus: () => 0, otherJob: () => state.otherJob,
  };
  missions = new Missions(host);
  return { save, state, dialogue, missions, host, persist };
}

function deferred() {
  let resolve!: (value: string) => void;
  const promise = new Promise<string>((done) => { resolve = done; });
  return { promise, resolve };
}

describe("Bhola's delivery route choice", () => {
  it.each([["local", false], ["far", true]] as const)("offers and saves a %s order", async (choice, far) => {
    const s = setup(); s.dialogue.mockResolvedValueOnce(choice).mockResolvedValueOnce("take");
    await s.missions.talkBhola();
    expect(s.dialogue).toHaveBeenCalledTimes(2);
    expect(!!s.missions.job?.dest.far).toBe(far);
    expect(s.state.carrying).toBe(true);
    expect(s.save.activeJob).toEqual(s.missions.snapshot());
    const resumed = new Missions(s.host);
    expect(resumed.restore(s.save.activeJob)).toBe(true);
    expect(resumed.snapshot()).toEqual(s.missions.snapshot());
  });

  it("keeps the first two deliveries local without adding a route choice", async () => {
    const s = setup(1); s.dialogue.mockResolvedValue("take");
    await s.missions.talkBhola();
    expect(s.dialogue).toHaveBeenCalledTimes(1);
    expect(s.missions.job?.dest.far).toBeFalsy();
  });

  it.each(["no", "unexpected"])("leaves without creating a job when the route answer is %s", async (answer) => {
    const s = setup(); s.dialogue.mockResolvedValue(answer);
    await s.missions.talkBhola();
    expect(s.dialogue).toHaveBeenCalledTimes(1);
    expect(s.missions.job).toBeNull();
    expect(s.persist).not.toHaveBeenCalled();
  });

  it("allows declining the specific order", async () => {
    const s = setup(); s.dialogue.mockResolvedValueOnce("far").mockResolvedValueOnce("no");
    await s.missions.talkBhola();
    expect(s.missions.job).toBeNull();
    expect(s.state.carrying).toBe(false);
  });

  it.each(["route", "offer"])("rejects acceptance if another job starts during the %s dialogue", async (step) => {
    const s = setup(), pending = deferred();
    if (step === "route") s.dialogue.mockImplementationOnce(() => pending.promise);
    else s.dialogue.mockResolvedValueOnce("far").mockImplementationOnce(() => pending.promise);
    const talking = s.missions.talkBhola();
    if (step === "offer") await Promise.resolve();
    s.state.otherJob = true; pending.resolve(step === "route" ? "far" : "take");
    await talking;
    expect(s.missions.job).toBeNull();
    expect(s.state.carrying).toBe(false);
    expect(s.persist).not.toHaveBeenCalled();
  });

  it("describes the intro interaction without a hard-coded keyboard key", () => {
    const s = setup(0); s.save.introStage = INTRO.MEET;
    expect(s.missions.objective().detail).toContain("interaction control");
    expect(s.missions.objective().detail).not.toContain("<kbd>");
  });
});
