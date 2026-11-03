import { describe, expect, it } from "vitest";
import { cancelCanalChallenge, canalChallengeState, recordCanalChallengeThrow, reportCanalChallenge, startCanalChallenge } from "../src/missions/CanalChallenge";
import { planStoneSkips, SKIPPING_LANDING } from "../src/missions/CanalSkipping";
import { newSave, validate } from "../src/save/schema";

const bounds = { minX: -1000, maxX: 1000, minZ: -2000, maxZ: 2000 };

describe("Amar's canal challenge", () => {
  it.each([3, 5] as const)("records three finished throws for target %i, checkpoints and pays the relationship once", (target) => {
    let save = newSave("preet", { x: 0, z: 0, yaw: 0 }, []);
    expect(startCanalChallenge(save.home, target)).toBe(true);
    expect(startCanalChallenge(save.home, target)).toBe(false);
    expect(recordCanalChallengeThrow(save.home, 1)).toBe(true);
    const before = JSON.stringify(save.home); // An interrupted throw has no completion callback.
    save = validate(JSON.parse(JSON.stringify(save)), ["preet"], bounds);
    expect(JSON.stringify(save.home)).toBe(before);
    expect(canalChallengeState(save.home)).toMatchObject({ stage: "throwing", throws: 1, best: 1 });
    expect(recordCanalChallengeThrow(save.home, target)).toBe(true);
    expect(reportCanalChallenge(save.home)).toBeNull();
    expect(recordCanalChallengeThrow(save.home, 2)).toBe(true);
    expect(recordCanalChallengeThrow(save.home, 7)).toBe(false);
    expect(canalChallengeState(save.home)).toMatchObject({ stage: "report", throws: 3, best: target });
    expect(reportCanalChallenge(save.home)).toEqual({ target, best: target, won: true, firstRelationship: true });
    expect(reportCanalChallenge(save.home)).toBeNull();
    expect(canalChallengeState(save.home).records[target]).toBe(target);
    expect(startCanalChallenge(save.home, target)).toBe(true);
    for (let i = 0; i < 3; i++) expect(recordCanalChallengeThrow(save.home, target)).toBe(true);
    expect(reportCanalChallenge(save.home)?.firstRelationship).toBe(false);
  });

  it("closes a failed round, preserves both records and lets the player retry", () => {
    const home = { canalChallengeRecord3: 4, canalChallengeRecord5: 6 };
    expect(startCanalChallenge(home, 5)).toBe(true);
    for (const count of [1, 2, 3]) recordCanalChallengeThrow(home, count);
    expect(reportCanalChallenge(home)).toEqual({ target: 5, best: 3, won: false, firstRelationship: false });
    expect(canalChallengeState(home).records).toEqual({ 3: 4, 5: 6 });
    expect(startCanalChallenge(home, 3)).toBe(true);
  });

  it.each([1, 3])("abandons a round after %i throws without a record or relationship", (throws) => {
    const home = { canalChallengeRecord3: 4, canalChallengeRecord5: 2 };
    expect(cancelCanalChallenge(home)).toBe(false);
    expect(startCanalChallenge(home, 5)).toBe(true);
    for (let i = 0; i < throws; i++) expect(recordCanalChallengeThrow(home, 6)).toBe(true);
    expect(cancelCanalChallenge(home)).toBe(true);
    expect(cancelCanalChallenge(home)).toBe(false);
    expect(reportCanalChallenge(home)).toBeNull();
    expect(canalChallengeState(home)).toMatchObject({ stage: "idle", relationshipReceived: false, records: { 3: 4, 5: 2 } });
    expect(startCanalChallenge(home, 3)).toBe(true);
  });

  it("treats old and inconsistent round data as idle while retaining valid independent records", () => {
    expect(canalChallengeState({}).stage).toBe("idle");
    for (const home of [
      { canalChallengeStage: 1, canalChallengeTarget: 4, canalChallengeThrows: 1, canalChallengeBest: 2 },
      { canalChallengeStage: 1, canalChallengeTarget: 3, canalChallengeThrows: 3, canalChallengeBest: 2 },
      { canalChallengeStage: 2, canalChallengeTarget: 5, canalChallengeThrows: 2, canalChallengeBest: 5 },
      { canalChallengeStage: 1, canalChallengeTarget: 3, canalChallengeThrows: 0, canalChallengeBest: 7 },
    ]) expect(canalChallengeState({ ...home, canalChallengeRecord3: 6 }).records[3]).toBe(6);
    const home = { canalChallengeStage: 2, canalChallengeTarget: 5, canalChallengeThrows: 1, canalChallengeBest: 5 };
    expect(canalChallengeState(home).stage).toBe("idle");
    expect(startCanalChallenge(home, 3)).toBe(true);
    expect(recordCanalChallengeThrow(home, NaN)).toBe(false);
    expect(recordCanalChallengeThrow(home, 8)).toBe(false);
  });

  it("has a five-impact trajectory from the designated landing", () => {
    const possible = Array.from({ length: 6284 }, (_, i) => planStoneSkips(SKIPPING_LANDING, -Math.PI + i * 0.001));
    expect(Math.max(...possible.map((points) => points.length))).toBeGreaterThanOrEqual(5);
  });
});
