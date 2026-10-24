/**
 * The day's rhythm on the road: how many vehicles there are at each hour compared with the quality preset's own
 * figure, and when the works change shift. The G.T. Road is nearly empty before five, fills with the morning rush,
 * and is at its fullest from four to six, when the day shift pours out of the factories, the schools let out and
 * everybody wants the same bridge.
 */

/** Hours at which the works sound the hooter: the day shift goes in at eight, comes out and the evening shift goes in at four. */
export const SHIFT_HOURS = [8, 16] as const;

const POINTS: Array<[number, number]> = [
  [0, 0.4], [4.5, 0.4], [6, 0.8], [8, 1.2], [10, 1.05], [12, 1.0], [15, 1.1], [16, 1.5], [18, 1.5], [19.5, 1.15], [21.5, 0.8], [23, 0.5], [24, 0.4],
];

/** Multiplier on the preset's traffic figures for this hour (0 to 24). */
export function rushFactor(hour: number): number {
  const h = ((hour % 24) + 24) % 24;
  for (let i = 1; i < POINTS.length; i++) {
    const [h1, f1] = POINTS[i]!, [h0, f0] = POINTS[i - 1]!;
    if (h <= h1) return f0 + ((f1 - f0) * (h - h0)) / (h1 - h0);
  }
  return POINTS[POINTS.length - 1]![1];
}

/** Did the clock pass a shift change between two readings (the hour may wrap past midnight)? Returns the hour passed, or null. */
export function shiftPassed(prev: number, now: number): number | null {
  if (now < prev) return null;
  for (const s of SHIFT_HOURS) if (prev < s && now >= s) return s;
  return null;
}

/**
 * Dhund, the winter fog of the plains: thick at dawn in Poh and Magh (the coldest months), thinner in Maghar and
 * Phagan, gone by noon and back, lightly, after dark. Returns the exponential fog density for this month (0 to 11)
 * and hour; 0 means none at all.
 */
export function dhundDensity(month: number, hour: number): number {
  const season = month === 2 || month === 3 ? 1 : month === 1 || month === 4 ? 0.45 : 0;
  if (!season) return 0;
  const h = ((hour % 24) + 24) % 24;
  let t = 0;
  if (h < 5) t = 0.7;
  else if (h < 8.5) t = 1;
  else if (h < 11) t = 1 - (h - 8.5) / 2.5;
  else if (h < 18) t = 0;
  else if (h < 22) t = ((h - 18) / 4) * 0.55;
  else t = 0.6;
  return 0.014 * season * t;
}
