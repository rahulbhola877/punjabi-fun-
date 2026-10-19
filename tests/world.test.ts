import { describe, expect, it } from "vitest";
import { BUILDINGS, POIS, SAFE_SPOTS, VEHICLE_SPAWNS, PLAYER_START, footprint, isOpenGround, facadeToWorld, facadeFrame } from "../src/world/layout";
import { buildRoadGraph, buildWalkGraph } from "../src/world/nav";
import { medalFor, payFor, DESTINATIONS } from "../src/missions/Missions";

describe("district layout", () => {
  it("has no overlapping building footprints", () => {
    const f = BUILDINGS.map((b) => ({ id: b.id, r: footprint(b) }));
    for (let i = 0; i < f.length; i++) for (let j = i + 1; j < f.length; j++) {
      const a = f[i]!.r, b = f[j]!.r;
      const overlap = a.x0 < b.x1 - 0.01 && b.x0 < a.x1 - 0.01 && a.z0 < b.z1 - 0.01 && b.z0 < a.z1 - 0.01;
      expect(overlap, `${f[i]!.id} vs ${f[j]!.id}`).toBe(false);
    }
  });
  it("façade frames map the frontage onto the street edge", () => {
    for (const b of BUILDINGS) {
      const fr = facadeFrame(b);
      const a = facadeToWorld(b, 0, 0), c = facadeToWorld(b, fr.width, 0);
      const r = footprint(b);
      for (const p of [a, c]) {
        expect(p.x).toBeGreaterThanOrEqual(r.x0 - 1e-6);
        expect(p.x).toBeLessThanOrEqual(r.x1 + 1e-6);
        expect(p.z).toBeGreaterThanOrEqual(r.z0 - 1e-6);
        expect(p.z).toBeLessThanOrEqual(r.z1 + 1e-6);
      }
      // Outward direction points away from the footprint.
      const out = facadeToWorld(b, fr.width / 2, 1);
      const inside = out.x > r.x0 + 0.01 && out.x < r.x1 - 0.01 && out.z > r.z0 + 0.01 && out.z < r.z1 - 0.01;
      expect(inside, b.id).toBe(false);
    }
  });
  it("safe spots, spawns and street delivery points are on open ground", () => {
    for (const s of SAFE_SPOTS) expect(isOpenGround(s.x, s.z), JSON.stringify(s)).toBe(true);
    for (const v of VEHICLE_SPAWNS) expect(isOpenGround(v.x, v.z), v.id).toBe(true);
    expect(isOpenGround(PLAYER_START.x, PLAYER_START.z)).toBe(true);
    for (const d of DESTINATIONS) {
      const p = POIS[d.poi]!;
      const inBuilding = BUILDINGS.some((b) => { const r = footprint(b); return p.x > r.x0 + 0.2 && p.x < r.x1 - 0.2 && p.z > r.z0 + 0.2 && p.z < r.z1 - 0.2; });
      expect(inBuilding && d.poi !== "workshop", d.id).toBe(false);
    }
  });
});

describe("navigation", () => {
  it("road graph connects the dhaba to every delivery destination", () => {
    const g = buildRoadGraph();
    const from = g.nearest(POIS.dhabaCounter!.x, POIS.dhabaCounter!.z);
    for (const d of DESTINATIONS) {
      const p = POIS[d.poi]!;
      const path = g.path(from, g.nearest(p.x, p.z));
      expect(path.length, d.id).toBeGreaterThan(0);
    }
  });
  it("walk graph is fully connected", () => {
    const g = buildWalkGraph();
    const seen = new Set<number>([0]);
    const q = [0];
    while (q.length) for (const n of g.nodes[q.pop()!]!.links) if (!seen.has(n)) { seen.add(n); q.push(n); }
    expect(seen.size).toBe(g.nodes.length);
  });
});

describe("delivery scoring", () => {
  it("awards medals by time and care", () => {
    expect(medalFor(40, 60, 95)).toBe("gold");
    expect(medalFor(60, 60, 70)).toBe("silver");
    expect(medalFor(60, 60, 40)).toBe("bronze");
    expect(medalFor(100, 60, 100)).toBe("bronze");
  });
  it("pays more for speed and care, in ₹5 steps", () => {
    const fast = payFor(100, 30, 40, 100), slow = payFor(100, 50, 40, 100), messy = payFor(100, 30, 40, 20);
    expect(fast).toBeGreaterThan(slow);
    expect(fast).toBeGreaterThan(messy);
    expect(fast % 5).toBe(0);
  });
});
