import { Vector3, type Scene, type Material, type TransformNode, type Mesh } from "../babylon";
import type { Materials } from "../render/Materials";
import { addMilkCans, buildTrolley, type TrolleyLoad } from "../vehicles/models";
import type { Vehicle } from "../vehicles/Vehicle";
import type { VehicleType } from "../vehicles/specs";
import { buildHuman, type BuiltHuman } from "../characters/HumanBuilder";
import { HumanAnimator } from "../characters/HumanAnimator";
import { randomAppearance } from "../characters/appearances";
import { AIDriver, isBazaarRoad, laneOffset } from "./AIDriver";
import type { NavGraph } from "../world/nav";
import { Rng } from "../render/textures";
import { LUDHIANA, TOWN, defectAt, inRectR } from "../world/region";
import { lifeAt } from "../world/zones";

export interface TrafficCar {
  v: Vehicle;
  ai: AIDriver;
  driver: BuiltHuman | null;
  anim: HumanAnimator | null;
  /** Why it stopped: "crash" makes the driver get out and shout. */
  mood: "calm" | "angry";
  angryT: number;
  police: boolean;
  /** A police jeep on its rounds (not chasing anyone unless `police` is set). */
  patrol: boolean;
  /** Some drivers lean on the horn whatever happens. */
  honker: boolean;
  /** A snake biker weaving about in front of the player (seconds left). */
  snakeT?: number;
  hornT: number;
  /** Tractor-trolley in tow (visual), with the trailing axle's world position. */
  trolley?: { root: TransformNode; meshes: Mesh[]; axle: Vector3 };
  /** Extra cargo meshes on the vehicle (milk cans), for shadow bookkeeping. */
  cargo?: Mesh[];
  /** Sawaris crammed into an auto-rickshaw (visual, with a seated animation). */
  riders?: Array<{ h: BuiltHuman; a: HumanAnimator }>;
  /** An auto kept alive for the crowded districts rather than the open road. */
  cityAuto?: boolean;
  /** Seconds before this auto may be thrown by a pothole again. */
  tipT?: number;
  /** Seconds until a toppled auto's riders spill out. */
  spillT?: number;
  /** How long this vehicle has been standing still (jam detection). */
  idleT?: number;
}

export interface TrafficHost {
  spawnVehicle(id: string, type: VehicleType, x: number, z: number, yaw: number, paint: string): Vehicle;
  despawnVehicle(v: Vehicle): void;
  playerPos(): Vector3;
  /** Camera position and forward (to spawn out of sight). */
  camera(): { pos: Vector3; fwd: Vector3 };
  /** Every moving obstacle the AI should not drive into. */
  obstacles(): Array<{ pos: Vector3; r: number; self?: Vehicle }>;
  honk(v: Vehicle): void;
  /** An overloaded auto caught a pothole and went over. */
  onTopple?(v: Vehicle, hard: boolean): void;
  /** A patrol's siren is wailing at a point (called every frame while it should sound). */
  siren?(pos: Vector3): void;
  /** A voice from a vehicle with no resident speaker (police jeep/bike loudspeaker). */
  say?(when: "police-patrol" | "police-bribe", group: string, pos: Vector3): void;
  /** The riders of a toppled auto tumble out onto the road. */
  onSpill?(v: Vehicle, riders: number): void;
  mats: Materials;
  addCaster(m: import("../babylon").AbstractMesh): void;
  removeCaster(m: import("../babylon").AbstractMesh): void;
}

const TYPES: Array<[VehicleType, number]> = [["car", 26], ["motorcycle", 18], ["auto", 12], ["erickshaw", 10], ["tractor", 12], ["truck", 12], ["jeep", 10], ["scooter", 10], ["bicycle", 4]];
const LIGHT: Array<[VehicleType, number]> = [["scooter", 30], ["motorcycle", 30], ["auto", 22], ["bicycle", 18]];
const LOADS: TrolleyLoad[] = ["sugarcane", "sugarcane", "straw", "bricks", "empty"];
const HITCH = 2.05, TONGUE = 3.2;
const PAINTS = ["mint", "cng", "mustard", "phulkari", "royal", "black", "silver", "olive", "tractorRed"];

/**
 * Countryside traffic: a handful of AI vehicles kept alive in a ring around
 * the player (spawned out of sight, removed when far). They are ordinary
 * physics vehicles, so they can be bumped, overtaken — or "borrowed".
 */
export class Traffic {
  cars: TrafficCar[] = [];
  private rng = new Rng(7070);
  private n = 0;
  private spawnT = 0;
  target = 16;
  /** Of those, how many small vehicles may be inside the bazaar walls. */
  townTarget = 4;
  /** Police jeeps doing the rounds near the player. */
  patrolTarget = 2;
  /** Auto-rickshaws kept alive in the crowded districts, on top of `target`. */
  autoTarget = 7;

  constructor(private host: TrafficHost, private g: NavGraph, private scene: Scene, private mat: Material) {}

  private pickType(table = TYPES): VehicleType {
    const total = table.reduce((s, [, w]) => s + w, 0);
    let r = this.rng.next() * total;
    for (const [t, w] of table) { r -= w; if (r <= 0) return t; }
    return table[0]![0];
  }

  private static inTown(x: number, z: number): boolean {
    return x > TOWN.x0 - 5 && x < TOWN.x1 + 5 && z > TOWN.z0 - 5 && z < TOWN.z1 + 5;
  }

  /** Streets where autos swarm: Ludhiana's bazaar and the Nawan Shehar grid. */
  private static crowded(x: number, z: number): boolean {
    return inRectR(LUDHIANA, x, z, 20) || (x > 190 && x < 510 && z > -153 && z < 146);
  }

  /** Put a seated driver figure on a vehicle (visual only). */
  private seatDriver(v: Vehicle, seed: number, look = randomAppearance(seed)): { h: BuiltHuman; a: HumanAnimator } {
    const h = buildHuman(this.scene, `drv_${v.id}`, { ...look, age: look.age === "child" ? "adult" : look.age, height: Math.max(1.6, look.height) }, this.mat);
    const a = new HumanAnimator(h);
    h.root.parent = v.model.root as TransformNode;
    const s = v.spec.seat;
    h.root.position.set(s[0], s[1] - 0.92 * h.scale, s[2]);
    this.host.addCaster(h.mesh);
    return { h, a };
  }

  /**
   * Cram sawaris into an auto-rickshaw: three on the bench, a couple more
   * squeezed behind, and when it is really full someone hanging off the side
   * with one hand on the frame. Nobody in Punjab waits for the next auto.
   */
  private loadAuto(v: Vehicle, howMany: number): Array<{ h: BuiltHuman; a: HumanAnimator }> {
    // Bench, back row, then the two who ride on the footboard.
    const ev = v.spec.type === "erickshaw";
    const spots: Array<[number, number, number]> = ev ? [
      [-0.3, 0.84, -0.32], [0.3, 0.84, -0.32], [-0.3, 0.84, -1.18], [0.3, 0.84, -1.18],
      [0.0, 0.84, -1.18], [0.72, 0.6, -0.7],
    ] : [
      [-0.42, 0.70, -0.62], [0.0, 0.70, -0.68], [0.42, 0.70, -0.62],
      [-0.30, 0.72, -1.05], [0.30, 0.72, -1.05],
      [0.80, 0.62, -0.55], [-0.80, 0.62, -0.55],
    ];
    const out: Array<{ h: BuiltHuman; a: HumanAnimator }> = [];
    for (let i = 0; i < Math.min(howMany, spots.length); i++) {
      const look = randomAppearance(6400 + this.n * 13 + i);
      const h = buildHuman(this.scene, `sawari_${v.id}_${i}`, { ...look, height: Math.max(1.5, look.height) }, this.mat);
      h.root.parent = v.model.root as TransformNode;
      const [x, y, z] = spots[i]!;
      h.root.position.set(x, y - 0.92 * h.scale, z);
      // The bench faces backwards; the footboard riders face out. On an
      // e-rickshaw the front bench faces forward and the back one faces back.
      h.root.rotation.y = ev ? (i >= 5 ? Math.PI / 2 : i < 2 ? 0 : Math.PI) : i >= 5 ? (x > 0 ? Math.PI / 2 : -Math.PI / 2) : Math.PI;
      this.host.addCaster(h.mesh);
      out.push({ h, a: new HumanAnimator(h) });
    }
    return out;
  }

  /** Spawn a police jeep for a chase (or, with `patrol`, for its rounds); returns the car record. */
  spawnPolice(x: number, z: number, yaw: number, patrol = false, type: "jeep" | "motorcycle" = "jeep"): TrafficCar {
    const v = this.host.spawnVehicle(`police_${this.n++}`, type, x, z, yaw, "police");
    const look = { ...randomAppearance(4000 + this.n), sex: "m" as const, top: "shirt" as const, topColor: "#b59a62", bottom: "trousers" as const, bottomColor: "#a88c58", headwear: "turban" as const, headColor: "#1a237e", age: "adult" as const, beard: "full" as const };
    const d = this.seatDriver(v, 0, look);
    v.hasDriver = true;
    const car: TrafficCar = { v, ai: new AIDriver(v, this.g, this.rng), driver: d.h, anim: d.a, mood: "calm", angryT: 0, police: !patrol, patrol, honker: false, hornT: 0 };
    car.ai.aggression = patrol ? 0.8 : 1.25;
    if (patrol) car.ai.wander(8);
    this.cars.push(car);
    return car;
  }

  /** The nearest patrolling jeep within `r` metres (to answer a call). */
  nearestPatrol(p: Vector3, r: number): TrafficCar | null {
    let best: TrafficCar | null = null, bd = r;
    for (const c of this.cars) {
      if (!c.patrol || c.police || !c.driver) continue;
      const d = Vector3.Distance(c.v.position, p);
      if (d < bd) { bd = d; best = c; }
    }
    return best;
  }

  private spawnOne(patrol = false, cityAuto = false): void {
    const p = this.host.playerPos();
    const cam = this.host.camera();
    const townCars = this.cars.filter((c) => !c.police && Traffic.inTown(c.v.position.x, c.v.position.z)).length;
    const townOk = townCars < this.townTarget;
    // Mostly close enough to be seen soon (55–150 m), some further out; out of
    // the camera's view unless far. Small vehicles also start inside the bazaar.
    const near = this.rng.next() < 0.7;
    const cands = this.g.nodes.filter((n) => {
      const town = isBazaarRoad(n);
      // City autos only ever appear on the crowded districts' streets, and
      // much closer in — they are there to be seen, three-deep at the chowk.
      if (cityAuto) {
        if (!n.road || !Traffic.crowded(n.x, n.z)) return false;
        const dd = Math.hypot(n.x - p.x, n.z - p.z);
        return dd > 25 && dd < 125;
      }
      if (town ? !townOk : !n.road || n.road.kind === "track" && this.rng.next() < 0.6) return false;
      if (!town && Traffic.inTown(n.x, n.z)) return false;
      const d = Math.hypot(n.x - p.x, n.z - p.z);
      if (town ? d < 35 || d > 120 : d < 55 || d > (near ? 140 : 185)) return false;
      const ahead = ((n.x - cam.pos.x) * cam.fwd.x + (n.z - cam.pos.z) * cam.fwd.z) / d;
      return ahead < 0.25 || d > 110;
    });
    if (!cands.length) return;
    const n = this.rng.pick(cands);
    const town = isBazaarRoad(n);
    if (this.cars.some((c) => Math.hypot(c.v.position.x - n.x, c.v.position.z - n.z) < (town ? 12 : 20))) return;
    const next = this.g.nodes[this.rng.pick(n.links)]!;
    const dx = next.x - n.x, dz = next.z - n.z, d = Math.hypot(dx, dz) || 1;
    const off = laneOffset(n);
    if (patrol) {
      if (town) return;
      // Patrols are jeeps and, almost as often, a constable on a motorbike.
      this.spawnPolice(n.x - (dz / d) * off, n.z + (dx / d) * off, Math.atan2(dx, dz), true, this.rng.next() < 0.45 ? "motorcycle" : "jeep");
      return;
    }
    // City autos: half the old diesel autos, half the battery e-rickshaws.
    const type: VehicleType = cityAuto ? (this.rng.next() < 0.5 ? "auto" : "erickshaw") : this.pickType(town ? LIGHT : TYPES);
    const yaw = Math.atan2(dx, dz);
    const v = this.host.spawnVehicle(`traffic_${this.n++}`, type, n.x - (dz / d) * off, n.z + (dx / d) * off, yaw, this.rng.pick(PAINTS));
    v.hasDriver = true;
    const drv = this.seatDriver(v, 5000 + this.n);
    const ai = new AIDriver(v, this.g, this.rng);
    ai.bazaar = town || (LIGHT.some(([t]) => t === type) && this.rng.next() < 0.6);
    ai.wander(8);
    // "Snake" bikers weave through the lane; plenty of drivers honk non-stop.
    if ((type === "motorcycle" || type === "scooter") && !town && this.rng.next() < 0.45) { ai.zigzag = this.rng.range(1.0, 1.8); ai.aggression = 1.2; }
    // Even the truckers are not all leaning on it — but how many drivers do
    // depends on where they are. In Chaura Bazaar most of them; down a lane
    // of houses almost nobody. A flat 8% left the bazaar silent.
    const horns = lifeAt(n.x, n.z).horns;
    const honker = this.rng.next() < (type === "truck" ? 0.3 : 0.05 + 0.2 * Math.max(0, Math.min(1.2, horns - 0.4)));
    const car: TrafficCar = { v, ai, driver: drv.h, anim: drv.a, mood: "calm", angryT: 0, police: false, patrol: false, honker, hornT: this.rng.range(1, 6), cityAuto, tipT: 4 };
    // Most autos on the road are carrying someone; in the crowded districts
    // they are carrying everyone.
    if (type === "auto" || type === "erickshaw") {
      const full = cityAuto || Traffic.crowded(n.x, n.z) || type === "erickshaw";
      const k = full ? this.rng.int(3, type === "erickshaw" ? 6 : 7) : this.rng.int(0, 3);
      if (k > 0) {
        car.riders = this.loadAuto(v, k);
        // A loaded auto is slower and top-heavy.
        car.ai.aggression = 0.9;
      }
    }
    // Most tractors on the road are pulling a trolley of ganna, toori or bricks.
    if (type === "tractor" && this.rng.next() < 0.75) {
      const t = buildTrolley(this.scene, this.host.mats, v.id, this.rng.pick(LOADS), this.rng.pick(["#2e7d32", "#1565c0", "#c62828", "#6d4c41"]));
      const fx = Math.sin(yaw), fz = Math.cos(yaw);
      const axle = new Vector3(v.position.x - fx * (HITCH + TONGUE), 0, v.position.z - fz * (HITCH + TONGUE));
      car.trolley = { ...t, axle };
      for (const m of t.meshes) this.host.addCaster(m);
      car.ai.aggression = 0.85;
    }
    // Doodhwala: milk cans either side of the bike.
    if (type === "motorcycle" && this.rng.next() < 0.3) {
      car.cargo = addMilkCans(this.scene, this.host.mats, v.model.root as TransformNode, `${v.id}_milk`);
      for (const m of car.cargo) this.host.addCaster(m);
    }
    this.cars.push(car);
  }

  /** Remove the driver figure (they got out, or the player took over). */
  dropDriver(c: TrafficCar): void {
    if (!c.driver) return;
    this.host.removeCaster(c.driver.mesh);
    c.driver.root.dispose();
    c.driver = null;
    c.anim = null;
  }

  /** Stop managing a vehicle (player took it, or it is removed). */
  /**
   * Street chases the player can watch: now and then a patrol (jeep or bike)
   * near the player goes after a speeding motorbike or car — siren, the
   * loudspeaker ("Gaddi rok!"), and when they catch him, chai-paani.
   */
  private chase: { cop: TrafficCar; perp: TrafficCar; t: number; speakT: number; caught: number } | null = null;
  private nextChaseT = 90;
  /** Seconds until an auto may lurch or tip again (any auto: once per 90 s at most). */
  private nextTipT = 30;
  private updateChase(dt: number, p: Vector3): void {
    const ch = this.chase;
    if (!ch) {
      this.nextChaseT -= dt;
      if (this.nextChaseT > 0) return;
      this.nextChaseT = 8;
      const cops = this.cars.filter((c) => c.patrol && !c.police && c.driver && Vector3.Distance(c.v.position, p) < 140);
      for (const cop of cops) {
        const perp = this.cars.find((c) => !c.police && !c.patrol && c.driver && !c.riders?.length && (c.v.spec.type === "motorcycle" || c.v.spec.type === "car" || c.v.spec.type === "scooter")
          && Vector3.Distance(c.v.position, p) > 20 && Vector3.Distance(c.v.position, p) < 90 && Vector3.Distance(c.v.position, cop.v.position) < 80);
        if (!perp) continue;
        this.chase = { cop, perp, t: 0, speakT: 1.5, caught: 0 };
        perp.ai.aggression = 1.7;
        if (perp.v.spec.twoWheeler) perp.ai.zigzag = 1.4;
        perp.ai.wander(14);
        cop.ai.aggression = 1.5;
        this.nextChaseT = this.rng.range(90, 150);
        return;
      }
      return;
    }
    ch.t += dt;
    const { cop, perp } = ch;
    const gone = !this.cars.includes(cop) || !this.cars.includes(perp) || cop.police;
    if (gone || ch.t > 60) { this.endChase(); return; }
    if (ch.caught > 0) {
      // Pulled over: both stop while the constable has a word (and a chai).
      ch.caught += dt;
      if (ch.caught > 9) this.endChase();
      return;
    }
    cop.ai.chase = perp.v.position.clone();
    if (Math.floor(ch.t * 2) !== Math.floor((ch.t - dt) * 2) && Math.floor(ch.t) % 2 === 0) cop.ai.routeTo(perp.v.position.x, perp.v.position.z);
    this.host.siren?.(cop.v.position);
    ch.speakT -= dt;
    if (ch.speakT <= 0) {
      ch.speakT = this.rng.range(6, 9);
      this.host.say?.("police-patrol", cop.v.spec.type === "motorcycle" ? "police-bike" : "police-jeep", cop.v.position);
    }
    if (Vector3.Distance(cop.v.position, perp.v.position) < 7 && ch.t > 8) {
      ch.caught = 0.01;
      perp.ai.hold = true; cop.ai.hold = true;
      this.host.say?.("police-bribe", "police", cop.v.position);
    }
  }
  private endChase(): void {
    const ch = this.chase;
    if (!ch) return;
    this.chase = null;
    for (const c of [ch.cop, ch.perp]) { c.ai.hold = false; c.ai.chase = null; c.ai.aggression = c.patrol ? 0.8 : 1; c.ai.zigzag = 0; if (this.cars.includes(c)) c.ai.wander(8); }
  }

  /**
   * A lane spot on a road between `minD` and `maxD` from a point, facing along
   * the road (preferring spots in front of `fwd` when given).
   */
  roadSpot(p: Vector3, minD: number, maxD: number, fwd?: Vector3): { x: number; z: number; yaw: number } | null {
    let best: { x: number; z: number; yaw: number } | null = null, bs = -Infinity;
    for (const n of this.g.nodes) {
      if (!n.road || !n.links.length || n.road.kind === "track") continue;
      const d = Math.hypot(n.x - p.x, n.z - p.z);
      if (d < minD || d > maxD) continue;
      const next = this.g.nodes[n.links[0]!]!;
      const dx = next.x - n.x, dz = next.z - n.z, l = Math.hypot(dx, dz) || 1;
      const off = laneOffset(n);
      const score = (fwd ? ((n.x - p.x) * fwd.x + (n.z - p.z) * fwd.z) / d : 0) - d * 0.01;
      if (score > bs) { bs = score; best = { x: n.x - (dz / l) * off, z: n.z + (dx / l) * off, yaw: Math.atan2(dx, dz) }; }
    }
    return best;
  }

  /** Put an ordinary driven vehicle (optionally with riders) on the road at a spot. */
  spawnCivil(type: VehicleType, x: number, z: number, yaw: number, riders = 0): TrafficCar {
    const v = this.host.spawnVehicle(`traffic_${this.n++}`, type, x, z, yaw, this.rng.pick(PAINTS));
    v.hasDriver = true;
    const drv = this.seatDriver(v, 5000 + this.n);
    const ai = new AIDriver(v, this.g, this.rng);
    ai.wander(8);
    const car: TrafficCar = { v, ai, driver: drv.h, anim: drv.a, mood: "calm", angryT: 0, police: false, patrol: false, honker: false, hornT: 5, cityAuto: type === "auto" || type === "erickshaw", tipT: 4 };
    if (riders > 0) { car.riders = this.loadAuto(v, riders); ai.aggression = 0.9; }
    this.cars.push(car);
    return car;
  }

  /** Tip a loaded auto over right now (for trying the event out). */
  forceTip(c: TrafficCar): void {
    c.tipT = 30;
    this.nextTipT = 90;
    this.tip(c, true);
  }

  /**
   * Another vehicle has slammed into a loaded auto or e-rickshaw: a hard hit
   * puts it on its side, a lighter one just shakes the riders off the edges.
   * Either way they end up on the road, shouting (lines 39-42).
   */
  knock(c: TrafficCar, dir: Vector3): void {
    if (c.police || c.spillT !== undefined || (c.tipT ?? 0) > 20) return;
    const t = c.v.spec.type;
    if (t !== "auto" && t !== "erickshaw") {
      if (c.riders?.length) { c.ai.hold = true; c.spillT = 0.35; }
      return;
    }
    // A three-wheeler that is hit skids sideways and goes over on its side.
    c.tipT = 30;
    this.tip(c, true, dir);
    if (!c.riders?.length) c.spillT = undefined;
  }

  /**
   * A snake biker the player has hit: the bike goes flying, the rider ends up
   * on the road. Returns where he landed (or null if this was not a snake).
   */
  throwSnake(c: TrafficCar, dir: Vector3): Vector3 | null {
    if (c.snakeT === undefined) return null;
    c.snakeT = undefined;
    c.ai.snake = false; c.ai.chase = null; c.ai.hold = true;
    const v = c.v;
    const at = v.position.clone();
    this.dropDriver(c);
    v.hasDriver = false;
    v.assistOff = 12;
    const m = v.spec.mass;
    const d = new Vector3(dir.x, 0, dir.z).normalize();
    v.body.applyImpulse(new Vector3(d.x * m * 9, m * 6.5, d.z * m * 9), v.position.add(new Vector3(0, 0.2, 0)));
    v.body.setAngularVelocity(new Vector3(this.rng.range(-8, 8), this.rng.range(-6, 6), this.rng.range(-8, 8)));
    return at;
  }

  /**
   * Snake bikers: now and then a biker turns up ahead of the player and
   * weaves about in front of them, cutting across, never quite letting them by.
   */
  private nextSnakeT = 40;
  private updateSnakes(dt: number, p: Vector3): void {
    const cam = this.host.camera();
    const fwd = new Vector3(cam.fwd.x, 0, cam.fwd.z).normalize();
    for (const c of this.cars) {
      if (c.snakeT === undefined) continue;
      c.snakeT -= dt;
      if (c.snakeT <= 0 || !c.driver) { c.snakeT = undefined; c.ai.snake = false; c.ai.chase = null; c.ai.zigzag = 1; c.ai.wander(8); continue; }
      // Aim a little ahead of the player: in the way.
      c.ai.chase = p.add(fwd.scale(9 + Math.sin(c.snakeT * 0.7) * 4));
    }
    this.nextSnakeT -= dt;
    if (this.nextSnakeT > 0) return;
    this.nextSnakeT = this.rng.range(50, 90);
    if (this.cars.filter((c) => c.snakeT !== undefined).length >= 2) return;
    const s = this.roadSpot(p, 35, 60, fwd);
    if (!s) return;
    const c = this.spawnCivil(this.rng.next() < 0.7 ? "motorcycle" : "scooter", s.x, s.z, s.yaw);
    c.snakeT = this.rng.range(35, 55);
    c.ai.snake = true;
    c.ai.zigzag = this.rng.range(2.0, 2.8);
    c.ai.aggression = 1.4;
    c.honker = true;
  }

  /** Bring a snake biker in now (for trying it out). */
  forceSnake(): void { this.nextSnakeT = 0; }

  /** Start a street chase near the player now

  /** Start a street chase near the player now, bringing a patrol and a speeder if needed. */
  forceChase(p: Vector3, fwd: Vector3): boolean {
    if (this.chase) this.endChase();
    let cop = this.cars.find((c) => c.patrol && !c.police && c.driver && Vector3.Distance(c.v.position, p) < 120);
    if (!cop) { const s = this.roadSpot(p, 45, 80, fwd); if (!s) return false; cop = this.spawnPolice(s.x, s.z, s.yaw, true, this.rng.next() < 0.5 ? "motorcycle" : "jeep"); }
    const s = this.roadSpot(p, 22, 40, fwd);
    if (!s) return false;
    const perp = this.spawnCivil(this.rng.next() < 0.5 ? "motorcycle" : "car", s.x, s.z, s.yaw);
    this.chase = { cop, perp, t: 0, speakT: 1.5, caught: 0 };
    perp.ai.aggression = 1.7;
    if (perp.v.spec.twoWheeler) perp.ai.zigzag = 1.4;
    perp.ai.wander(14);
    cop.ai.aggression = 1.5;
    this.nextChaseT = this.rng.range(90, 150);
    return true;
  }

  /** Take the passenger figures off a vehicle (they have fallen out, or it is going away). */
  dropRiders(c: TrafficCar): void {
    for (const r of c.riders ?? []) { this.host.removeCaster(r.h.mesh); r.h.root.dispose(); }
    c.riders = undefined;
  }

  release(c: TrafficCar, despawn: boolean): void {
    this.cars = this.cars.filter((x) => x !== c);
    this.dropDriver(c);
    if (c.trolley) {
      // The trolley stays with the tractor only while it is AI-driven.
      for (const m of c.trolley.meshes) this.host.removeCaster(m);
      c.trolley.root.dispose();
      c.trolley = undefined;
    }
    if (c.riders) {
      for (const r of c.riders) { this.host.removeCaster(r.h.mesh); r.h.root.dispose(); }
      c.riders = undefined;
    }
    if (c.cargo && despawn) for (const m of c.cargo) this.host.removeCaster(m);
    if (despawn) this.host.despawnVehicle(c.v);
    else c.v.hasDriver = false;
  }

  find(v: Vehicle): TrafficCar | undefined {
    return this.cars.find((c) => c.v === v);
  }

  fixedUpdate(dt: number): void {
    this.nextTipT -= dt;
    const p = this.host.playerPos();
    this.updateSnakes(dt, p);
    // Population management.
    this.spawnT -= dt;
    const civil = this.cars.filter((c) => !c.police && !c.patrol && !c.cityAuto).length;
    const patrols = this.cars.filter((c) => c.patrol).length;
    const autos = this.cars.filter((c) => c.cityAuto).length;
    const inCrowd = Traffic.crowded(p.x, p.z);
    // How much traffic this kind of place wants. A bazaar should be nose to
    // tail; a field road should have a tractor every so often. Same budget,
    // spent where it reads.
    const want = lifeAt(p.x, p.z).traffic;
    const target = Math.round(this.target * want);
    const autoTarget = Math.round(this.autoTarget * want);
    if (this.spawnT <= 0 && patrols < this.patrolTarget && this.rng.next() < 0.15) { this.spawnT = 0.4; this.spawnOne(true); }
    else if (this.spawnT <= 0 && inCrowd && autos < autoTarget) { this.spawnT = 0.25; this.spawnOne(false, true); }
    else if (this.spawnT <= 0 && civil < target) { this.spawnT = 0.3; this.spawnOne(); }
    this.updateChase(dt, p);
    for (const c of [...this.cars]) {
      const d = Math.hypot(c.v.position.x - p.x, c.v.position.z - p.z);
      // Tighter than it was (220 / 300). The budget is a headcount, so a
      // wide despawn ring spends it on cars three streets away: Chaura
      // Bazaar had one vehicle within seventy metres, which is why nothing
      // there ever honked. Keeping the ring close puts the same number of
      // cars in front of you instead of around the district.
      if (!c.police && d > (c.cityAuto ? 150 : 200)) { this.release(c, true); continue; }
      if (c.cityAuto && !Traffic.crowded(c.v.position.x, c.v.position.z) && d > 100) { this.release(c, true); continue; }
      this.potholeTip(c, dt, d);
      if (!c.police && c.ai.done && !c.ai.hold) c.ai.wander(8);
      this.unjam(c, dt, d);
      if (c.patrol && !c.police && this.chase?.cop !== c) c.ai.chase = null;
      c.ai.clearAhead = this.clearAhead(c);
      c.ai.update(dt);
      // Horns: blocked drivers honk; honkers honk anyway.
      // Horns. A Punjab street does honk constantly, but a game is not a
      // street: played straight it is exhausting within a minute and gives
      // people a headache. Keep it as punctuation — close by, well spaced,
      // and mostly from drivers who are actually blocked.
      c.hornT -= dt;
      const blocked = c.ai.clearAhead < 10 && c.v.speed < 4;
      if (c.hornT <= 0 && d < 70 && !c.police && !c.patrol && c.driver && (blocked || c.honker)) {
        // How much anyone leans on the horn depends on where they are: a
        // jammed bazaar is a wall of them, a residential gali almost none.
        const horns = lifeAt(c.v.position.x, c.v.position.z).horns;
        c.hornT = (blocked ? this.rng.range(5, 10) : this.rng.range(16, 32)) / Math.max(0.08, horns);
        if (horns > 0.05) this.host.honk(c.v);
      }
      // Flipped or stuck far from the player: quietly put it back on the road.
      const upY = c.v.dir(new Vector3(0, 1, 0)).y;
      if ((upY < 0.4 || c.v.stuckTime > 4) && d > 60) { this.release(c, true); continue; }
    }
  }

  /**
   * Punjab physics: an overloaded auto hits a pothole at speed, the weight
   * shifts, and it slews sideways — sometimes right over onto its side. Only
   * loaded autos, only where the player can see it, and never twice in a row.
   */
  private potholeTip(c: TrafficCar, dt: number, distToPlayer: number): void {
    if (!c.riders?.length || c.police) return;
    c.tipT = (c.tipT ?? 0) - dt;
    if (c.spillT !== undefined) {
      // Gone over: after a moment the riders tumble out onto the road.
      c.spillT -= dt;
      if (c.spillT <= 0) { c.spillT = undefined; const n = c.riders.length; this.dropRiders(c); this.host.onSpill?.(c.v, n); }
      return;
    }
    if (c.tipT > 0 || this.nextTipT > 0 || distToPlayer > 90 || distToPlayer < 6) return;
    const v = c.v;
    const ev = v.spec.type === "erickshaw";
    if (v.speed < (ev ? 3.5 : 5)) return;
    const hole = defectAt(v.position.x, v.position.z);
    // An e-rickshaw does not even need the pothole: a sharp swerve will do.
    const swerve = ev && Math.abs(v.controls.steer) > 0.5 && this.rng.next() < dt * 0.4;
    if (hole?.kind !== "pothole" && !swerve) return;
    c.tipT = this.rng.range(14, 30);
    this.nextTipT = this.rng.range(90, 150);
    // Three in four are a scare: a lurch and a skid. The fourth goes over.
    // Overloaded e-rickshaws go over far more often.
    this.tip(c, this.rng.next() < (ev ? 0.55 : 0.25) && c.riders.length >= (ev ? 2 : 4));
  }

  private tip(c: TrafficCar, over: boolean, hitDir?: Vector3): void {
    const v = c.v;
    const right = v.dir(new Vector3(1, 0, 0));
    const side = hitDir ? (Vector3.Dot(hitDir, right) >= 0 ? 1 : -1) : this.rng.next() < 0.5 ? -1 : 1;
    const mass = v.spec.mass;
    // Hit from the side: it skids along the road first.
    if (hitDir) v.body.applyImpulse(right.scale(side * mass * 2.2), v.position.add(new Vector3(0, 0.3, 0)));
    // Applied high above the centre of mass, so it rolls rather than slides.
    v.body.applyImpulse(right.scale(side * mass * (over ? 2.6 : 0.9)), v.position.add(new Vector3(0, over ? 1.5 : 0.9, 0)));
    if (over) {
      c.ai.hold = true;
      // Let it actually go over (the stabiliser would catch it), then spill.
      v.assistOff = 5;
      c.spillT = 1.3;
    }
    this.host.onTopple?.(v, over);
  }

  /**
   * Break up a clot. A queue behind a stopped vehicle is normal for a few
   * seconds; a queue behind a vehicle that will never move again is a wall
   * across the road, and the player sees a street frozen solid. Anything
   * standing still far too long is given a fresh route, and if it is out of
   * sight it is taken away and respawned elsewhere instead.
   */
  private unjam(c: TrafficCar, dt: number, distToPlayer: number): void {
    if (c.police || c.ai.hold) { c.idleT = 0; return; }
    c.idleT = c.v.speed < 0.5 ? (c.idleT ?? 0) + dt : 0;
    const wedged = c.ai.jammedT >= 3;
    if ((c.idleT ?? 0) < (wedged ? 6 : 14)) return;
    c.idleT = 0;
    c.ai.jammedT = 0;
    // Out of sight: the cheapest fix is a different car somewhere else.
    if (distToPlayer > 70) { this.release(c, true); return; }
    // In view, so it has to sort itself out where it stands.
    c.ai.wander(8);
  }

  /** Distance to the nearest obstacle in this car's lane ahead. */
  private clearAhead(c: TrafficCar): number {
    const v = c.v, pos = v.position;
    const yaw = v.yaw, fx = Math.sin(yaw), fz = Math.cos(yaw);
    let best = Infinity;
    const check = (q: Vector3, r: number) => {
      const dx = q.x - pos.x, dz = q.z - pos.z;
      const ahead = dx * fx + dz * fz;
      if (ahead < 0 || ahead > 22) return;
      const lat = Math.abs(dx * fz - dz * fx);
      if (lat < v.spec.halfWidth + r + 0.5) best = Math.min(best, ahead - r);
    };
    for (const o of this.host.obstacles()) if (o.self !== v) check(o.pos, o.r);
    for (const o of this.cars) {
      if (o === c) continue;
      check(o.v.position, o.v.spec.halfWidth + 0.6);
      if (o.trolley) check(o.trolley.root.position, 1.6);
    }
    return best;
  }

  /** Per-frame: animate drivers (cheap; they just hold the bars/wheel). */
  update(dt: number, camPos: Vector3): void {
    for (const c of this.cars) {
      if (c.trolley) this.dragTrolley(c);
      if (c.riders) {
        const near = Vector3.DistanceSquared(camPos, c.v.position) < 70 * 70;
        for (const r of c.riders) {
          r.h.mesh.isVisible = Vector3.DistanceSquared(camPos, c.v.position) < 150 * 150;
          if (near) r.a.update(dt, { speed: 0, grounded: true, pose: "sit", carry: false, lookYaw: 0 });
        }
      }
      if (!c.anim || !c.driver) continue;
      const far = Vector3.Distance(camPos, c.v.position) > 80;
      c.driver.mesh.isVisible = !far || Vector3.Distance(camPos, c.v.position) < 160;
      if (far) continue;
      c.anim.update(dt, { speed: 0, grounded: true, pose: c.v.spec.pose, carry: false, lookYaw: 0, steer: c.v.controls.steer });
    }
  }

  /** Trailer kinematics: the axle follows the hitch at a fixed tongue length. */
  private dragTrolley(c: TrafficCar): void {
    const t = c.trolley!, v = c.v;
    // Follow the interpolated model (not the physics body) so it does not jitter.
    const r = v.model.root;
    const hitch = new Vector3(0, 0, -HITCH).applyRotationQuaternion(r.rotationQuaternion!).addInPlace(r.position);
    let dx = hitch.x - t.axle.x, dz = hitch.z - t.axle.z;
    const d = Math.hypot(dx, dz) || 1;
    dx /= d; dz /= d;
    t.axle.set(hitch.x - dx * TONGUE, 0, hitch.z - dz * TONGUE);
    t.root.position.set(t.axle.x, Math.max(0, v.position.y - 0.05), t.axle.z);
    t.root.rotation.set(0, Math.atan2(dx, dz), 0);
  }

  clear(): void {
    for (const c of [...this.cars]) this.release(c, true);
  }
}
