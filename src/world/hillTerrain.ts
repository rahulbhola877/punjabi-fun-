/**
 * The hillside of Sukh Pahar. The rest of the world is flat; here the ground climbs north of the Mall from nothing to
 * HILL_TOP at the D road and eases off again towards the railway. Everything built on it reads its height from hillY():
 * Kit.frame() uses it for the origin of every building, site and road piece, so a builder never has to know.
 *
 * The slope is a function of z (the galis climb, the cross roads are level) with a taper at the west and east edges.
 * Each house plot and each civic site is a flat pad at the height of its middle, and each cross road is level at its own
 * height, so the terraces step the way a hill town's do.
 */
import type { Rect } from "./layout";
import { COLONIES } from "./colonies";
import { OUTER_BUILDINGS, SITES } from "./region";

/** How high the hill stands at its crest, in metres. */
export const HILL_TOP = 13.6;
/** The part of the hill that is meshed (south of it the ground is the ordinary flat ground). */
export const TERRAIN: Rect = { x0: 1104, x1: 1500, z0: 322, z1: 552 };
export const TERRAIN_STEP = 2;

const smooth = (t: number): number => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));

/** The natural slope: level south of z 330, climbing to the crest at z 500, then easing down to the railway cutting. */
export function hillBase(x: number, z: number): number {
  let h = 0;
  if (z > 330 && z < 500) { const t = (z - 330) / 170; h = HILL_TOP * (0.5 * t + 0.5 * smooth(t)); }
  else if (z >= 500 && z < 548) h = HILL_TOP * 0.5 * (1 + Math.cos((Math.PI * (z - 500)) / 48));
  return h * smooth((x - 1110) / 90) * (1 - smooth((x - 1470) / 30));
}

export interface Pad { x0: number; x1: number; z0: number; z1: number; tx0: number; tx1: number; tz0: number; tz1: number; h: number }
const CELL = 16;
const pads: Pad[] = [];
/** The flat plots and sites of the hill, for the retaining walls round them. */
export const HILL_PADS: ReadonlyArray<Pad> = pads;
const cells = new Map<string, Pad[]>();
const key = (x: number, z: number): string => `${Math.floor(x / CELL)},${Math.floor(z / CELL)}`;

function addPad(r: Rect, front: "x0" | "x1" | "z0" | "z1" | null, frontExtra: number, grow: number): void {
  const h = hillBase((r.x0 + r.x1) / 2, (r.z0 + r.z1) / 2);
  const p: Pad = { x0: r.x0, x1: r.x1, z0: r.z0, z1: r.z1, tx0: 0, tx1: 0, tz0: 0, tz1: 0, h };
  if (front) p[front] += front.endsWith("0") ? -frontExtra : frontExtra;
  p.tx0 = p.x0 - (front === "x0" ? 0 : grow); p.tx1 = p.x1 + (front === "x1" ? 0 : grow);
  p.tz0 = p.z0 - (front === "z0" ? 0 : grow); p.tz1 = p.z1 + (front === "z1" ? 0 : grow);
  if (p.tz1 < TERRAIN.z0 - 4) return;
  pads.push(p);
  for (let i = Math.floor(p.tx0 / CELL); i <= Math.floor(p.tx1 / CELL); i++) for (let j = Math.floor(p.tz0 / CELL); j <= Math.floor(p.tz1 / CELL); j++) {
    const k = `${i},${j}`;
    const l = cells.get(k) ?? [];
    l.push(p);
    cells.set(k, l);
  }
}

const hill = COLONIES.find((c) => c.id === "hill")!;
/** Which side of a building is its front: the side the street is on. */
function frontSide(face: number): "x0" | "x1" | "z0" | "z1" {
  if (Math.abs(face) < 1e-3) return "z1";
  if (Math.abs(face - Math.PI) < 1e-3) return "z0";
  return Math.abs(face + Math.PI / 2) < 1e-3 ? "x0" : "x1";
}
for (const b of OUTER_BUILDINGS) {
  if (!b.id.startsWith("hillH") && !b.id.startsWith("hillShop")) continue;
  // The pad reaches out over the footpath or kerb strip in front, so the paving sits on it.
  addPad(b, frontSide(b.face), b.id.startsWith("hillShop") ? 3 : 1.5, 1);
}
for (const s of SITES) if (s.id.startsWith("hill")) addPad(s, null, 0, 1);

/** The cross roads are level: the whole width of the road is at the height of its centre line. */
const levelRoads = hill.roads.filter((r) => r.x1 - r.x0 > r.z1 - r.z0).map((r) => ({ ...r, h: hillBase(1300, (r.z0 + r.z1) / 2) }));

function padAt(x: number, z: number, terrain: boolean): Pad | undefined {
  const l = cells.get(key(x, z));
  if (!l) return undefined;
  for (const p of l) {
    if (terrain ? x >= p.tx0 && x <= p.tx1 && z >= p.tz0 && z <= p.tz1 : x >= p.x0 - 0.02 && x <= p.x1 + 0.02 && z >= p.z0 - 0.02 && z <= p.z1 + 0.02) return p;
  }
  return undefined;
}

function level(x: number, z: number): number | undefined {
  for (const r of levelRoads) if (x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1) return r.h;
  return undefined;
}

/** The height of the ground a builder should stand on at (x, z): the pad of the plot or site it is in, else the road or slope. */
export function hillY(x: number, z: number): number {
  if (x < TERRAIN.x0 || x > TERRAIN.x1 || z < TERRAIN.z0 || z > TERRAIN.z1) return 0;
  return padAt(x, z, false)?.h ?? level(x, z) ?? hillBase(x, z);
}

/** The height of the terrain mesh at a node: the same, but a pad is a little bigger than its building so the corners are flat. */
function nodeY(x: number, z: number): number {
  return padAt(x, z, true)?.h ?? level(x, z) ?? hillBase(x, z);
}

export interface TerrainGrid { x0: number; z0: number; nx: number; nz: number; step: number; y: Float32Array }
let grid: TerrainGrid | null = null;

/** Heights at every node of the terrain mesh (built once). */
export function terrainGrid(): TerrainGrid {
  if (grid) return grid;
  const step = TERRAIN_STEP, nx = Math.round((TERRAIN.x1 - TERRAIN.x0) / step) + 1, nz = Math.round((TERRAIN.z1 - TERRAIN.z0) / step) + 1;
  const y = new Float32Array(nx * nz);
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) y[j * nx + i] = nodeY(TERRAIN.x0 + i * step, TERRAIN.z0 + j * step);
  grid = { x0: TERRAIN.x0, z0: TERRAIN.z0, nx, nz, step, y };
  return grid;
}

/** Roads that climb (the galis); the cross roads are level and use the ordinary builder. */
export const isHillGali = (id: string): boolean => /^col_hill\d$/.test(id);
