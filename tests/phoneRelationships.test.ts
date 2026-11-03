import { expect, it, vi } from "vitest";
import { Vector3 } from "../src/babylon";
import { People } from "../src/crowds/People";
import { Missions, INTRO, type MissionHost } from "../src/missions/Missions";
import { newSave } from "../src/save/schema";
import { PLAYER_START } from "../src/world/layout";
import { buildRoadGraph } from "../src/world/nav";

it("checkpoints each phone errand relationship once alongside its stage", async () => {
  const save = newSave("preet", PLAYER_START, []);
  save.introStage = INTRO.DELIVER;
  const people = new People(); people.files = save.people;
  const checkpoints: Array<{ stage: number; people: ReturnType<People["toJSON"]> }> = [];
  const dialogue = vi.fn(async () => "ok");
  const host: MissionHost = {
    save, playerPos: () => new Vector3(), vehicleSpeed: () => null, vehicleType: () => null,
    setCarrying: () => {}, dialogue, results: async () => "ok", toast: () => {}, reward: () => {},
    repTier: () => 0, sting: () => {}, residentSay: () => {}, residentGesture: () => {}, voice: () => {},
    persist: () => checkpoints.push({ stage: save.introStage, people: structuredClone(people.toJSON()) }),
    roadGraph: buildRoadGraph(), spillFactor: () => 1, tipMultiplier: () => 1, takeWarmthBonus: () => 0,
    warm: (id, amount) => { people.bump(id, amount); },
  };
  const missions = new Missions(host);
  await missions.buyMobile();
  expect(checkpoints.at(-1)).toMatchObject({ stage: INTRO.RETURN, people: { mobileWala: { rep: 1 } } });
  await missions.buyMobile();
  await missions.talkBhola();
  expect(checkpoints.at(-1)).toMatchObject({ stage: INTRO.DONE, people: { mobileWala: { rep: 1 }, bhola: { rep: 2 } } });
  const reloaded = new People(checkpoints.at(-1)!.people);
  expect(reloaded.file("bhola").rep).toBe(2);
  expect(reloaded.file("mobileWala").rep).toBe(1);
  dialogue.mockResolvedValue("no");
  await missions.talkBhola();
  expect(people.file("bhola").rep).toBe(2);
  expect(people.file("mobileWala").rep).toBe(1);
});
