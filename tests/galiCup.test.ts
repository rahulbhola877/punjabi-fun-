import { describe, expect, it } from "vitest";
import { beginCupRound, chooseCupRules, freshGaliCup, inviteCup, normalizeGaliCup, recordCupResult } from "../src/missions/GaliCup";
import type { CricketResult } from "../src/minigames/Cricket";
const result = (seed: number, mode: "practice" | "cup", rules: "ground" | "open" = "ground"): CricketResult => ({ seed, mode, rules, runs: 24, target: mode === "practice" ? 4 : rules === "ground" ? 10 : 20, wickets: 0, won: true, fielded: true, recovered: true });
describe("Gali Cup checkpoints and receipts", () => {
  it("requires invitation, batting and fielding practice before cup admission", () => {
    expect(beginCupRound(freshGaliCup())).toBeNull();
    let s = inviteCup(freshGaliCup());
    expect(beginCupRound(s, false)).toBeNull();
    let round = beginCupRound(s)!;
    s = recordCupResult(round.state, { ...result(round.seed, "practice"), fielded: false }).state;
    expect(s.stage).toBe("practice"); expect(s.practiceBat).toBe(true);
    round = beginCupRound(s)!;
    s = recordCupResult(round.state, { ...result(round.seed, "practice"), runs: 0 }).state;
    expect(s.stage).toBe("ready");
  });
  it("recovers interrupted preparation without replaying a reward", () => {
    const round = beginCupRound(inviteCup(freshGaliCup()))!;
    const loaded = normalizeGaliCup(JSON.parse(JSON.stringify(round.state)));
    expect(loaded.interrupted).toBe(false); expect(loaded.resumed).toBe(true);
    expect(loaded.seed).toBe(round.seed); expect(beginCupRound(loaded)?.mode).toBe("practice");
  });
  it("consumes each seeded attempt once; both rules have independent records", () => {
    let r = beginCupRound(inviteCup(freshGaliCup()))!;
    let s = recordCupResult(r.state, result(r.seed, "practice")).state;
    r = beginCupRound(s)!; let outcome = recordCupResult(r.state, result(r.seed, "cup"));
    expect(outcome.firstReward).toBe(true); expect(outcome.relationship?.delta).toBe(3);
    expect(recordCupResult(outcome.state, result(r.seed, "cup")).accepted).toBe(false);
    s = chooseCupRules(outcome.state, "open"); r = beginCupRound(s)!;
    outcome = recordCupResult(r.state, result(r.seed, "cup", "open"));
    expect(outcome.firstReward).toBe(false); expect(outcome.state.records.ground.wins).toBe(1); expect(outcome.state.records.open.medal).toBe(true);
  });
  it("keeps loss recoverable and rejects stale completion", () => {
    let r = beginCupRound(inviteCup(freshGaliCup()))!;
    let s = recordCupResult(r.state, result(r.seed, "practice")).state;
    r = beginCupRound(s)!;
    expect(recordCupResult(r.state, result(r.seed + 1, "cup")).accepted).toBe(false);
    s = recordCupResult(r.state, { ...result(r.seed, "cup"), fielded: false }).state;
    expect(s.stage).toBe("ready"); expect(s.receipt).toBe(false); expect(beginCupRound(s)?.mode).toBe("cup");
  });
  it("validates corrupt additive saves", () => {
    const s = normalizeGaliCup({ stage: "ready", seed: Infinity, records: { ground: { best: Infinity, wins: -2 } } });
    expect(s.stage).toBe("practice"); expect(s.seed).toBe(1701); expect(s.records.ground.best).toBe(0);
  });
});
