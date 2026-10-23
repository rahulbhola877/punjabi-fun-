import { describe, expect, it } from "vitest";
import { TransformNode } from "../../src/babylon";
import { makeWorld, v3 } from "./harness";
import { Vehicle } from "../../src/vehicles/Vehicle";
import { FIXED_DT } from "../../src/app/config";
import { SPECS, type VehicleType } from "../../src/vehicles/specs";

function fakeModel(scene: import("../../src/babylon").Scene, n: number) {
  return { root: new TransformNode("vis", scene), steer: new TransformNode("s", scene), wheels: Array.from({ length: n }, () => new TransformNode("w", scene)), meshes: [], paintable: [] };
}

/** Potholes at z 20 and 24, smooth road after: the ride must settle once past them. */
describe.each(["car", "auto", "motorcycle", "scooter", "truck", "jeep"] as VehicleType[])("%s over potholes", (type) => {
  it("settles on smooth road afterwards", async () => {
    const w = await makeWorld();
    const v = new Vehicle("t", type, w.scene, w.physics, fakeModel(w.scene, SPECS[type].wheels.length), v3(0, 0.05, 0), 0, "mint");
    const holes = [{ x: 0.3, z: 20, r: 0.7 }, { x: -0.4, z: 24, r: 0.6 }];
    const s = { kind: "pothole" as const, depth: 0 };
    v.surface = (x, z) => {
      for (const h of holes) { const d = Math.hypot(x - h.x, z - h.z); if (d < h.r) { s.depth = 0.12 * Math.min(1, (h.r - d) / (h.r * 0.45)); return s; } }
      return null;
    };
    v.hasDriver = true;
    const log: string[] = [];
    let maxAfter = 0, maxVy = 0;
    for (let i = 0; i < 14 / FIXED_DT; i++) {
      v.controls = { throttle: v.forwardSpeed < 11 ? 1 : 0, steer: 0, handbrake: false };
      v.fixedUpdate(FIXED_DT); w.physics.step(FIXED_DT); v.postStep(FIXED_DT);
      const up = v.dir(v3(0, 1, 0)), ang = v.body.getAngularVelocity(), lin = v.body.getLinearVelocity();
      if (i % 15 === 0 && process.env.DIAG) log.push(`t${(i * FIXED_DT).toFixed(1)} z${v.position.z.toFixed(1)} y${v.position.y.toFixed(3)} up${up.y.toFixed(3)} ang${ang.length().toFixed(2)} vy${lin.y.toFixed(2)} v${v.forwardSpeed.toFixed(1)}`);
      // Well past the holes (8 m on): angular rates and bouncing must have died down.
      if (v.position.z > 40) { maxAfter = Math.max(maxAfter, ang.length()); maxVy = Math.max(maxVy, Math.abs(lin.y)); }
    }
    if (process.env.DIAG) console.log(type, "\n" + log.join("\n"), "\nmaxAng", maxAfter.toFixed(2), "maxVy", maxVy.toFixed(2));
    expect(v.position.z).toBeGreaterThan(60);
    expect(maxAfter).toBeLessThan(0.35);
    expect(maxVy).toBeLessThan(0.25);
  }, 60000);
});

/** A jolt that tips the nose (a pothole edge) must not leave the vehicle riding crooked. */
describe.each(["car", "auto", "jeep", "truck", "erickshaw"] as VehicleType[])("%s after a pitch jolt", (type) => {
  it("comes back level", async () => {
    const w = await makeWorld();
    const v = new Vehicle("t", type, w.scene, w.physics, fakeModel(w.scene, SPECS[type].wheels.length), v3(0, 0.6, 0), 0.7, "mint");
    v.hasDriver = true;
    const tick = () => { v.fixedUpdate(FIXED_DT); w.physics.step(FIXED_DT); v.postStep(FIXED_DT); };
    for (let i = 0; i < 60; i++) tick();
    for (const sgn of [1, -1]) {
      v.body.setAngularVelocity(v.dir(v3(1, 0, 0)).scale(sgn * 1.2));
      for (let i = 0; i < 1.5 / FIXED_DT; i++) { v.controls = { throttle: 0.5, steer: 0, handbrake: false }; tick(); }
      expect(Math.abs(v.dir(v3(0, 0, 1)).y)).toBeLessThan(0.012);
    }
  });
});
