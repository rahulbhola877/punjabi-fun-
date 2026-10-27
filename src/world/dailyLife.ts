/** Shared hours for activities that need daylight. Night workers keep explicit shifts. */
export const START_HOUR = 9;
export const daytime = (hour: number): boolean => hour >= 6 && hour < 20;
export const quietHours = (hour: number): boolean => hour >= 22 || hour < 6;
/** The afternoon rest hour: a stranger is told, from a window, to come back later. */
export const siestaHours = (hour: number): boolean => hour >= 13 && hour < 16;
export function doorResponse(hour: number, known: boolean): "night" | "siesta" | "welcome" | "stranger" {
  if (quietHours(hour)) return "night";
  if (known) return "welcome";
  return siestaHours(hour) ? "siesta" : "stranger";
}
/** Sessions open in daylight, including an old save last played at night. */
export function sessionHour(saved: number, explicit?: number): number {
  if (explicit !== undefined && Number.isFinite(explicit)) return ((explicit % 24) + 24) % 24;
  return Number.isFinite(saved) && saved >= 7 && saved < 18 ? saved : START_HOUR;
}
