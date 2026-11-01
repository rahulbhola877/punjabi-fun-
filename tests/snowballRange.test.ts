import { describe, expect, it } from "vitest";
import { aimSnowTarget, SNOW_RANGE, SnowballRound, snowTargetPosition } from "../src/missions/SnowballRange";

describe("snowball target range", () => {
  it("requires the target to be ahead and in the player's aim", () => {
    expect(aimSnowTarget(0, 0, 0, { x: 0.4, z: 10 })).toBe(true);
    expect(aimSnowTarget(0, 0, 0, { x: 2, z: 10 })).toBe(false);
    expect(aimSnowTarget(0, 0, 0, { x: 0, z: -10 })).toBe(false);
    expect(aimSnowTarget(0, 0, 0, { x: 0, z: 24 })).toBe(false);
  });

  it("scores moving targets, respects cover and cooldown, and ends after eight throws", () => {
    const round = new SnowballRound(); round.start();
    const target = snowTargetPosition(1, 0);
    const yaw = Math.atan2(target.x - SNOW_RANGE.x, target.z - SNOW_RANGE.z);
    expect(round.throw(SNOW_RANGE.x, SNOW_RANGE.z, yaw, () => true)).toBe("miss");
    expect(round.throw(SNOW_RANGE.x, SNOW_RANGE.z, yaw)).toBe("wait");
    round.update(0.5);
    const p = snowTargetPosition(1, round.elapsed);
    expect(round.throw(SNOW_RANGE.x, SNOW_RANGE.z, Math.atan2(p.x - SNOW_RANGE.x, p.z - SNOW_RANGE.z))).toBe("hit");
    expect(round.score).toBe(1);
    for (let i = 0; i < 6; i++) { round.update(0.5); round.throw(SNOW_RANGE.x, SNOW_RANGE.z, Math.PI); }
    expect(round.throws).toBe(8); expect(round.active).toBe(false);
  });

  it("times out and restarts cleanly", () => {
    const round = new SnowballRound(); round.start();
    expect(round.update(35)).toBe(true); expect(round.active).toBe(false);
    round.start(); expect(round.remaining).toBe(35); expect(round.throws).toBe(0);
  });
});
