/**
 * Ranggarh bazaar district layout, as plain data. The renderer, the physics
 * builder, the minimap, the crowd navigation graph and the tests all read
 * from this one source so geometry, collision and map always agree.
 *
 * Axes: +X east, +Z north, +Y up. Units: metres.
 */

export const ROAD_HALF = 4; // main bazaar road spans x in [-4, 4]
export const FRONTAGE = 6.5; // building fronts at |x| = 6.5
export const CURB_H = 0.15;
export const STREET_Z0 = -72;
export const STREET_Z1 = 50;

/** West side lane leading to the residential courtyard. */
export const LANE_W = { z0: -10, z1: -6, x0: -34, x1: -FRONTAGE } as const;
export const COURTYARD = { x0: -46, x1: -34, z0: -20, z1: 4 } as const;

export type Side = "west" | "east" | "laneN" | "laneS" | "court";
export type GroundUse =
  | "dhaba" | "textile" | "sweets" | "cycle" | "chemist" | "kiryana" | "fruit"
  | "tailor" | "hardware" | "workshop" | "house" | "phone" | "gate";

export interface BuildingSpec {
  id: string;
  side: Side;
  /** Frontage interval along the street axis (z for west/east, x for lanes). */
  a0: number;
  a1: number;
  depth: number;
  floors: number;
  /** Plaster colour hex. */
  color: string;
  use: GroundUse;
  /** Sign key in the sign atlas, if any. */
  sign?: string;
  /** Extra setback of the upper floors (metres). */
  upperSetback?: number;
  balcony?: boolean;
  brick?: boolean;
  seed: number;
}

export interface Rect { x0: number; z0: number; x1: number; z1: number }

const W = "west", E = "east";

export const BUILDINGS: BuildingSpec[] = [
  // ---- West side, south → north
  { id: "w_gatehouse", side: W, a0: -72, a1: -62, depth: 12, floors: 3, color: "#d9c7a3", use: "house", seed: 1, balcony: true },
  { id: "w_kiryana", side: W, a0: -62, a1: -51, depth: 11, floors: 2, color: "#e0b98a", use: "kiryana", sign: "kiryana", seed: 2 },
  { id: "w_textile", side: W, a0: -51, a1: -42, depth: 12, floors: 3, color: "#c9d3c0", use: "textile", sign: "textile", seed: 3, balcony: true },
  { id: "w_dhaba", side: W, a0: -42, a1: -26, depth: 13, floors: 2, color: "#e8c46f", use: "dhaba", sign: "dhaba", seed: 4 },
  { id: "w_sweets", side: W, a0: -26, a1: -18, depth: 11, floors: 3, color: "#e6a98f", use: "sweets", sign: "sweets", seed: 5, balcony: true },
  { id: "w_house1", side: W, a0: -18, a1: -10, depth: 12, floors: 3, color: "#b9c9d6", use: "house", seed: 6, brick: true },
  { id: "w_cycle", side: W, a0: -6, a1: 4, depth: 12, floors: 2, color: "#d7d0b8", use: "cycle", sign: "cycle", seed: 7 },
  { id: "w_house2", side: W, a0: 4, a1: 14, depth: 11, floors: 3, color: "#e7d6b0", use: "house", seed: 8, balcony: true, upperSetback: 0.6 },
  { id: "w_chemist", side: W, a0: 14, a1: 24, depth: 12, floors: 2, color: "#cfe0d8", use: "chemist", sign: "chemist", seed: 9 },
  { id: "w_house3", side: W, a0: 24, a1: 34, depth: 12, floors: 4, color: "#d8b7a6", use: "house", seed: 10, balcony: true },
  { id: "w_corner", side: W, a0: 34, a1: 50, depth: 12, floors: 3, color: "#e3cfa2", use: "phone", sign: "phone", seed: 11, brick: true },
  // ---- East side, south → north
  { id: "e_house1", side: E, a0: -72, a1: -60, depth: 12, floors: 3, color: "#d4c09b", use: "house", seed: 21, balcony: true, brick: true },
  { id: "e_fruit", side: E, a0: -60, a1: -48, depth: 11, floors: 2, color: "#e9d39a", use: "fruit", sign: "fruit", seed: 22 },
  { id: "e_house2", side: E, a0: -48, a1: -38, depth: 12, floors: 3, color: "#c5cdb6", use: "house", seed: 23, balcony: true },
  { id: "e_tailor", side: E, a0: -38, a1: -30, depth: 11, floors: 2, color: "#e2b59a", use: "tailor", sign: "tailor", seed: 24 },
  { id: "e_house3", side: E, a0: -26, a1: -14, depth: 12, floors: 3, color: "#dccfb6", use: "house", seed: 25, upperSetback: 0.5 },
  { id: "e_hardware", side: E, a0: -14, a1: 2, depth: 12, floors: 2, color: "#bfc8cf", use: "hardware", sign: "hardware", seed: 26 },
  { id: "e_house4", side: E, a0: 2, a1: 14, depth: 11, floors: 4, color: "#e8c9a0", use: "house", seed: 27, balcony: true },
  { id: "e_workshop", side: E, a0: 14, a1: 34, depth: 17, floors: 1, color: "#c8c2b2", use: "workshop", sign: "workshop", seed: 28 },
  { id: "e_house5", side: E, a0: 34, a1: 50, depth: 12, floors: 3, color: "#d6c5c0", use: "house", seed: 29, balcony: true, brick: true },
  // ---- Lane houses (frontage along x, facing the lane)
  { id: "ln_house1", side: "laneN", a0: -34, a1: -26, depth: 10, floors: 2, color: "#e4d4b4", use: "house", seed: 31, balcony: true },
  { id: "ln_house2", side: "laneN", a0: -26, a1: -18.5, depth: 10, floors: 3, color: "#c7d6c9", use: "house", seed: 32 },
  { id: "ls_house1", side: "laneS", a0: -34, a1: -26, depth: 10, floors: 3, color: "#dcc3a8", use: "house", seed: 33, brick: true },
  { id: "ls_house2", side: "laneS", a0: -26, a1: -18.5, depth: 8, floors: 2, color: "#e9dcc0", use: "house", seed: 34, balcony: true },
];

/** Workshop forecourt: road-level apron in front of the open bay. */
export const WORKSHOP_APRON: Rect = { x0: FRONTAGE - 2.5, x1: 11.5, z0: 16, z1: 32 };
/** Dhaba open frontage (no wall) for walking in. */
export const DHABA_FRONT = { z0: -40.5, z1: -27.5 } as const;

/** Footprint rectangle of a building in world XZ. */
export function footprint(b: BuildingSpec): Rect {
  switch (b.side) {
    case "west": return { x0: -FRONTAGE - b.depth, x1: -FRONTAGE, z0: b.a0, z1: b.a1 };
    case "east": return { x0: FRONTAGE, x1: FRONTAGE + b.depth, z0: b.a0, z1: b.a1 };
    case "laneN": return { x0: b.a0, x1: b.a1, z0: LANE_W.z1, z1: LANE_W.z1 + b.depth };
    case "laneS": return { x0: b.a0, x1: b.a1, z0: LANE_W.z0 - b.depth, z1: LANE_W.z0 };
    case "court": return { x0: b.a0, x1: b.a1, z0: COURTYARD.z0, z1: COURTYARD.z0 + b.depth };
  }
}

/**
 * Local-to-world frame of a building: origin at the façade's left end on the
 * ground, local +X along the façade, local +Z pointing out to the street.
 */
export function facadeFrame(b: BuildingSpec): { ox: number; oz: number; rotY: number; width: number } {
  const width = b.a1 - b.a0;
  switch (b.side) {
    // Façade faces +X (east). Local +X maps to world -Z... choose so width runs south→north.
    case "west": return { ox: -FRONTAGE, oz: b.a1, rotY: Math.PI / 2, width };
    case "east": return { ox: FRONTAGE, oz: b.a0, rotY: -Math.PI / 2, width };
    case "laneN": return { ox: b.a1, oz: LANE_W.z1, rotY: Math.PI, width };
    case "laneS": return { ox: b.a0, oz: LANE_W.z0, rotY: 0, width };
    case "court": return { ox: b.a0, oz: COURTYARD.z0, rotY: 0, width };
  }
}

/** Convert façade-local (u along façade, v outward) to world XZ. */
export function facadeToWorld(b: BuildingSpec, u: number, v: number): { x: number; z: number } {
  const f = facadeFrame(b);
  // Local frame: X axis = (cos r, -sin r) in XZ? Use Babylon RotationY: (x,z) -> (x cos + z sin, -x sin + z cos)
  const c = Math.cos(f.rotY), s = Math.sin(f.rotY);
  return { x: f.ox + u * c + v * s, z: f.oz - u * s + v * c };
}

export function building(id: string): BuildingSpec {
  const b = BUILDINGS.find((x) => x.id === id);
  if (!b) throw new Error(`unknown building ${id}`);
  return b;
}

// ---------------------------------------------------------------- Points of interest

export interface Poi {
  id: string;
  label: string;
  x: number;
  z: number;
  y?: number;
  kind: "contact" | "delivery" | "vehicle" | "shop" | "activity";
}

/** Dhaba interior coordinates: u along the frontage (from its north end), v outward (negative = inside). */
export function dhabaLocal(u: number, v: number): { x: number; z: number } {
  return facadeToWorld(building("w_dhaba"), u, v);
}

const counterFront = dhabaLocal(13.7, -1.5);
const pickupFront = dhabaLocal(6.2, -8.5);

export const POIS: Record<string, Poi> = {
  dhabaCounter: { id: "dhabaCounter", label: "Bhola's Dhaba", x: counterFront.x, z: counterFront.z, kind: "contact" },
  dhabaPickup: { id: "dhabaPickup", label: "Kitchen pass", x: pickupFront.x, z: pickupFront.z, kind: "contact" },
  workshop: { id: "workshop", label: "Gurnam Motor Works", x: 10.2, z: 22.5, kind: "delivery" },
  cycleShop: { id: "cycleShop", label: "Sohal Cycle Store", x: -4.9, z: -1.5, kind: "delivery" },
  courtyard: { id: "courtyard", label: "Kaur family courtyard", x: -43.2, z: -8, kind: "delivery" },
  tailor: { id: "tailor", label: "Masterji Tailors", x: 5.5, z: -34, kind: "delivery" },
  fruit: { id: "fruit", label: "Pammi's fruit stall", x: 4.9, z: -51.5, kind: "delivery" },
  laneHouse: { id: "laneHouse", label: "Gill house, Gali 3", x: -29.5, z: -7.6, kind: "delivery" },
  chemist: { id: "chemist", label: "Sehat Chemist", x: -5.4, z: 19, kind: "delivery" },
  gate: { id: "gate", label: "Bazaar gate", x: 0, z: -66, kind: "shop" },
};

/** Where the player starts a new game: on the sidewalk outside the dhaba. */
export const PLAYER_START = { x: -5.4, z: -44, yaw: Math.PI * 0.5 };

/** Safe, known-good recovery spots (always on open walkable ground). */
export const SAFE_SPOTS: Array<{ x: number; z: number }> = [
  { x: -5.3, z: -44 }, { x: 5.3, z: -44 }, { x: -5.3, z: -14 }, { x: 5.3, z: -20 },
  { x: -5.3, z: 10 }, { x: 5.3, z: 10 }, { x: 5.3, z: 40 }, { x: -5.3, z: 40 },
  { x: -20, z: -8 }, { x: -39, z: -8 }, { x: -5.3, z: -64 }, { x: 5.3, z: -64 },
];

/** Default parking for vehicles at new game. */
export const VEHICLE_SPAWNS = [
  { id: "scooter_1", type: "scooter" as const, x: -3.0, z: -31.5, yaw: 0 },
  { id: "auto_1", type: "auto" as const, x: -2.9, z: -47, yaw: 0 },
  { id: "scooter_2", type: "scooter" as const, x: 9.0, z: 28.5, yaw: Math.PI * 0.5 },
];

// ---------------------------------------------------------------- Drivable / walkable areas

/** Rectangles that are road-level drivable surface (for map and recovery). */
export const ROAD_RECTS: Rect[] = [
  { x0: -ROAD_HALF, x1: ROAD_HALF, z0: STREET_Z0, z1: STREET_Z1 },
  { x0: LANE_W.x0, x1: -FRONTAGE, z0: LANE_W.z0, z1: LANE_W.z1 },
  { x0: COURTYARD.x0, x1: COURTYARD.x1, z0: COURTYARD.z0, z1: COURTYARD.z1 },
  WORKSHOP_APRON,
];

export const SIDEWALK_RECTS: Rect[] = [
  { x0: -FRONTAGE, x1: -ROAD_HALF, z0: STREET_Z0, z1: LANE_W.z0 },
  { x0: -FRONTAGE, x1: -ROAD_HALF, z0: LANE_W.z1, z1: STREET_Z1 },
  { x0: ROAD_HALF, x1: FRONTAGE, z0: STREET_Z0, z1: WORKSHOP_APRON.z0 },
  { x0: ROAD_HALF, x1: FRONTAGE, z0: WORKSHOP_APRON.z1, z1: STREET_Z1 },
];

export function inRect(r: Rect, x: number, z: number, pad = 0): boolean {
  return x >= r.x0 - pad && x <= r.x1 + pad && z >= r.z0 - pad && z <= r.z1 + pad;
}

export function isOpenGround(x: number, z: number): boolean {
  return ROAD_RECTS.some((r) => inRect(r, x, z)) || SIDEWALK_RECTS.some((r) => inRect(r, x, z));
}
