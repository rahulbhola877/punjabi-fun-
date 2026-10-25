/** Shared hours for activities that need daylight. Night workers keep explicit shifts. */
export const START_HOUR = 9;
export const daytime = (hour: number): boolean => hour >= 6 && hour < 20;
export const quietHours = (hour: number): boolean => hour >= 22 || hour < 6;
export function doorResponse(hour: number, known: boolean): "night" | "welcome" | "stranger" {
  return quietHours(hour) ? "night" : known ? "welcome" : "stranger";
}
/** Sessions open in daylight, including an old save last played at night. */
export function sessionHour(saved: number, explicit?: number): number {
  if (explicit !== undefined && Number.isFinite(explicit)) return ((explicit % 24) + 24) % 24;
  return Number.isFinite(saved) && saved >= 7 && saved < 18 ? saved : START_HOUR;
}
