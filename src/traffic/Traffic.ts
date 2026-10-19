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
import { TOWN } from "../world/region";

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
  hornT: number;
  /** Tractor-trolley in tow (visual), with the trailing axle's world position. */
  trolley?: { root: TransformNode; meshes: Mesh[]; axle: Vector3 };
  /** Extra cargo meshes on the vehicle (milk cans), for shadow bookkeeping. */
  cargo?: Mesh[];
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
  mats: Materials;
  addCaster(m: import("../babylon").AbstractMesh): void;
  removeCaster(m: import("../babylon").AbstractMesh): void;
}

const TYPES: Array<[VehicleType, number]> = [["car", 26], ["motorcycle", 18], ["auto", 12], ["tractor", 12], ["truck", 12], ["jeep", 10], ["scooter", 10], ["bicycle", 4]];
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

  /** Spawn a police jeep for a chase (or, with `patrol`, for its rounds); returns the car record. */
  spawnPolice(x: number, z: number, yaw: number, patrol = false): TrafficCar {
    const v = this.host.spawnVehicle(`police_${this.n++}`, "jeep", x, z, yaw, "police");
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

  private spawnOne(patrol = false): void {
    const p = this.host.playerPos();
    const cam = this.host.camera();
    const townCars = this.cars.filter((c) => !c.police && Traffic.inTown(c.v.position.x, c.v.position.z)).length;
    const townOk = townCars < this.townTarget;
    // Mostly close enough to be seen soon (55–150 m), some further out; out of
    // the camera's view unless far. Small vehicles also start inside the bazaar.
    const near = this.rng.next() < 0.7;
    const cands = this.g.nodes.filter((n) => {
      const town = isBazaarRoad(n);
      if (town ? !townOk : !n.road || n.road.kind === "track" && this.rng.next() < 0.6) return false;
      if (!town && Traffic.inTown(n.x, n.z)) return false;
      const d = Math.hypot(n.x - p.x, n.z - p.z);
      if (town ? d < 35 || d > 120 : d < 55 || d > (near ? 150 : 230)) return false;
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
      this.spawnPolice(n.x - (dz / d) * off, n.z + (dx / d) * off, Math.atan2(dx, dz), true);
      return;
    }
    const type = this.pickType(town ? LIGHT : TYPES);
    const yaw = Math.atan2(dx, dz);
    const v = this.host.spawnVehicle(`traffic_${this.n++}`, type, n.x - (dz / d) * off, n.z + (dx / d) * off, yaw, this.rng.pick(PAINTS));
    v.hasDriver = true;
    const drv = this.seatDriver(v, 5000 + this.n);
    const ai = new AIDriver(v, this.g, this.rng);
    ai.bazaar = town || (LIGHT.some(([t]) => t === type) && this.rng.next() < 0.6);
    ai.wander(8);
    // "Snake" bikers weave through the lane; plenty of drivers honk non-stop.
    if ((type === "motorcycle" || type === "scooter") && !town && this.rng.next() < 0.45) { ai.zigzag = this.rng.range(1.0, 1.8); ai.aggression = 1.2; }
    const honker = type === "truck" || this.rng.next() < 0.25;
    const car: TrafficCar = { v, ai, driver: drv.h, anim: drv.a, mood: "calm", angryT: 0, police: false, patrol: false, honker, hornT: this.rng.range(1, 6) };
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
  release(c: TrafficCar, despawn: boolean): void {
    this.cars = this.cars.filter((x) => x !== c);
    this.dropDriver(c);
    if (c.trolley) {
      // The trolley stays with the tractor only while it is AI-driven.
      for (const m of c.trolley.meshes) this.host.removeCaster(m);
      c.trolley.root.dispose();
      c.trolley = undefined;
    }
    if (c.cargo && despawn) for (const m of c.cargo) this.host.removeCaster(m);
    if (despawn) this.host.despawnVehicle(c.v);
    else c.v.hasDriver = false;
  }

  find(v: Vehicle): TrafficCar | undefined {
    return this.cars.find((c) => c.v === v);
  }

  fixedUpdate(dt: number): void {
    const p = this.host.playerPos();
    // Population management.
    this.spawnT -= dt;
    const civil = this.cars.filter((c) => !c.police && !c.patrol).length;
    const patrols = this.cars.filter((c) => c.patrol).length;
    if (this.spawnT <= 0 && patrols < this.patrolTarget && this.rng.next() < 0.15) { this.spawnT = 0.4; this.spawnOne(true); }
    else if (this.spawnT <= 0 && civil < this.target) { this.spawnT = 0.4; this.spawnOne(); }
    for (const c of [...this.cars]) {
      const d = Math.hypot(c.v.position.x - p.x, c.v.position.z - p.z);
      if (!c.police && d > 300) { this.release(c, true); continue; }
      if (!c.police && c.ai.done && !c.ai.hold) c.ai.wander(8);
      if (c.patrol && !c.police) c.ai.chase = null;
      c.ai.clearAhead = this.clearAhead(c);
      c.ai.update(dt);
      // Horns: blocked drivers honk; honkers honk anyway.
      c.hornT -= dt;
      const blocked = c.ai.clearAhead < 12 && c.v.speed < 6;
      if (c.hornT <= 0 && d < 140 && !c.police && !c.patrol && c.driver && (blocked || c.honker)) {
        c.hornT = blocked ? this.rng.range(1.5, 3.5) : this.rng.range(4, 11);
        this.host.honk(c.v);
      }
      // Flipped or stuck far from the player: quietly put it back on the road.
      const upY = c.v.dir(new Vector3(0, 1, 0)).y;
      if ((upY < 0.4 || c.v.stuckTime > 4) && d > 60) { this.release(c, true); continue; }
    }
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
