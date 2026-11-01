import { describe, expect, it } from "vitest";
import { TransformNode, Vector3 } from "../../src/babylon";
import { FIXED_DT } from "../../src/app/config";
import { Vehicle } from "../../src/vehicles/Vehicle";
import type { VehicleModel } from "../../src/vehicles/models";
import { SPECS } from "../../src/vehicles/specs";
import { buildRidgeCollider } from "../../src/world/ridge";
import { ridgeHeight } from "../../src/world/ridgeTerrain";
import { makeWorld, v3 } from "./harness";

describe("pickup on the ridge", () => {
  it("drives uphill on the actual terrain collision without falling or rolling", async () => {
    const w = await makeWorld(undefined, 6000);
    const terrain = buildRidgeCollider(w.scene);
    const model: VehicleModel = { root: new TransformNode("pickup-vis", w.scene), steer: new TransformNode("pickup-steer", w.scene), wheels: SPECS.pickup.wheels.map(() => new TransformNode("wheel", w.scene)), meshes: [], paintable: [] };
    const x = -670, z = 1850, y = ridgeHeight(x, z);
    const v = new Vehicle("pickup", "pickup", w.scene, w.physics, model, v3(x, y + 0.1, z), -0.9, "pickupRed");
    try {
      v.hasDriver = true;
      let minUp = 1;
      for (let i = 0; i < Math.round(3 / FIXED_DT); i++) {
        v.controls = { throttle: 0.55, steer: 0, handbrake: false };
        v.fixedUpdate(FIXED_DT); w.physics.step(FIXED_DT); v.postStep(FIXED_DT);
        minUp = Math.min(minUp, v.dir(new Vector3(0, 1, 0)).y);
      }
      expect(Math.hypot(v.position.x - x, v.position.z - z)).toBeGreaterThan(8);
      expect(v.position.y).toBeGreaterThan(y + 0.2);
      expect(minUp).toBeGreaterThan(0.8);
      expect(v.grounded).toBe(true);
    } finally { terrain.dispose(); w.scene.dispose(); }
  });
});
