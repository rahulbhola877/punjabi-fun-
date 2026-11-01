import { describe, expect, it } from "vitest";
import { TransformNode } from "../../src/babylon";
import { FIXED_DT } from "../../src/app/config";
import { Vehicle } from "../../src/vehicles/Vehicle";
import { SPECS } from "../../src/vehicles/specs";
import { CANAL } from "../../src/world/region";
import { makeWorld, v3 } from "./harness";

async function run(z: number, y: number) {
  // No ground plane at zero: the only floor is the canal bed, well below us.
  const w = await makeWorld(c => c.add(0, CANAL.bedY - 0.5, z, 100, 1, 100), 0);
  const model = { root: new TransformNode("vis", w.scene), steer: new TransformNode("steer", w.scene), wheels: SPECS.car.wheels.map(() => new TransformNode("wheel", w.scene)), meshes: [], paintable: [] };
  const v = new Vehicle("car", "car", w.scene, w.physics, model, v3(0, y, z), 0, "silver");
  v.hasDriver = true;
  v.body.setLinearVelocity(v3(6, 0, 0));
  try {
    for (let i = 0; i < 15; i++) { v.fixedUpdate(FIXED_DT); w.physics.step(FIXED_DT); v.postStep(FIXED_DT); }
    return { velocity: v.body.getLinearVelocity(), y: v.position.y, grounded: v.grounded };
  } finally { w.scene.dispose(); }
}

describe("vehicles entering canal water", () => {
  it("lose momentum and receive partial buoyancy before any wheel can reach the bed", async () => {
    const canal = await run((CANAL.z0 + CANAL.z1) / 2, -1.8);
    const dry = await run(CANAL.z1 + 20, -1.8);
    expect(canal.grounded).toBe(false);
    expect(canal.velocity.x).toBeLessThan(dry.velocity.x * 0.7);
    expect(canal.velocity.y).toBeGreaterThan(dry.velocity.y + 0.5);
    expect(canal.velocity.y).toBeLessThan(0); // A car still sinks; it isn't a boat.
  });

  it("does not apply water forces to a vehicle crossing above the canal", async () => {
    const aboveWater = await run((CANAL.z0 + CANAL.z1) / 2, 2);
    const dry = await run(CANAL.z1 + 20, 2);
    expect(aboveWater.velocity.x).toBeCloseTo(dry.velocity.x, 5);
    expect(aboveWater.velocity.y).toBeCloseTo(dry.velocity.y, 5);
  });
});
