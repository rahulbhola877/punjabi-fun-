import { describe, expect, it } from "vitest";
import { expeditionInteraction, normalizeExpeditionStage } from "../src/alternate/spaceExpedition";

describe("lunar rover expedition", () => {
  it("accepts only known saved stages", () => {
    for (const stage of [0, 1, 2, 3]) expect(normalizeExpeditionStage(stage)).toBe(stage);
    for (const stage of [undefined, null, {}, "2", -1, 4, 1.5, NaN, Infinity]) {
      expect(normalizeExpeditionStage(stage)).toBe(0);
    }
  });

  it("requires meeting the engineer and drilling from the rover before reporting back", () => {
    expect(expeditionInteraction(0, "sample", true).stage).toBe(0);
    expect(expeditionInteraction(0, "engineer").stage).toBe(1);
    expect(expeditionInteraction(1, "engineer").stage).toBe(1);
    expect(expeditionInteraction(1, "sample").stage).toBe(1);
    expect(expeditionInteraction(1, "sample", true).stage).toBe(2);
    expect(expeditionInteraction(2, "sample", true).stage).toBe(2);
    expect(expeditionInteraction(2, "engineer").stage).toBe(3);
    expect(expeditionInteraction(3, "engineer").stage).toBe(3);
    expect(expeditionInteraction(3, "sample", true).stage).toBe(3);
  });
});
