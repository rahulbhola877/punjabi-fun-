import { OUTER_BUILDINGS, type OuterBuilding } from "./region";
import { Rng } from "../render/textures";

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
  /** You can walk in: the family's own home and the two nearest neighbours. Every other house has a closed gate and a bell. */
  walkIn: boolean;
  /** The doorbell: its world point on the kerb, the gate's middle and the front door's middle (world), both inside the plot. */
  bell: { x: number; z: number };
  gate: { x: number; z: number };
  frontDoor: { x: number; z: number };
}

/** The family's own home (world/home.ts HOME_ID). */
const FAMILY_HOME = "santH149";
/** How many neighbours' homes can be walked into, besides the family's own. */
export const WALK_IN_NEIGHBOURS = 2;

/** Where a kothi's gate stands: the left edge of the opening and its width (local u). Shared with country.ts's kothi(). */
export function kothiGate(b: OuterBuilding): { gu: number; gw: number } {
  const { w } = dims(b);
  const gw = Math.min(3.2, w * 0.3);
  const r = new Rng(b.seed);
  r.next(); // the trim colour
  return { gu: r.next() < 0.5 ? 0.6 : w - 0.6 - gw, gw };
}

/** The front door's left edge (local u) in a kothi of this width: centred in a walk-in house, off the gate's side otherwise. */
export function kothiDoorU(b: OuterBuilding, walkIn: boolean): number {
  const { w } = dims(b);
  const { gu, gw } = kothiGate(b);
  return walkIn ? w / 2 - 0.575 : gu < w / 2 ? Math.min(gu + gw + 0.4, w - 1.6) : Math.max(0.5, gu - 1.6);
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

/** Every colony kothi that has a bell and a front door worth knowing: one in seven, the families' homes among them. */
export const OPEN_HOUSES: OpenHouse[] = (() => {
  const all = OUTER_BUILDINGS.filter(isOpenHouse).map((b) => {
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
      talk, baithak, walkIn: false,
      ...bellOf(b, f, yd, false),
    } as OpenHouse;
  });
  // The family's home, and the nearest few of the others by distance from it, can be walked into.
  const home = all.find((h) => h.id === FAMILY_HOME);
  if (home) {
    const hx = (home.rect.x0 + home.rect.x1) / 2, hz = (home.rect.z0 + home.rect.z1) / 2;
    const dist = (h: OpenHouse) => Math.hypot((h.rect.x0 + h.rect.x1) / 2 - hx, (h.rect.z0 + h.rect.z1) / 2 - hz);
    const near = all.filter((h) => h !== home).sort((p, q) => dist(p) - dist(q) || (p.id < q.id ? -1 : 1)).slice(0, WALK_IN_NEIGHBOURS);
    for (const h of [home, ...near]) {
      h.walkIn = true;
      const b = OUTER_BUILDINGS.find((q) => q.id === h.id)!;
      Object.assign(h, bellOf(b, h, h.yd, true));
    }
  }
  return all;
})();

function bellOf(b: OuterBuilding, f: { ox: number; oz: number; rot: number }, yd: number, walkIn: boolean): Pick<OpenHouse, "bell" | "gate" | "frontDoor"> {
  const { gu, gw } = kothiGate(b);
  const du = kothiDoorU(b, walkIn);
  return {
    bell: houseToWorld(f, gu + gw, 1.0),
    gate: houseToWorld(f, gu + gw / 2, 0.5),
    frontDoor: houseToWorld(f, du + 0.575, -yd + 0.5),
  };
}

export const OPEN_HOUSE_IDS = new Set(OPEN_HOUSES.map((h) => h.id));
/** The houses you can walk into. */
export const WALK_IN_IDS = new Set(OPEN_HOUSES.filter((h) => h.walkIn).map((h) => h.id));

/** The walk-in house whose ground floor contains (x, z), if any. */
export function openHouseAt(x: number, z: number): OpenHouse | null {
  for (const h of OPEN_HOUSES) if (h.walkIn && x > h.rect.x0 && x < h.rect.x1 && z > h.rect.z0 && z < h.rect.z1) return h;
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


/** A doorbell at the gate of any colony kothi: where to stand, where the gate and the front door are, and the door's own frame. */
export interface HouseBell {
  id: string;
  bell: { x: number; z: number };
  gate: { x: number; z: number };
  frontDoor: { x: number; z: number };
  /** The house frame (world origin and yaw), the yard depth and the front door's left edge (local u) and width. */
  ox: number; oz: number; rot: number; yd: number; doorU: number; doorW: number;
  /** The gate's middle (local u). */
  gateU: number;
  plinth: number;
  walkIn: boolean;
}

/** Every kothi in the colonies has a bell and a front door; the walk-in ones are the open houses above. */
export const HOUSE_BELLS: HouseBell[] = OUTER_BUILDINGS.filter((b) => b.style === "kothi").map((b) => {
  const { w, d } = dims(b);
  const { ox, oz, rot } = frame(b);
  const yd = Math.min(4.5, Math.max(3, d * 0.27));
  const walkIn = WALK_IN_IDS.has(b.id);
  const f = { ox, oz, rot };
  const doorU = kothiDoorU(b, walkIn);
  void w;
  const gt = kothiGate(b);
  return { id: b.id, ...bellOf(b, f, yd, walkIn), ox, oz, rot, yd, doorU, doorW: 1.15, gateU: gt.gu + gt.gw / 2, plinth: PLINTH, walkIn };
});
