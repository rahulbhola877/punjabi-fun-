/** A saved side story: accept, confront the bus-stand gang, then return. */
export type GangStage = "available" | "confront" | "witness" | "police" | "return" | "done";
export function gangStage(flags: Record<string, boolean>): GangStage {
  if (flags.crime_complete) return "done";
  if (flags.crime_return) return "return";
  if (!flags.crime_active) return "available";
  if (flags.crime_investigate) return flags.crime_witness ? "police" : "witness";
  return "confront";
}
export function startGangStory(flags: Record<string, boolean>): boolean {
  if (gangStage(flags) !== "available") return false;
  // Ignore remnants of an incomplete or damaged older save when starting anew.
  delete flags.crime_investigate;
  delete flags.crime_witness;
  delete flags.crime_peaceful;
  flags.crime_active = true;
  return true;
}
export function gangDefeated(flags: Record<string, boolean>, site: string): boolean {
  if (gangStage(flags) !== "confront" || site !== "busAdda") return false;
  flags.crime_return = true;
  return true;
}
/** Choose the noncombat route before confronting the crew. */
export function investigateGangStory(flags: Record<string, boolean>): boolean {
  if (gangStage(flags) !== "confront") return false;
  flags.crime_investigate = true;
  return true;
}
/** Bittu gives his account only once, after the investigation is chosen. */
export function hearGangWitness(flags: Record<string, boolean>): boolean {
  if (gangStage(flags) !== "witness") return false;
  flags.crime_witness = true;
  return true;
}
/** Balwant receives the account and records the complaint. */
export function reportGangToPolice(flags: Record<string, boolean>): boolean {
  if (gangStage(flags) !== "police") return false;
  flags.crime_peaceful = true;
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
