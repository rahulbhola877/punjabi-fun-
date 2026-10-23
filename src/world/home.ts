import { OPEN_HOUSES, PLINTH, houseToWorld, type OpenHouse } from "./openHouses";

/** A place in the house: world position, seat or floor height, which way to face. */
export interface Spot { x: number; y: number; z: number; yaw: number }

/**
 * The hero's own home: the walk-in kothi in Sant Nagar nearest the bazaar.
 * Spots mirror houseInterior() in interiors.ts (sofa against the left wall,
 * two armchairs, the dining table with four plastic chairs at the back, the
 * kitchen platform along the back wall) and kothi() in country.ts (the yard
 * in front; the Bullet stands outside it, along the wall).
 */
export const HOME_ID = "santH149";

const WALL = 0.2;

export interface Home {
  house: OpenHouse;
  label: string;
  /** Sofa: three places, left to right as you face it. */
  sofa: Spot[];
  armchairs: Spot[];
  /** Dining chairs (seat height), facing the table. */
  dining: Spot[];
  /** Standing at the gas chulha, facing the wall. */
  kitchen: Spot;
  /** Where you stand to sit down / eat (prompts). */
  sofaFront: { x: number; z: number };
  tableSide: { x: number; z: number };
  /** Out front beside the gate, parked along the boundary wall. */
  bike: { x: number; z: number; yaw: number };
  /** Out on the gali in front of the gate (where you arrive). */
  gate: { x: number; z: number; yaw: number };
}

function spot(h: OpenHouse, u: number, z: number, y: number, localYaw: number): Spot {
  const p = houseToWorld(h, u, z);
  return { x: p.x, y, z: p.z, yaw: h.rot + localYaw };
}

function build(): Home | null {
  const h = OPEN_HOUSES.find((o) => o.id === HOME_ID) ?? OPEN_HOUSES[0];
  if (!h) return null;
  const zf = -h.yd - WALL, zc = zf - 2.4;
  const zp = zf - h.baithak, zk = zp - 0.12, zb = -h.d + WALL;
  const seat = PLINTH + 0.45, chair = PLINTH + 0.46;
  const du = h.w / 2 + 0.3, dz = (zk + zb + 0.6) / 2;
  const at = (u: number, z: number) => houseToWorld(h, u, z);
  return {
    house: h,
    label: "Ghar (home), Sant Nagar",
    sofa: [-0.65, 0, 0.65].map((o) => spot(h, WALL + 0.55, zc + o, seat, Math.PI / 2)),
    // Hips well back on the cushion, so even a child's knees reach past the front edge.
    armchairs: [-1, 1].map((sz) => spot(h, WALL + 1.6, zc + sz * 1.87, seat, sz > 0 ? Math.PI : 0)),
    dining: ([[-0.4, -0.8], [0.4, -0.8], [-0.4, 0.8], [0.4, 0.8]] as const).map(([a, b]) => spot(h, du + a, dz + b, chair, b < 0 ? 0 : Math.PI)),
    kitchen: spot(h, h.w * 0.35 + 0.35, zb + 1.0, PLINTH, Math.PI),
    sofaFront: at(WALL + 1.9, zc),
    tableSide: at(du + 1.3, dz),
    bike: (() => { const p = at(h.w / 2 + 2.6, 1.0); return { x: p.x, z: p.z, yaw: h.rot + Math.PI / 2 }; })(),
    gate: (() => { const p = at(h.w / 2, 2.2); return { x: p.x, z: p.z, yaw: h.rot + Math.PI }; })(),
  };
}

export const HOME: Home | null = build();
