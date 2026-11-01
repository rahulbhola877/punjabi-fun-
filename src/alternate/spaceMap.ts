/** A compact, authored lunar outpost. Coordinates are metres in the scene. */
export const SPACE_WORLD = {
  minX: -82, maxX: 82, minZ: -65, maxZ: 100,
  start: { x: 0, z: -32 }, portal: { x: -5, z: -40 },
  pilot: { x: 7, z: -28 }, cell: { x: -24, z: 3 },
  relay: { x: 23, z: 27 }, fox: { x: -6, z: -27 },
  engineer: { x: 10, z: -18 }, rover: { x: 14, z: -12 }, sample: { x: 58, z: 72 },
} as const;

/** Solid bases, kept in sync with the rendered structures. */
export const SPACE_SOLIDS = [
  { x: -20, z: -27, w: 13, d: 10 },
  { x: 20, z: -22, w: 13, d: 9 },
  { x: -36, z: 20, w: 9, d: 8 },
  { x: 32, z: 39, w: 10, d: 8 },
] as const;
/** Mission equipment has solid bases, but can be reached from every side. */
export const SPACE_EQUIPMENT = [
  { x: SPACE_WORLD.cell.x, z: SPACE_WORLD.cell.z, w: 2.4, d: 1.8 },
  { x: SPACE_WORLD.relay.x, z: SPACE_WORLD.relay.z, w: 3.2, d: 3.2 },
  { x: -27, z: 14, w: 10.5, d: 2.0 },
  { x: 20, z: -15, w: 1.8, d: 3.5 },
  { x: -13.1, z: -15.5, w: 4, d: 2.2 },
  { x: -13, z: -11.8, w: 3.2, d: 1.1 },
  { x: -18, z: -12.8, w: 2.7, d: 1 },
  { x: -17.3, z: -9.7, w: 0.75, d: 0.75 },
  { x: 11.5, z: -18, w: 1, d: 0.8 },
] as const;

/** Irregular boulders around the crater have a broad south entrance. */
export const SPACE_CRATER_ROCKS = Array.from({ length: 22 }, (_, i) => i)
  .filter((i) => i < 15 || i > 18)
  .map((i) => {
    const a = i * Math.PI * 2 / 22, radius = 12.4 + (i % 3) * 0.4;
    return { x: SPACE_WORLD.sample.x + Math.cos(a) * radius, z: SPACE_WORLD.sample.z + Math.sin(a) * radius, radius: (2.3 + i % 3 * 0.35) * 0.44, i };
  });

/** Stage: meet pilot, recover cell, repair relay, report back, complete. */
export interface SpaceProgress { stage: number; expeditionStage?: number }
export type SpaceTarget = "pilot" | "cell" | "relay" | "fox";

export function normalizeSpaceProgress(value?: Partial<SpaceProgress>): SpaceProgress {
  const s = value?.stage;
  return { stage: typeof s === "number" && Number.isInteger(s) && s >= 0 && s <= 4 ? s : 0 };
}

/** An encounter changes state only at the correct place and in the right order. */
export function spaceInteraction(stage: number, target: SpaceTarget): { stage: number; text: string } {
  const s = normalizeSpaceProgress({ stage }).stage;
  if (target === "fox") return { stage: s, text: "Cosmo: One small step for you, one giant snack break for me!" };
  if (target === "cell") return s === 1
    ? { stage: 2, text: "Power cell recovered. Take it to the relay on the eastern ridge." }
    : { stage: s, text: s < 1 ? "A power cell lies in the cargo cradle. Ask the pilot first." : "The cargo cradle is empty." };
  if (target === "relay") return s === 2
    ? { stage: 3, text: "Relay restored! Tell the pilot the outpost is online." }
    : { stage: s, text: s < 2 ? "The relay needs the missing power cell." : "The relay is sending a clear signal." };
  if (s === 0) return { stage: 1, text: "Pilot Noor: Our relay has gone quiet. Can you recover its cell from the western cargo cradle?" };
  if (s === 1) return { stage: s, text: "Noor: The cargo cradle is west of the landing pad. Its amber light is still blinking." };
  if (s === 2) return { stage: s, text: "Noor: Great! Fit the cell into the relay on the eastern ridge." };
  if (s === 3) return { stage: 4, text: "Noor: Signal received! You earned the Chand Outpost explorer stamp." };
  return { stage: s, text: "Noor: The outpost is back online. Take your time exploring!" };
}

/** Full player footprint against outpost buildings; open ground stays walkable. */
export function canWalkSpace(x: number, z: number): boolean {
  const r = 0.45, w = SPACE_WORLD;
  if (x < w.minX + r || x > w.maxX - r || z < w.minZ + r || z > w.maxZ - r) return false;
  const hits = (b: { x: number; z: number; w: number; d: number }) => Math.abs(x - b.x) < b.w / 2 + r && Math.abs(z - b.z) < b.d / 2 + r;
  return !SPACE_SOLIDS.some(hits) && !SPACE_EQUIPMENT.some(hits) && !SPACE_CRATER_ROCKS.some((b) => Math.hypot(x - b.x, z - b.z) < b.radius + r);
}

/** Conservative rover footprint, including all four corners. */
export function canDriveSpace(x: number, z: number): boolean {
  return [[0, 0], [-1.45, -1.45], [-1.45, 1.45], [1.45, -1.45], [1.45, 1.45]]
    .every(([dx, dz]) => canWalkSpace(x + dx!, z + dz!));
}

/** Gentle surveyed uplands; the working outpost and crater floor remain level. */
export function spaceHeight(x: number, z: number): number {
  let height = 0;
  for (const hill of [{ x: -66, z: 22, r: 25, h: 4 }, { x: -42, z: 77, r: 23, h: 3.8 }, { x: 0, z: 85, r: 21, h: 3 }, { x: 75, z: 0, r: 23, h: 3.3 }, { x: -70, z: -44, r: 19, h: 2.6 }]) {
    const t = Math.max(0, 1 - Math.hypot(x - hill.x, z - hill.z) / hill.r);
    height += hill.h * t * t * (3 - 2 * t);
  }
  return height;
}
