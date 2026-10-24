import { describe, expect, it } from "vitest";
import { Vector3 } from "../src/babylon";
import { Missions, INTRO, type MissionHost } from "../src/missions/Missions";
import { buildRoadGraph } from "../src/world/nav";
import { newSave } from "../src/save/schema";
import { PLAYER_START } from "../src/world/layout";

/** A MissionHost that records what the game would have been told to do. */
function stubHost(stage: number) {
  const save = newSave("preet", PLAYER_START, []);
  save.introStage = stage;
  const log = {
    dialogues: [] as string[],
    toasts: [] as string[],
    voices: [] as string[],
    carrying: [] as boolean[],
    rewards: [] as Array<[number, number]>,
  };
  const host: MissionHost = {
    save,
    playerPos: () => new Vector3(-8, 0, -39.7),
    vehicleSpeed: () => null,
    vehicleType: () => null,
    setCarrying: (on) => log.carrying.push(on),
    dialogue: async (_who, text) => { log.dialogues.push(text); return "n"; },
    results: async () => "ok",
    toast: (m) => log.toasts.push(m),
    reward: (money, rep) => log.rewards.push([money, rep]),
    sting: () => {},
    residentSay: () => {},
    residentGesture: () => {},
    voice: (clip) => log.voices.push(clip),
    persist: () => {},
    roadGraph: buildRoadGraph(),
    spillFactor: () => 1,
    tipMultiplier: () => 1,
    takeWarmthBonus: () => 0,
    repTier: () => 0,
  };
  return { host, save, log, missions: new Missions(host) };
}

describe("first mission: Bhola's phone", () => {
  it("sends you to Chaura Bazaar when you first meet Bhola", async () => {
    const { missions, save, log } = stubHost(INTRO.MEET);
    await missions.talkBhola();
    expect(log.voices).toContain("bhola_chaura");
    expect(save.introStage).toBe(INTRO.DELIVER);
    expect(log.dialogues.length).toBeGreaterThanOrEqual(3);
  });

  it("hands the phone over and finishes the intro", async () => {
    // This is the regression that mattered: talkBhola takes `busy`, so
    // finishIntro must not test it again — it used to, which made the
    // hand-over a silent no-op with the prompt stuck on screen for ever.
    const { missions, save, log } = stubHost(INTRO.RETURN);
    await missions.talkBhola();
    expect(save.introStage).toBe(INTRO.DONE);
    expect(log.voices).toContain("bhola_thanks");
    expect(log.rewards).toContainEqual([200, 10]);
    expect(log.carrying).toContain(false);
    expect(log.toasts.join(" ")).toMatch(/delivery jobs/i);
  });

  it("leaves the mission ready for the next order, not stuck busy", async () => {
    const { missions, save } = stubHost(INTRO.RETURN);
    await missions.talkBhola();
    expect(missions.busy).toBe(false);
    // The very next talk should hand out a delivery job.
    await missions.talkBhola();
    expect(save.introStage).toBe(INTRO.DONE);
  });

  it("nags rather than finishing while the phone is still unbought", async () => {
    const { missions, save, log } = stubHost(INTRO.DELIVER);
    await missions.talkBhola();
    expect(save.introStage).toBe(INTRO.DELIVER);
    expect(log.dialogues.join(" ")).toMatch(/Chaura Bazaar/i);
    expect(log.rewards).toHaveLength(0);
  });

  it("buys the phone at the shop and sends you back", async () => {
    const { missions, save, log } = stubHost(INTRO.DELIVER);
    await missions.buyMobile();
    expect(save.introStage).toBe(INTRO.RETURN);
    expect(log.voices).toContain("mobile_shop");
    expect(log.carrying).toContain(true);
  });
});
