/**
 * Bus routes turned into drivable legs: for every pair of consecutive stops,
 * the road-graph path between them (only on roads a bus fits: tarmac at
 * least 7 m wide, never the bazaar or a kacha track) and its lane-offset
 * polyline, which the buses follow while nobody is watching. Pure data.
 */
import type { NavGraph, NavNode } from "../world/nav";
import { BUS_ROUTES, stopById, type BusRoute, type BusStop } from "../world/busRoutes";
import { laneOffset } from "./AIDriver";
import { COLONIES } from "../world/colonies";
import { ROADS, type Road } from "../world/region";

/** Colony and mohalla roads: a ten-metre bus cannot turn in them. */
const COLONY_ROADS = new Set(COLONIES.flatMap((c) => c.roads.map((r) => r.id)));

const fits = (r: Road) => r.kind !== "track" && !COLONY_ROADS.has(r.id) && Math.min(r.x1 - r.x0, r.z1 - r.z0) >= 7;
const BUS_ROADS = ROADS.filter(fits);

/** Roads a ten-metre bus can use. */
export function busRoad(n: NavNode): boolean {
  return !!n.road && fits(n.road);
}

/**
 * A step a bus can take: onto a bus road, and along one. A junction node
 * belongs to one road, so the link out of it can run down a kacha track.
 */
export function busStep(n: NavNode, from: NavNode): boolean {
  if (!busRoad(n)) return false;
  const mx = (n.x + from.x) / 2, mz = (n.z + from.z) / 2;
  return BUS_ROADS.some((r) => mx >= r.x0 - 0.5 && mx <= r.x1 + 0.5 && mz >= r.z0 - 0.5 && mz <= r.z1 + 0.5);
}

export interface BusLeg {
  from: BusStop;
  to: BusStop;
  /** Road-graph nodes from the stop's road to the next stop's road. */
  nodes: number[];
  /** Lane points (left of the direction of travel), ending at the stop. */
  pts: Array<{ x: number; z: number }>;
  /** Running distance along `pts`. */
  acc: number[];
  len: number;
}

/** The node on a stop's own road nearest to it. */
export function stopNode(g: NavGraph, s: BusStop): number {
  return g.nearest(s.x, s.z, (n) => n.road?.id === s.road);
}

/** Where a bus pulls up for a stop, given which way it is going. */
export function stopPoint(g: NavGraph, s: BusStop, dx: number, dz: number): { x: number; z: number } {
  const n = g.nodes[stopNode(g, s)]!;
  const d = Math.hypot(dx, dz) || 1;
  const off = laneOffset(n) + 0.6;
  // The stop lies on the centreline; the bus keeps to its own (left) lane.
  return { x: s.x - (dz / d) * off, z: s.z + (dx / d) * off };
}

export function planLeg(g: NavGraph, a: BusStop, b: BusStop): BusLeg | null {
  const nodes = g.path(stopNode(g, a), stopNode(g, b), busStep);
  if (nodes.length < 2) return null;
  // A stop's nearest node can lie either side of it: drop an end node the
  // bus would have to pass and come back from.
  const between = (s: BusStop, i: number, j: number) => {
    const A = g.nodes[nodes[i]!]!, B = g.nodes[nodes[j]!]!;
    const ax = B.x - A.x, az = B.z - A.z;
    const t = ((s.x - A.x) * ax + (s.z - A.z) * az) / (ax * ax + az * az || 1);
    return t > 0 && t < 1;
  };
  if (nodes.length > 2 && between(a, 0, 1)) nodes.shift();
  if (nodes.length > 2 && between(b, nodes.length - 2, nodes.length - 1)) nodes.pop();
  const N = nodes.map((i) => g.nodes[i]!);
  const pts: Array<{ x: number; z: number }> = [];
  const s0 = N[0]!, s1 = N[1]!;
  pts.push(stopPoint(g, a, s1.x - s0.x, s1.z - s0.z));
  for (let k = 0; k < N.length; k++) {
    const n = N[k]!;
    const p = N[Math.max(0, k - 1)]!, q = N[Math.min(N.length - 1, k + 1)]!;
    const dx = q.x - p.x, dz = q.z - p.z, d = Math.hypot(dx, dz) || 1;
    const off = laneOffset(n);
    pts.push({ x: n.x - (dz / d) * off, z: n.z + (dx / d) * off });
  }
  const e0 = N[N.length - 2]!, e1 = N[N.length - 1]!;
  pts.push(stopPoint(g, b, e1.x - e0.x, e1.z - e0.z));
  const acc = [0];
  for (let i = 1; i < pts.length; i++) acc.push(acc[i - 1]! + Math.hypot(pts[i]!.x - pts[i - 1]!.x, pts[i]!.z - pts[i - 1]!.z));
  return { from: a, to: b, nodes, pts, acc, len: acc[acc.length - 1]! };
}

/** A point and heading at distance `s` along a leg. */
export function legAt(L: BusLeg, s: number): { x: number; z: number; yaw: number; i: number } {
  const t = Math.max(0, Math.min(L.len, s));
  let i = 1;
  while (i < L.pts.length - 1 && L.acc[i]! < t) i++;
  const A = L.pts[i - 1]!, B = L.pts[i]!;
  const seg = L.acc[i]! - L.acc[i - 1]! || 1;
  const f = (t - L.acc[i - 1]!) / seg;
  return { x: A.x + (B.x - A.x) * f, z: A.z + (B.z - A.z) * f, yaw: Math.atan2(B.x - A.x, B.z - A.z), i };
}

/** Distance along a leg of the point nearest to (x, z). */
export function legProject(L: BusLeg, x: number, z: number): number {
  let best = 0, bd = Infinity;
  for (let i = 1; i < L.pts.length; i++) {
    const A = L.pts[i - 1]!, B = L.pts[i]!;
    const ax = B.x - A.x, az = B.z - A.z, l2 = ax * ax + az * az || 1;
    const f = Math.max(0, Math.min(1, ((x - A.x) * ax + (z - A.z) * az) / l2));
    const d = (A.x + ax * f - x) ** 2 + (A.z + az * f - z) ** 2;
    if (d < bd) { bd = d; best = L.acc[i - 1]! + Math.sqrt(l2) * f; }
  }
  return best;
}

export interface PlannedRoute {
  route: BusRoute;
  /** Legs out to the far end and back again, in driving order. */
  legs: BusLeg[];
}

/** Every route's legs, out and back. Throws if a leg has no bus road. */
export function planRoutes(g: NavGraph): PlannedRoute[] {
  return BUS_ROUTES.map((route) => {
    const ids = [...route.stops, ...route.stops.slice(0, -1).reverse()];
    const legs: BusLeg[] = [];
    for (let i = 1; i < ids.length; i++) {
      const L = planLeg(g, stopById(ids[i - 1]!), stopById(ids[i]!));
      if (!L) throw new Error(`no bus road from ${ids[i - 1]} to ${ids[i]}`);
      legs.push(L);
    }
    return { route, legs };
  });
}
