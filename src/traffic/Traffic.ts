import { Vector3, type Scene, type Material, type TransformNode } from "../babylon";
import type { Vehicle } from "../vehicles/Vehicle";
import type { VehicleType } from "../vehicles/specs";
import { buildHuman, type BuiltHuman } from "../characters/HumanBuilder";
import { HumanAnimator } from "../characters/HumanAnimator";
import { randomAppearance } from "../characters/appearances";
import { AIDriver, laneOffset } from "./AIDriver";
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
  /** Some drivers lean on the horn whatever happens. */
  honker: boolean;
  hornT: number;
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
  addCaster(m: import("../babylon").AbstractMesh): void;
  removeCaster(m: import("../babylon").AbstractMesh): void;
}

const TYPES: Array<[VehicleType, number]> = [["car", 26], ["motorcycle", 18], ["auto", 12], ["tractor", 12], ["truck", 12], ["jeep", 10], ["scooter", 10], ["bicycle", 4]];
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
  target = 9;

  constructor(private host: TrafficHost, private g: NavGraph, private scene: Scene, private mat: Material) {}

  private pickType(): VehicleType {
    const total = TYPES.reduce((s, [, w]) => s + w, 0);
    let r = this.rng.next() * total;
    for (const [t, w] of TYPES) { r -= w; if (r <= 0) return t; }
    return "car";
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

  /** Spawn a police jeep (or bike) for a chase; returns the car record. */
  spawnPolice(x: number, z: number, yaw: number): TrafficCar {
    const v = this.host.spawnVehicle(`police_${this.n++}`, "jeep", x, z, yaw, "police");
    const look = { ...randomAppearance(4000 + this.n), sex: "m" as const, top: "shirt" as const, topColor: "#b59a62", bottom: "trousers" as const, bottomColor: "#a88c58", headwear: "turban" as const, headColor: "#1a237e", age: "adult" as const, beard: "full" as const };
    const d = this.seatDriver(v, 0, look);
    v.hasDriver = true;
    const car: TrafficCar = { v, ai: new AIDriver(v, this.g, this.rng), driver: d.h, anim: d.a, mood: "calm", angryT: 0, police: true, honker: false, hornT: 0 };
    car.ai.aggression = 1.25;
    this.cars.push(car);
    return car;
  }

  private spawnOne(): void {
    const p = this.host.playerPos();
    const cam = this.host.camera();
    // A road node 90–240 m away, preferably behind the camera, outside the bazaar walls.
    const cands = this.g.nodes.filter((n) => {
      if (!n.road || n.road.kind === "track" && this.rng.next() < 0.6) return false;
      if (n.x > TOWN.x0 - 5 && n.x < TOWN.x1 + 5 && n.z > TOWN.z0 - 5 && n.z < TOWN.z1 + 5) return false;
      const d = Math.hypot(n.x - p.x, n.z - p.z);
      if (d < 90 || d > 240) return false;
      const ahead = ((n.x - cam.pos.x) * cam.fwd.x + (n.z - cam.pos.z) * cam.fwd.z) / d;
      return ahead < 0.3 || d > 170;
    });
    if (!cands.length) return;
    const n = this.rng.pick(cands);
    if (this.cars.some((c) => Math.hypot(c.v.position.x - n.x, c.v.position.z - n.z) < 25)) return;
    const next = this.g.nodes[this.rng.pick(n.links)]!;
    const dx = next.x - n.x, dz = next.z - n.z, d = Math.hypot(dx, dz) || 1;
    const off = laneOffset(n);
    const type = this.pickType();
    const yaw = Math.atan2(dx, dz);
    const v = this.host.spawnVehicle(`traffic_${this.n++}`, type, n.x - (dz / d) * off, n.z + (dx / d) * off, yaw, this.rng.pick(PAINTS));
    v.hasDriver = true;
    const drv = this.seatDriver(v, 5000 + this.n);
    const ai = new AIDriver(v, this.g, this.rng);
    ai.wander(8);
    // "Snake" bikers weave through the lane; plenty of drivers honk non-stop.
    if ((type === "motorcycle" || type === "scooter") && this.rng.next() < 0.45) { ai.zigzag = this.rng.range(1.0, 1.8); ai.aggression = 1.2; }
    const honker = type === "truck" || this.rng.next() < 0.35;
    this.cars.push({ v, ai, driver: drv.h, anim: drv.a, mood: "calm", angryT: 0, police: false, honker, hornT: this.rng.range(1, 6) });
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
    const civil = this.cars.filter((c) => !c.police).length;
    if (this.spawnT <= 0 && civil < this.target) { this.spawnT = 0.7; this.spawnOne(); }
    for (const c of [...this.cars]) {
      const d = Math.hypot(c.v.position.x - p.x, c.v.position.z - p.z);
      if (!c.police && d > 330) { this.release(c, true); continue; }
      if (!c.police && c.ai.done && !c.ai.hold) c.ai.wander(8);
      c.ai.clearAhead = this.clearAhead(c);
      c.ai.update(dt);
      // Horns: blocked drivers honk; honkers honk anyway.
      c.hornT -= dt;
      const blocked = c.ai.clearAhead < 12 && c.v.speed < 6;
      if (c.hornT <= 0 && d < 140 && !c.police && c.driver && (blocked || c.honker)) {
        c.hornT = blocked ? this.rng.range(1.2, 3) : this.rng.range(3, 9);
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
    for (const o of this.cars) if (o !== c) check(o.v.position, o.v.spec.halfWidth + 0.6);
    return best;
  }

  /** Per-frame: animate drivers (cheap; they just hold the bars/wheel). */
  update(dt: number, camPos: Vector3): void {
    for (const c of this.cars) {
      if (!c.anim || !c.driver) continue;
      const far = Vector3.Distance(camPos, c.v.position) > 80;
      c.driver.mesh.isVisible = !far || Vector3.Distance(camPos, c.v.position) < 160;
      if (far) continue;
      c.anim.update(dt, { speed: 0, grounded: true, pose: c.v.spec.pose, carry: false, lookYaw: 0, steer: c.v.controls.steer });
    }
  }

  clear(): void {
    for (const c of [...this.cars]) this.release(c, true);
  }
}
