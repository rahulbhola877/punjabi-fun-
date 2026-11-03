import type { KabaddiSelectionEvent } from "../minigames/Kabaddi";
export type KotliRole = "captain" | "raider";
export interface KotliSelectionState {
  version: 1;
  stage: "available" | "practice" | "choose" | "ready" | "playing" | "failed" | "report" | "done";
  role: KotliRole | null;
  practiceComplete: boolean;
  roundKind: "practice" | "selection" | null;
  attemptId: number;
  lastRaid: number;
  scoringRaids: number;
  bestTouches: number;
  receipt: boolean;
}
export function freshKotliSelection(): KotliSelectionState {
  return { version: 1, stage: "available", role: null, practiceComplete: false, roundKind: null, attemptId: 0, lastRaid: 0, scoringRaids: 0, bestTouches: 0, receipt: false };
}
const count = (v: unknown, cap: number) => typeof v === "number" && Number.isSafeInteger(v) && v >= 0 ? Math.min(cap, v) : 0;
/** Interrupted matches restart at preparation; no partial match qualification survives reload. */
export function normalizeKotliSelection(raw: unknown): KotliSelectionState {
  const s = freshKotliSelection();
  if (!raw || typeof raw !== "object" || (raw as { version?: unknown }).version !== 1) return s;
  const q = raw as Partial<KotliSelectionState>;
  s.attemptId = count(q.attemptId, Number.MAX_SAFE_INTEGER - 1);
  s.receipt = q.receipt === true;
  s.practiceComplete = q.practiceComplete === true;
  s.role = q.role === "captain" || q.role === "raider" ? q.role : null;
  if (s.receipt) { s.stage = "done"; s.practiceComplete = true; return s; }
  if (q.stage === "available") return s;
  if (!s.practiceComplete) { s.stage = "practice"; return s; }
  if (!s.role) { s.stage = "choose"; return s; }
  s.stage = q.stage === "failed" ? "failed" : "ready";
  if (q.stage === "report") {
    s.lastRaid = count(q.lastRaid, 4); s.scoringRaids = count(q.scoringRaids, 4); s.bestTouches = count(q.bestTouches, 4);
    if (s.lastRaid === 4 && qualified(s)) s.stage = "report";
  }
  return s;
}
export function inviteKotliSelection(s: KotliSelectionState): KotliSelectionState | null {
  return s.stage === "available" ? { ...s, stage: "practice" } : null;
}
export function chooseKotliRole(s: KotliSelectionState, role: KotliRole): KotliSelectionState | null {
  if (!s.practiceComplete || !["choose", "ready", "failed"].includes(s.stage) || (role !== "captain" && role !== "raider")) return null;
  return { ...s, stage: "ready", role, roundKind: null, lastRaid: 0, scoringRaids: 0, bestTouches: 0 };
}
export function beginKotliRound(s: KotliSelectionState): { state: KotliSelectionState; attemptId: number } | null {
  if ((s.stage !== "practice" && s.stage !== "ready") || s.receipt || s.attemptId >= Number.MAX_SAFE_INTEGER - 1) return null;
  const attemptId = s.attemptId + 1;
  return { state: { ...s, stage: "playing", roundKind: s.stage === "practice" ? "practice" : "selection", attemptId, lastRaid: 0, scoringRaids: 0, bestTouches: 0 }, attemptId };
}
const qualified = (s: KotliSelectionState) => s.role === "captain" ? s.scoringRaids >= 3 : s.role === "raider" && s.bestTouches >= 2;
export function recordKotliEvent(s: KotliSelectionState, event: KabaddiSelectionEvent): { state: KotliSelectionState; accepted: boolean } {
  const reject = { state: s, accepted: false };
  if (s.stage !== "playing" || event.cup || event.attemptId !== s.attemptId) return reject;
  if (event.kind === "interrupted") return { state: { ...s, stage: s.roundKind === "practice" ? s.practiceComplete ? "choose" : "practice" : "ready", roundKind: null, lastRaid: 0, scoringRaids: 0, bestTouches: 0 }, accepted: true };
  if (event.kind === "complete") {
    if (event.raids !== 4 || s.lastRaid !== 4) return reject;
    return { state: { ...s, stage: s.roundKind === "practice" ? s.practiceComplete ? "choose" : "practice" : qualified(s) ? "report" : "failed", roundKind: null }, accepted: true };
  }
  if (!Number.isInteger(event.raid) || event.raid !== s.lastRaid + 1 || event.raid > 4 || !Number.isInteger(event.touches) || event.touches < 0 || event.touches > 4 || !["home", "empty", "caught", "breath", "line", "late"].includes(event.reason) || (event.reason === "home" && event.touches < 1) || (event.reason === "empty" && event.touches !== 0)) return reject;
  const home = event.reason === "home";
  return { state: { ...s, lastRaid: event.raid, scoringRaids: s.scoringRaids + (home ? 1 : 0), bestTouches: Math.max(s.bestTouches, home ? event.touches : 0), practiceComplete: s.practiceComplete || s.roundKind === "practice" && home }, accepted: true };
}
/** Explicit cancel keeps completed practice but releases the activity slot. */
export function cancelKotliRound(s: KotliSelectionState): KotliSelectionState | null {
  return s.stage === "playing" ? recordKotliEvent(s, { kind: "interrupted", attemptId: s.attemptId, cup: false }).state : null;
}
/** Commit returned receipt, reward and relationship together before awaited dialogue. */
export function finishKotliSelection(s: KotliSelectionState): { state: KotliSelectionState; money: number; rep: number; relationship: { who: "sarpanch"; amount: number } } | null {
  if (s.stage !== "report" || s.receipt || !s.practiceComplete || s.lastRaid !== 4 || !qualified(s)) return null;
  return { state: { ...s, stage: "done", receipt: true }, money: s.role === "captain" ? 150 : 300, rep: s.role === "captain" ? 8 : 5, relationship: { who: "sarpanch", amount: s.role === "captain" ? 3 : 1 } };
}
