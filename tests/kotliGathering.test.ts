import { describe, expect, it } from "vitest";
import { gatheringStep, gatheringChoice, startGathering, consultGathering, postGatheringNotice, finishGathering } from "../src/missions/KotliGathering";
import { freshTractorSponsorship } from "../src/missions/TractorSponsorship";
import { newSave, validate } from "../src/save/schema";
const bounds = { minX: -2000, maxX: 2000, minZ: -2000, maxZ: 2000 };
const done = { ...freshTractorSponsorship(), stage: "done" as const, receipt: true };
describe("Kotli's community notice", () => {
  for (const choice of ["team", "care"] as const) it(`preserves the ${choice} dedication through each checkpoint and reports once`, () => {
    let save = newSave("preet", {x: 0, z: 0, yaw: 0}, []);
    const reload = () => { save = validate(JSON.parse(JSON.stringify(save)), ["preet"], bounds); };
    expect(startGathering(save.home, freshTractorSponsorship())).toBe(false);
    expect(postGatheringNotice(save.home, choice)).toBe(false);
    expect(startGathering(save.home, done)).toBe(true); reload(); expect(gatheringStep(save.home)).toBe(1);
    expect(consultGathering(save.home)).toBe(true); reload(); expect(gatheringStep(save.home)).toBe(2);
    expect(postGatheringNotice(save.home, choice)).toBe(true); reload();
    expect(gatheringStep(save.home)).toBe(3); expect(gatheringChoice(save.home)).toBe(choice);
    expect(finishGathering(save.home)).toBe(choice); reload();
    expect(gatheringStep(save.home)).toBe(4); expect(finishGathering(save.home)).toBeNull();
    expect(startGathering(save.home, done)).toBe(false);
  });
  it("does not report a corrupted notice without a dedication", () => {
    const home = { kotliGatherStep: 3, kotliGatherChoice: 7 };
    expect(finishGathering(home)).toBeNull();
  });
});
