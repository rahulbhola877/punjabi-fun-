import { describe, expect, it } from "vitest";
import { CANADA_RINK as R, onCanadaIce, RinkPuck } from "../src/missions/CanadaRink";
import { newSave, validate } from "../src/save/schema";

describe("Maple Street rink", () => {
  it("only lets a nearby player on the ice kick the puck", () => {
    const p = new RinkPuck();
    expect(onCanadaIce(R.x, R.z)).toBe(true);
    expect(onCanadaIce(R.x + R.halfWidth, R.z)).toBe(false);
    expect(p.kick(R.x + 5, R.z, 0)).toBe(false);
    expect(p.kick(R.x, R.z, NaN)).toBe(false);
    expect(p.kick(R.x, R.z, 0)).toBe(true);
    expect(p.kick(R.x, R.z, 0)).toBe(false);
  });
  it("scores at the open goal and resets, but rebounds from the boards", () => {
    const p = new RinkPuck();
    expect(p.kick(R.x, R.z, 0)).toBe(true);
    let goal = false;
    for (let i = 0; i < 200 && !goal; i++) goal = p.update(0.02);
    expect(goal).toBe(true);
    expect(p.x).toBe(R.x); expect(p.z).toBe(R.z);
    p.x = R.x + 5; p.z = R.z + R.halfLength - 0.4; p.vz = 10;
    expect(p.update(0.02)).toBe(false);
    expect(p.vz).toBeLessThan(0);
  });
  it("keeps the rink goal count when a save is validated", () => {
    const save = newSave("look", { x: 0, z: 0, yaw: 0 }, []);
    save.home.canadaRinkGoals = 7;
    expect(validate(save, ["look"], { minX: -2000, maxX: 2000, minZ: -2000, maxZ: 2500 }).home.canadaRinkGoals).toBe(7);
  });
});
