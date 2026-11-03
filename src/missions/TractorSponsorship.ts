/** One saved sponsorship commitment, fulfilled only by an owned race outcome. */
export type TractorCommitment = "purse" | "village";
export interface TractorOutcome { finished: boolean; rank: number; elapsed: number }
export interface TractorSponsorshipState {
  version: 1;
  stage: "available" | "ready" | "racing" | "failed" | "report" | "done";
  choice: TractorCommitment | null;
  attemptId: number;
  outcome: TractorOutcome | null;
  receipt: boolean;
}
export function freshTractorSponsorship(): TractorSponsorshipState {
  return { version: 1, stage: "available", choice: null, attemptId: 0, outcome: null, receipt: false };
}
function validOutcome(value: unknown): value is TractorOutcome {
  if (!value || typeof value !== "object") return false;
  const q = value as Partial<TractorOutcome>;
  return typeof q.finished === "boolean" && Number.isInteger(q.rank) && q.rank! >= 1 && q.rank! <= 4
    && typeof q.elapsed === "number" && Number.isFinite(q.elapsed) && q.elapsed > 0;
}
function qualified(choice: TractorCommitment | null, outcome: TractorOutcome): boolean {
  return outcome.finished && (choice === "village" || choice === "purse" && outcome.rank <= 3);
}
/** Reload never resumes a half-driven lap or trusts unqualified report evidence. */
export function normalizeTractorSponsorship(raw: unknown): TractorSponsorshipState {
  const s = freshTractorSponsorship();
  if (!raw || typeof raw !== "object" || (raw as {version?:unknown}).version !== 1) return s;
  const q = raw as Partial<TractorSponsorshipState>;
  if (Number.isSafeInteger(q.attemptId) && q.attemptId! >= 0) s.attemptId = Math.min(q.attemptId!, Number.MAX_SAFE_INTEGER - 1);
  s.choice = q.choice === "purse" || q.choice === "village" ? q.choice : null;
  if (!s.choice) return s;
  s.stage = "ready";
  if (s.attemptId > 0 && validOutcome(q.outcome)) {
    if ((q.stage === "report" || q.stage === "done") && qualified(s.choice, q.outcome)) {
      s.outcome = { ...q.outcome };
      s.receipt = q.stage === "done" && q.receipt === true;
      s.stage = s.receipt ? "done" : "report";
    } else if (q.stage === "failed" && !qualified(s.choice, q.outcome)) {
      s.outcome = { ...q.outcome }; s.stage = "failed";
    }
  }
  return s;
}
/** Invitation and choice are one transition; the caller checks story prerequisites. */
export function chooseTractorCommitment(s: TractorSponsorshipState, choice: TractorCommitment): TractorSponsorshipState | null {
  if (!["available", "ready", "failed"].includes(s.stage) || s.receipt || (choice !== "purse" && choice !== "village")) return null;
  return { ...s, stage: "ready", choice, outcome: null };
}
/** Commit only after the physical race start succeeds; a blocked grid consumes no attempt. */
export function beginTractorSponsorship(s: TractorSponsorshipState): {state:TractorSponsorshipState;attemptId:number} | null {
  if (s.stage !== "ready" || !s.choice || s.receipt || s.attemptId >= Number.MAX_SAFE_INTEGER - 1) return null;
  const attemptId = s.attemptId + 1;
  return { state: { ...s, stage: "racing", attemptId, outcome: null }, attemptId };
}
export function recordTractorOutcome(s: TractorSponsorshipState, attemptId: number, outcome: TractorOutcome): {state:TractorSponsorshipState;accepted:boolean} {
  if (s.stage !== "racing" || !s.choice || s.receipt || attemptId !== s.attemptId || !validOutcome(outcome)) return { state: s, accepted: false };
  return { state: { ...s, outcome: { ...outcome }, stage: qualified(s.choice, outcome) ? "report" : "failed" }, accepted: true };
}
export function interruptTractorSponsorship(s: TractorSponsorshipState, attemptId: number): TractorSponsorshipState | null {
  return s.stage === "racing" && !s.receipt && attemptId === s.attemptId ? { ...s, stage: "ready", outcome: null } : null;
}
/** Caller commits state, returned reward and relationship before awaiting dialogue. */
export function finishTractorSponsorship(s: TractorSponsorshipState): {state:TractorSponsorshipState;money:number;rep:number;relationship:{who:"sarpanch";amount:number}} | null {
  if (s.stage !== "report" || s.receipt || !s.outcome || !validOutcome(s.outcome) || !qualified(s.choice, s.outcome)) return null;
  const village = s.choice === "village";
  return { state: { ...s, stage: "done", receipt: true }, money: village ? 100 : 300, rep: village ? 8 : 2, relationship: { who: "sarpanch", amount: village ? 3 : 1 } };
}
