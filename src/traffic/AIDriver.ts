import { Vector3 } from "../babylon";
import type { Vehicle } from "../vehicles/Vehicle";
import type { NavGraph, NavNode } from "../world/nav";
import type { Rng } from "../render/textures";

/** Distance from the centreline to the left-hand lane (India keeps left). */
export function laneOffset(n: NavNode | undefined): number {
  switch (n?.road?.kind) {
    case "highway": return 3.4;
    case "road": return 2.0;
    case "street": return 2.4;
    case "track": return 0.9;
    default: return 1.6;
  }
}

/** The bazaar's own centreline (no country road attached, not the lane or courtyard). */
export function isBazaarRoad(n: NavNode): boolean {
  return n.kind === "road" && !n.road && !n.tag && Math.abs(n.x) < 1;
}

/** Cruising speed by road (m/s). */
export function roadSpeed(n: NavNode | undefined, vmax: number): number {
  const s = n?.road?.kind === "highway" ? 17 : n?.road?.kind === "road" ? 12 : n?.road?.kind === "street" ? 9 : n?.road?.kind === "track" ? 7 : 4.5;
  return Math.min(s, vmax * 0.85);
}

/**
 * Drives a Vehicle along the road graph: pure-pursuit steering toward a
 * look-ahead point on a lane-offset path, speed from the road type and the
 * sharpness of upcoming turns, braking for whatever is ahead, and a short
 * reverse-and-retry when wedged.
 */
export class AIDriver {
  private pts: Array<{ x: number; z: number; v: number }> = [];
  private i = 0;
  private lastNode = -1;
  private stuckT = 0;
  /**
   * Rises each time this driver has to back out of something and decays while
   * it is moving. Traffic reads it to spot a car that cannot free itself.
   */
  jammedT = 0;
  private reverseT = 0;
  /** Extra speed factor (police chases drive harder). */
  aggression = 1;
  /** Metres of clear road ahead (set by the traffic manager each step). */
  clearAhead = Infinity;
  /** Hold position (e.g. after a crash, while the driver shouts). */
  hold = false;
  /** "Snake" bikers weave across the lane (metres of sideways swing). */
  zigzag = 0;
  /** A "snake" biker keeps weaving even while cutting in on a target. */
  snake = false;
  /** Small vehicles may also ride through the bazaar. */
  bazaar = false;
  private t = Math.random() * 10;
  /** When chasing, aim straight at this point once close. */
  chase: Vector3 | null = null;

  constructor(readonly v: Vehicle, private g: NavGraph, private rng: Rng) {}

  get done(): boolean {
    return this.i >= this.pts.length;
  }

  /** Start a meandering route from the nearest road node. */
  wander(steps = 6): void {
    const ok = (x: NavNode) => !!x.road || (this.bazaar && isBazaarRoad(x));
    let n = this.g.nearest(this.v.position.x, this.v.position.z, ok);
    if (n < 0) return;
    const nodes = [n];
    let prev = this.lastNode;
    for (let k = 0; k < steps; k++) {
      let links = this.g.nodes[n]!.links.filter((l) => l !== prev && ok(this.g.nodes[l]!));
      // Dead end (the bazaar's north end): turn around.
      if (!links.length && prev >= 0 && k > 0) links = [prev];
      if (!links.length) break;
      // Prefer going straight.
      const here = this.g.nodes[n]!;
      const from = prev >= 0 ? this.g.nodes[prev]! : null;
      let next = this.rng.pick(links);
      if (from && this.rng.next() < 0.65) {
        const dir = Math.atan2(here.x - from.x, here.z - from.z);
        let best = Infinity;
        for (const l of links) {
          const L = this.g.nodes[l]!;
          const turn = Math.abs(Math.atan2(Math.sin(Math.atan2(L.x - here.x, L.z - here.z) - dir), Math.cos(Math.atan2(L.x - here.x, L.z - here.z) - dir)));
          if (turn < best) { best = turn; next = l; }
        }
      }
      prev = n;
      n = next;
      nodes.push(n);
    }
    this.lastNode = nodes.length > 1 ? nodes[nodes.length - 2]! : -1;
    this.setNodes(nodes);
  }

  /** Route to a point along the roads. */
  routeTo(x: number, z: number): void {
    const a = this.g.nearest(this.v.position.x, this.v.position.z, (n) => n.kind === "road");
    const b = this.g.nearest(x, z, (n) => n.kind === "road");
    const p = this.g.path(a, b);
    this.setNodes(p);
    this.pts.push({ x, z, v: 6 });
  }

  private setNodes(ids: number[]): void {
    const N = ids.map((i) => this.g.nodes[i]!);
    this.pts = [];
    for (let k = 0; k < N.length; k++) {
      const n = N[k]!;
      const a = N[Math.max(0, k - 1)]!, b = N[Math.min(N.length - 1, k + 1)]!;
      let dx = b.x - a.x, dz = b.z - a.z;
      const d = Math.hypot(dx, dz) || 1;
      dx /= d; dz /= d;
      const off = laneOffset(n);
      // Left of the direction of travel: (-dz, dx).
      this.pts.push({ x: n.x - dz * off, z: n.z + dx * off, v: roadSpeed(n, this.v.spec.maxSpeed) });
    }
    // Slow for sharp turns.
    for (let k = 1; k < this.pts.length - 1; k++) {
      const p0 = this.pts[k - 1]!, p1 = this.pts[k]!, p2 = this.pts[k + 1]!;
      const t = Math.abs(Math.atan2(Math.sin(Math.atan2(p2.x - p1.x, p2.z - p1.z) - Math.atan2(p1.x - p0.x, p1.z - p0.z)), Math.cos(Math.atan2(p2.x - p1.x, p2.z - p1.z) - Math.atan2(p1.x - p0.x, p1.z - p0.z))));
      p1.v = Math.min(p1.v, Math.max(4, p1.v * (1 - (t / Math.PI) * 1.4)));
    }
    this.i = 0;
    // Skip points already behind us.
    while (this.i < this.pts.length - 1) {
      const p = this.pts[this.i]!, q = this.pts[this.i + 1]!;
      const ax = q.x - p.x, az = q.z - p.z;
      const t = ((this.v.position.x - p.x) * ax + (this.v.position.z - p.z) * az) / (ax * ax + az * az || 1);
      if (t > 0.6) this.i++;
      else break;
    }
  }

  update(dt: number): void {
    const v = this.v;
    const pos = v.position;
    if (this.hold || (this.done && !this.chase)) {
      v.controls = { throttle: v.speed > 0.5 ? -1 : 0, steer: 0, handbrake: v.speed < 0.6 };
      return;
    }
    // Advance along the path.
    while (this.i < this.pts.length) {
      const p = this.pts[this.i]!;
      if (Math.hypot(p.x - pos.x, p.z - pos.z) < 5 + v.speed * 0.3) this.i++;
      else break;
    }
    let target: { x: number; z: number; v: number } | undefined = this.pts[this.i];
    if (this.chase && (this.snake || !target || Vector3.Distance(pos, this.chase) < 35)) target = { x: this.chase.x, z: this.chase.z, v: this.snake ? 11 : 12 };
    if (!target) { v.controls = { throttle: 0, steer: 0, handbrake: true }; return; }
    const yaw = v.yaw;
    this.t += dt;
    let wx = 0, wz = 0;
    if (this.zigzag > 0 && (!this.chase || this.snake)) {
      // Swing the aim point left and right of the lane, like a biker showing off.
      const w = Math.sin(this.t * 1.7) * this.zigzag;
      wx = Math.cos(yaw) * w;
      wz = -Math.sin(yaw) * w;
    }
    const dx = target.x + wx - pos.x, dz = target.z + wz - pos.z;
    const lx = dx * Math.cos(yaw) - dz * Math.sin(yaw), lz = dx * Math.sin(yaw) + dz * Math.cos(yaw);
    const ang = Math.atan2(lx, lz);
    let steer = Math.max(-1, Math.min(1, ang * 1.9));
    let want = target.v * this.aggression;
    if (Math.abs(ang) > 0.6) want = Math.min(want, 5);
    // What this driver would do with an empty road, kept before the brake
    // below clamps it: "wants to move but isn't" is the only honest test for
    // being stuck, and after the clamp every blocked car looks content.
    const desired = want;
    // Brake for anything ahead.
    if (this.clearAhead < 18) want = Math.min(want, Math.max(0, (this.clearAhead - 5) * 0.9));
    let throttle = Math.max(-1, Math.min(1, (want - v.forwardSpeed) * 0.45));
    let handbrake = false;
    if (want < 0.3) { throttle = v.forwardSpeed > 0.4 ? -1 : 0; handbrake = v.speed < 0.6; }
    // Wedged against something: back up and swing the nose.
    if (this.reverseT > 0) {
      this.reverseT -= dt;
      throttle = -0.8;
      steer = -steer;
      handbrake = false;
    } else if (desired > 0.3 && v.speed < 0.4) {
      // Standing still with somewhere to be. A clear road ahead means we are
      // wedged on scenery and should back off straight away; a blocked road
      // means a queue, which is normal for a few seconds and a deadlock after
      // that — the car in front may itself be stuck on the car in front of it.
      this.stuckT += dt;
      if (this.stuckT > (this.clearAhead > 6 ? 2.5 : 7)) {
        this.stuckT = 0;
        this.reverseT = 1.6;
        this.jammedT += 1;
      }
    } else { this.stuckT = Math.max(0, this.stuckT - dt); this.jammedT = Math.max(0, this.jammedT - dt * 0.2); }
    v.controls = { throttle, steer, handbrake };
  }
}
