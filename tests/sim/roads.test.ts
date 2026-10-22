import { describe, expect, it } from "vitest";
import { makeWorld, v3 } from "./harness";
import { Vehicle } from "../../src/vehicles/Vehicle";
import { TransformNode } from "../../src/babylon";
import { FIXED_DT } from "../../src/app/config";
import { SPECS } from "../../src/vehicles/specs";
import { DEFECTS, ROADS, defectAt, holeHalf, inRectR, roadCondition, surfaceAt } from "../../src/world/region";

function fakeModel(scene: import("../../src/babylon").Scene, n: number) {
  return { root: new TransformNode("vis", scene), steer: new TransformNode("s", scene), wheels: Array.from({ length: n }, () => new TransformNode("w", scene)), meshes: [], paintable: [] };
}

describe("road condition", () => {
  it("has potholes and mud spread over the roads", () => {
    expect(DEFECTS.filter((d) => d.kind === "pothole").length).toBeGreaterThan(60);
    expect(DEFECTS.filter((d) => d.kind === "mud").length).toBeGreaterThan(20);
    const d = DEFECTS.find((x) => x.kind === "pothole")!;
    expect(defectAt(d.x, d.z)?.kind).toBe("pothole");
  });

  it("roads by planning: good roads are smooth, bad ones broken, potholes are real holes", () => {
    const byRoad = (id: string) => DEFECTS.filter((d) => d.road === id);
    for (const r of ROADS.filter((q) => roadCondition(q) === "good")) expect(byRoad(r.id)).toEqual([]);
    expect(roadCondition(ROADS.find((r) => r.id === "col_model0")!)).toBe("good");
    expect(roadCondition(ROADS.find((r) => r.id === "ludhS1")!)).toBe("bad");
    expect(byRoad("ludhS1").filter((d) => d.kind === "pothole").length).toBeGreaterThan(5);
    for (const d of DEFECTS.filter((x) => x.kind === "pothole")) {
      // Each pothole lies wholly on its own road, clear of every other road.
      const s = holeHalf(d);
      expect(ROADS.filter((r) => inRectR(r, d.x, d.z, s)).map((r) => r.id)).toEqual([d.road]);
      expect(surfaceAt(d.x, d.z)!.depth).toBeGreaterThan(0.06);
    }
    // Smooth on a good road, rattly on a bad one.
    expect(surfaceAt(528, -40)).toBeNull();
    let bumps = 0;
    for (let x = -580; x < -310; x += 0.37) bumps = Math.max(bumps, surfaceAt(x, -288)?.depth ?? 0);
    expect(bumps).toBeGreaterThan(0.01);
  });

  it("a car drops into a pothole", async () => {
    const run = async (hole: boolean) => {
      const w = await makeWorld();
      const c = new Vehicle("c", "car", w.scene, w.physics, fakeModel(w.scene, SPECS.car.wheels.length), v3(0, 0.05, 0), 0, "silver");
      c.surface = (x, z) => (hole && Math.hypot(x - 0.75, z - 15) < 0.9 ? { kind: "pothole", depth: 0.12 } : null);
      c.hasDriver = true;
      let minY = 9, minComp = 9, tilt = 0;
      for (let i = 0; i < 4 / FIXED_DT; i++) {
        c.controls = { throttle: 0.4, steer: 0, handbrake: false };
        c.fixedUpdate(FIXED_DT); w.physics.step(FIXED_DT); c.postStep(FIXED_DT);
        if (c.position.z > 10 && c.position.z < 22) minY = Math.min(minY, c.position.y);
        const st = (c as unknown as { wheels: Array<{ compression: number }> }).wheels;
        minComp = Math.min(minComp, ...st.map((q) => q.compression));
        tilt = Math.max(tilt, 1 - c.dir(v3(0, 1, 0)).y);
      }
      return { minY, minComp, tilt };
    };
    const flat = await run(false), hole = await run(true);
    // The wheel hangs down into the hole and the body sags with it.
    expect(hole.minComp).toBeLessThan(-0.05);
    expect(hole.minY).toBeLessThan(flat.minY - 0.01);
  });

  it("a pothole jolts a scooter but does not flip it; mud slows a car", async () => {
    const w = await makeWorld();
    const s = new Vehicle("s", "scooter", w.scene, w.physics, fakeModel(w.scene, 2), v3(0, 0.05, 0), 0, "mint");
    s.surface = (x, z) => (Math.abs(x) < 1 && z > 20 && z < 21 ? { kind: "pothole", depth: 0.1 } : null);
    s.hasDriver = true;
    let minUp = 1, maxImpact = 0;
    for (let i = 0; i < 6 / FIXED_DT; i++) {
      s.controls = { throttle: 1, steer: 0, handbrake: false };
      s.fixedUpdate(FIXED_DT); w.physics.step(FIXED_DT); s.postStep(FIXED_DT);
      minUp = Math.min(minUp, s.dir(v3(0, 1, 0)).y);
      maxImpact = Math.max(maxImpact, s.consumeImpact());
    }
    expect(s.position.z).toBeGreaterThan(25);
    expect(minUp).toBeGreaterThan(0.8);
    expect(maxImpact).toBeGreaterThan(0);
    const run = async (mud: boolean) => {
      const ww = await makeWorld();
      const c = new Vehicle("c", "car", ww.scene, ww.physics, fakeModel(ww.scene, SPECS.car.wheels.length), v3(0, 0.05, 0), 0, "silver");
      c.surface = () => (mud ? { kind: "mud", depth: 0.04 } : null);
      c.hasDriver = true;
      for (let i = 0; i < 4 / FIXED_DT; i++) { c.controls = { throttle: 1, steer: 0, handbrake: false }; c.fixedUpdate(FIXED_DT); ww.physics.step(FIXED_DT); c.postStep(FIXED_DT); }
      return c.forwardSpeed;
    };
    const dry = await run(false), wet = await run(true);
    expect(wet).toBeLessThan(dry * 0.75);
    expect(wet).toBeGreaterThan(1);
  });
});
