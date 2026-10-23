import { OUTER_BUILDINGS, type OuterBuilding } from "./region";

/**
 * Colony kothis you can walk into: the gate stands open, the front door is
 * open, and inside is the baithak (sofa set, TV, showcase, photos, the fan)
 * with the kitchen and dining room behind, and someone of the family at home
 * on the sofa who will offer you chah. About one kothi in seven.
 *
 * Mirrors kothi() in country.ts: the yard is yd deep, the house front at
 * local z = -yd, the ground floor at the plinth; local (u, z) maps to the
 * world through the same frame frontFrame() sets.
 */
export interface OpenHouse {
  id: string;
  ox: number; oz: number; rot: number;
  /** Frontage and depth of the plot, yard depth. */
  w: number; d: number; yd: number;
  /** Front door: left edge (local u) and width. */
  door: number; doorW: number;
  /** Inside the walls, world space (for the camera's interior mode). */
  rect: { x0: number; x1: number; z0: number; z1: number };
  /** The whole plot, yard and all, world space: no street event belongs in it. */
  plot: { x0: number; x1: number; z0: number; z1: number };
  /** On the gali just outside the open gate. */
  out: { x: number; z: number };
  /** Where the one at home sits on the sofa, and where you stand to talk. */
  host: { x: number; y: number; z: number; yaw: number };
  talk: { x: number; z: number };
  /** Depth of the baithak (front room) from the inside of the front wall. */
  baithak: number;
}

export const PLINTH = 0.45;
const WALL = 0.2;

export function isOpenHouse(b: OuterBuilding): boolean {
  if (b.style !== "kothi") return false;
  const { w, d } = dims(b);
  const yd = Math.min(4.5, Math.max(3, d * 0.27));
  return w >= 7 && d - yd >= 10 && b.seed % 7 === 3;
}

function dims(b: OuterBuilding): { w: number; d: number } {
  const ns = Math.abs(Math.sin(b.face)) < 0.5;
  return ns ? { w: b.x1 - b.x0, d: b.z1 - b.z0 } : { w: b.z1 - b.z0, d: b.x1 - b.x0 };
}

function frame(b: OuterBuilding): { ox: number; oz: number; rot: number } {
  const f = b.face, eps = 1e-3;
  if (Math.abs(f) < eps) return { ox: b.x0, oz: b.z1, rot: 0 };
  if (Math.abs(f - Math.PI) < eps) return { ox: b.x1, oz: b.z0, rot: Math.PI };
  if (Math.abs(f + Math.PI / 2) < eps) return { ox: b.x0, oz: b.z0, rot: -Math.PI / 2 };
  return { ox: b.x1, oz: b.z1, rot: Math.PI / 2 };
}

export function houseToWorld(h: { ox: number; oz: number; rot: number }, u: number, z: number): { x: number; z: number } {
  const c = Math.cos(h.rot), s = Math.sin(h.rot);
  return { x: h.ox + u * c + z * s, z: h.oz - u * s + z * c };
}

export const OPEN_HOUSES: OpenHouse[] = OUTER_BUILDINGS.filter(isOpenHouse).map((b) => {
  const { w, d } = dims(b);
  const { ox, oz, rot } = frame(b);
  const yd = Math.min(4.5, Math.max(3, d * 0.27));
  const f = { ox, oz, rot };
  const doorW = 1.15, door = w / 2 - doorW / 2;
  const a = houseToWorld(f, WALL, -yd - WALL), c = houseToWorld(f, w - WALL, -d + WALL);
  const baithak = 4.6;
  // On the sofa against the left wall, facing across the room to the TV.
  const zs = -yd - WALL - 2.4;
  const seat = houseToWorld(f, WALL + 0.55, zs), talk = houseToWorld(f, WALL + 1.9, zs);
  return {
    id: b.id, ox, oz, rot, w, d, yd, door, doorW,
    rect: { x0: Math.min(a.x, c.x), x1: Math.max(a.x, c.x), z0: Math.min(a.z, c.z), z1: Math.max(a.z, c.z) },
    plot: { x0: b.x0, x1: b.x1, z0: b.z0, z1: b.z1 },
    out: houseToWorld(f, w / 2, 2.2),
    host: { x: seat.x, y: PLINTH + 0.45, z: seat.z, yaw: rot + Math.PI / 2 },
    talk, baithak,
  };
});

export const OPEN_HOUSE_IDS = new Set(OPEN_HOUSES.map((h) => h.id));

/** The open house whose ground floor contains (x, z), if any. */
export function openHouseAt(x: number, z: number): OpenHouse | null {
  for (const h of OPEN_HOUSES) if (x > h.rect.x0 && x < h.rect.x1 && z > h.rect.z0 && z < h.rect.z1) return h;
  return null;
}

/** The open house whose plot (yard included, grown by `pad`) contains (x, z), if any. */
export function openPlotAt(x: number, z: number, pad = 0): OpenHouse | null {
  for (const h of OPEN_HOUSES) {
    const q = h.plot;
    if (x > q.x0 - pad && x < q.x1 + pad && z > q.z0 - pad && z < q.z1 + pad) return h;
  }
  return null;
}
