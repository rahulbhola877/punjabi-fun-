import { COURTYARD, LANE_W, ROAD_HALF, STREET_Z0, STREET_Z1, BUILDINGS, facadeToWorld } from "./layout";

export interface NavNode { id: number; x: number; z: number; kind: "road" | "walk" | "cross" | "stop"; links: number[]; tag?: string }

/** Small undirected waypoint graph with A* search. Pure data, unit-tested. */
export class NavGraph {
  nodes: NavNode[] = [];

  add(x: number, z: number, kind: NavNode["kind"], tag?: string): number {
    const id = this.nodes.length;
    this.nodes.push({ id, x, z, kind, links: [], tag });
    return id;
  }

  link(a: number, b: number): void {
    if (a === b) return;
    if (!this.nodes[a]!.links.includes(b)) this.nodes[a]!.links.push(b);
    if (!this.nodes[b]!.links.includes(a)) this.nodes[b]!.links.push(a);
  }

  nearest(x: number, z: number, pred: (n: NavNode) => boolean = () => true): number {
    let best = -1, bd = Infinity;
    for (const n of this.nodes) {
      if (!pred(n)) continue;
      const d = (n.x - x) ** 2 + (n.z - z) ** 2;
      if (d < bd) { bd = d; best = n.id; }
    }
    return best;
  }

  private h(a: number, b: number): number {
    const A = this.nodes[a]!, B = this.nodes[b]!;
    return Math.hypot(A.x - B.x, A.z - B.z);
  }

  path(start: number, goal: number): number[] {
    if (start < 0 || goal < 0) return [];
    const open = new Set<number>([start]);
    const came = new Map<number, number>();
    const g = new Map<number, number>([[start, 0]]);
    const f = new Map<number, number>([[start, this.h(start, goal)]]);
    while (open.size) {
      let cur = -1, cf = Infinity;
      for (const n of open) { const v = f.get(n) ?? Infinity; if (v < cf) { cf = v; cur = n; } }
      if (cur === goal) {
        const out = [cur];
        while (came.has(cur)) { cur = came.get(cur)!; out.push(cur); }
        return out.reverse();
      }
      open.delete(cur);
      for (const nb of this.nodes[cur]!.links) {
        const t = (g.get(cur) ?? Infinity) + this.h(cur, nb);
        if (t < (g.get(nb) ?? Infinity)) {
          came.set(nb, cur);
          g.set(nb, t);
          f.set(nb, t + this.h(nb, goal));
          open.add(nb);
        }
      }
    }
    return [];
  }

  /** Total length of a path in metres. */
  length(p: number[]): number {
    let s = 0;
    for (let i = 1; i < p.length; i++) s += this.h(p[i - 1]!, p[i]!);
    return s;
  }
}

/** Drivable network: road centreline, west lane, courtyard and workshop apron. */
export function buildRoadGraph(): NavGraph {
  const g = new NavGraph();
  let prev = -1;
  const laneZ = (LANE_W.z0 + LANE_W.z1) / 2;
  let laneJoin = -1, apronJoin = -1;
  for (let z = STREET_Z0 + 2; z <= STREET_Z1 - 6; z += 6) {
    const id = g.add(0, z, "road");
    if (prev >= 0) g.link(prev, id);
    if (Math.abs(z - laneZ) < 3.1 && laneJoin < 0) laneJoin = id;
    if (Math.abs(z - 24) < 3.1 && apronJoin < 0) apronJoin = id;
    prev = id;
  }
  // Lane to the courtyard.
  let lp = laneJoin;
  for (let x = -ROAD_HALF - 2; x >= LANE_W.x0; x -= 6) {
    const id = g.add(x, laneZ, "road");
    g.link(lp, id);
    lp = id;
  }
  const court = g.add((COURTYARD.x0 + COURTYARD.x1) / 2, laneZ, "road", "courtyard");
  g.link(lp, court);
  const apron = g.add(8.5, 24, "road", "apron");
  g.link(apronJoin, apron);
  return g;
}

/** Pedestrian network along both footpaths, the lane and the courtyard, with crossings and shop stops. */
export function buildWalkGraph(): NavGraph {
  const g = new NavGraph();
  const lines: Record<"w" | "e", number[]> = { w: [], e: [] };
  for (const side of ["w", "e"] as const) {
    const x = side === "w" ? -5.15 : 5.15;
    let prev = -1;
    for (let z = STREET_Z0 + 3; z <= STREET_Z1 - 5; z += 4) {
      const id = g.add(x, z, "walk");
      if (prev >= 0) g.link(prev, id);
      lines[side].push(id);
      prev = id;
    }
  }
  // Crossings over the bazaar road.
  for (const z of [-58, -38, -14, 6, 30]) {
    const a = g.nearest(-5.15, z, (n) => n.kind === "walk" && n.x < 0);
    const b = g.nearest(5.15, z, (n) => n.kind === "walk" && n.x > 0);
    const m = g.add(0, g.nodes[a]!.z, "cross");
    g.link(a, m);
    g.link(m, b);
  }
  // Lane and courtyard.
  const laneZ = (LANE_W.z0 + LANE_W.z1) / 2;
  let lp = g.nearest(-5.15, laneZ, (n) => n.kind === "walk");
  for (let x = -8; x >= LANE_W.x0; x -= 4) {
    const id = g.add(x, laneZ + ((x / 4) % 2 ? 0.6 : -0.6), "walk");
    g.link(lp, id);
    lp = id;
  }
  const c = COURTYARD;
  const ring = [[-36, -14], [-36, -2], [-43, -2], [-43, -14]].map(([x, z]) => g.add(x!, z!, "walk", "court"));
  for (let i = 0; i < ring.length; i++) g.link(ring[i]!, ring[(i + 1) % ring.length]!);
  const courtIn = g.add(c.x1 - 1, laneZ, "walk", "court");
  g.link(lp, courtIn);
  g.link(courtIn, ring[0]!);
  g.link(courtIn, ring[1]!);
  // Shop stops: browse in front of each shopfront.
  for (const b of BUILDINGS) {
    if (b.use === "house" || b.use === "gate" || (b.side !== "west" && b.side !== "east")) continue;
    const mid = facadeToWorld(b, (b.a1 - b.a0) / 2, 0.55);
    const s = g.add(mid.x, mid.z, "stop", b.id);
    g.link(s, g.nearest(mid.x, mid.z, (n) => n.kind === "walk"));
  }
  return g;
}
