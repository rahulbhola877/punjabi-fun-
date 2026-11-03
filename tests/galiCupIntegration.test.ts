import { describe, expect, it, vi } from "vitest";
import { Game } from "../src/app/Game";
import { beginCupRound, freshGaliCup, normalizeGaliCup } from "../src/missions/GaliCup";
import { newSave, validate } from "../src/save/schema";
import { WORLD_BOUNDS } from "../src/app/config";

function fixture() {
  const game = Object.create(Game.prototype) as any;
  const events: string[] = [];
  Object.defineProperty(game, "carrying", { value: false, writable: true });
  Object.assign(game, {
    save: newSave("hero", { x: 130, z: -31, yaw: 0 }, []),
    driving: null, busRide: null,
    missions: { job: null, stage: 0, objective: () => ({ title: "Bhola", detail: "Phone errand", target: null }) }, tiffinRun: { batch: null, objective: () => null }, rides: { ride: null },
    cricket: { active: false, start: vi.fn(), stop: vi.fn() },
    kabaddi: { active: false }, tractorRace: { active: false },
    combat: { inFight: false, playerDown: false }, police: { stars: 0 },
    dogFetch: { active: false }, canalSkipping: { active: false },
    dayNight: { hour: 10 }, pistol: { equipped: false }, cupMenuBusy: false,
    ui: { menu: vi.fn(async () => "play"), toast: vi.fn(), results: vi.fn(async () => { events.push("results"); return "ok"; }) },
    audio: { success: vi.fn() }, setBusy: vi.fn(), setRoute: vi.fn(),
    persist: vi.fn(() => { events.push("persist"); return true; }),
    reward: vi.fn((money: number, rep: number) => { game.save.money += money; game.save.rep += rep; }),
  });
  return { game, events };
}

describe("integrated park mission ownership", () => {
  it("persists the cup receipt and relationship before results, and ignores duplicate completion", async () => {
    const { game, events } = fixture();
    const state = { ...freshGaliCup(), stage: "ready" as const, practiceBat: true, practiceField: true };
    game.save.galiCup = beginCupRound(state, false)!.state;
    const result = { mode: "cup", rules: "ground", seed: state.seed, runs: 10, target: 10, wickets: 0, won: true, fielded: true, recovered: false };
    game.finishCupRound(result);
    expect(game.save.galiCup.receipt).toBe(true);
    expect(game.save.people.gali_team).toMatchObject({ name: "Gali team", rep: 3 });
    expect(events).toEqual(["persist", "results"]);
    expect(game.save.rep).toBe(3);
    expect(game.save.home.punjabStory).toBe(1);
    game.finishCupRound(result);
    expect(game.ui.results).toHaveBeenCalledTimes(1);
    expect(game.save.rep).toBe(3);
    await Promise.resolve();
  });

  it("rechecks a job admitted while the invitation was open", async () => {
    const { game } = fixture();
    game.ui.menu.mockImplementation(async () => { game.missions.job = { id: "new-food" }; return "play"; });
    await game.cricketStart();
    expect(game.cricket.start).not.toHaveBeenCalled();
    expect(game.save.galiCup.interrupted).toBe(false);
    expect(game.missions.job.id).toBe("new-food");
  });

  it("starts an owned seeded practice only after saving its checkpoint", async () => {
    const { game, events } = fixture();
    game.cricket.start.mockImplementation(() => events.push("start"));
    await game.cricketStart();
    expect(game.cricket.start).toHaveBeenCalledWith(expect.objectContaining({ mode: "practice", rules: "ground", seed: 1701 }));
    expect(events).toEqual(["persist", "persist", "start"]);
    expect(game.save.galiCup.interrupted).toBe(true);
  });

  it("validates an additive interrupted cup checkpoint without changing old progression", () => {
    const save = newSave("hero", { x: 67, z: -35, yaw: 0 }, []);
    save.introStage = 4; save.home.japanTeaStage = 2; save.bag.canada_cocoa = 1;
    save.galiCup = beginCupRound({ ...freshGaliCup(), stage: "practice" })!.state;
    const loaded = validate(save, ["hero"], WORLD_BOUNDS);
    expect(loaded.galiCup).toMatchObject({ stage: "practice", interrupted: false, resumed: true });
    expect(loaded.introStage).toBe(4);
    expect(loaded.home.japanTeaStage).toBe(2);
    expect(loaded.bag.canada_cocoa).toBe(1);
    expect(normalizeGaliCup(undefined).stage).toBe("uninvited");
  });

  it("tracks the new invitation for an existing completed-intro save and explains night availability", async () => {
    const { game } = fixture();
    game.missions.stage = 999;
    game.ui.menu.mockResolvedValue("cup");
    await game.showPunjabStories();
    expect(game.setRoute).toHaveBeenCalledWith(120.8, -24, "Gali da Cup");
    expect(game.currentObjective().title).toContain("Gali da Cup");
    game.save.galiCup = { ...freshGaliCup(), stage: "complete", receipt: true };
    expect(game.currentObjective().title).toContain("Gali da Cup");
    game.dayNight.hour = 23;
    expect(game.currentObjective().detail).toContain("daylight");
    expect(game.save.introStage).toBe(0);
  });
});
