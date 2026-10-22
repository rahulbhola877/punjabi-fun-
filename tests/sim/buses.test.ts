import { describe, expect, it } from "vitest";
import { buildRoadGraph } from "../../src/world/nav";
import { planRoutes, busRoad, legAt } from "../../src/traffic/busPlan";
import { TransformNode } from "../../src/babylon";
import { makeWorld, v3 } from "./harness";
import { districtColliders } from "./district";
import { Vehicle } from "../../src/vehicles/Vehicle";
import { AIDriver } from "../../src/traffic/AIDriver";
import { FIXED_DT } from "../../src/app/config";
import { Rng } from "../../src/render/textures";
import { BUS_STOPS, shelterSpot } from "../../src/world/busRoutes";
import { OUTER_BUILDINGS, ROADS, SITES } from "../../src/world/region";

function fakeModel(scene: import("../../src/babylon").Scene, n: number) {
  return { root: new TransformNode("vis", scene), steer: new TransformNode("s", scene), wheels: Array.from({ length: n }, () => new TransformNode("w", scene)), meshes: [], paintable: [] };
}

describe("bus routes", () => {
  const g = buildRoadGraph();
  it("every leg runs on bus roads", () => {
    const plans = planRoutes(g);
    for (const p of plans) for (const L of p.legs) {
      if (process.env.DIAG) console.log(p.route.id, L.from.id, "->", L.to.id, Math.round(L.len), "m", L.nodes.map((i) => g.nodes[i]!.road?.id).filter((r, k, a) => r !== a[k - 1]).join(" "));
      expect(L.len).toBeGreaterThan(50);
      for (const i of L.nodes) expect(busRoad(g.nodes[i]!)).toBe(true);
    }
  });
});

describe("bus shelters", () => {
  it("stand clear of houses, sites and other roads", () => {
    const bad: string[] = [];
    for (const st of BUS_STOPS) {
      const s = shelterSpot(st);
      const hit = (r: { x0: number; x1: number; z0: number; z1: number }) => s.x > r.x0 - 3 && s.x < r.x1 + 3 && s.z > r.z0 - 3 && s.z < r.z1 + 3;
      const near = [...OUTER_BUILDINGS, ...SITES, ...ROADS.filter((r) => r.id !== st.road)].filter(hit)
        // Nawan Shehar's stop is the adda's own gate.
        .filter((r) => !(st.id === "nsAdda" && r.id === "busAdda")).map((r) => r.id);
      if (near.length) bad.push(`${st.id}: ${near.join(",")}`);
    }
    expect(bad).toEqual([]);
  });
});

describe("buses drive their routes", () => {
  const g = buildRoadGraph();
  it("every leg, on the real colliders, to the stop", async () => {
    const w = await makeWorld((c, scene) => districtColliders(scene, c), 2200);
    const rng = new Rng(3);
    const fails: string[] = [];
    // From the stop, and taking over half-way along (a bus coming into view).
    for (const p of planRoutes(g)) for (const L of p.legs) for (const from of [0, 0.5]) {
      const a = legAt(L, L.len * from);
      const v = new Vehicle(`b_${L.from.id}`, "bus", w.scene, w.physics, fakeModel(w.scene, 4), v3(a.x, 0.05, a.z), a.yaw, "roadways");
      v.hasDriver = true;
      const ai = new AIDriver(v, g, rng);
      ai.follow(L.nodes, L.pts[L.pts.length - 1]);
      let still = 0, t = 0, worst = 0;
      for (; t < L.len / 3 + 40 && !ai.done; t += FIXED_DT) {
        ai.update(FIXED_DT);
        v.fixedUpdate(FIXED_DT); w.physics.step(FIXED_DT); v.postStep(FIXED_DT);
        still = v.speed < 0.5 ? still + FIXED_DT : 0;
        worst = Math.max(worst, still);
      }
      const end = L.pts[L.pts.length - 1]!;
      const miss = Math.hypot(v.position.x - end.x, v.position.z - end.z);
      if (process.env.DIAG) console.log(`${p.route.id} ${L.from.id}->${L.to.id}@${from} ${t.toFixed(0)} s, miss ${miss.toFixed(1)} m, worst stand ${worst.toFixed(1)} s at ${v.position.x.toFixed(0)},${v.position.z.toFixed(0)}`);
      if (!ai.done || miss > 5 || worst > 8 || v.dir(v3(0, 1, 0)).y < 0.8) fails.push(`${p.route.id} ${L.from.id}->${L.to.id}@${from} stopped at ${v.position.x.toFixed(0)},${v.position.z.toFixed(0)} (miss ${miss.toFixed(0)} m)`);
      v.dispose();
    }
    expect(fails).toEqual([]);
  }, 900000);
});
