import { Vector3 } from "../babylon";
import type { NavGraph } from "../world/nav";
import type { BusStop } from "../world/busRoutes";
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

export interface BusHost {
  playerPos(): Vector3;
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
  }
}
