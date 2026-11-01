/** The optional rover expedition is independent of the outpost relay story. */
export type ExpeditionStage = 0 | 1 | 2 | 3;
export type ExpeditionTarget = "engineer" | "sample";

/** Treat missing or damaged saved values as an expedition that has not started. */
export function normalizeExpeditionStage(value: unknown): ExpeditionStage {
  return value === 0 || value === 1 || value === 2 || value === 3 ? value : 0;
}

/**
 * The crater sample is collected with the rover's drill, so walking up to the
 * marker does not bypass the drive. Calling this again never consumes or
 * duplicates a sample; the caller can safely persist the returned stage.
 */
export function expeditionInteraction(
  stage: unknown,
  target: ExpeditionTarget,
  inRover = false,
): { stage: ExpeditionStage; text: string } {
  const s = normalizeExpeditionStage(stage);
  if (target === "sample") {
    if (s === 0) return { stage: s, text: "A pale seam runs through the crater floor. Ask the outpost engineer about it." };
    if (s === 1 && !inRover) return { stage: s, text: "The seam is too hard to sample by hand. Bring the rover and use its drill here." };
    if (s === 1) return { stage: 2, text: "The rover drill catches a glittering core. Take the sealed sample back to the engineer." };
    return { stage: s, text: "The drill hole marks where you took the crater sample." };
  }
  if (s === 0) return { stage: 1, text: "Engineer Zoya: My rover spotted a bright seam in the crater. Drive over and use its drill to bring me a core!" };
  if (s === 1) return { stage: s, text: "Zoya: Take the rover to the crater seam. Its drill can lift a sample without scattering the dust." };
  if (s === 2) return { stage: 3, text: "Zoya: A perfect core! These layers record impacts over ages. I'll put it in the outpost's science archive." };
  return { stage: s, text: "Zoya: Your crater core is in the archive. Even moon dust has a story if you know where to look." };
}
