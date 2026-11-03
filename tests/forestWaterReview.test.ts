import { describe, expect, it } from "vitest";
import { advanceForestWater, forestWaterCanReview, forestWaterStage, recordForestWaterReport, switchForestWaterOutlet } from "../src/missions/ForestWater";
import { newSave, validate } from "../src/save/schema";

const bounds = { minX: -1000, maxX: 1000, minZ: -2000, maxZ: 2000 };

describe("Kiran's next-day spring review", () => {
  it.each([[4, 6, 7], [5, 7, 6]])("keeps outlet %i through its report day, then saves a switch", (pending, completed, switched) => {
    const save = newSave("preet", { x: 0, z: 0, yaw: 0 }, []);
    save.home.forestWaterStage = pending;
    expect(advanceForestWater(save.home, pending, completed)).toBe(true);
    recordForestWaterReport(save.home, 3);
    expect(forestWaterCanReview(save.home, 3)).toBe(false);
    expect(switchForestWaterOutlet(save.home, 3)).toBe(false);
    expect(forestWaterStage(save.home)).toBe(completed);
    expect(forestWaterCanReview(save.home, 4)).toBe(true);
    expect(switchForestWaterOutlet(save.home, 4)).toBe(true);
    const loaded = validate(JSON.parse(JSON.stringify(save)), ["preet"], bounds);
    expect(forestWaterStage(loaded.home)).toBe(switched);
    expect(forestWaterCanReview(loaded.home, 4)).toBe(false);
    expect(switchForestWaterOutlet(loaded.home, 4)).toBe(false);
    expect(switchForestWaterOutlet(loaded.home, 5)).toBe(true);
    expect(forestWaterStage(loaded.home)).toBe(completed);
  });

  it("permits legacy completed saves to review, but never pending or invalid-day states", () => {
    for (const stage of [6, 7]) {
      const home = { forestWaterStage: stage };
      expect(forestWaterCanReview(home, 0)).toBe(true);
      expect(switchForestWaterOutlet(home, 0)).toBe(true);
      expect(forestWaterCanReview(home, 0)).toBe(false);
    }
    for (const stage of [0, 1, 2, 3, 4, 5]) {
      const home = { forestWaterStage: stage };
      recordForestWaterReport(home, 0);
      expect(forestWaterCanReview(home, 1)).toBe(false);
      expect(switchForestWaterOutlet(home, 1)).toBe(false);
    }
    expect(forestWaterCanReview({ forestWaterStage: 6 }, -1)).toBe(false);
    expect(forestWaterCanReview({ forestWaterStage: 6 }, 0.5)).toBe(false);
  });
});
