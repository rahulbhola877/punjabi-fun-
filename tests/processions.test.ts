import { describe, expect, it } from "vitest";
import { buildRoadGraph } from "../src/world/nav";
import { ROADS } from "../src/world/region";
import { Rng } from "../src/render/textures";
import { pathAt, planRoute, procStep } from "../src/crowds/Processions";

describe("procession routes", () => {
  const g = buildRoadGraph();
  const spots: Array<[number, number]> = [];
  for (let x = -650; x <= 650; x += 130) for (let z = -650; z <= 650; z += 130) spots.push([x, z]);

  it("follow wide roads and keep the walkers on the tarmac", () => {
    const rng = new Rng(3);
    let found = 0;
    for (const [x, z] of spots) {
      const p = planRoute(g, rng, x, z, { minD: 25, maxD: 130, len: 220 });
      if (!p) continue;
      found++;
      expect(p.len).toBeGreaterThan(160);
      for (let s = 0; s < p.len; s += 2) {
        const q = pathAt(p, s);
        // The lane centre and the walkers either side of it are on a road.
        for (const lat of [-1.1, 0, 1.1]) {
          const lx = q.x - q.tz * lat, lz = q.z + q.tx * lat;
          expect(ROADS.some((r) => lx >= r.x0 - 0.3 && lx <= r.x1 + 0.3 && lz >= r.z0 - 0.3 && lz <= r.z1 + 0.3), `${x},${z} s=${s} lat=${lat} (${lx.toFixed(1)},${lz.toFixed(1)})`).toBe(true);
        }
      }
    }
    expect(found).toBeGreaterThan(40);
  });

  it("never step onto a track or a narrow gali", () => {
    for (const n of g.nodes) for (const l of n.links) {
      const m = g.nodes[l]!;
      if (procStep(m, n)) expect(Math.min(m.road!.x1 - m.road!.x0, m.road!.z1 - m.road!.z0)).toBeGreaterThanOrEqual(7);
    }
  });
});
