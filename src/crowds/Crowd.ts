import { PhysicsBody, PhysicsMotionType, PhysicsShapeCapsule, Quaternion, Scene, TransformNode, Vector3, type Material } from "../babylon";
import { Group } from "../app/config";
import type { Physics } from "../physics/Physics";
import { buildHuman, type Appearance, type BuiltHuman } from "../characters/HumanBuilder";
import { HumanAnimator, type BasePose, type Gesture } from "../characters/HumanAnimator";
import { NAMED, constableLook, randomAppearance } from "../characters/appearances";
import { buildWalkGraph, type NavGraph } from "../world/nav";
import { OBSTACLES } from "../world/props";
import { Rng } from "../render/textures";
import { COURTYARD } from "../world/layout";
import { openPlotAt } from "../world/openHouses";
import type { CallKind } from "./Barkers";
import { VoiceDirector } from "../audio/VoiceDirector";
import { Umbrellas } from "./umbrellas";
import type { InstancedMesh } from "../babylon";
import { KitHuman, type KitLook } from "../characters/KitHuman";
import { KitAnimator } from "../characters/KitAnimator";
import { Character } from "../kit/character";
import type { Archetype } from "../kit/rig";
import { kitLookFor, kitLookKey } from "./kitLooks";

export type Role = "walker" | "keeper" | "seated" | "chatter" | "child" | "roamer";
/** Who a person sides with when fists fly. */
export type Faction = "civilian" | "police" | "lafanga" | "wrestler";
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
  /** Stands on a roof: keeps its height (not snapped to the street below). */
  onRoof?: boolean;
  /** Flying a kite: both hands up on the string. */
  kite?: boolean;
  /** Holds a flag or a nishan upright (processions). */
  pole?: boolean;
  /** Plays a dhol slung on the belly (a baraat's dholi). */
  dhol?: boolean;
  gesture?: Gesture;
  /** Named contacts can be talked to for jobs. */
  contact?: boolean;
  /** Keeps a real shop (says the "aao ji, aao" shop lines at its front). */
  shop?: boolean;
  lines?: string[];
  /** Walkers: the pedestrian network they use (default: the bazaar's). */
  graph?: NavGraph;
  /** Roamers: wander inside this rectangle. */
  wander?: { x0: number; x1: number; z0: number; z1: number };
  faction?: Faction;
  /** Toughness multiplier for fights (1 = an ordinary resident). */
  tough?: number;
  /** Street sellers and touts: what they are selling (see crowds/Barkers.ts). */
  callKind?: CallKind;
  /** The lines they call out; picked at random, one at a time. */
  calls?: string[];
  /** A recorded take in public/audio/voice, used instead of the synth cry. */
  callClip?: string;
  /** A chosen kit look (the family at home); otherwise one is picked to match `look`. */
  kitLook?: KitLook;
  /** Lives inside an open house (the family, the one at home): never borrowed by street events. */
  indoor?: boolean;
}

export interface Resident extends ResidentDef {
  /** A chhatri held up in the rain. */
  chhatri?: InstancedMesh;
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
  /** When set, replaces the role's movement each step (fights, chases, quarrels). */
  brain: ((r: Resident, dt: number) => void) | null;
  hp: number;
  maxHp: number;
  /** The kit body drawn instead of the old one while this person is near and in view. */
  kit?: KitBody;
  /** Children the old body's root has of its own (more means a prop is attached: keep the old body). */
  baseChildren: number;
}

/**
 * Free for a street event (a quarrel, a fight, onlookers): out on the street,
 * nobody's family at home, not already busy.
 */
export function streetFree(r: Resident): boolean {
  return !r.brain && !r.indoor && !r.contact && r.pose !== "down" && !openPlotAt(r.pos.x, r.pos.z, 0.5);
}

/** A kit character standing in for a resident's old body. */
export interface KitBody { h: KitHuman; a: KitAnimator; key: string; size: number; away: number }

export interface VehicleThreat { pos: Vector3; fwd: Vector3; speed: number; halfWidth: number; halfLen: number; isPlayer: boolean }

const REACT_LINES = [
  "Oye!", "Dhyaan naal!", "Hatt ja!", "Aaram naal, puttar!", "Hai rabba!", "Oh ho!",
  "Fuddu ho gia hai?!", "Andha ae ke?", "Marwaa dena si!", "Bapu di sadak ae?",
  "Licence mele ton liya?", "Hai meri maa!",
];
const HORN_LINES = [
  "Haan ji, haan ji…", "Ja lang ja!", "Hor ki?", "Sabar karo!",
  "Horn vajaa ke ki sadak chaudi ho jaugi?", "Oye pom-pom band kar!",
];
const GREET_LINES = [
  "Sat Sri Akal!", "Garmi bahut hai aaj — it's hot today!", "Have you tried Bhole's lassi? Best in Ranggarh.",
  "The chowk is under repair again. Every year!", "Gurnam fixed my scooter in ten minutes. Magic hands.",
  "Pammi's mangoes are sweet, but her gossip is sweeter.", "Kidda? All good?", "Watch out for the speed breakers, they're tall!",
  "Ludhiane di sadak? Bas, uthe taan poora fuddu ho gia hai traffic!", "Bijli gayi hoi ae subah ton.",
  "Auto wale ne aaj dugna maangeya. Lutt machi ae!", "Naali da kam kal ton shuru hona si. Kal kade nahi aunda.",
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
  /** How hard it is raining (0..1), set by the game: chhatris come out, the rest hurry. */
  rain = 0;
  private umbrellas: Umbrellas;

  constructor(private scene: Scene, private physics: Physics, private mat: Material) {
    this.graph = buildWalkGraph();
    this.umbrellas = new Umbrellas(scene, mat);
  }

  /** About half the people walking about own a chhatri and bring it out in the rain. */
  private static hasUmbrella(r: Resident): boolean {
    if (r.role !== "walker" && r.role !== "roamer") return false;
    let h = 0;
    for (let i = 0; i < r.id.length; i++) h = (h * 31 + r.id.charCodeAt(i)) | 0;
    return Math.abs(h) % 100 < 45;
  }

  /** Walking pace now: people without a chhatri hurry through the rain. */
  private pace(r: Resident): number {
    return this.rain > 0.3 && !r.chhatri && (r.role === "walker" || r.role === "roamer") && r.look.age !== "elder" ? r.speed * 1.7 : r.speed;
  }

  private updateUmbrella(r: Resident, dist: number): void {
    const want = this.rain > 0.3 && r.pose === "stand" && !r.brain && dist < 90 && Crowd.hasUmbrella(r);
    if (want && !r.chhatri) {
      const u = this.umbrellas.make(r.id.length * 7 + r.id.charCodeAt(r.id.length - 1));
      // Upright on the body (not the bone), handle at the raised right hand,
      // canopy over the head whatever the arm is doing.
      u.parent = r.human.root;
      u.position.set(0.1, 1.32, 0.16);
      u.rotation.set(0, 0, 0.12);
      r.chhatri = u;
    } else if (r.chhatri && (!want && dist > 110 || this.rain < 0.1 || r.brain || r.pose !== "stand")) {
      r.chhatri.dispose();
      r.chhatri = undefined;
    }
  }

  private addCaster: (m: import("../babylon").AbstractMesh) => void = () => {};
  removeCaster: (m: import("../babylon").AbstractMesh) => void = () => {};

  spawnAll(defs: ResidentDef[], addCaster: (m: import("../babylon").AbstractMesh) => void): void {
    this.addCaster = addCaster;
    for (const d of defs) this.spawn(d);
  }

  /** Add one person to the world (also used for police, rivals and drivers at runtime). */
  spawn(d: ResidentDef): Resident {
    {
      const human = buildHuman(this.scene, d.id, d.look, this.mat);
      this.addCaster(human.mesh);
      const anim = new HumanAnimator(human);
      const bodyNode = new TransformNode(`${d.id}_col`, this.scene);
      // Place the node BEFORE creating the body so it starts where it belongs
      // (a kinematic body dragged from the origin would sweep through everything).
      const pos = new Vector3(d.x, d.y ?? this.groundY(d.x, d.z), d.z);
      bodyNode.position.copyFrom(pos);
      const h = d.look.height;
      const shape = new PhysicsShapeCapsule(new Vector3(0, 0.3, 0), new Vector3(0, h - 0.3, 0), 0.28, this.scene);
      shape.filterMembershipMask = Group.RESIDENT;
      // Nobody collides with residents physically: vehicles dodge them by script and
      // residents step aside for the player, so a person can never trap the player.
      shape.filterCollideMask = Group.STATIC;
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
        bubbleCooldown: 0, brain: null, hp: 100 * (d.tough ?? 1), maxHp: 100 * (d.tough ?? 1),
        baseChildren: human.root.getChildren().length,
      };
      // Gestures reach the kit body too when one is drawn.
      const play = anim.play.bind(anim);
      anim.play = (g, dur) => { play(g, dur); r.kit?.a.play(g, dur); };
      if (d.gesture) anim.play(d.gesture, 1e9);
      this.residents.push(r);
      this.placeVisual(r, 1);
      return r;
    }
  }

  /** Take a person out of the world (despawned rivals, police who left). */
  remove(r: Resident): void {
    const i = this.residents.indexOf(r);
    if (i < 0) return;
    this.residents.splice(i, 1);
    this.bubbles = this.bubbles.filter((b) => b.r !== r);
    this.dropKit(r, true);
    this.removeCaster(r.human.mesh);
    r.chhatri?.dispose();
    r.body.dispose();
    r.bodyNode.dispose();
    r.human.root.dispose();
  }

  /** Teleport someone (kinematic body moved without sweeping). */
  place(r: Resident, x: number, z: number): void {
    r.pos.set(x, this.groundY(x, z), z);
    r.prev.copyFrom(r.pos);
    r.bodyNode.position.copyFrom(r.pos);
    this.physics.teleport(r.body, r.bodyNode);
  }

  private groundY(x: number, z: number): number {
    const hit = this.physics.raycast(new Vector3(x, 3, z), new Vector3(x, -1, z), Group.STATIC);
    return hit ? hit.hitPointWorld.y : 0;
  }

  get(id: string): Resident | undefined {
    return this.residents.find((r) => r.id === id);
  }

  private pickDestination(r: Resident): void {
    const g = r.graph ?? this.graph;
    if (!g.nodes.length) return;
    let start = g.nearest(r.pos.x, r.pos.z, (n) => (r.role === "child" ? n.tag === "court" : n.kind !== "stop"));
    // Not every sub-graph has every kind of node: a lane of houses has no
    // shop fronts, a mohalla has no playing field. Picking out of an empty
    // list threw out of the whole frame — so the rest of the game's update
    // was skipped on that tick, which is a stutter you can feel and a crowd
    // that stops dead. Fall back to any node instead.
    const any = g.nodes;
    const pickFrom = (...lists: typeof any[]) => {
      for (const l of lists) if (l.length) return this.rng.pick(l).id;
      return any[0]!.id;
    };
    let goal: number;
    if (r.role === "child") {
      goal = pickFrom(g.nodes.filter((n) => n.tag === "court"), g.nodes.filter((n) => n.kind === "walk"), any);
    } else {
      const stops = g.nodes.filter((n) => n.kind === "stop");
      const walks = g.nodes.filter((n) => n.kind === "walk");
      goal = this.rng.next() < 0.45 ? pickFrom(stops, walks, any) : pickFrom(walks, stops, any);
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

  /** Called for every spoken line, so the game can play a matching recording. */
  onLine: ((r: Resident, text: string) => void) | null = null;

  say(r: Resident, text: string): void {
    this.onLine?.(r, text);
    r.bubbleCooldown = 4;
    this.bubbles = this.bubbles.filter((b) => b.r !== r);
    this.bubbles.push({ r, text, t: 2.2 });
    if (this.bubbles.length > 4) this.bubbles.shift();
  }

  greetLine(r: Resident): string {
    // Named characters say only their own lines from the voice map.
    if (r.contact) { const own = VoiceDirector.linesFor(r.id); if (own.length) return this.rng.pick(own); }
    if (r.lines?.length) return this.rng.pick(r.lines);
    return this.rng.pick(GREET_LINES);
  }

  /** Street folk who wandered (or were pushed) into an open house's plot go back out of its gate. */
  private keepOut(r: Resident): void {
    if (r.indoor || r.onRoof) return;
    const h = openPlotAt(r.pos.x, r.pos.z, -0.2);
    if (!h) return;
    this.place(r, h.out.x, h.out.z);
    r.path = [];
    r.pathI = 0;
    r.wait = 0.5;
  }

  fixedUpdate(dt: number, player: Vector3 | null, vehicles: VehicleThreat[]): void {
    for (const r of this.residents) {
      r.prev.copyFrom(r.pos);
      r.bubbleCooldown -= dt;
      if (r.brain) r.brain(r, dt);
      else if (r.role === "walker" || r.role === "child") this.steerWalker(r, dt, player);
      else if (r.role === "roamer") this.steerRoamer(r, dt, player);
      else this.updateStationary(r, dt, player);
      if (r.pose !== "down") this.reactToVehicles(r, vehicles, dt);
      // Integrate.
      r.pos.x += r.vel.x * dt;
      r.pos.z += r.vel.z * dt;
      r.groundT -= dt;
      if (r.groundT <= 0 && !r.onRoof && (r.pose === "stand" || r.pose === "down")) {
        r.groundT = 0.25;
        this.keepOut(r);
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

  avoid(r: Resident, player: Vector3 | null): Vector3 {
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
    for (const o of Math.abs(r.pos.x) < 60 && Math.abs(r.pos.z) < 90 ? OBSTACLES : []) {
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
      const last = r.path.length ? (r.graph ?? this.graph).nodes[r.path[r.path.length - 1]!] : null;
      if (last?.kind === "stop") {
        r.wait = this.rng.range(3, 8);
        r.anim.play(this.rng.next() < 0.5 ? "work" : "talk", r.wait * 0.8);
        // Face the shop (away from the road).
        r.facing = last.x < 0 ? -Math.PI / 2 : Math.PI / 2;
      } else r.wait = this.rng.range(0.5, r.role === "child" ? 1.5 : 4);
      if (r.role === "child" && this.rng.next() < 0.3) r.anim.play("cheer", 1.2);
      return;
    }
    const g = r.graph ?? this.graph;
    const n = g.nodes[r.path[r.pathI]!]!;
    const dx = n.x - r.pos.x, dz = n.z - r.pos.z;
    const d = Math.hypot(dx, dz);
    if (d < 0.45) {
      r.pathI++;
      return;
    }
    const sp = this.pace(r);
    const want = new Vector3((dx / d) * sp, 0, (dz / d) * sp);
    const av = this.avoid(r, player);
    want.addInPlace(av);
    // Slow when crowded ahead instead of pushing through.
    const len = Math.hypot(want.x, want.z);
    if (len > sp) want.scaleInPlace(sp / len);
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

  /** Roamers amble between random points of their area (farmers, villagers). */
  private steerRoamer(r: Resident, dt: number, player: Vector3 | null): void {
    const a = r.wander;
    if (!a) { this.updateStationary(r, dt, player); return; }
    if (r.dodgeT > 0) { r.dodgeT -= dt; r.vel.set(r.dodgeDir.x * 2.6, 0, r.dodgeDir.z * 2.6); return; }
    if (r.wait > 0) {
      r.wait -= dt;
      r.vel.scaleInPlace(Math.exp(-dt * 8));
      if (r.wait <= 0) r.home.set(this.rng.range(a.x0, a.x1), 0, this.rng.range(a.z0, a.z1));
      return;
    }
    const dx = r.home.x - r.pos.x, dz = r.home.z - r.pos.z;
    const d = Math.hypot(dx, dz);
    if (d < 0.5) {
      r.wait = this.rng.range(3, 9);
      if (this.rng.next() < 0.6) r.anim.play(this.rng.next() < 0.7 ? "work" : "talk", r.wait * 0.8);
      return;
    }
    const sp = this.pace(r) * 0.8;
    const want = new Vector3((dx / d) * sp, 0, (dz / d) * sp).addInPlace(this.avoid(r, player));
    r.vel.x += (want.x - r.vel.x) * (1 - Math.exp(-dt * 5));
    r.vel.z += (want.z - r.vel.z) * (1 - Math.exp(-dt * 5));
    // Roamers walk at a point rather than along the path network, so nothing
    // re-routes them when a wall, a cart or a parked tractor sits in the way:
    // without this they lean into it for ever. Pick somewhere else instead.
    r.stuckT += dt;
    if (r.stuckT > 2.5) {
      const moved = Vector3.Distance(r.pos, r.lastProgress);
      r.lastProgress.copyFrom(r.pos);
      r.stuckT = 0;
      if (moved < 0.35) {
        r.stuckCount++;
        // Three failures and the corner it is in is the problem, not the
        // target: go back to the middle of its patch and start again.
        if (r.stuckCount >= 3) {
          r.stuckCount = 0;
          r.home.set((a.x0 + a.x1) / 2, 0, (a.z0 + a.z1) / 2);
          this.place(r, r.home.x, r.home.z);
          r.wait = 0.5;
        } else {
          r.home.set(this.rng.range(a.x0, a.x1), 0, this.rng.range(a.z0, a.z1));
        }
      } else r.stuckCount = 0;
    }
  }

  /** Recovery: move a persistently blocked walker to a free node. */
  private relocate(r: Resident): void {
    const g = r.graph ?? this.graph;
    // Same trap as pickDestination: a sub-graph need not have a playing field
    // or even a "walk" node, and picking from nothing threw the frame away.
    const nodes = g.nodes.filter((n) => n.kind === "walk" && (r.role !== "child" || n.tag === "court"));
    const pool = nodes.length ? nodes : g.nodes.filter((n) => n.kind === "walk");
    if (!pool.length && !g.nodes.length) return;
    const n = this.rng.pick(pool.length ? pool : g.nodes);
    r.pos.set(n.x, this.groundY(n.x, n.z), n.z);
    r.prev.copyFrom(r.pos);
    // Teleport the kinematic body (no sweep).
    r.bodyNode.position.copyFrom(r.pos);
    this.physics.teleport(r.body, r.bodyNode);
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
    // Step aside when the player squeezes past, then drift back (diners stay seated).
    if (player && r.role !== "seated") {
      const dx = r.pos.x - player.x, dz = r.pos.z - player.z;
      const d = Math.hypot(dx, dz);
      if (d < 0.8 && d > 1e-3) {
        r.vel.x = (dx / d) * (0.8 - d) * 7;
        r.vel.z = (dz / d) * (0.8 - d) * 7;
      }
    }
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
    if (r.kit) {
      // Hips on the seat like the old body's; the root's own scale is undone.
      const k = r.kit, hs = r.human.scale;
      k.h.root.position.y = r.pose === "sit" ? (0.92 * hs - 0.92 * k.h.scale * k.size) / hs : 0;
    }
  }

  // ------------------------------------------------------------ kit bodies

  /** How many residents may wear a kit body at once, and how near they must be (set from the graphics preset). */
  kitMax = 0;
  kitRange = 30;
  kitMat: Material | null = null;
  private kitPool: KitBody[] = [];
  private kitT = 0;
  private kitWanted: Resident[] = [];
  private kitLooks = new Map<string, KitLook>();
  private kitBuilds = 0;
  private buildT = 0;
  private kitBuildMs = 0;
  private kitBuildMax = 0;
  /** Archetypes whose clips are baked (the first character of a kind costs ~0.1–0.3 s). */
  private kitWarm = new Set<Archetype>();
  private warmQueue: Archetype[] = ["male", "female", "uncle", "aunty", "boy", "girl"];
  private warmT = 0;

  /** Bake one archetype's clips now (loading screen, or a quiet moment later). Returns false when all are done. */
  warmKit(): boolean {
    const a = this.warmQueue.shift();
    if (!a) return false;
    if (!this.kitWarm.has(a)) new Character({ archetype: a }).dispose();
    this.kitWarm.add(a);
    return this.warmQueue.length > 0;
  }

  private kitEligible(r: Resident): boolean {
    return !r.pole && !r.dhol && !r.kite && !r.onRoof && !r.chhatri && r.pose !== "ride" && r.pose !== "drive"
      && r.human.root.getChildren().length <= r.baseChildren + (r.kit ? 1 : 0);
  }

  private lookOf(r: Resident): KitLook {
    let l = this.kitLooks.get(r.id) ?? r.kitLook;
    if (!l) {
      // A child behind a counter was the old random look's doing: keepers are grown-ups.
      const look = r.role === "keeper" && r.look.age === "child" ? { ...r.look, age: "adult" as const } : r.look;
      l = kitLookFor(r.id, look, r.faction === "police", r.role === "seated");
      this.kitLooks.set(r.id, l);
    }
    return l;
  }

  /** Put a kit body on someone: from the pool when the same look is there, else built (the costly part). */
  private giveKit(r: Resident, build: boolean): boolean {
    const look = this.lookOf(r);
    const key = kitLookKey(look);
    let k: KitBody | undefined;
    const pi = this.kitPool.findIndex((p) => p.key === key);
    if (pi >= 0) k = this.kitPool.splice(pi, 1)[0]!;
    else if (build && this.kitWarm.has(look.archetype) && this.kitMat) {
      const t0 = performance.now();
      const h = new KitHuman(this.scene, `${r.id}_kit`, look, this.kitMat);
      const ms = performance.now() - t0;
      this.kitBuilds++; this.kitBuildMs += ms; this.kitBuildMax = Math.max(this.kitBuildMax, ms);
      k = { h, a: new KitAnimator(h), key, size: 1, away: 0 };
    }
    if (!k) return false;
    // Their own height, within what still looks like the kit's proportions.
    k.size = Math.max(0.93, Math.min(1.07, r.look.height / (1.72 * k.h.scale)));
    k.h.root.parent = r.human.root;
    k.h.root.position.set(0, 0, 0);
    k.h.root.rotationQuaternion = null;
    k.h.root.rotation.set(0, 0, 0);
    k.h.root.scaling.setAll(k.size / r.human.scale);
    k.h.root.setEnabled(true);
    k.a = new KitAnimator(k.h);
    k.away = 0;
    r.kit = k;
    r.human.mesh.isVisible = false;
    this.removeCaster(r.human.mesh);
    this.addCaster(k.h.mesh);
    const left = r.anim.gestureLeft;
    if (left > 0) k.a.play(r.anim.currentGesture, left);
    this.placeVisual(r, 1);
    return true;
  }

  /** Back to the old body; the kit body waits in the pool (or is thrown away). */
  private dropKit(r: Resident, dispose = false): void {
    const k = r.kit;
    if (!k) return;
    r.kit = undefined;
    this.removeCaster(k.h.mesh);
    this.addCaster(r.human.mesh);
    r.human.mesh.isVisible = true;
    k.h.root.parent = null;
    k.h.root.setEnabled(false);
    if (dispose) { k.h.dispose(); return; }
    this.kitPool.push(k);
    while (this.kitPool.length > 14) this.kitPool.shift()!.h.dispose();
  }

  /**
   * Who wears a kit body: the nearest people in front of the camera (facing
   * it counts a little extra), up to kitMax. Re-chosen a few times a second
   * with some stickiness so nobody flickers between bodies; at most one new
   * body is built per frame.
   */
  private updateKit(dt: number, camPos: Vector3): void {
    if (this.warmQueue.length) {
      this.warmT -= dt;
      if (this.warmT <= 0) { this.warmT = 0.5; this.warmKit(); }
    }
    if (this.kitMax <= 0) {
      for (const r of this.residents) if (r.kit) this.dropKit(r, true);
      return;
    }
    this.kitT -= dt;
    if (this.kitT <= 0) {
      this.kitT = 0.3;
      const cam = this.scene.activeCamera;
      const fwd = cam ? cam.getDirection(Vector3.Forward()) : Vector3.Forward();
      const fl = Math.hypot(fwd.x, fwd.z) || 1;
      const fx = fwd.x / fl, fz = fwd.z / fl;
      const scored: Array<{ r: Resident; s: number }> = [];
      for (const r of this.residents) {
        const dx = r.pos.x - camPos.x, dz = r.pos.z - camPos.z;
        const d = Math.hypot(dx, dz);
        const range = this.kitRange + (r.kit ? 8 : 0);
        if (d > range || !this.kitEligible(r)) continue;
        const inView = d < 4 || (dx * fx + dz * fz) / Math.max(d, 1e-3) > (r.kit ? 0.2 : 0.4);
        // Someone already dressed keeps it while you glance away (a turn of the camera must not rebuild everybody).
        if (r.kit) { r.kit.away = inView ? 0 : r.kit.away + 0.3; if (r.kit.away > 4) continue; }
        else if (!inView) continue;
        // Facing the camera: they turn their face to you, so they get the detail first.
        const facing = -(Math.sin(r.facing) * dx + Math.cos(r.facing) * dz) / Math.max(d, 1e-3);
        scored.push({ r, s: d - facing * 3 - (r.kit ? 6 : 0) });
      }
      scored.sort((a, b) => a.s - b.s);
      this.kitWanted = scored.slice(0, this.kitMax).map((e) => e.r);
      const keep = new Set(this.kitWanted);
      for (const r of this.residents) if (r.kit && !keep.has(r)) this.dropKit(r);
    }
    this.buildT -= dt;
    let built = 0, reused = 0;
    for (const r of this.kitWanted) {
      if (r.kit || !this.residents.includes(r)) continue;
      if (!this.kitEligible(r)) continue;
      // Reusing a pooled body is cheap; building one is ~10–30 ms, so one a frame.
      if (reused < 3 && this.giveKit(r, false)) { reused++; continue; }
      // Builds are spaced out too, so a crowd coming into view never costs more than one in a few frames.
      if (built < 1 && this.buildT <= 0 && this.giveKit(r, true)) { built++; this.buildT = 0.12; }
      if (built >= 1 && reused >= 3) break;
    }
  }

  /** Snapshot for the probe: who wears a kit body. */
  kitInfo(): { max: number; on: number; pool: number; builds: number; buildMs: number; buildMax: number; warm: string[]; people: Array<{ id: string; look: string }> } {
    const on = this.residents.filter((r) => r.kit);
    return { max: this.kitMax, on: on.length, pool: this.kitPool.length, builds: this.kitBuilds, buildMs: Math.round(this.kitBuildMs / Math.max(1, this.kitBuilds)), buildMax: Math.round(this.kitBuildMax), warm: [...this.kitWarm], people: on.map((r) => ({ id: r.id, look: r.kit!.key.split("|").slice(0, 2).join(" ") })) };
  }

  /** Per-frame: interpolate visuals and animate (distance-based LOD). */
  update(dt: number, alpha: number, camPos: Vector3): void {
    this.frameCounter++;
    for (const b of this.bubbles) b.t -= dt;
    this.bubbles = this.bubbles.filter((b) => b.t > 0);
    this.updateKit(dt, camPos);
    for (let i = 0; i < this.residents.length; i++) {
      const r = this.residents[i]!;
      this.placeVisual(r, alpha);
      const dist = Vector3.Distance(camPos, r.pos);
      this.updateUmbrella(r, dist);
      const every = dist > 70 ? 6 : dist > 45 ? 4 : dist > 22 ? 2 : 1;
      if ((this.frameCounter + i) % every !== 0) continue;
      let look = 0;
      if (r.lookTarget) {
        const a = Math.atan2(r.lookTarget.x - r.pos.x, r.lookTarget.z - r.pos.z);
        look = Math.atan2(Math.sin(a - r.facing), Math.cos(a - r.facing));
        if (Math.abs(look) > 1.6) look = 0;
      }
      r.lookYaw += (look - r.lookYaw) * Math.min(1, dt * every * 5);
      const inp = {
        speed: Math.hypot(r.vel.x, r.vel.z), grounded: true, pose: r.pose, carry: false, lookYaw: r.lookYaw, umbrella: !!r.chhatri, kite: r.kite, pole: r.pole, dhol: r.dhol,
      };
      if (r.kit) {
        // Something now needs the old body (a chhatri, a flag...): swap back.
        if (!this.kitEligible(r)) this.dropKit(r);
        else { r.anim.tick(dt * every); r.kit.a.update(dt * every, inp); continue; }
      }
      r.human.mesh.isVisible = dist < 140;
      if (dist > 160) continue;
      r.anim.update(dt * every, inp);
    }
  }

  dispose(): void {
    for (const r of this.residents) {
      this.dropKit(r, true);
      r.body.dispose();
      r.bodyNode.dispose();
      r.chhatri?.dispose();
      r.human.root.dispose();
    }
    this.residents = [];
    for (const k of this.kitPool) k.h.dispose();
    this.kitPool = [];
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
    defs.push({ id: `keeper_${id}`, name: "Shopkeeper", role: "keeper", shop: true, look: randomAppearance(seed), x, z, yaw });
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
  for (let i = 0; i < 20; i++) {
    const side = i % 2 ? 5.15 : -5.15;
    defs.push({ id: `walker${i}`, name: "Resident", role: "walker", look: randomAppearance(100 + i * 13), x: side, z: -66 + i * 5.7, yaw: 0 });
  }
  // Two constables on their beat (they come running if there is trouble).
  for (let i = 0; i < 2; i++) {
    defs.push({ id: `beat${i}`, name: "Constable", role: "walker", faction: "police", tough: 1.4, look: constableLook(40 + i), x: i ? 5.15 : -5.15, z: i ? 30 : -40, yaw: 0, lines: ["Sab theek? Koi gal nahi.", "Gaddi side te lao, ji!", "Bazaar ch dheere chalo!"] });
  }
  return defs;
}
