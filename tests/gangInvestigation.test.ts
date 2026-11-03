import { describe, expect, it } from "vitest";
import { finishGangStory, gangDefeated, gangStage, hearGangWitness, investigateGangStory, reportGangToPolice, startGangStory } from "../src/missions/GangStory";
import { newSave, validate } from "../src/save/schema";

const bounds = { minX: -1000, maxX: 1000, minZ: -2000, maxZ: 2000 };
const reload = (save: ReturnType<typeof newSave>) => validate(JSON.parse(JSON.stringify(save)), ["preet"], bounds);

describe("bus-stand investigation", () => {
  it("requires Bittu then Balwant, survives each checkpoint and completes once", () => {
    let save = newSave("preet", { x: 0, z: 0, yaw: 0 }, []);
    expect(startGangStory(save.flags)).toBe(true);
    expect(investigateGangStory(save.flags)).toBe(true);
    expect(investigateGangStory(save.flags)).toBe(false);
    expect(reportGangToPolice(save.flags)).toBe(false);
    expect(gangDefeated(save.flags, "busAdda")).toBe(false);
    save = reload(save);
    expect(gangStage(save.flags)).toBe("witness");
    expect(hearGangWitness(save.flags)).toBe(true);
    expect(hearGangWitness(save.flags)).toBe(false);
    expect(gangDefeated(save.flags, "busAdda")).toBe(false);
    save = reload(save);
    expect(gangStage(save.flags)).toBe("police");
    expect(reportGangToPolice(save.flags)).toBe(true);
    expect(reportGangToPolice(save.flags)).toBe(false);
    save = reload(save);
    expect(gangStage(save.flags)).toBe("return");
    expect(save.flags.crime_peaceful).toBe(true);
    expect(finishGangStory(save.flags)).toBe(true);
    expect(finishGangStory(save.flags)).toBe(false);
    save = reload(save);
    expect(gangStage(save.flags)).toBe("done");
    expect(startGangStory(save.flags)).toBe(false);
    expect(save.flags.crime_peaceful).toBe(true);
  });

  it("retains the legacy confrontation and rejects a stale investigation choice after combat", () => {
    const flags: Record<string, boolean> = { crime_active: true };
    expect(gangStage(flags)).toBe("confront");
    expect(gangDefeated(flags, "ghantaGhar")).toBe(false);
    expect(gangDefeated(flags, "busAdda")).toBe(true);
    expect(investigateGangStory(flags)).toBe(false);
    expect(hearGangWitness(flags)).toBe(false);
    expect(reportGangToPolice(flags)).toBe(false);
    expect(finishGangStory(flags)).toBe(true);
    expect(finishGangStory(flags)).toBe(false);
  });

  it("does not revive an inactive or completed story from orphaned investigation flags", () => {
    const flags: Record<string, boolean> = { crime_investigate: true, crime_witness: true };
    expect(gangStage(flags)).toBe("available");
    expect(startGangStory(flags)).toBe(true);
    expect(gangStage(flags)).toBe("confront");
    flags.crime_complete = true;
    expect(gangStage(flags)).toBe("done");
    expect(reportGangToPolice(flags)).toBe(false);
  });
});
