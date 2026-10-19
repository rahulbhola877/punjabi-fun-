import { describe, expect, it } from "vitest";
import { makeWorld, v3 } from "./harness";
import { Vehicle } from "../../src/vehicles/Vehicle";
import { TransformNode } from "../../src/babylon";
import { FIXED_DT } from "../../src/app/config";
import { SPECS } from "../../src/vehicles/specs";
import { DEFECTS, defectAt } from "../../src/world/region";

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

  it("a pothole jolts a scooter but does not flip it; mud slows a car", async () => {
    const w = await makeWorld();
    const s = new Vehicle("s", "scooter", w.scene, w.physics, fakeModel(w.scene, 2), v3(0, 0.05, 0), 0, "mint");
    s.surface = (x, z) => (Math.abs(x) < 1 && z > 20 && z < 21 ? { kind: "pothole" } : null);
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
      c.surface = () => (mud ? { kind: "mud" } : null);
      c.hasDriver = true;
      for (let i = 0; i < 4 / FIXED_DT; i++) { c.controls = { throttle: 1, steer: 0, handbrake: false }; c.fixedUpdate(FIXED_DT); ww.physics.step(FIXED_DT); c.postStep(FIXED_DT); }
      return c.forwardSpeed;
    };
    const dry = await run(false), wet = await run(true);
    expect(wet).toBeLessThan(dry * 0.75);
    expect(wet).toBeGreaterThan(1);
  });
});
