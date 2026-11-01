/** A small, repeatable orchard job. Progress lives in the existing numeric
 * save dictionary so leaving and returning to a game does not lose a round. */
export const ORCHARD_STAND = { x: 368, z: 1348 } as const;
export const ORCHARD_BASKETS = [
  { x: 303, z: 1298 }, { x: 402, z: 1375 }, { x: 493, z: 1358 },
] as const;
export const ORCHARD_PAY = 120;
const STEP = "orchardRoundStep", PAID_DAY = "orchardRoundPaidDay";

/** 0 = idle, 1–3 = next basket, 4 = return to the stand. */
export function orchardStep(home: Record<string, number>): number {
  const n = home[STEP];
  return Number.isInteger(n) && n! >= 0 && n! <= 4 ? n! : 0;
}

export function orchardAvailable(home: Record<string, number>, day: number): boolean {
  return orchardStep(home) === 0 && home[PAID_DAY] !== Math.floor(day) + 1;
}

export function startOrchardRound(home: Record<string, number>, day: number): boolean {
  if (!orchardAvailable(home, day)) return false;
  home[STEP] = 1;
  return true;
}

/** Advance only at the expected basket; completing a round pays once per game day. */
export function pickOrchardBasket(home: Record<string, number>, index: number): boolean {
  if (orchardStep(home) !== index + 1 || index < 0 || index >= ORCHARD_BASKETS.length) return false;
  home[STEP] = index + 2;
  return true;
}

export function finishOrchardRound(home: Record<string, number>, day: number): boolean {
  if (orchardStep(home) !== 4 || home[PAID_DAY] === Math.floor(day) + 1) return false;
  home[PAID_DAY] = Math.floor(day) + 1;
  home[STEP] = 0;
  return true;
}
