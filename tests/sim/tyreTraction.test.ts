import { describe, expect, it } from "vitest";
import { TransformNode } from "../../src/babylon";
import { FIXED_DT } from "../../src/app/config";
import { Vehicle } from "../../src/vehicles/Vehicle";
import { SPECS } from "../../src/vehicles/specs";
import { makeWorld, v3 } from "./harness";

async function car() {
  const w = await makeWorld(undefined, 600);
  const model = { root: new TransformNode("vis", w.scene), steer: new TransformNode("steer", w.scene), wheels: SPECS.car.wheels.map(() => new TransformNode("wheel", w.scene)), meshes: [], paintable: [] };
  const v = new Vehicle("car", "car", w.scene, w.physics, model, v3(0, 0.05, 0), 0, "silver");
  v.hasDriver = true;
  const tick = () => { v.fixedUpdate(FIXED_DT); w.physics.step(FIXED_DT); v.postStep(FIXED_DT); };
  for (let i = 0; i < 120; i++) tick();
  return { ...w, v, tick };
}

describe("loaded tyre traction", () => {
  it("needs a substantially longer stopping distance on a slippery road", async () => {
    const run = async (wetGrip: number) => {
      const w = await car();
      try {
        w.v.wetGrip = wetGrip;
        w.v.body.setLinearVelocity(v3(0, 0, 15));
        w.v.controls.throttle = -1;
        const start = w.v.position.z;
        for (let i = 0; i < 600; i++) { w.tick(); if (w.v.forwardSpeed < 0.3) break; }
        return w.v.position.z - start;
      } finally { w.scene.dispose(); }
    };
    const dry = await run(1), wet = await run(0.4);
    if (process.env.DIAG) console.log("15m/s braking distance (m)", { dry, wet });
    expect(dry).toBeGreaterThan(5);
    expect(wet).toBeGreaterThan(dry * 1.5);
    expect(wet).toBeLessThan(80);
  });

  it("cannot cancel a sideways skid at dry-road strength on a slippery road", async () => {
    const run = async (wetGrip: number) => {
      const w = await car();
      try {
        w.v.wetGrip = wetGrip;
        w.v.body.setLinearVelocity(v3(6, 0, 0));
        for (let i = 0; i < 15; i++) w.tick();
        return w.v.body.getLinearVelocity().x;
      } finally { w.scene.dispose(); }
    };
    const dry = await run(1), wet = await run(0.4);
    if (process.env.DIAG) console.log("6m/s lateral skid speed after 0.25s (m/s)", { dry, wet });
    expect(dry).toBeGreaterThan(0);
    expect(wet).toBeGreaterThan(dry + 1);
    expect(wet).toBeLessThan(6);
  });
});
