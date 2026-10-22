import {
  PhysicsBody, PhysicsMotionType, PhysicsShapeBox, Quaternion, TransformNode, Vector3,
  type InstancedMesh, type Mesh, type Scene,
} from "../babylon";
import { GeoBuilder, rgb, shade } from "../render/GeoBuilder";
import type { Materials } from "../render/Materials";
import type { SignAtlas } from "../render/Signs";
import { buildTrolley, buildVehicleModel } from "../vehicles/models";
import { SPECS, type VehicleType } from "../vehicles/specs";
import { randomAppearance } from "../characters/appearances";
import type { Appearance } from "../characters/HumanBuilder";
import { Group } from "../app/config";
import { Rng } from "../render/textures";
import { laneOffset } from "../traffic/AIDriver";
import { ROADS, type Road } from "../world/region";
import type { NavGraph, NavNode } from "../world/nav";
import type { Crowd, Resident, ResidentDef } from "./Crowd";

export type ProcKind = "kirtan" | "rally" | "baraat";

/**
 * Roads a procession takes: proper tarmac at least seven metres wide, so it
 * fills its own side and the other lane stays open. Not kacha tracks (no
 * room to walk beside a tractor) and not the G.T. Road (nobody would live).
 */
const fits = (r: Road) => r.kind !== "track" && r.kind !== "highway" && Math.min(r.x1 - r.x0, r.z1 - r.z0) >= 7;
const PROC_ROADS = ROADS.filter(fits);
export function procRoad(n: NavNode): boolean {
  return !!n.road && fits(n.road);
}
/** A step along a procession road (a junction's link can lead down a track). */
export function procStep(n: NavNode, from: NavNode): boolean {
  if (!procRoad(n) || !procRoad(from)) return false;
  const mx = (n.x + from.x) / 2, mz = (n.z + from.z) / 2;
  return PROC_ROADS.some((r) => mx >= r.x0 - 0.5 && mx <= r.x1 + 0.5 && mz >= r.z0 - 0.5 && mz <= r.z1 + 0.5);
}

export interface ProcPath { pts: Array<{ x: number; z: number; half: number }>; acc: number[]; len: number }

/**
 * A route for a procession near (x, z): a meander along procession roads,
 * mostly straight on, `len` metres long, lane-offset to the left of the
 * direction of travel. Pure, so it is unit-tested.
 */
export function planRoute(g: NavGraph, rng: Rng, x: number, z: number, opts: { minD: number; maxD: number; len: number }): ProcPath | null {
  const starts = g.nodes.filter((n) => procRoad(n) && n.links.length && Math.hypot(n.x - x, n.z - z) >= opts.minD && Math.hypot(n.x - x, n.z - z) <= opts.maxD);
  let best: ProcPath | null = null, bestD = Infinity;
  for (let tries = 0; tries < 24 && starts.length; tries++) {
    const ids = [rng.pick(starts).id];
    let L = 0;
    while (L < opts.len) {
      const cur = g.nodes[ids[ids.length - 1]!]!, prev = ids.length > 1 ? g.nodes[ids[ids.length - 2]!]! : null;
      const links = cur.links.filter((l) => !ids.includes(l) && procStep(g.nodes[l]!, cur));
      if (!links.length) break;
      let next = rng.pick(links);
      if (prev && rng.next() < 0.75) {
        const dir = Math.atan2(cur.x - prev.x, cur.z - prev.z);
        let bt = Infinity;
        for (const l of links) {
          const n = g.nodes[l]!, a = Math.atan2(n.x - cur.x, n.z - cur.z);
          const t = Math.abs(Math.atan2(Math.sin(a - dir), Math.cos(a - dir)));
          if (t < bt) { bt = t; next = l; }
        }
      }
      L += Math.hypot(g.nodes[next]!.x - cur.x, g.nodes[next]!.z - cur.z);
      ids.push(next);
    }
    if (L < opts.len * 0.75) continue;
    const p = lanePath(ids.map((i) => g.nodes[i]!));
    // Prefer a route that passes close to the player: that is the point.
    let d = Infinity;
    for (const q of p.pts) d = Math.min(d, Math.hypot(q.x - x, q.z - z));
    if (d < bestD) { bestD = d; best = p; }
  }
  return best;
}

function lanePath(N: NavNode[]): ProcPath {
  const pts: ProcPath["pts"] = [];
  for (let k = 0; k < N.length; k++) {
    const n = N[k]!, a = N[Math.max(0, k - 1)]!, b = N[Math.min(N.length - 1, k + 1)]!;
    let dx = b.x - a.x, dz = b.z - a.z;
    const d = Math.hypot(dx, dz) || 1;
    dx /= d; dz /= d;
    const off = laneOffset(n);
    const w = n.road ? Math.min(n.road.x1 - n.road.x0, n.road.z1 - n.road.z0) : 8;
    pts.push({ x: n.x - dz * off, z: n.z + dx * off, half: w / 2 - off - 0.5 });
  }
  const acc = [0];
  for (let k = 1; k < pts.length; k++) acc.push(acc[k - 1]! + Math.hypot(pts[k]!.x - pts[k - 1]!.x, pts[k]!.z - pts[k - 1]!.z));
  return { pts, acc, len: acc[acc.length - 1]! };
}

/** Point and unit tangent at distance `s` along a path (clamped to its ends). */
export function pathAt(p: ProcPath, s: number): { x: number; z: number; tx: number; tz: number; half: number } {
  s = Math.max(0, Math.min(p.len - 1e-3, s));
  let k = 1;
  while (k < p.acc.length - 1 && p.acc[k]! < s) k++;
  const A = p.pts[k - 1]!, B = p.pts[k]!;
  const L = p.acc[k]! - p.acc[k - 1]! || 1;
  const f = (s - p.acc[k - 1]!) / L;
  return { x: A.x + (B.x - A.x) * f, z: A.z + (B.z - A.z) * f, tx: (B.x - A.x) / L, tz: (B.z - A.z) / L, half: Math.min(A.half, B.half) };
}

type PropKind = "nishan" | "flag" | "kirpan" | "dhol" | "sehra";
interface Member { r: Resident; along: number; lat: number; prop: InstancedMesh | null; dancer?: boolean; lead?: boolean; ph: number }
interface Float {
  kind: "tractor" | "jeep" | "ghodi";
  along: number;
  root: TransformNode;
  meshes: Mesh[];
  /** Ground clearance of the model's origin, wheel nodes and radius (to roll them). */
  y: number; wheels: TransformNode[]; wheelR: number;
  trolley?: { root: TransformNode; meshes: Mesh[] };
  legs?: TransformNode[];
  blockers: Array<{ node: TransformNode; body: PhysicsBody; off: number }>;
  rider?: Resident;
  halfWidth: number;
  pos: Vector3;
}
interface Proc {
  kind: ProcKind;
  path: ProcPath;
  s: number; speed: number;
  members: Member[];
  floats: Float[];
  t: number;
  /** Tail length (head to last walker), metres. */
  tail: number;
  blockedT: number;
  /** Baraat: stopping to dance (seconds left), and when the next stop comes. */
  danceT: number; nextDance: number;
  talkT: number;
  ending: number;
}

export interface ProcHost {
  scene: Scene;
  mats: Materials;
  signs: SignAtlas;
  crowd: Crowd;
  graph: NavGraph;
  playerPos(): Vector3;
  camera(): { pos: Vector3; fwd: Vector3 };
  /** Every physics vehicle (positions and sizes), to stop for. */
  vehicles(): Array<{ pos: Vector3; halfWidth: number }>;
  sound(kind: ProcKind, pos: Vector3): void;
  toast(msg: string): void;
  addCaster(m: import("../babylon").AbstractMesh): void;
  removeCaster(m: import("../babylon").AbstractMesh): void;
}

const LINES = {
  kirtanCall: ["Jo bole so nihaal!", "Bole so nihaal!"],
  kirtanReply: ["Sat Sri Akaal!", "Sat Sri Akaal!", "Waheguru ji ka Khalsa, Waheguru ji ki Fateh!"],
  rallyLead: [
    "Bhullar ji — zindabad!", "Sadda neta kaisa ho? Bhullar ji jaisa ho!", "Naali, sadak, bijli — sab milegi!",
    "Vote saanu, kamm tuhada!", "Ranggarh di awaaz — Bhullar ji!", "Mehngai murdabad!",
  ],
  rallyReply: ["Zindabad! Zindabad!", "Zindabad!", "Jeetega bhai jeetega!"],
  baraat: ["Balle balle!", "Hoye hoye!", "Chak de phatte!", "Nach le veere!", "Ghodi chadheya veera!", "Shava shava!"],
  baraatPull: ["Aaja veere, nach la!", "Oye, khada kyon ae? Bhangra pa!", "Dulhe da yaar ae? Nach!"],
};

/** The fictional party's colours (green, white and yellow). */
const PARTY = ["#2e7d32", "#f5f5f5", "#f9a825"];

/**
 * The party flag in a vertical plane (x = x), hoist at z, flying towards
 * -z·dir: a green field, a yellow band at the hoist and a white disc. Not
 * striped, so it never reads as the national flag.
 */
function partyFlag(g: GeoBuilder, x: number, z: number, top: number, w: number, h: number, dir = 1): void {
  const quad2 = (z0: number, z1: number, y0: number, y1: number, c: string) => {
    const a = new Vector3(x, y0, z0), b = new Vector3(x, y0, z1), cc = new Vector3(x, y1, z1), d = new Vector3(x, y1, z0);
    g.quad(a, b, cc, d, rgb(c));
    g.quad(a, d, cc, b, rgb(c));
  };
  quad2(z, z + dir * w * 0.18, top, top - h, PARTY[2]!);
  quad2(z + dir * w * 0.18, z + dir * w, top, top - h, PARTY[0]!);
  for (const sx of [-0.004, 0.004]) g.ellipsoid(x + sx, top - h / 2, z + dir * w * 0.58, 0.002, h * 0.28, h * 0.28, 10, 6, rgb(PARTY[1]!));
}

/**
 * Processions that come along a road now and then and hold the traffic up:
 * a nagar kirtan (Panj Pyare in front, the palki on a decorated tractor-
 * trolley, the sangat walking behind to harmonium and tabla), a political
 * rally (flag-waving supporters round a jeep with loudspeakers and a neta
 * standing in the back), and a baraat (dholis, bhangra, the dulha on a
 * decorated ghodi). They walk the left half of a wide road; vehicles behind
 * queue patiently (Traffic reads `holds`) and the other lane keeps moving.
 */
export class Processions {
  proc: Proc | null = null;
  private rng = new Rng(9191);
  private n = 0;
  /** Seconds until one may start by itself. */
  nextT = 200 + Math.random() * 120;
  private src = new Map<string, Mesh>();

  constructor(private host: ProcHost) {}

  // ------------------------------------------------------------------ Props

  private source(kind: PropKind, variant = 0): Mesh {
    const key = `${kind}${variant}`;
    let m = this.src.get(key);
    if (m) return m;
    const g = new GeoBuilder(0.4);
    const pole = rgb("#6d4c41"), steel = rgb("#cfd8dc"), gold = rgb("#d4a017");
    if (kind === "nishan") {
      // The Nishan Sahib: a tall pole in kesri cloth, a triangular kesri
      // flag and the steel khanda at the top. Held with the hand at y = 0.
      g.cylinder(0, -0.6, 0, 0.025, 0.022, 3.4, 6, rgb("#f57c00"));
      g.quad(new Vector3(0, 2.75, 0), new Vector3(0, 2.75, 0.85), new Vector3(0, 2.25, 0), new Vector3(0, 2.25, 0), rgb("#ff8f00"));
      g.quad(new Vector3(0, 2.75, 0), new Vector3(0, 2.25, 0), new Vector3(0, 2.25, 0), new Vector3(0, 2.75, 0.85), rgb("#ff8f00"));
      g.cylinder(0, 2.8, 0, 0.012, 0.012, 0.3, 4, steel);
      g.torus(0, 2.95, 0, 0.07, 0.012, 10, 3, steel, "x");
      g.box(0, 3.05, 0, 0.02, 0.22, 0.05, steel);
    } else if (kind === "flag") {
      g.cylinder(0, -0.5, 0, 0.015, 0.015, 2.3, 5, pole);
      partyFlag(g, 0, 0, 1.78, 0.8, 0.52);
    } else if (kind === "kirpan") {
      // A sword held point-up, as the Panj Pyare carry them.
      g.cylinder(0, -0.08, 0, 0.018, 0.018, 0.18, 6, rgb("#3e2723"));
      g.box(0, 0.11, 0, 0.16, 0.02, 0.03, gold);
      g.box(0, 0.5, 0, 0.012, 0.75, 0.035, steel);
    } else if (kind === "dhol") {
      // Barrel across the belly (along x), both skins, rope lacing, the strap.
      g.cylinderX(0, 0, 0, 0.2, 0.55, 14, rgb(variant ? "#8d1c1c" : "#5d4037"));
      for (const sd of [-1, 1]) g.cylinderX(sd * 0.28, 0, 0, 0.205, 0.015, 14, rgb("#efe6d0"));
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        g.tube(new Vector3(-0.27, Math.sin(a) * 0.2, Math.cos(a) * 0.2), new Vector3(0.27, Math.sin(a + 0.4) * 0.2, Math.cos(a + 0.4) * 0.2), 0.006, 3, gold);
      }
      g.tube(new Vector3(-0.2, 0.15, -0.1), new Vector3(0.12, 0.62, -0.22), 0.02, 4, rgb("#c62828"));
    } else {
      // The sehra: strings of gold and flowers hanging over the dulha's face.
      for (let i = 0; i < 15; i++) {
        const a = -1.5 + (i / 14) * 3.0;
        const x = Math.sin(a) * 0.13, z = Math.cos(a) * 0.13;
        g.tube(new Vector3(x, 0, z), new Vector3(x * 1.1, -0.3, z * 1.1), 0.008, 3, i % 2 ? gold : rgb("#fafafa"));
        g.ellipsoid(x * 1.1, -0.3, z * 1.1, 0.018, 0.018, 0.018, 4, 3, i % 3 ? rgb("#ff8f00") : rgb("#c62828"));
      }
      g.torus(0, 0, 0, 0.13, 0.015, 16, 3, gold);
      g.ellipsoid(0, 0.18, 0.1, 0.04, 0.09, 0.02, 6, 4, gold);
    }
    m = g.toMesh(`proc_${key}`, this.host.scene, this.host.mats.get("matte"));
    m.isPickable = false;
    m.isVisible = false;
    m.position.y = -100;
    this.src.set(key, m);
    return m;
  }

  private attach(r: Resident, kind: PropKind, variant = 0): InstancedMesh {
    const inst = this.source(kind, variant).createInstance(`proc_${kind}_${this.n++}`);
    inst.isPickable = false;
    inst.parent = r.human.root;
    if (kind === "dhol") inst.position.set(0, 0.98, 0.26);
    else if (kind === "sehra") inst.position.set(0, 1.62, 0.02);
    else inst.position.set(0.12, 1.34, 0.2);
    return inst;
  }

  // ------------------------------------------------------------------ Floats

  /** An animated box the player's car bumps into instead of driving through. */
  private blocker(id: string, w: number, h: number, l: number): { node: TransformNode; body: PhysicsBody } {
    const node = new TransformNode(`${id}_col`, this.host.scene);
    const sh = new PhysicsShapeBox(Vector3.Zero(), Quaternion.Identity(), new Vector3(w, h, l), this.host.scene);
    sh.filterMembershipMask = Group.ANIMAL;
    sh.filterCollideMask = Group.VEHICLE | Group.PLAYER;
    const body = new PhysicsBody(node, PhysicsMotionType.ANIMATED, false, this.host.scene);
    body.shape = sh;
    body.setMassProperties({ mass: 2000 });
    return { node, body };
  }

  private vehicleFloat(type: VehicleType, body: string, accent: string, along: number): Float {
    const id = `proc_${type}_${this.n++}`;
    const spec = SPECS[type];
    const model = buildVehicleModel(this.host.scene, this.host.mats, this.host.signs, type, body, accent, id);
    const w0 = spec.wheels[0]!;
    const y = w0.r + spec.suspRest - w0.y;
    const f: Float = {
      kind: type === "jeep" ? "jeep" : "tractor", along, root: model.root as TransformNode, meshes: [...model.meshes], y,
      wheels: model.wheels, wheelR: w0.r, blockers: [], halfWidth: spec.halfWidth, pos: new Vector3(),
    };
    const b = this.blocker(id, spec.halfWidth * 2, 1.6, spec.wheelbase + 1.6);
    f.blockers.push({ ...b, off: 0 });
    for (const m of f.meshes) this.host.addCaster(m);
    return f;
  }

  /** Decorations on a float: the palki on the trolley, or the rally jeep's speakers and flags. */
  private decorate(f: Float, kind: ProcKind): void {
    const g = new GeoBuilder(0.4);
    const gold = rgb("#d4a017"), white = rgb("#fafafa"), marigold = rgb("#ff8f00");
    const garland = (x0: number, z0: number, x1: number, z1: number, y: number, sag: number) => {
      for (let i = 0; i <= 10; i++) {
        const f2 = i / 10, yy = y - Math.sin(f2 * Math.PI) * sag;
        g.ellipsoid(x0 + (x1 - x0) * f2, yy, z0 + (z1 - z0) * f2, 0.06, 0.06, 0.06, 5, 3, i % 2 ? marigold : rgb("#fdd835"));
      }
    };
    if (kind === "kirtan" && f.trolley) {
      // Palki Sahib on the trolley bed: white sheet, four gold posts, a gold
      // dome with a kalash, rumala-draped seat; marigolds everywhere.
      g.box(0, 1.55, 0.2, 1.9, 0.12, 3.5, white);
      g.box(0, 1.85, 0.1, 0.9, 0.5, 1.1, rgb("#b71c1c"));
      g.box(0, 2.12, 0.1, 0.95, 0.06, 1.15, gold);
      for (const sx of [-0.7, 0.7]) for (const sz of [-0.6, 0.8]) g.cylinder(sx, 1.6, sz, 0.05, 0.05, 1.5, 8, gold);
      g.box(0, 3.12, 0.1, 1.6, 0.1, 1.6, gold);
      g.ellipsoid(0, 3.17, 0.1, 0.78, 0.55, 0.78, 14, 7, gold, 0, 1);
      g.cylinder(0, 3.7, 0.1, 0.06, 0.02, 0.35, 6, gold);
      g.ellipsoid(0, 4.07, 0.1, 0.07, 0.07, 0.07, 6, 4, gold);
      for (const sz of [-0.6, 0.8]) garland(-0.7, sz, 0.7, sz, 3.0, 0.3);
      for (const sx of [-0.7, 0.7]) garland(sx, -0.6, sx, 0.8, 3.0, 0.3);
      for (const sx of [-0.98, 0.98]) garland(sx, -1.5, sx, 1.9, 1.5, 0.15);
      const m = g.toMesh(`palki${this.n++}`, this.host.scene, this.host.mats.get("matte"));
      m.parent = f.trolley.root;
      m.isPickable = false;
      f.meshes.push(m);
      this.host.addCaster(m);
      // Bonnet garland and a nishan on the tractor.
      const t = new GeoBuilder(0.4);
      for (let i = 0; i <= 8; i++) t.ellipsoid(-0.45 + i * 0.11, 1.45 - Math.sin((i / 8) * Math.PI) * 0.25, 1.9, 0.06, 0.06, 0.06, 5, 3, i % 2 ? marigold : white);
      t.cylinder(0.7, 1.0, 1.6, 0.02, 0.02, 2.0, 5, rgb("#f57c00"));
      t.quad(new Vector3(0.7, 2.95, 1.6), new Vector3(0.7, 2.95, 1.0), new Vector3(0.7, 2.6, 1.6), new Vector3(0.7, 2.6, 1.6), rgb("#ff8f00"));
      t.quad(new Vector3(0.7, 2.95, 1.6), new Vector3(0.7, 2.6, 1.6), new Vector3(0.7, 2.6, 1.6), new Vector3(0.7, 2.95, 1.0), rgb("#ff8f00"));
      const tm = t.toMesh(`palkiT${this.n++}`, this.host.scene, this.host.mats.get("matte"));
      tm.parent = f.root;
      tm.isPickable = false;
      f.meshes.push(tm);
    } else if (kind === "rally") {
      // Two loudspeaker horns on a frame, party flags at the corners and a
      // banner along each side.
      g.box(0, 2.15, -0.3, 0.06, 0.5, 0.06, rgb("#424242"));
      for (const sd of [-1, 1]) {
        g.cylinder(sd * 0.25, 2.35, -0.3, 0.04, 0.2, 0.4, 10, rgb("#eceff1"));
        g.box(sd * 0.12, 2.4, -0.3, 0.26, 0.04, 0.04, rgb("#424242"));
      }
      for (const [x, z] of [[-0.85, 1.9], [0.85, 1.9], [-0.85, -1.9], [0.85, -1.9]] as const) {
        g.cylinder(x, 0.9, z, 0.015, 0.015, 1.6, 5, rgb("#6d4c41"));
        partyFlag(g, x, z, 2.5, 0.6, 0.4, -1);
      }
      for (const sd of [-1, 1]) {
        g.box(sd * 0.93, 1.05, 0, 0.02, 0.4, 2.6, rgb("#f5f5f5"));
        g.box(sd * 0.935, 1.05, 0, 0.02, 0.12, 2.6, rgb(PARTY[0]!));
      }
      garland(-0.8, 2.2, 0.8, 2.2, 1.2, 0.2);
      const m = g.toMesh(`rallyDeco${this.n++}`, this.host.scene, this.host.mats.get("matte"));
      m.parent = f.root;
      m.isPickable = false;
      f.meshes.push(m);
    }
  }

  /** A decorated white ghodi for the dulha, with legs that walk. */
  private ghodi(along: number): Float {
    const id = `ghodi${this.n++}`;
    const root = new TransformNode(id, this.host.scene);
    const mat = this.host.mats.get("matte");
    const coat = rgb("#f2efe9"), red = rgb("#b71c1c"), gold = rgb("#d4a017"), mane = rgb("#d7ccc8");
    const meshes: Mesh[] = [];
    const mk = (g: GeoBuilder, parent: TransformNode) => {
      const m = g.toMesh(`${id}_m${meshes.length}`, this.host.scene, mat);
      m.parent = parent;
      m.isPickable = false;
      meshes.push(m);
    };
    const leg = 0.95, bodyY = 1.22;
    const b = new GeoBuilder(0.4);
    b.ellipsoid(0, bodyY, 0, 0.32, 0.34, 0.85, 14, 8, coat);
    b.ellipsoid(0, bodyY + 0.05, -0.55, 0.33, 0.33, 0.4, 10, 6, coat);
    b.ellipsoid(0, bodyY + 0.05, 0.5, 0.31, 0.36, 0.4, 10, 6, coat);
    // Neck reaching forward and up, the long head angled down, the mane.
    b.loft([
      { p: new Vector3(0, bodyY + 0.05, 0.6), rx: 0.22, rz: 0.3 },
      { p: new Vector3(0, bodyY + 0.42, 0.86), rx: 0.17, rz: 0.24 },
      { p: new Vector3(0, bodyY + 0.72, 1.06), rx: 0.13, rz: 0.18 },
    ], 10, coat, false, true);
    b.tube(new Vector3(0, bodyY + 0.36, 0.66), new Vector3(0, bodyY + 0.8, 0.98), 0.05, 6, mane);
    b.ellipsoid(0, bodyY + 0.76, 1.15, 0.14, 0.18, 0.2, 10, 6, coat);
    b.ellipsoid(0, bodyY + 0.58, 1.36, 0.115, 0.15, 0.22, 10, 6, coat);
    b.ellipsoid(0, bodyY + 0.48, 1.5, 0.1, 0.11, 0.1, 8, 5, shade(coat, 0.8));
    for (const sd of [-1, 1]) {
      b.ellipsoid(sd * 0.07, bodyY + 0.95, 1.08, 0.035, 0.09, 0.035, 5, 3, coat);
      b.ellipsoid(sd * 0.125, bodyY + 0.78, 1.22, 0.02, 0.03, 0.03, 4, 3, rgb("#111"));
    }
    // Jhool: a red and gold cloth over the back, saddle, the kalgi plume and
    // a gold bridle; a tail.
    b.ellipsoid(0, bodyY + 0.08, -0.05, 0.36, 0.3, 0.62, 12, 6, red, 0, 1);
    for (const sd of [-1, 1]) b.box(sd * 0.35, bodyY - 0.12, -0.05, 0.02, 0.45, 1.1, red);
    for (const sd of [-1, 1]) b.box(sd * 0.36, bodyY - 0.35, -0.05, 0.02, 0.06, 1.12, gold);
    b.box(0, bodyY + 0.36, -0.05, 0.42, 0.08, 0.55, rgb("#4e342e"));
    b.cylinder(0, bodyY + 0.9, 1.1, 0.02, 0.05, 0.26, 6, gold);
    b.ellipsoid(0, bodyY + 1.22, 1.08, 0.06, 0.12, 0.06, 6, 4, rgb("#e91e63"));
    b.torus(0, bodyY + 0.56, 1.4, 0.125, 0.015, 12, 3, gold);
    for (let i = 0; i <= 6; i++) b.ellipsoid(-0.15 + i * 0.05, bodyY + 0.3 - Math.sin((i / 6) * Math.PI) * 0.08, 0.92 + i * 0.0, 0.035, 0.035, 0.035, 5, 3, i % 2 ? gold : rgb("#ff8f00"));
    b.tube(new Vector3(0, bodyY + 0.15, -0.85), new Vector3(0, bodyY - 0.55, -1.0), 0.06, 6, mane);
    mk(b, root);
    const legs: TransformNode[] = [];
    for (const [x, z] of [[-1, 1], [1, 1], [-1, -1], [1, -1]] as const) {
      const n = new TransformNode(`${id}_leg`, this.host.scene);
      n.parent = root;
      n.position.set(x * 0.18, leg + 0.02, z * 0.58);
      const lg = new GeoBuilder(0.4);
      lg.cylinder(0, -leg, 0, 0.055, 0.1, leg + 0.1, 8, coat);
      lg.cylinder(0, -leg, 0, 0.055, 0.055, 0.08, 8, rgb("#3e2723"));
      lg.torus(0, -leg + 0.2, 0, 0.055, 0.012, 8, 3, gold);
      mk(lg, n);
      legs.push(n);
    }
    for (const m of meshes) this.host.addCaster(m);
    const bl = this.blocker(id, 0.7, 1.6, 2.2);
    return { kind: "ghodi", along, root, meshes, y: 0, wheels: [], wheelR: 1, legs, blockers: [{ ...bl, off: 0 }], halfWidth: 0.4, pos: new Vector3() };
  }

  // ------------------------------------------------------------------ People

  private person(kind: string, look: Partial<Appearance> & { sex: "m" | "f" }, x: number, z: number, extra: Partial<ResidentDef> = {}): Resident {
    const seed = 5100 + this.n * 37 + this.rng.int(0, 900);
    const base = randomAppearance(seed);
    const r = this.host.crowd.spawn({
      id: `proc_${kind}_${this.n++}`, name: kind, role: "chatter", x, z, yaw: 0,
      look: { ...base, ...(base.age === "child" ? { age: "adult" as const, height: 1.62 + this.rng.next() * 0.2 } : {}), ...look }, ...extra,
    });
    return r;
  }

  private sikhMan(c: string): Partial<Appearance> & { sex: "m" } {
    return { sex: "m", headwear: "turban", headColor: c, beard: "full", hair: "short" };
  }

  /** Start one near the player. Returns where it is, or null if no road fits. */
  start(kind: ProcKind, near: Vector3, staged = false): { x: number; z: number } | null {
    if (this.proc) this.end(true);
    const len = kind === "baraat" ? 160 : 220;
    const path = planRoute(this.host.graph, this.rng, near.x, near.z, staged ? { minD: 25, maxD: 70, len } : { minD: 70, maxD: 130, len });
    if (!path) return null;
    if (!staged) {
      // Never pop into view: start only where the camera is not looking.
      const cam = this.host.camera();
      for (const s0 of [0, 15, 30]) {
        const q = pathAt(path, s0);
        const dx = q.x - cam.pos.x, dz = q.z - cam.pos.z, d = Math.hypot(dx, dz) || 1;
        if (d < 150 && (dx * cam.fwd.x + dz * cam.fwd.z) / d > 0.35) return null;
      }
    }
    const P: Proc = { kind, path, s: 0, speed: kind === "rally" ? 1.1 : kind === "kirtan" ? 0.9 : 0.75, members: [], floats: [], t: 0, tail: 0, blockedT: 0, danceT: 0, nextDance: 25, talkT: 3, ending: 0 };
    const add = (r: Resident, along: number, lat: number, prop: PropKind | null = null, opts: Partial<Member> = {}, variant = 0) => {
      const m: Member = { r, along, lat, prop: prop ? this.attach(r, prop, variant) : null, ph: this.rng.next() * 6, ...opts };
      P.members.push(m);
      return m;
    };
    const at0 = pathAt(path, 0);
    const X = at0.x, Z = at0.z;
    if (kind === "kirtan") {
      // Two nishanchis, the Panj Pyare in single file, bibis ahead of the
      // palki, the palki on its tractor-trolley, then the sangat.
      for (const lat of [-0.7, 0.7]) add(this.person("nishanchi", { ...this.sikhMan("#1a237e"), top: "kurta", topColor: "#ff8f00", bottom: "pajama", bottomColor: "#1a237e", kara: true }, X, Z, { pole: true }), 0, lat, "nishan");
      for (let i = 0; i < 5; i++) add(this.person("pyara", { ...this.sikhMan("#ff8f00"), top: "kurta", topColor: "#ff8f00", bottom: "pajama", bottomColor: "#ff8f00", kara: true, sleeves: "long" }, X, Z, { pole: true }), 2.6 + i * 1.5, 0, "kirpan", i === 0 ? { lead: true } : {});
      for (const lat of [-0.8, 0.8]) add(this.person("bibi", { sex: "f", top: "kameez", topColor: "#fafafa", bottom: "salwar", bottomColor: "#fafafa", dupatta: "#ff8f00", headwear: "none" }, X, Z), 11.5, lat);
      const tr = this.vehicleFloat("tractor", "#1565c0", "#fafafa", 16);
      const trol = buildTrolley(this.host.scene, this.host.mats, `proc_trol${this.n++}`, "empty", "#1565c0");
      for (const m of trol.meshes) this.host.addCaster(m);
      tr.trolley = trol;
      const tb = this.blocker(`proc_trolcol${this.n}`, 2.0, 2.0, 3.8);
      tr.blockers.push({ ...tb, off: 5.25 });
      this.decorate(tr, "kirtan");
      P.floats.push(tr);
      const tops = ["#fafafa", "#fdd835", "#ff8f00", "#90caf9", "#f48fb1", "#fafafa"];
      for (let i = 0; i < 12; i++) {
        const f = i % 3 !== 1;
        const look = f
          ? { sex: "f" as const, top: "kameez" as const, topColor: tops[i % tops.length]!, bottom: "salwar" as const, bottomColor: "#fafafa", dupatta: tops[(i + 2) % tops.length]!, headwear: "none" as const }
          : { ...this.sikhMan(this.rng.pick(["#1a237e", "#ff8f00", "#fafafa", "#0d47a1"])), top: "kurta" as const, topColor: "#fafafa", bottom: "pajama" as const, bottomColor: "#fafafa" };
        add(this.person("sangat", look, X, Z), 24.5 + Math.floor(i / 3) * 1.6, -1.1 + (i % 3) * 1.1);
      }
    } else if (kind === "rally") {
      for (let i = 0; i < 6; i++) add(this.person("worker", { sex: "m", top: i % 2 ? "kurta" : "shirt", topColor: i % 3 ? "#fafafa" : PARTY[0]!, age: "adult" }, X, Z, { pole: i % 2 === 0 }), Math.floor(i / 3) * 1.6, -1.1 + (i % 3) * 1.1, i % 2 === 0 ? "flag" : null);
      const j = this.vehicleFloat("jeep", "#f0f0ee", PARTY[0]!, 6.5);
      this.decorate(j, "rally");
      P.floats.push(j);
      // The neta stands in the back of the open jeep, waving to his voters.
      j.rider = this.person("neta", { sex: "m", top: "kurta", topColor: "#fafafa", bottom: "pajama", bottomColor: "#fafafa", headwear: "turban", headColor: "#2e7d32", beard: "full", age: "elder", vest: "#37474f", build: 1.2 }, X, Z, { onRoof: true, y: 0.75 });
      for (let i = 0; i < 6; i++) add(this.person("worker", { sex: "m", top: i % 2 ? "kurta" : "tshirt", topColor: i % 2 ? "#fafafa" : PARTY[2]!, age: "adult" }, X, Z, { pole: i % 3 === 0 }), 11.5 + Math.floor(i / 3) * 1.6, -1.1 + (i % 3) * 1.1, i % 3 === 0 ? "flag" : null);
    } else {
      // Two dholis lead; the dancers; the women of the family; the ghodi with
      // the dulha, led by the ghodi-wala; the elders at the back.
      for (const [i, lat] of [[0, -0.7], [1, 0.7]] as const) add(this.person("dholi", { sex: "m", top: "kurta", topColor: i ? "#fdd835" : "#e91e63", bottom: "pajama", bottomColor: "#fafafa", headwear: "turban", headColor: i ? "#e91e63" : "#fdd835", beard: "full" }, X, Z, { dhol: true }), 0, lat, "dhol", {}, i);
      for (let i = 0; i < 6; i++) add(this.person("baraati", { sex: "m", top: this.rng.pick(["kurta", "shirt"]) as "kurta" | "shirt", topColor: this.rng.pick(["#fafafa", "#ffcc80", "#90caf9", "#ce93d8", "#a5d6a7"]), headwear: i % 2 ? "turban" : "none", headColor: this.rng.pick(["#e91e63", "#ff8f00", "#c62828", "#7b1fa2"]), age: "adult" }, X, Z), 3 + Math.floor(i / 3) * 1.8, -1.1 + (i % 3) * 1.1, null, { dancer: true });
      for (let i = 0; i < 4; i++) add(this.person("baraatan", { sex: "f", top: "kameez", topColor: this.rng.pick(["#e91e63", "#c62828", "#7b1fa2", "#fdd835", "#00897b"]), bottom: "salwar", bottomColor: this.rng.pick(["#fdd835", "#e91e63", "#fafafa"]), dupatta: this.rng.pick(["#fdd835", "#ff8f00", "#e91e63"]), headwear: "none", age: "adult" }, X, Z), 7.5 + Math.floor(i / 2) * 1.4, -0.6 + (i % 2) * 1.2, null, { dancer: i % 2 === 0 });
      const gh = this.ghodi(13.5);
      gh.rider = this.person("dulha", { sex: "m", top: "kurta", topColor: "#f3e5ab", bottom: "pajama", bottomColor: "#f3e5ab", headwear: "turban", headColor: "#c62828", beard: "stubble", age: "adult", shoes: "jutti", shoeColor: "#d4a017" }, X, Z, { y: 1.42 });
      gh.rider.pose = "sit";
      this.attach(gh.rider, "sehra");
      P.floats.push(gh);
      add(this.person("ghodiwala", { sex: "m", top: "kurta", topColor: "#8d6e63", headwear: "turban", headColor: "#fafafa", age: "elder" }, X, Z), 12.3, -1.0);
      for (let i = 0; i < 4; i++) add(this.person("baraati", { sex: "m", top: "kurta", topColor: this.rng.pick(["#fafafa", "#ffcc80", "#bcaaa4"]), headwear: "turban", headColor: this.rng.pick(["#e91e63", "#ff8f00", "#c62828"]), age: i < 2 ? "elder" : "adult" }, X, Z), 17 + Math.floor(i / 2) * 1.5, -0.6 + (i % 2) * 1.2);
    }
    P.tail = Math.max(...P.members.map((m) => m.along), ...P.floats.map((f) => f.along + (f.trolley ? 7 : 3)));
    // Start fully formed with the tail at the route's start.
    P.s = P.tail + 1;
    for (const m of P.members) {
      const q = this.slot(P, m);
      this.host.crowd.place(m.r, q.x, q.z);
      m.r.facing = Math.atan2(q.tx, q.tz);
      m.r.brain = (_r, dt) => this.steer(P, m, dt);
    }
    for (const f of P.floats) {
      this.placeFloat(P, f, 0);
      if (f.rider) f.rider.brain = (rr) => { rr.vel.setAll(0); };
    }
    this.proc = P;
    const name = kind === "kirtan" ? "Nagar kirtan" : kind === "rally" ? "A political rally" : "A baraat";
    this.host.toast(`${name} is coming down the road — traffic will have to wait.`);
    const h = pathAt(path, P.s);
    return { x: h.x, z: h.z };
  }

  private slot(P: Proc, m: Member): { x: number; z: number; tx: number; tz: number } {
    const q = pathAt(P.path, P.s - m.along);
    let lat = m.lat;
    // Dancers swing about their place in the line.
    if (m.dancer) lat += Math.sin(P.t * 0.9 + m.ph) * 0.35;
    lat = Math.max(-q.half - 0.3, Math.min(q.half, lat));
    // Left of travel is (-tz, tx).
    return { x: q.x - q.tz * lat, z: q.z + q.tx * lat, tx: q.tx, tz: q.tz };
  }

  private steer(P: Proc, m: Member, dt: number): void {
    const r = m.r;
    if (P.ending > 0) { r.vel.scaleInPlace(Math.exp(-dt * 6)); return; }
    const q = this.slot(P, m);
    const ex = q.x - r.pos.x, ez = q.z - r.pos.z, e = Math.hypot(ex, ez);
    if (e > 0.12) {
      const sp = Math.min(2.6, e * 2.2 + (P.danceT > 0 || P.blockedT > 0 ? 0 : P.speed * 0.5));
      r.vel.set((ex / e) * sp, 0, (ez / e) * sp);
    } else {
      r.vel.scaleInPlace(Math.exp(-dt * 8));
      const want = Math.atan2(q.tx, q.tz);
      r.facing += Math.atan2(Math.sin(want - r.facing), Math.cos(want - r.facing)) * Math.min(1, dt * 3);
    }
    if (m.dancer && r.anim.currentGesture === "none" && (P.danceT > 0 || this.rng.next() < dt * 0.25)) r.anim.play("bhangra", P.danceT > 0 ? 3 : 2);
  }

  private placeFloat(P: Proc, f: Float, dt: number): void {
    const q = pathAt(P.path, P.s - f.along);
    const yaw = Math.atan2(q.tx, q.tz);
    const moved = Math.hypot(q.x - f.pos.x, q.z - f.pos.z);
    f.pos.set(q.x, 0, q.z);
    f.root.position.set(q.x, f.y, q.z);
    f.root.rotationQuaternion = null;
    f.root.rotation.set(0, yaw, 0);
    if (dt > 0) {
      for (const w of f.wheels) w.rotation.x += moved / f.wheelR;
      if (f.legs) {
        const ph = P.t * 4.2, go = Math.min(1, moved / dt / 0.6);
        f.legs.forEach((l, i) => { l.rotation.x = Math.sin(ph + (i === 0 || i === 3 ? 0 : Math.PI)) * 0.35 * go; });
      }
    }
    if (f.trolley) {
      // The trolley rides the route behind the hitch, turned towards it.
      const hx = q.x - q.tx * 2.05, hz = q.z - q.tz * 2.05;
      const a = pathAt(P.path, P.s - f.along - 5.25);
      f.trolley.root.position.set(a.x, 0, a.z);
      f.trolley.root.rotation.set(0, Math.atan2(hx - a.x, hz - a.z), 0);
    }
    for (const b of f.blockers) {
      const o = b.off ? pathAt(P.path, P.s - f.along - b.off) : q;
      b.node.position.set(o.x, 0.9, o.z);
      b.body.setTargetTransform(b.node.position, Quaternion.RotationYawPitchRoll(Math.atan2(o.tx, o.tz), 0, 0));
    }
    if (f.rider) {
      const r = f.rider;
      if (f.kind === "jeep") {
        // Standing in the back, behind the speakers.
        r.pos.set(q.x - q.tx * 1.1, 0.75, q.z - q.tz * 1.1);
        r.y = 0.75;
      } else {
        r.pos.set(q.x - q.tx * 0.1, 0, q.z - q.tz * 0.1);
      }
      r.prev.copyFrom(r.pos);
      r.facing = yaw;
    }
  }

  /** Is anything parked or stopped in the lane just ahead of the head? */
  private blockedAhead(P: Proc): boolean {
    const h = pathAt(P.path, P.s);
    for (const v of this.host.vehicles()) {
      const dx = v.pos.x - h.x, dz = v.pos.z - h.z;
      const ahead = dx * h.tx + dz * h.tz, lat = dx * h.tz - dz * h.tx;
      if (ahead > -1 && ahead < 4.5 + v.halfWidth && Math.abs(lat) < 1.6 + v.halfWidth) return true;
    }
    return false;
  }

  update(dt: number, raining: number, auto: boolean): void {
    const P = this.proc;
    const p = this.host.playerPos();
    if (!P) {
      this.nextT -= dt;
      if (auto && this.nextT <= 0) {
        this.nextT = 30;
        if (raining > 0.2) return;
        const kinds: ProcKind[] = ["kirtan", "rally", "baraat"];
        if (this.start(this.rng.pick(kinds), p)) this.nextT = this.rng.range(360, 600);
      }
      return;
    }
    P.t += dt;
    const head = pathAt(P.path, P.s);
    const dPlayer = Math.hypot(head.x - p.x, head.z - p.z);
    if (dPlayer > 260) { this.end(true); return; }
    if (P.ending > 0) {
      P.ending -= dt;
      // Gone home: clear it away once nobody is looking (or after a minute).
      const cam = this.host.camera();
      const mid = pathAt(P.path, P.s - P.tail / 2);
      const dx = mid.x - cam.pos.x, dz = mid.z - cam.pos.z, d = Math.hypot(dx, dz) || 1;
      const seen = d < 110 && (dx * cam.fwd.x + dz * cam.fwd.z) / d > 0.3;
      if (!seen || P.ending <= 0) this.end(true);
      return;
    }
    // Walk on, unless something stands in the lane ahead.
    const blocked = this.blockedAhead(P);
    P.blockedT = blocked ? P.blockedT + dt : 0;
    if (P.blockedT > 25) { P.ending = 60; return; }
    if (P.kind === "baraat") {
      // A baraat stops every so often for the boys to dance it out.
      P.nextDance -= dt;
      if (P.danceT > 0) P.danceT -= dt;
      else if (P.nextDance <= 0) { P.danceT = this.rng.range(12, 18); P.nextDance = this.rng.range(30, 45); }
    }
    if (!blocked && P.danceT <= 0) P.s += P.speed * dt;
    if (P.s >= P.path.len) { P.ending = 60; return; }
    for (const f of P.floats) this.placeFloat(P, f, dt);
    const src = pathAt(P.path, P.s - (P.kind === "baraat" ? 0 : P.floats[0]?.along ?? 0));
    this.host.sound(P.kind, new Vector3(src.x, 0, src.z));
    this.talk(P, dt, p);
  }

  private talk(P: Proc, dt: number, p: Vector3): void {
    P.talkT -= dt;
    if (P.talkT > 0) return;
    const say = (m: Resident | undefined, t: string) => { if (m) this.host.crowd.say(m, t); };
    const pick = <T>(a: T[]) => this.rng.pick(a);
    if (P.kind === "kirtan") {
      P.talkT = this.rng.range(18, 28);
      const lead = P.members.find((m) => m.lead)?.r;
      say(lead, pick(LINES.kirtanCall));
      setTimeout(() => {
        if (this.proc !== P) return;
        const sangat = P.members.filter((m) => !m.lead);
        for (let i = 0; i < 3; i++) { const m = pick(sangat); say(m.r, LINES.kirtanReply[i === 2 ? this.rng.int(0, 2) : 0]!); m.r.anim.play("cheer", 1.2); }
      }, 1300);
    } else if (P.kind === "rally") {
      P.talkT = this.rng.range(5, 8);
      const neta = P.floats[0]?.rider;
      say(neta, pick(LINES.rallyLead));
      neta?.anim.play("wave", 2);
      setTimeout(() => {
        if (this.proc !== P) return;
        for (let i = 0; i < 2; i++) { const m = pick(P.members); say(m.r, pick(LINES.rallyReply)); m.r.anim.play("cheer", 1.4); }
      }, 1500);
    } else {
      P.talkT = this.rng.range(6, 10);
      const dancers = P.members.filter((m) => m.dancer);
      // Someone from the baraat pulls the player in to dance.
      const near = dancers.find((m) => Vector3.Distance(m.r.pos, p) < 6);
      if (near) say(near.r, pick(LINES.baraatPull));
      else say(pick(dancers).r, pick(LINES.baraat));
    }
  }

  /** Traffic at this point is held up by the procession (queue, don't re-route). */
  holds(pos: Vector3): boolean {
    const P = this.proc;
    if (!P) return false;
    // Anything within reach of the procession's stretch of road, plus a
    // queue's worth behind it.
    for (let s = P.s + 10; s > P.s - P.tail - 70; s -= 12) {
      const q = pathAt(P.path, s);
      if (Math.hypot(q.x - pos.x, q.z - pos.z) < 12) return true;
    }
    return false;
  }

  /** The floats as obstacles for the traffic's look-ahead. */
  obstacles(): Array<{ pos: Vector3; r: number }> {
    const P = this.proc;
    if (!P) return [];
    const out: Array<{ pos: Vector3; r: number }> = [];
    for (const f of P.floats) {
      for (const b of f.blockers) out.push({ pos: b.node.position, r: f.halfWidth + 0.6 });
      if (f.kind !== "ghodi") {
        const q = pathAt(P.path, P.s - f.along);
        out.push({ pos: new Vector3(q.x + q.tx * 1.6, 0, q.z + q.tz * 1.6), r: f.halfWidth + 0.6 });
        out.push({ pos: new Vector3(q.x - q.tx * 1.6, 0, q.z - q.tz * 1.6), r: f.halfWidth + 0.6 });
      }
    }
    return out;
  }

  /** Clear the procession away. */
  end(now = false): void {
    const P = this.proc;
    if (!P) return;
    if (!now) { P.ending = 60; return; }
    this.proc = null;
    for (const m of P.members) {
      m.prop?.dispose();
      if (this.host.crowd.residents.includes(m.r)) this.host.crowd.remove(m.r);
    }
    for (const f of P.floats) {
      if (f.rider) {
        for (const c of f.rider.human.root.getChildren()) if ((c as InstancedMesh).sourceMesh) c.dispose();
        if (this.host.crowd.residents.includes(f.rider)) this.host.crowd.remove(f.rider);
      }
      for (const m of [...f.meshes, ...(f.trolley?.meshes ?? [])]) { this.host.removeCaster(m); m.dispose(); }
      f.trolley?.root.dispose();
      f.root.dispose();
      for (const b of f.blockers) { b.body.dispose(); b.node.dispose(); }
    }
  }

  state(): unknown {
    const P = this.proc;
    if (!P) return { next: Math.round(this.nextT) };
    const h = pathAt(P.path, P.s);
    return {
      kind: P.kind, s: +P.s.toFixed(1), len: +P.path.len.toFixed(0), head: [+h.x.toFixed(1), +h.z.toFixed(1)], yaw: +Math.atan2(h.tx, h.tz).toFixed(2),
      members: P.members.length, floats: P.floats.map((f) => f.kind), blocked: +P.blockedT.toFixed(1), dancing: P.danceT > 0, ending: P.ending > 0,
    };
  }
}
