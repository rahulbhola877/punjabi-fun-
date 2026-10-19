import { PhysicsBody, PhysicsMotionType, PhysicsShapeCapsule, Quaternion, Scene, TransformNode, Vector3, type Material } from "@babylonjs/core";
import { Group } from "../app/config";
import type { Physics } from "../physics/Physics";
import { buildHuman, type Appearance, type BuiltHuman } from "../characters/HumanBuilder";
import { HumanAnimator, type BasePose, type Gesture } from "../characters/HumanAnimator";
import { NAMED, randomAppearance } from "../characters/appearances";
import { buildWalkGraph, type NavGraph } from "../world/nav";
import { OBSTACLES } from "../world/props";
import { Rng } from "../render/textures";
import { COURTYARD } from "../world/layout";

export type Role = "walker" | "keeper" | "seated" | "chatter" | "child";
/** Subtle per-person temperament affecting reactions (and later, powers). */
export type Affinity = "calm" | "nimble" | "curious";

export interface ResidentDef {
  id: string;
  name: string;
  role: Role;
  look: Appearance;
  x: number;
  z: number;
  yaw: number;
  y?: number;
  gesture?: Gesture;
  /** Named contacts can be talked to for jobs. */
  contact?: boolean;
  lines?: string[];
}

export interface Resident extends ResidentDef {
  human: BuiltHuman;
  anim: HumanAnimator;
  body: PhysicsBody;
  bodyNode: TransformNode;
  pos: Vector3;
  prev: Vector3;
  vel: Vector3;
  affinity: Affinity;
  speed: number;
  path: number[];
  pathI: number;
  wait: number;
  dodgeT: number;
  dodgeDir: Vector3;
  stuckT: number;
  lastProgress: Vector3;
  stuckCount: number;
  lookYaw: number;
  lookTarget: Vector3 | null;
  groundT: number;
  pose: BasePose;
  home: Vector3;
  facing: number;
  gestureT: number;
  bubbleCooldown: number;
}

export interface VehicleThreat { pos: Vector3; fwd: Vector3; speed: number; halfWidth: number; halfLen: number; isPlayer: boolean }

const REACT_LINES = ["Oye!", "Dhyaan naal!", "Hatt ja!", "Aaram naal, puttar!", "Hai rabba!", "Oh ho!"];
const HORN_LINES = ["Haan ji, haan ji…", "Ja lang ja!", "Hor ki?", "Sabar karo!"];
const GREET_LINES = [
  "Sat Sri Akal!", "Garmi bahut hai aaj — it's hot today!", "Have you tried Bhole's lassi? Best in Ranggarh.",
  "The chowk is under repair again. Every year!", "Gurnam fixed my scooter in ten minutes. Magic hands.",
  "Pammi's mangoes are sweet, but her gossip is sweeter.", "Kidda? All good?", "Watch out for the speed breakers, they're tall!",
];


/**
 * Bounded crowd of residents. Movement is kinematic (deterministic, cheap);
 * each resident carries an animated capsule so the player cannot walk
 * through them, while vehicles are handled by explicit dodge/contact logic
 * so nobody gets ragdolled across the bazaar.
 */
export class Crowd {
  residents: Resident[] = [];
  graph: NavGraph;
  private rng = new Rng(2024);
  /** Bubble requests for the UI: resident id → text. */
  bubbles: Array<{ r: Resident; text: string; t: number }> = [];
  onBump: ((r: Resident, isPlayer: boolean) => void) | null = null;
  private frameCounter = 0;

  constructor(private scene: Scene, private physics: Physics, private mat: Material) {
    this.graph = buildWalkGraph();
  }

  spawnAll(defs: ResidentDef[], addCaster: (m: import("@babylonjs/core").AbstractMesh) => void): void {
    for (const d of defs) {
      const human = buildHuman(this.scene, d.id, d.look, this.mat);
      addCaster(human.mesh);
      const anim = new HumanAnimator(human);
      const bodyNode = new TransformNode(`${d.id}_col`, this.scene);
      // Place the node BEFORE creating the body so it starts where it belongs
      // (a kinematic body dragged from the origin would sweep through everything).
      const pos = new Vector3(d.x, d.y ?? this.groundY(d.x, d.z), d.z);
      bodyNode.position.copyFrom(pos);
      const h = d.look.height;
      const shape = new PhysicsShapeCapsule(new Vector3(0, 0.3, 0), new Vector3(0, h - 0.3, 0), 0.28, this.scene);
      shape.filterMembershipMask = Group.RESIDENT;
      // Vehicles ignore residents physically (dodging is scripted); the player's controller still collides.
      shape.filterCollideMask = Group.PLAYER | Group.STATIC;
      const body = new PhysicsBody(bodyNode, PhysicsMotionType.ANIMATED, false, this.scene);
      body.shape = shape;
      body.setMassProperties({ mass: 70 });
      const aff: Affinity = d.role === "child" ? "nimble" : this.rng.pick(["calm", "nimble", "curious"] as const);
      const r: Resident = {
        ...d, human, anim, body, bodyNode, pos: pos.clone(), prev: pos.clone(), vel: new Vector3(), affinity: aff,
        speed: d.role === "child" ? 2.4 : d.look.age === "elder" ? 0.95 : this.rng.range(1.15, 1.5),
        path: [], pathI: 0, wait: this.rng.range(0, 3), dodgeT: 0, dodgeDir: new Vector3(), stuckT: 0,
        lastProgress: pos.clone(), stuckCount: 0, lookYaw: 0, lookTarget: null, groundT: 0,
        pose: d.role === "seated" ? "sit" : "stand", home: pos.clone(), facing: d.yaw, gestureT: this.rng.range(1, 6),
        bubbleCooldown: 0,
      };
      if (d.gesture) anim.play(d.gesture, 1e9);
      this.residents.push(r);
      this.placeVisual(r, 1);
    }
  }

  private groundY(x: number, z: number): number {
    const hit = this.physics.raycast(new Vector3(x, 3, z), new Vector3(x, -1, z), Group.STATIC);
    return hit ? hit.hitPointWorld.y : 0;
  }

  get(id: string): Resident | undefined {
    return this.residents.find((r) => r.id === id);
  }

  private pickDestination(r: Resident): void {
    const g = this.graph;
    let start = g.nearest(r.pos.x, r.pos.z, (n) => (r.role === "child" ? n.tag === "court" : n.kind !== "stop"));
    let goal: number;
    if (r.role === "child") {
      const ring = g.nodes.filter((n) => n.tag === "court");
      goal = this.rng.pick(ring).id;
    } else {
      const stops = g.nodes.filter((n) => n.kind === "stop");
      const walks = g.nodes.filter((n) => n.kind === "walk");
      goal = this.rng.next() < 0.45 ? this.rng.pick(stops).id : this.rng.pick(walks).id;
    }
    if (start < 0) start = 0;
    r.path = g.path(start, goal);
    r.pathI = 0;
  }

  /** Make residents near a horn react; those in the vehicle's path step aside. */
  horn(pos: Vector3, fwd: Vector3): number {
    let n = 0;
    for (const r of this.residents) {
      const d = r.pos.subtract(pos);
      const dist = Math.hypot(d.x, d.z);
      if (dist > 14) continue;
      n++;
      r.lookTarget = pos.clone();
      r.gestureT = 0;
      const ahead = d.x * fwd.x + d.z * fwd.z;
      const lat = d.x * fwd.z - d.z * fwd.x;
      if (r.role === "walker" && ahead > 0 && ahead < 10 && Math.abs(lat) < 2.2) {
        this.dodge(r, lat >= 0 ? 1 : -1, fwd, 0.7);
      } else if (dist < 6 && r.pose === "stand" && r.affinity !== "calm") {
        r.anim.play("startled", 0.6);
      }
      if (dist < 9 && r.bubbleCooldown <= 0 && this.rng.next() < 0.5) this.say(r, this.rng.pick(HORN_LINES));
    }
    return n;
  }

  private dodge(r: Resident, side: number, fwd: Vector3, t: number): void {
    if (r.pose !== "stand") return;
    r.dodgeT = t * (r.affinity === "nimble" ? 1.1 : 1);
    // Perpendicular to the vehicle's direction, plus a little backward.
    r.dodgeDir.set(fwd.z * side - fwd.x * 0.2, 0, -fwd.x * side - fwd.z * 0.2).normalize();
    if (r.affinity !== "calm" || this.rng.next() < 0.5) r.anim.play("startled", 0.7);
  }

  say(r: Resident, text: string): void {
    r.bubbleCooldown = 4;
    this.bubbles = this.bubbles.filter((b) => b.r !== r);
    this.bubbles.push({ r, text, t: 2.2 });
    if (this.bubbles.length > 4) this.bubbles.shift();
  }

  greetLine(r: Resident): string {
    if (r.lines?.length) return this.rng.pick(r.lines);
    return this.rng.pick(GREET_LINES);
  }

  fixedUpdate(dt: number, player: Vector3 | null, vehicles: VehicleThreat[]): void {
    for (const r of this.residents) {
      r.prev.copyFrom(r.pos);
      r.bubbleCooldown -= dt;
      if (r.role === "walker" || r.role === "child") this.steerWalker(r, dt, player);
      else this.updateStationary(r, dt, player);
      this.reactToVehicles(r, vehicles, dt);
      // Integrate.
      r.pos.x += r.vel.x * dt;
      r.pos.z += r.vel.z * dt;
      r.groundT -= dt;
      if (r.groundT <= 0 && r.pose === "stand") {
        r.groundT = 0.25;
        const gy = this.groundY(r.pos.x, r.pos.z);
        if (gy < 0.6) r.pos.y = gy;
      }
      const sp = Math.hypot(r.vel.x, r.vel.z);
      if (sp > 0.15) {
        const want = Math.atan2(r.vel.x, r.vel.z);
        let d = want - r.facing;
        d = Math.atan2(Math.sin(d), Math.cos(d));
        r.facing += d * (1 - Math.exp(-dt * 8));
      }
      r.bodyNode.position.copyFrom(r.pos);
      r.body.setTargetTransform(r.pos, Quaternion.Identity());
    }
  }

  private avoid(r: Resident, player: Vector3 | null): Vector3 {
    const f = new Vector3();
    // Personal space between residents.
    for (const o of this.residents) {
      if (o === r) continue;
      const dx = r.pos.x - o.pos.x, dz = r.pos.z - o.pos.z;
      const d2 = dx * dx + dz * dz;
      if (d2 < 0.81 && d2 > 1e-6) {
        const d = Math.sqrt(d2);
        f.x += (dx / d) * (0.9 - d) * 3;
        f.z += (dz / d) * (0.9 - d) * 3;
      }
    }
    if (player) {
      const dx = r.pos.x - player.x, dz = r.pos.z - player.z;
      const d = Math.hypot(dx, dz);
      if (d < 1.2 && d > 1e-3) { f.x += (dx / d) * (1.2 - d) * 3; f.z += (dz / d) * (1.2 - d) * 3; }
    }
    for (const o of OBSTACLES) {
      const dx = r.pos.x - o.x, dz = r.pos.z - o.z;
      const d = Math.hypot(dx, dz);
      const rr = o.r + 0.45;
      if (d < rr && d > 1e-3) { f.x += (dx / d) * (rr - d) * 4; f.z += (dz / d) * (rr - d) * 4; }
    }
    return f;
  }

  private steerWalker(r: Resident, dt: number, player: Vector3 | null): void {
    if (r.dodgeT > 0) {
      r.dodgeT -= dt;
      const s = r.affinity === "nimble" ? 3.6 : 2.8;
      r.vel.set(r.dodgeDir.x * s, 0, r.dodgeDir.z * s);
      return;
    }
    if (r.wait > 0) {
      r.wait -= dt;
      r.vel.scaleInPlace(Math.exp(-dt * 8));
      const av = this.avoid(r, player);
      r.vel.addInPlace(av.scale(dt * 4));
      if (r.wait <= 0) this.pickDestination(r);
      return;
    }
    if (r.pathI >= r.path.length) {
      // Arrived: browse at shops, pause elsewhere.
      const last = r.path.length ? this.graph.nodes[r.path[r.path.length - 1]!] : null;
      if (last?.kind === "stop") {
        r.wait = this.rng.range(3, 8);
        r.anim.play(this.rng.next() < 0.5 ? "work" : "talk", r.wait * 0.8);
        // Face the shop (away from the road).
        r.facing = last.x < 0 ? -Math.PI / 2 : Math.PI / 2;
      } else r.wait = this.rng.range(0.5, r.role === "child" ? 1.5 : 4);
      if (r.role === "child" && this.rng.next() < 0.3) r.anim.play("cheer", 1.2);
      return;
    }
    const n = this.graph.nodes[r.path[r.pathI]!]!;
    const dx = n.x - r.pos.x, dz = n.z - r.pos.z;
    const d = Math.hypot(dx, dz);
    if (d < 0.45) {
      r.pathI++;
      return;
    }
    const want = new Vector3((dx / d) * r.speed, 0, (dz / d) * r.speed);
    const av = this.avoid(r, player);
    want.addInPlace(av);
    // Slow when crowded ahead instead of pushing through.
    const len = Math.hypot(want.x, want.z);
    if (len > r.speed) want.scaleInPlace(r.speed / len);
    r.vel.x += (want.x - r.vel.x) * (1 - Math.exp(-dt * 6));
    r.vel.z += (want.z - r.vel.z) * (1 - Math.exp(-dt * 6));
    // Stuck detection → re-route, eventually relocate.
    r.stuckT += dt;
    if (r.stuckT > 2.5) {
      const moved = Vector3.Distance(r.pos, r.lastProgress);
      r.lastProgress.copyFrom(r.pos);
      r.stuckT = 0;
      if (moved < 0.4) {
        r.stuckCount++;
        if (r.stuckCount >= 3) this.relocate(r);
        else this.pickDestination(r);
      } else r.stuckCount = 0;
    }
  }

  /** Recovery: move a persistently blocked walker to a free node. */
  private relocate(r: Resident): void {
    const nodes = this.graph.nodes.filter((n) => n.kind === "walk" && (r.role !== "child" || n.tag === "court"));
    const n = this.rng.pick(nodes);
    r.pos.set(n.x, this.groundY(n.x, n.z), n.z);
    r.prev.copyFrom(r.pos);
    // Teleport the kinematic body (no sweep).
    r.bodyNode.position.copyFrom(r.pos);
    this.physics.plugin.setPhysicsBodyTransformation(r.body, r.bodyNode);
    r.stuckCount = 0;
    r.path = [];
    r.pathI = 0;
    r.wait = 1;
  }

  private updateStationary(r: Resident, dt: number, player: Vector3 | null): void {
    // Keepers drift back home after being nudged; dodge still works.
    if (r.dodgeT > 0) {
      r.dodgeT -= dt;
      r.vel.set(r.dodgeDir.x * 2.5, 0, r.dodgeDir.z * 2.5);
      return;
    }
    const hx = r.home.x - r.pos.x, hz = r.home.z - r.pos.z;
    r.vel.set(hx * 2, 0, hz * 2);
    if (Math.hypot(hx, hz) < 0.05) r.facing += (Math.atan2(Math.sin(r.yaw - r.facing), Math.cos(r.yaw - r.facing))) * (1 - Math.exp(-dt * 3));
    // Periodic idle gestures.
    r.gestureT -= dt;
    if (r.gestureT <= 0 && r.anim.currentGesture === "none") {
      r.gestureT = this.rng.range(3, 9);
      const g: Gesture = r.role === "seated" ? "work" : r.role === "chatter" ? "talk" : this.rng.pick(["work", "talk", "none"] as const);
      if (g !== "none") r.anim.play(g, this.rng.range(2, 4));
    }
    // Look at the player when near.
    if (player && Math.hypot(player.x - r.pos.x, player.z - r.pos.z) < 4) r.lookTarget = player.clone();
    else if (r.lookTarget && Math.hypot(r.lookTarget.x - r.pos.x, r.lookTarget.z - r.pos.z) > 15) r.lookTarget = null;
  }

  private reactToVehicles(r: Resident, vehicles: VehicleThreat[], dt: number): void {
    void dt;
    for (const v of vehicles) {
      if (v.speed < 1.2) continue;
      const dx = r.pos.x - v.pos.x, dz = r.pos.z - v.pos.z;
      const ahead = dx * v.fwd.x + dz * v.fwd.z;
      const lat = dx * v.fwd.z - dz * v.fwd.x;
      const reach = (r.affinity === "nimble" ? 1.4 : r.affinity === "calm" ? 0.9 : 1.1) * (2 + v.speed * 0.8);
      // Contact: push clear, report the bump.
      if (Math.abs(lat) < v.halfWidth + 0.3 && ahead > -v.halfLen - 0.3 && ahead < v.halfLen + 0.3) {
        const side = lat >= 0 ? 1 : -1;
        const push = v.halfWidth + 0.35 - Math.abs(lat);
        r.pos.x += v.fwd.z * side * push;
        r.pos.z += -v.fwd.x * side * push;
        this.dodge(r, side, v.fwd, 0.5);
        r.anim.play("startled", 0.9);
        if (r.bubbleCooldown <= 0) this.say(r, this.rng.pick(REACT_LINES));
        this.onBump?.(r, v.isPlayer);
        continue;
      }
      if (ahead > 0 && ahead < reach && Math.abs(lat) < v.halfWidth + 0.9 && r.dodgeT <= 0) {
        this.dodge(r, lat >= 0 ? 1 : -1, v.fwd, 0.6);
        if (r.bubbleCooldown <= 0 && this.rng.next() < 0.6) this.say(r, this.rng.pick(REACT_LINES));
      } else if (ahead > 0 && ahead < reach * 2 && Math.abs(lat) < 4) {
        r.lookTarget = v.pos.clone();
      }
    }
  }

  private placeVisual(r: Resident, alpha: number): void {
    const root = r.human.root;
    Vector3.LerpToRef(r.prev, r.pos, alpha, root.position);
    if (r.pose === "sit") root.position.y = (r.y ?? 0) + 0.07 - 0.92 * r.human.scale;
    root.rotationQuaternion = Quaternion.RotationYawPitchRoll(r.facing, 0, 0);
  }

  /** Per-frame: interpolate visuals and animate (distance-based LOD). */
  update(dt: number, alpha: number, camPos: Vector3): void {
    this.frameCounter++;
    for (const b of this.bubbles) b.t -= dt;
    this.bubbles = this.bubbles.filter((b) => b.t > 0);
    for (let i = 0; i < this.residents.length; i++) {
      const r = this.residents[i]!;
      this.placeVisual(r, alpha);
      const dist = Vector3.Distance(camPos, r.pos);
      const every = dist > 45 ? 4 : dist > 22 ? 2 : 1;
      if ((this.frameCounter + i) % every !== 0) continue;
      let look = 0;
      if (r.lookTarget) {
        const a = Math.atan2(r.lookTarget.x - r.pos.x, r.lookTarget.z - r.pos.z);
        look = Math.atan2(Math.sin(a - r.facing), Math.cos(a - r.facing));
        if (Math.abs(look) > 1.6) look = 0;
      }
      r.lookYaw += (look - r.lookYaw) * Math.min(1, dt * every * 5);
      r.anim.update(dt * every, {
        speed: Math.hypot(r.vel.x, r.vel.z), grounded: true, pose: r.pose, carry: false, lookYaw: r.lookYaw,
      });
      r.human.mesh.isVisible = dist < 120;
    }
  }

  dispose(): void {
    for (const r of this.residents) {
      r.body.dispose();
      r.bodyNode.dispose();
      r.human.root.dispose();
    }
    this.residents = [];
  }
}

/** The bazaar's population for Milestone 1. */
export function residentDefs(seats: Array<{ x: number; y: number; z: number; yaw: number }>, dhabaWorld: (u: number, v: number) => { x: number; z: number }): ResidentDef[] {
  const defs: ResidentDef[] = [];
  const counter = dhabaWorld(13.7, -3.9);
  const cook = dhabaWorld(6.3, -10.5);
  const E = Math.PI / 2, W = -Math.PI / 2;
  defs.push({ id: "bhola", name: "Bhola Singh", role: "keeper", look: NAMED.bhola!, x: counter.x, z: counter.z, yaw: E, contact: true });
  defs.push({ id: "cook", name: "Kaku the cook", role: "keeper", look: { ...randomAppearance(77), sex: "m", top: "vest", vest: "#f0ead8", topColor: "#f0ead8", headwear: "patka", headColor: "#f3f3f3", age: "adult", apron: "#e0d6c0", beard: "mustache", hair: "short", height: 1.7 }, x: cook.x, z: cook.z, yaw: E, gesture: "work", lines: ["Tandoor is hot — mind your fingers!", "One more paratha coming up!"] });
  defs.push({ id: "gurnam", name: "Gurnam Kaur", role: "keeper", look: NAMED.gurnam!, x: 12.3, z: 21.6, yaw: W, contact: true });
  defs.push({ id: "pammi", name: "Pammi", role: "keeper", look: NAMED.pammi!, x: 6.7, z: -51.5, yaw: W, contact: true, lines: ["Fresh kinnow from Abohar! Sweet as gur!", "Have you heard? Sohal is planning a cycle race!"] });
  defs.push({ id: "masterji", name: "Masterji", role: "keeper", look: NAMED.masterji!, x: 7.9, z: -34, yaw: W, contact: true, lines: ["Measure twice, cut once. Measure three times if it's a wedding.", "Your kurta is a size too big, puttar."] });
  defs.push({ id: "sohal", name: "Sohal", role: "keeper", look: NAMED.sohal!, x: -5.55, z: -1.6, yaw: E, contact: true, lines: ["A good chain and a good heart — that's all a cycle needs.", "One day I'll race you to the gate!"] });
  defs.push({ id: "mrsKaur", name: "Mrs. Kaur", role: "keeper", look: { ...randomAppearance(501), sex: "f", top: "kameez", topColor: "#3949ab", bottom: "salwar", bottomColor: "#f6efe0", dupatta: "#ffffff", age: "elder", hair: "bun", hairColor: "#cfcac2", headwear: "none", beard: "none", height: 1.58 }, x: -44.3, z: -8, yaw: E, contact: true, lines: ["Come, sit — have some chai.", "My grandson only eats Bhole's parathas."] });
  defs.push({ id: "gill", name: "Gill uncle", role: "keeper", look: { ...randomAppearance(613), sex: "m", age: "elder", headwear: "turban", headColor: "#f3f3f3", beard: "full", top: "kurta", topColor: "#e9d8a6", bottom: "pajama", bottomColor: "#f1ece0", height: 1.75 }, x: -29.5, z: -6.4, yaw: Math.PI, contact: true, lines: ["In my day the lane was dirt, and we were happy.", "Tell Bhola less salt!"] });
  defs.push({ id: "chemist", name: "Dr. Sehgal", role: "keeper", look: { ...randomAppearance(701), sex: "m", top: "shirt", topColor: "#ffffff", bottom: "trousers", bottomColor: "#4a4a4a", age: "adult", headwear: "none", beard: "mustache", height: 1.72 }, x: -7.9, z: 19, yaw: E, contact: true, lines: ["Drink water, it's hot out there.", "No, I don't have medicine for spicy food regret."] });
  for (const [id, x, z, yaw, seed] of [["kiryana", -7.9, -56.5, E, 801], ["sweets", -7.9, -22, E, 802], ["hardware", 7.9, -6, W, 803], ["phone", -7.9, 42, E, 804], ["textile", -7.9, -46.5, E, 805]] as const) {
    defs.push({ id: `keeper_${id}`, name: "Shopkeeper", role: "keeper", look: randomAppearance(seed), x, z, yaw });
  }
  // Seated diners at the dhaba.
  seats.filter((_s, i) => i % 3 === 0).slice(0, 4).forEach((s, i) => {
    defs.push({ id: `diner${i}`, name: "Diner", role: "seated", look: randomAppearance(900 + i * 7), x: s.x, z: s.z, y: s.y, yaw: s.yaw });
  });
  // A chatting pair by the neem tree.
  defs.push({ id: "chatA", name: "Neighbour", role: "chatter", look: randomAppearance(1201), x: 5.4, z: -45.6, yaw: Math.PI });
  defs.push({ id: "chatB", name: "Neighbour", role: "chatter", look: randomAppearance(1207), x: 5.4, z: -46.8, yaw: 0 });
  // Kids in the courtyard.
  for (let i = 0; i < 2; i++) {
    const look = randomAppearance(1300 + i * 11);
    defs.push({ id: `kid${i}`, name: "Kid", role: "child", look: { ...look, age: "child", height: 1.2 + i * 0.12, beard: "none", headwear: look.sex === "m" ? "patka" : "none" }, x: (COURTYARD.x0 + COURTYARD.x1) / 2 + 3, z: -12 + i * 6, yaw: 0 });
  }
  // Walkers spread along both footpaths.
  for (let i = 0; i < 12; i++) {
    const side = i % 2 ? 5.15 : -5.15;
    defs.push({ id: `walker${i}`, name: "Resident", role: "walker", look: randomAppearance(100 + i * 13), x: side, z: -66 + i * 9.3, yaw: 0 });
  }
  return defs;
}
