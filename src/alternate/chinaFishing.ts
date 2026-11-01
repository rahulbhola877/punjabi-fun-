/** A small timing game at the harbor. A catch only counts after a bite. */
export type FishingPhase = "idle" | "waiting" | "bite" | "ready" | "delivered";
export interface FishingState { phase: FishingPhase; catches: number; remaining: number }
export const CHINA_FISHING_SPOT = { x: 11, z: -25 } as const;
export const CHINA_FISHMONGER = { x: -49, z: 20 } as const;
export function startChinaFishing(delivered = false): FishingState {
  return { phase: delivered ? "delivered" : "idle", catches: delivered ? 3 : 0, remaining: 0 };
}
export function castChinaFishing(state: FishingState): FishingState {
  if (state.phase !== "idle") return state;
  return { ...state, phase: "waiting", remaining: 2.6 + state.catches * 0.6 };
}
export function tickChinaFishing(state: FishingState, dt: number): FishingState {
  if (state.phase !== "waiting" && state.phase !== "bite") return state;
  const remaining = state.remaining - Math.max(0, dt);
  if (remaining > 0) return { ...state, remaining };
  if (state.phase === "waiting" && remaining > -2.8) return { ...state, phase: "bite", remaining: 2.8 + remaining };
  return { ...state, phase: "idle", remaining: 0 };
}
export function reelChinaFishing(state: FishingState): FishingState {
  if (state.phase === "waiting") return { ...state, phase: "idle", remaining: 0 };
  if (state.phase !== "bite" || state.remaining <= 0) return state;
  const catches = state.catches + 1;
  return { phase: catches >= 3 ? "ready" : "idle", catches, remaining: 0 };
}
export function deliverChinaFishing(state: FishingState): FishingState {
  return state.phase === "ready" ? { ...state, phase: "delivered" } : state;
}
