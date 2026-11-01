/** A compact Japan-inspired street, in metres; this is one neighborhood. */
export const JAPAN_WORLD = {
  minX: -17, maxX: 36, minZ: -26, maxZ: 34,
  start: { x: 0, z: -20 }, portal: { x: 0, z: -24 },
  shopkeeper: { x: -5.2, z: 2 }, resident: { x: 5.2, z: 16 }, neighbor: { x: 3.2, z: 27 },
} as const;

/** Street-facing footprints; the middle road and both pavements stay walkable. */
export const JAPAN_BUILDINGS = [
  { x: -10, z: -15, w: 7, d: 9, h: 5.4, color: "#d8cab1", shop: false },
  { x: -10, z: 2, w: 7, d: 9, h: 4.6, color: "#d4c4a9", shop: true },
  { x: -10, z: 17, w: 7, d: 9, h: 5.1, color: "#d6c9b4", shop: false },
  { x: 10, z: -15, w: 7, d: 9, h: 5.3, color: "#c8c3b3", shop: false },
  { x: 10, z: 1, w: 7, d: 9, h: 5.5, color: "#dfd4c0", shop: true },
  { x: 10, z: 16, w: 7, d: 9, h: 4.9, color: "#cfc5b5", shop: false },
] as const;
/** The larger original Tunyard teahouse and its garden at the end of the lane. */
export const JAPAN_GARDEN = { x0: -17, x1: -5.1, z0: 21.4, z1: 33.7 } as const;
/** Koi pond and the visitor's feeding spot on its western bank. */
export const JAPAN_POND = { x: 10.3, z: 27.2, rx: 3.4, rz: 2.5, feedX: 6.0, feedZ: 27.2 } as const;
/** The east lane opens onto a public park. Yuna's camera is beside the bench. */
export const JAPAN_PARK = { minX: 17, maxX: 36, minZ: -22, maxZ: 19, cameraX: 29, cameraZ: 2 } as const;
/** Raised raked-gravel garden, positioned beside rather than over the path. */
export const JAPAN_ZEN = { x: 25.5, z: 0, width: 5.35, depth: 4.4 } as const;

/** Small solid street objects, expressed as circular footprints. */
export const JAPAN_OBSTACLES = [
  { x: -6, z: -8, r: 0.55 }, { x: 6, z: 7, r: 0.55 }, { x: -6, z: 21, r: 0.55 },
  { x: 6.4, z: -5, r: 0.7 },
  { x: -6.1, z: -19, r: 0.15 }, { x: -6.1, z: 4, r: 0.15 }, { x: -6.1, z: 25, r: 0.15 },
  { x: -5.6, z: 11, r: 0.35 }, { x: 5.8, z: -9, r: 0.35 },
  { x: -2.3, z: 31, r: 0.3 }, { x: 2.3, z: 31, r: 0.3 },
  { x: -5.5, z: 26, r: 0.5 }, { x: 5.7, z: 30, r: 0.5 },
  { x: 21, z: -17, r: 0.45 }, { x: 32, z: -15, r: 0.45 },
  { x: 32, z: 12, r: 0.45 }, { x: 21, z: 13, r: 0.45 },
  { x: 29, z: 4, r: 0.9 }, { x: 33.8, z: -2, r: 0.5 }, { x: 25.7, z: 7, r: 0.45 },
] as const;

/** 0 = available, 1 = carrying tea, 2 = delivered, 3 = thanked. */
export interface JapanProgress { stage: number; parkStage: number }
export function normalizeJapanProgress(value?: Partial<JapanProgress>): JapanProgress {
  const valid = (n: unknown): number => typeof n === "number" && Number.isInteger(n) && n >= 0 && n <= 3 ? n : 0;
  return { stage: valid(value?.stage), parkStage: valid(value?.parkStage) };
}
/** Yuna's photographs become part of the park after her camera is returned. */
export function japanParkConversation(stage: number): { stage: number; text: string } {
  const s = normalizeJapanProgress({ parkStage: stage }).parkStage;
  if (s === 0) return { stage: 1, text: "Yuna: I left my camera by the bench in the park east of the street. It has my grandmother’s blossom photographs on it. Could you find it?" };
  if (s === 1) return { stage: 1, text: "Yuna: The park is through the east lane, between the houses. Look beside the bench." };
  if (s === 2) return { stage: 3, text: "Yuna: You found it! I can finally share Grandma’s blossom photographs at the park noticeboard. Thank you." };
  return { stage: 3, text: "Yuna: Grandma’s blossoms are on the park noticeboard now. I’m glad everyone can see them." };
}
export type JapanPerson = "shopkeeper" | "resident" | "neighbor";
export interface JapanConversation { stage: number; text: string }

/** Story state is pure so its transitions and persistence can be tested. */
export function japanConversation(stage: number, person: JapanPerson): JapanConversation {
  const s = normalizeJapanProgress({ stage }).stage;
  if (person === "neighbor") return { stage: s, text: "Yuna: The cherry blossoms are lovely today. The lane leads to the little garden." };
  if (person === "resident") {
    if (s === 1) return { stage: 2, text: "Ken: My tea! Thank you. Please tell Aiko it arrived safely." };
    if (s >= 2) return { stage: s, text: "Ken: Thank you again. I’ll make a pot for the evening." };
    return { stage: s, text: "Ken: I ordered tea from Aiko. She’s just down the street." };
  }
  if (s === 0) return { stage: 1, text: "Aiko: Could you take this tea parcel to Ken? He’s waiting farther up the street." };
  if (s === 1) return { stage: 1, text: "Aiko: Ken is on the right-hand pavement, farther up the street." };
  if (s === 2) return { stage: 3, text: "Aiko: Thank you for helping! Here’s a neighborhood postcard stamp to remember us by." };
  return { stage: 3, text: "Aiko: Welcome back! Your postcard stamp is safe with you." };
}

/** Circle-versus-rectangle test keeps the player body outside facades. */
export function canWalkJapan(x: number, z: number): boolean {
  const r = 0.4, w = JAPAN_WORLD;
  if (x < w.minX + r || x > w.maxX - r || z < w.minZ + r || z > w.maxZ - r) return false;
  if (x > JAPAN_PARK.minX && (z < JAPAN_PARK.minZ + r || z > JAPAN_PARK.maxZ - r)) return false;
  if (Math.abs(x - 17.25) < r + 0.125 && ((z > -20.9 && z < -10.5) || (z > -3 && z < 18))) return false;
  if (JAPAN_BUILDINGS.some((b) => Math.abs(x - b.x) < b.w / 2 + r && Math.abs(z - b.z) < b.d / 2 + r)) return false;
  if (Math.abs(x - JAPAN_ZEN.x) < JAPAN_ZEN.width / 2 + r && Math.abs(z - JAPAN_ZEN.z) < JAPAN_ZEN.depth / 2 + r) return false;
  if (x + r > JAPAN_GARDEN.x0 && x - r < JAPAN_GARDEN.x1 && z + r > JAPAN_GARDEN.z0 && z - r < JAPAN_GARDEN.z1) return false;
  if (((x - JAPAN_POND.x) / (JAPAN_POND.rx + r)) ** 2 + ((z - JAPAN_POND.z) / (JAPAN_POND.rz + r)) ** 2 < 1) return false;
  if (Math.abs(x - 16.25) < r + 0.1 && z > 21.5 && z < 33.5) return false;
  return !JAPAN_OBSTACLES.some((o) => Math.hypot(x - o.x, z - o.z) < r + o.r);
}
