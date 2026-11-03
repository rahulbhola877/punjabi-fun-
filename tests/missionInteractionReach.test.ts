import { describe, expect, it, vi } from "vitest";
import { Vector3 } from "../src/babylon";
import { Missions, INTRO, DESTINATIONS, type MissionHost } from "../src/missions/Missions";
import { newSave } from "../src/save/schema";
import { PLAYER_START, POIS } from "../src/world/layout";
import { buildRoadGraph } from "../src/world/nav";

function setup(stage: number) {
  const save = newSave("preet", PLAYER_START, []); save.introStage = stage;
  const state = { pos: new Vector3(), speed: null as number | null };
  const dialogue = vi.fn(async () => "ok");
  const host: MissionHost = {
    save, playerPos: () => state.pos, vehicleSpeed: () => state.speed, vehicleType: () => null,
    setCarrying: () => {}, dialogue, results: async () => "ok", toast: () => {}, reward: () => {},
    repTier: () => 0, sting: () => {}, residentSay: () => {}, residentGesture: () => {},
    voice: () => {}, persist: () => {}, roadGraph: buildRoadGraph(), spillFactor: () => 1,
    tipMultiplier: () => 1, takeWarmthBonus: () => 0,
  };
  return { save, state, dialogue, missions: new Missions(host) };
}

describe("mission interaction prompt grace", () => {
  it.each(["away", "moving"])("does not buy the phone after the player is %s", async (change) => {
    const s = setup(INTRO.DELIVER), p = POIS.mobileShop!;
    s.state.pos.set(p.x, 0, p.z);
    const action = s.missions.deliveryHere()!;
    if (change === "away") s.state.pos.x += 8; else s.state.speed = 3;
    await action.run();
    expect(s.save.introStage).toBe(INTRO.DELIVER);
    expect(s.dialogue).not.toHaveBeenCalled();
    s.state.pos.set(p.x, 0, p.z); s.state.speed = 0;
    await action.run();
    expect(s.save.introStage).toBe(INTRO.RETURN);
  });

  it.each(["away", "moving"])("does not complete a delivery after the player is %s", async (change) => {
    const s = setup(INTRO.DONE), dest = DESTINATIONS[0]!, p = POIS[dest.poi]!;
    s.missions.startJob(dest); s.state.pos.set(p.x, 0, p.z);
    const action = s.missions.deliveryHere()!;
    if (change === "away") s.state.pos.x += 4; else s.state.speed = -3;
    await action.run();
    expect(s.save.stats.deliveries).toBe(0);
    expect(s.missions.job?.dest).toBe(dest);
    s.state.pos.set(p.x, 0, p.z); s.state.speed = null;
    await action.run();
    expect(s.save.stats.deliveries).toBe(1);
  });
});
