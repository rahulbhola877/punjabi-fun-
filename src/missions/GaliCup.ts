import type { CricketResult, CricketRules } from "../minigames/Cricket";

export interface CupRecord { best: number; wins: number; medal: boolean }
export interface GaliCupState {
  version: 1;
  stage: "uninvited" | "practice" | "ready" | "complete";
  rules: CricketRules;
  seed: number;
  interrupted: boolean;
  resumed: boolean;
  receipt: boolean;
  practiceBat: boolean;
  practiceField: boolean;
  records: Record<CricketRules, CupRecord>;
}
export function freshGaliCup(): GaliCupState {
  return { version: 1, stage: "uninvited", rules: "ground", seed: 1701, interrupted: false, resumed: false, receipt: false, practiceBat: false, practiceField: false, records: { ground: { best: 0, wins: 0, medal: false }, open: { best: 0, wins: 0, medal: false } } };
}
function count(value: unknown, cap = 1000000): number { return typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.min(cap, Math.floor(value))) : 0; }
/** Additive save validation; an interrupted round restarts at its preparation checkpoint. */
export function normalizeGaliCup(raw: unknown): GaliCupState {
  const s = freshGaliCup();
  if (!raw || typeof raw !== "object") return s;
  const q = raw as Partial<GaliCupState>;
  if (q.stage === "practice" || q.stage === "ready" || q.stage === "complete") s.stage = q.stage;
  s.rules = q.rules === "open" ? "open" : "ground";
  s.seed = count(q.seed, 2147483646) || 1701;
  s.receipt = q.receipt === true;
  s.practiceBat = q.practiceBat === true; s.practiceField = q.practiceField === true;
  s.resumed = q.interrupted === true || q.resumed === true;
  for (const rule of ["ground", "open"] as const) {
    const r = q.records?.[rule];
    s.records[rule] = { best: count(r?.best, 36), wins: count(r?.wins), medal: r?.medal === true };
  }
  if (s.receipt) s.stage = "complete";
  if (s.stage === "ready" && !(s.practiceBat && s.practiceField)) s.stage = "practice";
  return s;
}
function copy(s: GaliCupState): GaliCupState {
  return { ...s, records: { ground: { ...s.records.ground }, open: { ...s.records.open } } };
}
export function inviteCup(state: GaliCupState): GaliCupState {
  const s = copy(state); if (s.stage === "uninvited") s.stage = "practice"; return s;
}
export function chooseCupRules(state: GaliCupState, rules: CricketRules): GaliCupState {
  const s = copy(state); if (!s.interrupted) s.rules = rules; return s;
}
/** Persist this state BEFORE starting CricketGame. No partial short-round score is restored. */
export function beginCupRound(state: GaliCupState, practice = state.stage === "practice"): { state: GaliCupState; mode: "practice" | "cup"; rules: CricketRules; seed: number } | null {
  if (state.stage === "uninvited" || state.interrupted || (!practice && state.stage === "practice")) return null;
  const s = copy(state); s.interrupted = true; s.resumed = false;
  return { state: s, mode: practice ? "practice" : "cup", rules: s.rules, seed: s.seed };
}
/** Cancellation/reload returns to the same preparation checkpoint, preserving the seed. */
export function interruptCupRound(state: GaliCupState): GaliCupState {
  const s = copy(state); s.resumed = s.interrupted || s.resumed; s.interrupted = false; return s;
}
export interface CupOutcome { state: GaliCupState; accepted: boolean; firstReward: boolean; relationship: { name: "Gali team"; delta: number } | null }
/** Consume only the active seeded attempt. Hosts persist state/consequence before opening UI. */
export function recordCupResult(state: GaliCupState, result: CricketResult): CupOutcome {
  const s = copy(state);
  const expectedPractice = s.stage === "practice";
  if (!s.interrupted || result.seed !== s.seed || result.rules !== s.rules || (expectedPractice && result.mode !== "practice") || !Number.isFinite(result.runs) || result.runs < 0 || result.runs > 36) return { state: s, accepted: false, firstReward: false, relationship: null };
  s.interrupted = false; s.resumed = false;
  s.seed = (s.seed + 97) % 2147483646 || 1701;
  if (result.mode === "practice") {
    s.practiceBat ||= result.runs >= result.target;
    s.practiceField ||= result.fielded;
    if (s.stage === "practice" && s.practiceBat && s.practiceField) s.stage = "ready";
    return { state: s, accepted: true, firstReward: false, relationship: null };
  }
  const record = s.records[result.rules]; record.best = Math.max(record.best, Math.floor(result.runs));
  const won = result.runs >= (result.rules === "ground" ? 10 : 20) && result.fielded;
  const firstReward = won && !s.receipt;
  if (won) { record.wins++; record.medal = true; s.receipt = true; s.stage = "complete"; }
  return { state: s, accepted: true, firstReward, relationship: firstReward ? { name: "Gali team", delta: 3 } : null };
}
export function cupObjective(s: GaliCupState): string {
  if (s.resumed) return "Cup round interrupted. Speak at the park invitation to restart from preparation.";
  if (s.stage === "uninvited") return "Read the Gali da Cup invitation at Sant Nagar park.";
  if (s.stage === "practice") return `Park practice: ${s.practiceBat ? "batting ready" : "score 4 in three balls"}; ${s.practiceField ? "fielding ready" : "intercept and time a return"}.`;
  if (s.stage === "complete") return "Gali da Cup won. Return for rule medals, records and seeded rematches.";
  return `${s.rules === "ground" ? "Ground-only: boundaries count two; chase 10" : "Open boundaries: chase 20; recover any loose six"}, then intercept and return.`;
}
