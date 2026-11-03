import type { KotliSelectionState } from "./KotliSelection";

/** The existing dispensary entrance and Ustad's usual position beside the court. */
export const KOTLI_SUPPLIES_DISPENSARY = { x: 22, z: 319.5 } as const;
export const KOTLI_SUPPLIES_USTAD = { x: -31, z: 350 } as const;
export const KOTLI_SUPPLIES_REWARD = { money: 60, rep: 2 } as const;
const STEP = "kotliSuppliesStep";

/** 0 = unstarted, 1 = collect supplies, 2 = deliver to Ustad, 3 = report, 4 = receipt. */
export function kotliSuppliesStep(home: Record<string, number>): 0 | 1 | 2 | 3 | 4 {
  const value = home[STEP];
  return value === 1 || value === 2 || value === 3 || value === 4 ? value : 0;
}

export function startKotliSupplies(home: Record<string, number>, selection: KotliSelectionState | undefined): boolean {
  if (selection?.stage !== "done" || !selection.receipt || kotliSuppliesStep(home) !== 0) return false;
  home[STEP] = 1;
  return true;
}

export function collectKotliSupplies(home: Record<string, number>): boolean {
  if (kotliSuppliesStep(home) !== 1) return false;
  home[STEP] = 2;
  return true;
}

export function deliverKotliSupplies(home: Record<string, number>): boolean {
  if (kotliSuppliesStep(home) !== 2) return false;
  home[STEP] = 3;
  return true;
}

/** Commit receipt and returned reward together before awaiting dialogue. */
export function finishKotliSupplies(home: Record<string, number>): typeof KOTLI_SUPPLIES_REWARD | null {
  if (kotliSuppliesStep(home) !== 3) return null;
  home[STEP] = 4;
  return KOTLI_SUPPLIES_REWARD;
}
