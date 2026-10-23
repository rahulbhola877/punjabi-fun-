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
/** The Bullet's spot, local z out from the plot's front (the footpath ends about 2 m out). */
const BIKE_Z = 2.9;

/** The bed in the back room along the left wall: local u range, and z measured back from the partition. */
export const BED = { u0: WALL + 0.05, u1: WALL + 1.55, z0: 1.45, z1: 3.5 };

export interface Shot { eye: { x: number; y: number; z: number }; at: { x: number; y: number; z: number }; fov: number }

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
  /** Your bed in the back room: where you sit on its edge, and where you stand beside it. */
  bed: Spot;
  bedSide: { x: number; z: number };
  /** The TV's screen (centre, facing into the room) and its size. */
  tv: Spot & { w: number; h: number };
  /** Watching TV from the sofa: the camera above the sofa's end, looking at the screen. */
  tvShot: Shot;
  /** ...and the family on the sofa, seen from across the centre table (when someone talks). */
  sofaShot: Shot;
  /** Out front beside the gate, parked along the boundary wall. */
  bike: { x: number; z: number; yaw: number };
  /** A new game starts here: on the footpath beside the Bullet, facing down the gali. */
  start: { x: number; z: number; yaw: number };
  /** Where it used to stand (on the footpath): older saves are moved to the kerb. */
  oldBike: { x: number; z: number };
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
    bed: spot(h, BED.u1 - 0.3, zk - (BED.z0 + BED.z1) / 2, PLINTH + 0.5, Math.PI / 2),
    bedSide: at(BED.u1 + 0.55, zk - (BED.z0 + BED.z1) / 2),
    tv: (() => { const c = at(h.w - WALL - 0.25 - 0.065, zc); return { x: c.x, y: PLINTH + 1.1, z: c.z, yaw: h.rot + Math.PI / 2, w: 1.16, h: 0.64 }; })(),
    tvShot: (() => { const e = at(WALL + 0.12, zc), t = at(h.w - WALL - 0.3, zc); return { eye: { x: e.x, y: PLINTH + 1.7, z: e.z }, at: { x: t.x, y: PLINTH + 1.0, z: t.z }, fov: 0.42 }; })(),
    sofaShot: (() => { const e = at(WALL + 2.9, zc + 0.9), t = at(WALL + 0.6, zc - 0.15); return { eye: { x: e.x, y: PLINTH + 1.45, z: e.z }, at: { x: t.x, y: PLINTH + 0.95, z: t.z }, fov: 0.9 }; })(),
    // At the kerb, clear of the footpath's lamp posts, pointing down the gali.
    bike: (() => { const p = at(h.w / 2 + 2.6, BIKE_Z); return { x: p.x, z: p.z, yaw: h.rot + Math.PI / 2 }; })(),
    oldBike: at(h.w / 2 + 2.6, 1.0),
    start: (() => { const p = at(h.w / 2 + 2.3, BIKE_Z - 1.1); return { x: p.x, z: p.z, yaw: h.rot + Math.PI / 2 }; })(),
    gate: (() => { const p = at(h.w / 2, 2.2); return { x: p.x, z: p.z, yaw: h.rot + Math.PI }; })(),
  };
}

export const HOME: Home | null = build();
