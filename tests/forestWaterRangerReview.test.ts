import { describe, expect, it, vi } from "vitest";
import { Game } from "../src/app/Game";

function ranger(stage: number, day: number, answer: string) {
  const game = Object.create(Game.prototype) as any;
  game.save = { home: { forestWaterStage: stage, day } };
  game.dialogue = vi.fn(async () => answer);
  game.forestWater = { sync: vi.fn() };
  game.ui = { toast: vi.fn() };
  game.persist = vi.fn();
  game.reward = vi.fn();
  return game;
}

describe("Kiran's completed spring interaction", () => {
  it("records the report day and original reward once", async () => {
    const game = ranger(4, 2, "ok");
    await game.talkForestRanger();
    expect(game.save.home).toMatchObject({ forestWaterStage: 6, forestWaterReviewDay: 2 });
    expect(game.reward).toHaveBeenCalledTimes(1);
    await game.talkForestRanger();
    expect(game.reward).toHaveBeenCalledTimes(1);
    expect(game.dialogue.mock.calls[1][1]).toContain("a day");
  });

  it("persists and renders a selected switch without another reward", async () => {
    const game = ranger(6, 3, "switch");
    game.save.home.forestWaterReviewDay = 2;
    await game.talkForestRanger();
    expect(game.save.home).toMatchObject({ forestWaterStage: 7, forestWaterReviewDay: 3 });
    expect(game.forestWater.sync).toHaveBeenCalledWith(game.save.home);
    expect(game.persist).toHaveBeenCalledWith("forest_water");
    expect(game.reward).not.toHaveBeenCalled();
    await game.talkForestRanger();
    expect(game.save.home.forestWaterStage).toBe(7);
  });

  it("leaves the chosen outlet alone when the player keeps it", async () => {
    const game = ranger(7, 3, "keep");
    await game.talkForestRanger();
    expect(game.save.home.forestWaterStage).toBe(7);
    expect(game.persist).not.toHaveBeenCalled();
    expect(game.forestWater.sync).not.toHaveBeenCalled();
  });
});
