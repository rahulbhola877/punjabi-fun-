import { describe, expect, it } from "vitest";
import { collectKotliSupplies, deliverKotliSupplies, finishKotliSupplies, kotliSuppliesStep, startKotliSupplies } from "../src/missions/KotliSupplies";
import { freshKotliSelection } from "../src/missions/KotliSelection";
import { newSave, validate } from "../src/save/schema";

const bounds = { minX: -2000, maxX: 2000, minZ: -2000, maxZ: 2000 };
const selected = { ...freshKotliSelection(), stage: "done" as const, receipt: true };

describe("Kotli practice supplies", () => {
  it("requires selection, collection, handoff and report, paying once", () => {
    const home: Record<string, number> = {};
    expect(startKotliSupplies(home, undefined)).toBe(false);
    expect(startKotliSupplies(home, { ...selected, receipt: false })).toBe(false);
    expect(collectKotliSupplies(home)).toBe(false);
    expect(startKotliSupplies(home, selected)).toBe(true);
    expect(startKotliSupplies(home, selected)).toBe(false);
    expect(deliverKotliSupplies(home)).toBe(false);
    expect(finishKotliSupplies(home)).toBeNull();
    expect(collectKotliSupplies(home)).toBe(true);
    expect(collectKotliSupplies(home)).toBe(false);
    expect(deliverKotliSupplies(home)).toBe(true);
    expect(deliverKotliSupplies(home)).toBe(false);
    expect(finishKotliSupplies(home)).toEqual({ money: 60, rep: 2 });
    expect(finishKotliSupplies(home)).toBeNull();
    expect(startKotliSupplies(home, selected)).toBe(false);
  });
  it("resumes each step through the real save validator and preserves the receipt", () => {
    let save = newSave("preet", { x: -12, z: 318, yaw: 0 }, []);
    const reload = () => { save = validate(JSON.parse(JSON.stringify(save)), ["preet"], bounds); };
    startKotliSupplies(save.home, selected); reload();
    expect(kotliSuppliesStep(save.home)).toBe(1);
    collectKotliSupplies(save.home); reload();
    expect(kotliSuppliesStep(save.home)).toBe(2);
    deliverKotliSupplies(save.home); reload();
    expect(kotliSuppliesStep(save.home)).toBe(3);
    finishKotliSupplies(save.home); reload();
    expect(kotliSuppliesStep(save.home)).toBe(4);
    expect(finishKotliSupplies(save.home)).toBeNull();
  });
  it("treats malformed steps as unstarted", () => {
    for (const step of [-1, 5, 1.5, NaN]) expect(kotliSuppliesStep({ kotliSuppliesStep: step })).toBe(0);
  });
});
