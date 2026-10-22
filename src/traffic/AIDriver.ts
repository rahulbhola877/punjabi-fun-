import { Vector3 } from "../babylon";
import type { Vehicle } from "../vehicles/Vehicle";
import type { NavGraph, NavNode } from "../world/nav";
import type { Rng } from "../render/textures";
import { CART_ROADS } from "../world/region";

/** Distance from the centreline to the left-hand lane (India keeps left). */
export function laneOffset(n: NavNode | undefined): number {
  const r = n?.road;
  const k = r?.kind === "highway" ? 3.4 : r?.kind === "road" ? 2.0 : r?.kind === "street" ? 2.4 : r?.kind === "track" ? 0.9 : 1.6;
  // A 6 m colony gali has no room for a 2.4 m lane offset: the wheels ride
  // the kerb. Keep a metre and a bit from the edge.
  return r ? Math.max(0.6, Math.min(k, Math.min(r.x1 - r.x0, r.z1 - r.z0) / 2 - 1.2)) : k;
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
  /** Route points: lane position, cruise speed, and how close counts as reached. */
  private pts: Array<{ x: number; z: number; v: number; r?: number }> = [];
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
  wander(steps = 6, first = -1): void {
    const ok = (x: NavNode) => !!x.road || (this.bazaar && isBazaarRoad(x));
    let n = this.g.nearest(this.v.position.x, this.v.position.z, ok);
    if (n < 0) return;
    let prev = this.lastNode;
    // Start the way we face: if the nearest node is already behind us, begin
    // at the linked node ahead instead of turning round to reach it.
    const pos = this.v.position, fx = Math.sin(this.v.yaw), fz = Math.cos(this.v.yaw);
    const ahead = (id: number) => (this.g.nodes[id]!.x - pos.x) * fx + (this.g.nodes[id]!.z - pos.z) * fz;
    if (first < 0 && ahead(n) < 0) {
      const fwd = this.g.nodes[n]!.links.filter((l) => ok(this.g.nodes[l]!) && ahead(l) > 0).sort((a, b) => ahead(a) - ahead(b))[0];
      if (fwd !== undefined) { prev = n; n = fwd; }
    }
    const nodes = [n];
    for (let k = 0; k < steps; k++) {
      let links = this.g.nodes[n]!.links.filter((l) => l !== prev && ok(this.g.nodes[l]!));
      // Never turn into a dead-end stub when the road goes on elsewhere: a
      // car cannot turn round in a six-metre gali.
      const through = links.filter((l) => this.g.nodes[l]!.links.length > 1);
      if (through.length) links = through;
      // Dead end (the bazaar's north end): turn around.
      if (!links.length && prev >= 0 && k > 0) links = [prev];
      if (!links.length) break;
      // Prefer going straight.
      const here = this.g.nodes[n]!;
      const from = prev >= 0 ? this.g.nodes[prev]! : null;
      let next = this.rng.pick(links);
      // A freshly spawned vehicle carries on the way it faces instead of
      // pulling a U-turn across a narrow gali.
      if (k === 0 && links.includes(first)) next = first;
      else if (from && this.rng.next() < 0.65) {
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

  /** Drive a fixed list of road nodes, then pull up at `end` (a bus stop). */
  follow(ids: number[], end?: { x: number; z: number }): void {
    this.setNodes(ids);
    if (end) this.pts.push({ x: end.x, z: end.z, v: 2.5, r: 1.5 });
    // Join the route where we are on it (a bus taking over half-way along a
    // leg), not at its start: head for the end of the nearest piece.
    const pos = this.v.position;
    let bd = Infinity;
    for (let k = 1; k < this.pts.length; k++) {
      const A = this.pts[k - 1]!, B = this.pts[k]!;
      const ax = B.x - A.x, az = B.z - A.z, l2 = ax * ax + az * az || 1;
      const f = Math.max(0, Math.min(1, ((pos.x - A.x) * ax + (pos.z - A.z) * az) / l2));
      const d = (A.x + ax * f - pos.x) ** 2 + (A.z + az * f - pos.z) ** 2;
      if (d < bd - 1) { bd = d; this.i = k; }
    }
  }

  private get turnR(): number {
    return this.v.spec.wheelbase / Math.tan(this.v.spec.steerMax) * 0.9;
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
      let off = laneOffset(n);
      // Carts on the tarmac take the outer 1.4 m: a tractor or a truck has
      // to drive further in to get past them.
      if (n.road && CART_ROADS.has(n.road.id)) off = Math.max(0.6, Math.min(off, Math.min(n.road.x1 - n.road.x0, n.road.z1 - n.road.z0) / 2 - 1.6 - this.v.spec.halfWidth));
      // Left of the direction of travel: (-dz, dx).
      // Narrow galis have house walls right at the corners: start each turn
      // one turning circle before the corner, neither cutting across the
      // corner plot nor swinging wide into the house opposite.
      const w = n.road ? Math.min(n.road.x1 - n.road.x0, n.road.z1 - n.road.z0) : 8;
      this.pts.push({ x: n.x - dz * off, z: n.z + dx * off, v: roadSpeed(n, this.v.spec.maxSpeed), r: w <= 8.01 ? this.turnR : undefined });
    }
    // Slow for sharp turns.
    for (let k = 1; k < this.pts.length - 1; k++) {
      const p0 = this.pts[k - 1]!, p1 = this.pts[k]!, p2 = this.pts[k + 1]!;
      const t = Math.abs(Math.atan2(Math.sin(Math.atan2(p2.x - p1.x, p2.z - p1.z) - Math.atan2(p1.x - p0.x, p1.z - p0.z)), Math.cos(Math.atan2(p2.x - p1.x, p2.z - p1.z) - Math.atan2(p1.x - p0.x, p1.z - p0.z))));
      p1.v = Math.min(p1.v, Math.max(p1.r ? 3 : 4, p1.v * (1 - (t / Math.PI) * 1.4)));
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
      const d = Math.hypot(p.x - pos.x, p.z - pos.z);
      if (d < (p.r ?? 5) + v.speed * 0.3) { this.i++; continue; }
      // A point beside or behind us inside two turning circles can never be
      // reached by steering at it — the vehicle just orbits it. Let it go.
      if (d < this.turnR * 2.2 && this.i < this.pts.length - 1) {
        const lx = (p.x - pos.x) * Math.cos(v.yaw) - (p.z - pos.z) * Math.sin(v.yaw), lz = (p.x - pos.x) * Math.sin(v.yaw) + (p.z - pos.z) * Math.cos(v.yaw);
        if (Math.abs(Math.atan2(lx, lz)) > 1.2) { this.i++; continue; }
      }
      break;
    }
    let target: { x: number; z: number; v: number; r?: number } | undefined = this.pts[this.i];
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
    // Pure pursuit: aim at a point a few metres ahead on the current leg of
    // the route rather than at its far end, so a car that came out of a
    // turn wide is back in its lane within a few metres, not a whole block.
    let ax = target.x, az = target.z;
    const from = this.pts[this.i - 1];
    if (from && target === this.pts[this.i]) {
      const sx = target.x - from.x, sz = target.z - from.z, L2 = sx * sx + sz * sz;
      if (L2 > 1) {
        const L = Math.sqrt(L2);
        const t = Math.max(0, Math.min(1, ((pos.x - from.x) * sx + (pos.z - from.z) * sz) / L2)) + (4 + v.speed * 0.5) / L;
        if (t < 1) { ax = from.x + sx * t; az = from.z + sz * t; }
      }
    }
    const dx = ax + wx - pos.x, dz = az + wz - pos.z;
    const lx = dx * Math.cos(yaw) - dz * Math.sin(yaw), lz = dx * Math.sin(yaw) + dz * Math.cos(yaw);
    const ang = Math.atan2(lx, lz);
    let steer = Math.max(-1, Math.min(1, ang * 1.9));
    // Cruise at the leg's speed and brake for a slow corner only as it
    // comes up, rather than crawling the whole block at turning pace.
    let want = target.v;
    if (from && target === this.pts[this.i] && from.v > target.v) {
      const left = Math.max(0, Math.hypot(target.x - pos.x, target.z - pos.z) - (target.r ?? 5));
      want = Math.min(from.v, Math.sqrt(target.v * target.v + 2 * 2.5 * left));
    }
    want *= this.aggression;
    if (Math.abs(ang) > 0.6) want = Math.min(want, 5);
    // Round a gali corner at walking pace; speed up once straight.
    if (target.r && Math.abs(ang) > 0.25) want = Math.min(want, 3);
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
