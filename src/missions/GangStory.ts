/** A saved side story: accept, confront the bus-stand gang, then return. */
export type GangStage = "available" | "confront" | "return" | "done";
export function gangStage(flags: Record<string, boolean>): GangStage {
  if (flags.crime_complete) return "done";
  if (flags.crime_return) return "return";
  return flags.crime_active ? "confront" : "available";
}
export function startGangStory(flags: Record<string, boolean>): boolean {
  if (gangStage(flags) !== "available") return false;
  flags.crime_active = true;
  return true;
}
export function gangDefeated(flags: Record<string, boolean>, site: string): boolean {
  if (gangStage(flags) !== "confront" || site !== "busAdda") return false;
  flags.crime_return = true;
  return true;
}
export function finishGangStory(flags: Record<string, boolean>): boolean {
  if (gangStage(flags) !== "return") return false;
  flags.crime_active = false;
  flags.crime_return = false;
  flags.crime_complete = true;
  return true;
}
