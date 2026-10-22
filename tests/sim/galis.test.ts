import { describe, expect, it } from "vitest";
import { TransformNode } from "../../src/babylon";
import { makeWorld, v3 } from "./harness";
import { districtColliders } from "./district";
import { Vehicle } from "../../src/vehicles/Vehicle";
import { AIDriver } from "../../src/traffic/AIDriver";
import { buildRoadGraph } from "../../src/world/nav";
import { COLONIES } from "../../src/world/colonies";
import { FIXED_DT } from "../../src/app/config";
import { SPECS, type VehicleType } from "../../src/vehicles/specs";
import { Rng } from "../../src/render/textures";

function fakeModel(scene: import("../../src/babylon").Scene, n: number) {
  return { root: new TransformNode("vis", scene), steer: new TransformNode("s", scene), wheels: Array.from({ length: n }, () => new TransformNode("w", scene)), meshes: [], paintable: [] };
}

/**
 * Colony galis are 6 m wide between kerbs, lamps, neems and welcome arches.
 * Traffic driven by the real AI on the real colliders must keep moving
 * through every colony and mohalla: no vehicle may sit wedged on scenery.
 */
describe("traffic keeps moving", () => {
  const g = buildRoadGraph();
  it("on the other roads: city, Ludhiana, the highway and the tracks", async () => {
    let boxes: Array<{ cx: number; cy: number; cz: number; sx: number; sy: number; sz: number; rotY: number }> = [];
    const w = await makeWorld((c, scene) => { districtColliders(scene, c); boxes = c.boxes; }, 2200);
    const rng = new Rng(17);
    const colonyRoads = new Set(COLONIES.flatMap((c) => c.roads.map((r) => r.id)));
    const nodes = g.nodes.filter((n) => n.road && !colonyRoads.has(n.road.id) && n.links.length > 1);
    const stalls: string[] = [];
    for (let k = 0; k < 60; k++) {
      const type = (["car", "truck", "auto", "tractor", "rickshaw", "motorcycle"] as VehicleType[])[k % 6]!;
      const n = nodes[(k * 97 + 5) % nodes.length]!;
      const next = g.nodes[n.links[0]!]!;
      const v = new Vehicle(`r${k}`, type, w.scene, w.physics, fakeModel(w.scene, SPECS[type].wheels.length), v3(n.x, 0.05, n.z), Math.atan2(next.x - n.x, next.z - n.z), "mint");
      v.hasDriver = true;
      const ai = new AIDriver(v, g, rng);
      ai.wander(8, next.id);
      let still = 0, reported = false;
      for (let i = 0; i < 30 / FIXED_DT; i++) {
        if (ai.done) ai.wander(8);
        ai.update(FIXED_DT);
        v.fixedUpdate(FIXED_DT); w.physics.step(FIXED_DT); v.postStep(FIXED_DT);
        still = v.speed < 0.5 ? still + FIXED_DT : Math.max(0, still - FIXED_DT * 0.5);
        if (still > 8 && !reported) { reported = true; stalls.push(`${n.road!.id} ${type} at ${v.position.x.toFixed(0)},${v.position.z.toFixed(0)}`);
          if (process.env.DIAG) {
            const near = boxes.filter((b) => Math.abs(b.cx - v.position.x) < 3 + b.sx / 2 && Math.abs(b.cz - v.position.z) < 3 + b.sz / 2 && b.cy + b.sy / 2 > 0.05);
            console.log(`${type} pos ${v.position.x.toFixed(1)},${v.position.z.toFixed(1)} yaw ${(v.yaw * 57.3).toFixed(0)} up ${v.dir(v3(0, 1, 0)).y.toFixed(2)}\n` + near.map((b) => `  box c(${b.cx.toFixed(1)},${b.cy.toFixed(2)},${b.cz.toFixed(1)}) s(${b.sx.toFixed(2)},${b.sy.toFixed(2)},${b.sz.toFixed(2)}) r${b.rotY.toFixed(2)}`).join("\n"));
          }
        }
      }
      if (v.dir(v3(0, 1, 0)).y < 0.5) stalls.push(`${n.road!.id} ${type} flipped at ${v.position.x.toFixed(0)},${v.position.z.toFixed(0)}`);
      v.dispose();
    }
    expect(stalls).toEqual([]);
  }, 600000);

  it("through every colony and village", async () => {
    let boxes: Array<{ cx: number; cy: number; cz: number; sx: number; sy: number; sz: number; rotY: number }> = [];
    const w = await makeWorld((c, scene) => { districtColliders(scene, c); boxes = c.boxes; }, 2200);
    const rng = new Rng(11);
    const stalls: string[] = [];
    let runs = 0;
    for (const col of COLONIES) {
      const ids = new Set(col.roads.map((r) => r.id));
      const nodes = g.nodes.filter((n) => n.road && ids.has(n.road.id) && n.links.length);
      for (let k = 0; k < 12; k++) {
        const type = (["jeep", "erickshaw", "rickshaw", "car"] as VehicleType[])[k % 4]!;
        const n = nodes[(k * 7 + 3) % nodes.length]!;
        const next = g.nodes[n.links[0]!]!;
        const yaw = Math.atan2(next.x - n.x, next.z - n.z);
        const v = new Vehicle(`t${runs++}`, type, w.scene, w.physics, fakeModel(w.scene, SPECS[type].wheels.length), v3(n.x, 0.05, n.z), yaw, "mint");
        v.hasDriver = true;
        const ai = new AIDriver(v, g, rng);
        ai.wander(8, next.id);
        let still = 0, reported = false;
        for (let i = 0; i < 40 / FIXED_DT; i++) {
          if (ai.done) ai.wander(8);
          ai.update(FIXED_DT);
          v.fixedUpdate(FIXED_DT); w.physics.step(FIXED_DT); v.postStep(FIXED_DT);
          // Moving at under half a metre a second for eight seconds on an
          // empty road is a vehicle wedged on the scenery.
          if (process.env.TRACE === `${col.id} ${type} ${k}` && i % 30 === 0) console.log(`t${(i * FIXED_DT).toFixed(0)} ${v.position.x.toFixed(1)},${v.position.z.toFixed(1)} yaw ${(v.yaw * 57.3).toFixed(0)} v ${v.speed.toFixed(1)} thr ${v.controls.throttle.toFixed(2)} st ${v.controls.steer.toFixed(2)} tgt ${JSON.stringify((ai as any).pts[(ai as any).i])}`);
          still = v.speed < 0.5 ? still + FIXED_DT : Math.max(0, still - FIXED_DT * 0.5);
          if (still > 8 && !reported) { reported = true; stalls.push(`${col.id} ${type} at ${v.position.x.toFixed(0)},${v.position.z.toFixed(0)}`);
            if (process.env.DIAG) {
              const near = boxes.filter((b) => Math.hypot(b.cx - v.position.x, b.cz - v.position.z) < 3.5 + Math.max(b.sx, b.sz) / 2 && Math.abs(b.cx - v.position.x) < 3 + b.sx / 2 && Math.abs(b.cz - v.position.z) < 3 + b.sz / 2 && b.cy + b.sy / 2 > 0.05);
              console.log(`${col.id} ${type} pos ${v.position.x.toFixed(1)},${v.position.z.toFixed(1)} yaw ${(v.yaw * 57.3).toFixed(0)} target`, ai, "\n" + near.map((b) => `  box c(${b.cx.toFixed(1)},${b.cy.toFixed(2)},${b.cz.toFixed(1)}) s(${b.sx.toFixed(2)},${b.sy.toFixed(2)},${b.sz.toFixed(2)}) r${b.rotY.toFixed(2)}`).join("\n"));
            }
          }
        }
        if (v.dir(v3(0, 1, 0)).y < 0.5) stalls.push(`${col.id} ${type} flipped at ${v.position.x.toFixed(0)},${v.position.z.toFixed(0)}`);
        v.dispose();
      }
    }
    expect(stalls).toEqual([]);
  }, 600000);
});
