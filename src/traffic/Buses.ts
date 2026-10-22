import { Vector3 } from "../babylon";
import type { NavGraph } from "../world/nav";
import { BUS_STOPS, shelterSpot, type BusStop } from "../world/busRoutes";
import type { BuiltHuman } from "../characters/HumanBuilder";
import type { HumanAnimator } from "../characters/HumanAnimator";
import type { Traffic, TrafficCar } from "./Traffic";
import { legAt, legProject, planRoutes, type PlannedRoute } from "./busPlan";
import { Rng } from "../render/textures";

/** Metres per second a bus covers while nobody is there to see it. */
const VIRTUAL_SPEED = 8;
/** Buses come to life this close to the player and go virtual again beyond `FAR`. */
const NEAR = 170, FAR = 240;

export interface BusRun {
  id: string;
  plan: PlannedRoute;
  /** The leg being driven, or (while dwelling) the one just finished. */
  leg: number;
  /** Distance along the leg (virtual buses only). */
  s: number;
  /** Seconds left standing at the stop (> 0 while at a stop). */
  dwell: number;
  car: TrafficCar | null;
  /** Seconds standing still while it should be driving. */
  stuckT: number;
  /** The player is aboard: never goes virtual, waits for them at their stop. */
  carrying: boolean;
}

/** Someone waiting at a shelter: on the bench or standing, then off to the door. */
interface Waiter {
  f: { h: BuiltHuman; a: HumanAnimator };
  x: number;
  z: number;
  yaw: number;
  sit: boolean;
  /** Walking to this bus's door. */
  to: BusRun | null;
  seed: number;
}

/** Waiters appear at shelters this close to the player and go beyond `WAIT_FAR`. */
const WAIT_NEAR = 110, WAIT_FAR = 150;

export interface BusHost {
  playerPos(): Vector3;
  groundY(x: number, z: number): number;
  /** A conductor's call at a stop ("Ludhiana! Ludhiana!"). */
  call?(run: BusRun, stop: BusStop): void;
}

/**
 * The district's buses: each route's buses run out and back between their
 * stops all the time. Far from the player a bus is only a point moving along
 * its route; within reach it is a real vehicle on the road with a driver,
 * pulling up at every stop for a dozen seconds. The player can board one at
 * its front door and ride it to a later stop.
 */
export class Buses {
  runs: BusRun[] = [];
  private rng = new Rng(4242);
  /** People waiting at each stop near the player, and when a stop fills up again. */
  private waiting = new Map<string, Waiter[]>();
  private refillAt = new Map<string, number>();
  private clock = 0;
  private seeds = 0;

  constructor(private host: BusHost, private traffic: Traffic, g: NavGraph) {
    let n = 0;
    for (const plan of planRoutes(g)) {
      for (let k = 0; k < plan.route.buses; k++) {
        // Spread a route's buses evenly round the loop.
        const leg = Math.floor((k * plan.legs.length) / plan.route.buses);
        this.runs.push({ id: `bus_${n++}`, plan, leg, s: plan.legs[leg]!.len * 0.3, dwell: 0, car: null, stuckT: 0, carrying: false });
      }
    }
  }

  /** Where a bus is, materialised or not. */
  where(r: BusRun): { x: number; z: number; yaw: number } {
    if (r.car) return { x: r.car.v.position.x, z: r.car.v.position.z, yaw: r.car.v.yaw };
    return legAt(r.plan.legs[r.leg]!, r.dwell > 0 ? Infinity : r.s);
  }

  /** The stop a bus is standing at, if it is. */
  atStop(r: BusRun): BusStop | null {
    return r.dwell > 0 ? r.plan.legs[r.leg]!.to : null;
  }

  /** Stops still ahead of a bus before it turns round at the end of the line (legs to take, in order). */
  ahead(r: BusRun): number[] {
    const L = r.plan.legs.length, half = L / 2;
    const start = r.dwell > 0 ? (r.leg + 1) % L : r.leg;
    const end = start < half ? half : L;
    const out: number[] = [];
    for (let i = start; i < end; i++) out.push(i);
    return out;
  }

  /** Fare from where the bus is to the end of leg `to`: ₹10, and ₹2 a hundred metres. */
  fare(r: BusRun, to: number): number {
    let m = 0;
    for (const i of this.ahead(r)) { m += r.plan.legs[i]!.len; if (i === to) break; }
    return 10 + Math.round(m / 100) * 2;
  }

  /** The front door (kerb side, behind the front wheel) of a materialised bus. */
  door(r: BusRun): Vector3 | null {
    return r.car ? r.car.v.toWorld(new Vector3(-1.9, 0, 4.1)) : null;
  }

  fixedUpdate(dt: number): void {
    const p = this.host.playerPos();
    for (const r of this.runs) {
      const L = r.plan.legs[r.leg]!;
      if (r.dwell > 0) {
        r.dwell -= dt;
        if (r.dwell <= 0) this.depart(r);
        else if (r.car) r.car.ai.hold = true;
      }
      const at = this.where(r);
      const d = Math.hypot(at.x - p.x, at.z - p.z);
      if (!r.car) {
        if (r.dwell <= 0) {
          r.s += VIRTUAL_SPEED * dt;
          if (r.s >= L.len) this.arrive(r);
        }
        if (d < NEAR) this.materialise(r);
        continue;
      }
      const c = r.car;
      if (!this.traffic.cars.includes(c)) { r.car = null; continue; }
      if (d > FAR && !r.carrying) { this.dematerialise(r); continue; }
      if (r.dwell > 0) continue;
      if (c.ai.done) { this.arrive(r); continue; }
      // Rolled or wedged: a bus does not get left in a ditch.
      const up = c.v.dir(new Vector3(0, 1, 0)).y;
      r.stuckT = c.v.speed < 0.5 ? r.stuckT + dt : Math.max(0, r.stuckT - dt);
      if (up < 0.5 || r.stuckT > (r.carrying ? 20 : 35)) {
        r.stuckT = 0;
        if (!r.carrying && d > 60) { this.dematerialise(r); continue; }
        // Put it back on the route a little further on and carry on.
        const s = Math.min(L.len - 2, legProject(L, c.v.position.x, c.v.position.z) + 12);
        const q = legAt(L, s);
        c.v.placeAt(new Vector3(q.x, 0.3, q.z), q.yaw);
        c.ai.follow(L.nodes, L.pts[L.pts.length - 1]);
      }
    }
  }

  /**
   * Shelters near the player have one to three people waiting, a couple on
   * the bench. When a bus pulls up they walk to its door and get on (and
   * show up in a window seat); the stop fills again a minute or two later.
   */
  update(dt: number, camPos: Vector3): void {
    this.clock += dt;
    const p = this.host.playerPos();
    for (const st of BUS_STOPS) {
      const sp = shelterSpot(st);
      const d = Math.hypot(sp.x - p.x, sp.z - p.z);
      let list = this.waiting.get(st.id);
      if (list && d > WAIT_FAR) {
        for (const w of list) this.traffic.dropFigure(w.f);
        this.waiting.delete(st.id);
        continue;
      }
      if (!list && d < WAIT_NEAR && this.clock >= (this.refillAt.get(st.id) ?? 0)) list = this.fill(st, sp);
      if (!list) continue;
      const bus = this.runs.find((r) => r.car && r.dwell > 2 && this.atStop(r) === st);
      const near = Vector3.DistanceSquared(camPos, new Vector3(sp.x, 0, sp.z)) < 70 * 70;
      for (const w of [...list]) {
        if (bus && !w.to) { w.to = bus; w.sit = false; }
        if (w.to) {
          const door = this.door(w.to);
          if (!door || w.to.dwell <= 0) { w.to = null; continue; }
          const dx = door.x - w.x, dz = door.z - w.z, l = Math.hypot(dx, dz);
          if (l < 0.7) {
            // On board: a seat if there is one (standing room otherwise).
            this.traffic.busSawari(w.to.car!, w.seed);
            this.traffic.dropFigure(w.f);
            list.splice(list.indexOf(w), 1);
            continue;
          }
          const step = Math.min(l, 1.5 * dt);
          w.x += (dx / l) * step; w.z += (dz / l) * step;
          w.yaw = Math.atan2(dx, dz);
        }
        const r = w.f.h.root;
        // The bench top is half a metre up (shelters stand at ground level).
        r.position.set(w.x, w.sit ? 0.55 - 0.92 * w.f.h.scale : this.host.groundY(w.x, w.z), w.z);
        r.rotation.y = w.yaw;
        if (near) w.f.a.update(dt, { speed: w.to ? 1.5 : 0, grounded: true, pose: w.sit ? "sit" : "stand", carry: false, lookYaw: 0 });
      }
      if (!list.length) {
        this.waiting.delete(st.id);
        this.refillAt.set(st.id, this.clock + this.rng.range(60, 150));
      }
    }
  }

  private fill(st: BusStop, sp: { x: number; z: number; yaw: number }): Waiter[] {
    const list: Waiter[] = [];
    // Shelter frame: +z is out towards the road, the bench is at z -0.5.
    const fx = Math.sin(sp.yaw), fz = Math.cos(sp.yaw), rx = Math.cos(sp.yaw), rz = -Math.sin(sp.yaw);
    const n = 1 + Math.floor(this.rng.next() * 3);
    for (let i = 0; i < n; i++) {
      const sit = i < 2 && this.rng.next() < 0.6;
      const lx = sit ? -1.2 + i * 1.3 : this.rng.range(-1.6, 1.6), lz = sit ? -0.52 : this.rng.range(0.2, 0.7);
      const seed = 12000 + this.seeds++ * 7;
      const f = this.traffic.figure(`waiter_${st.id}_${seed}`, seed);
      list.push({ f, x: sp.x + rx * lx + fx * lz, z: sp.z + rz * lx + fz * lz, yaw: sp.yaw + this.rng.range(-0.4, 0.4), sit, to: null, seed });
    }
    this.waiting.set(st.id, list);
    return list;
  }

  /** Debug: how many are waiting at each stop near the player. */
  waiters(): Record<string, number> {
    return Object.fromEntries([...this.waiting].map(([k, v]) => [k, v.length]));
  }

  private arrive(r: BusRun): void {
    r.dwell = this.rng.range(12, 15);
    r.s = 0;
    r.stuckT = 0;
    if (r.car) r.car.ai.hold = true;
    this.host.call?.(r, r.plan.legs[r.leg]!.to);
  }

  private depart(r: BusRun): void {
    r.dwell = 0;
    r.leg = (r.leg + 1) % r.plan.legs.length;
    r.s = 0;
    if (r.car) {
      const L = r.plan.legs[r.leg]!;
      r.car.ai.hold = false;
      r.car.ai.follow(L.nodes, L.pts[L.pts.length - 1]);
    }
  }

  private materialise(r: BusRun): void {
    const at = this.where(r);
    // Never on top of another vehicle or the player.
    const p = this.host.playerPos();
    if (Math.hypot(at.x - p.x, at.z - p.z) < 14) return;
    if (this.traffic.cars.some((c) => Math.hypot(c.v.position.x - at.x, c.v.position.z - at.z) < 14)) return;
    const c = this.traffic.spawnBus(r.id, at.x, at.z, at.yaw, r.plan.route.livery);
    r.car = c;
    r.stuckT = 0;
    if (r.dwell > 0) c.ai.hold = true;
    else { const L = r.plan.legs[r.leg]!; c.ai.follow(L.nodes, L.pts[L.pts.length - 1]); }
  }

  private dematerialise(r: BusRun): void {
    const c = r.car!;
    if (r.dwell <= 0) r.s = legProject(r.plan.legs[r.leg]!, c.v.position.x, c.v.position.z);
    r.car = null;
    this.traffic.release(c, true);
  }

  /** Debug: put a bus `back` metres short of the end of leg `leg`. */
  warp(r: BusRun, leg: number, back: number): void {
    if (r.car) this.dematerialise(r);
    r.leg = leg;
    r.dwell = 0;
    r.s = Math.max(0, r.plan.legs[leg]!.len - back);
  }

  clear(): void {
    for (const r of this.runs) if (r.car) this.dematerialise(r);
    for (const list of this.waiting.values()) for (const w of list) this.traffic.dropFigure(w.f);
    this.waiting.clear();
  }
}
