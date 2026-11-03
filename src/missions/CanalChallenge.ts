/** Amar's optional ghat challenge. All progress uses the existing numeric home save. */
export type CanalTarget = 3 | 5;
export type CanalChallengeStage = "idle" | "throwing" | "report";
export interface CanalChallengeState {
  stage: CanalChallengeStage;
  target: CanalTarget | null;
  throws: number;
  best: number;
  records: { 3: number; 5: number };
  relationshipReceived: boolean;
}

const STAGE = "canalChallengeStage", TARGET = "canalChallengeTarget";
const THROWS = "canalChallengeThrows", BEST = "canalChallengeBest";
const RECORD_3 = "canalChallengeRecord3", RECORD_5 = "canalChallengeRecord5";
const RECEIPT = "canalChallengeRelationship";
const MAX_SKIPS = 7; // One first impact plus six further impacts.
const integerIn = (value: unknown, min: number, max: number): value is number =>
  typeof value === "number" && Number.isInteger(value) && value >= min && value <= max;

/** Invalid or older data reads as an idle challenge; independent valid records survive. */
export function canalChallengeState(home: Record<string, number>): CanalChallengeState {
  const records = { 3: integerIn(home[RECORD_3], 0, MAX_SKIPS) ? home[RECORD_3] : 0,
    5: integerIn(home[RECORD_5], 0, MAX_SKIPS) ? home[RECORD_5] : 0 };
  const idle: CanalChallengeState = { stage: "idle", target: null, throws: 0, best: 0,
    records, relationshipReceived: home[RECEIPT] === 1 };
  const stage = home[STAGE], target = home[TARGET], throws = home[THROWS], best = home[BEST];
  if ((stage !== 1 && stage !== 2) || (target !== 3 && target !== 5)
    || !integerIn(throws, 0, 3) || !integerIn(best, 0, MAX_SKIPS)
    || (throws === 0 && best !== 0) || (stage === 1 && throws >= 3) || (stage === 2 && throws !== 3)) return idle;
  return { ...idle, stage: stage === 1 ? "throwing" : "report", target, throws, best };
}

/** Start or retry only after the previous round is reported and closed. */
export function startCanalChallenge(home: Record<string, number>, target: CanalTarget): boolean {
  if ((target !== 3 && target !== 5) || canalChallengeState(home).stage !== "idle") return false;
  home[STAGE] = 1; home[TARGET] = target; home[THROWS] = 0; home[BEST] = 0;
  return true;
}

/** Call only from a completed throw's onFinish callback, never on launch or interruption. */
export function recordCanalChallengeThrow(home: Record<string, number>, count: number): boolean {
  const state = canalChallengeState(home);
  if (state.stage !== "throwing" || !integerIn(count, 1, MAX_SKIPS)) return false;
  home[THROWS] = state.throws + 1;
  home[BEST] = Math.max(state.best, count);
  if (home[THROWS] === 3) home[STAGE] = 2;
  return true;
}

/** Abandon the current round without recording it or granting a relationship. */
export function cancelCanalChallenge(home: Record<string, number>): boolean {
  if (canalChallengeState(home).stage === "idle") return false;
  home[STAGE] = 0;
  return true;
}

export interface CanalChallengeReport { target: CanalTarget; best: number; won: boolean; firstRelationship: boolean }
/** Consume the report exactly once; the host persists before opening acknowledgement UI. */
export function reportCanalChallenge(home: Record<string, number>): CanalChallengeReport | null {
  const state = canalChallengeState(home);
  if (state.stage !== "report" || state.target === null) return null;
  const won = state.best >= state.target, firstRelationship = won && !state.relationshipReceived;
  const key = state.target === 3 ? RECORD_3 : RECORD_5;
  home[key] = Math.max(state.records[state.target], state.best);
  if (firstRelationship) home[RECEIPT] = 1;
  home[STAGE] = 0;
  return { target: state.target, best: state.best, won, firstRelationship };
}
