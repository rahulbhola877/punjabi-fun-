import { expect, it } from "vitest";
import { TransformNode } from "../../src/babylon";
import { AIDriver } from "../../src/traffic/AIDriver";
import { Vehicle } from "../../src/vehicles/Vehicle";
import { SPECS } from "../../src/vehicles/specs";
import { buildRoadGraph } from "../../src/world/nav";
import { Rng } from "../../src/render/textures";
import { FIXED_DT } from "../../src/app/config";
import { districtColliders } from "./district";
import { makeWorld, v3 } from "./harness";

it("police replans close through Kitchlu Nagar on actual district colliders", async () => {
  const graph = buildRoadGraph(), start = { x: -152.27044677734375, z: -256.1504211425781 };
  const world = await makeWorld((colliders, scene) => districtColliders(scene, colliders), 2200);
  const results: Array<{ type: string; moving: boolean; readyAt: number | null; minDistance: number }> = [];
  try {
    for (const type of ["jeep", "motorcycle"] as const) for (const moving of [false, true]) {
      const goalAt = (time: number) => ({ x: moving ? -186 + Math.min(23, time) : -162.8317413330078, z: -165.5 });
      const first = goalAt(0), model = {
        root: new TransformNode("patrol", world.scene), steer: new TransformNode("steer", world.scene),
        wheels: SPECS[type].wheels.map(() => new TransformNode("wheel", world.scene)), meshes: [], paintable: [],
      };
      const vehicle = new Vehicle("approach", type, world.scene, world.physics, model, v3(start.x, 0.05, start.z), Math.atan2(first.x - start.x, first.z - start.z), "police");
      try {
        vehicle.hasDriver = true;
        for (let frame = 0; frame < 120; frame++) {
          vehicle.fixedUpdate(FIXED_DT); world.physics.step(FIXED_DT); vehicle.postStep(FIXED_DT);
        }
        const ai = new AIDriver(vehicle, graph, new Rng(100)); ai.aggression = 1.25;
        let readyFor = 0, readyAt: number | null = null, minDistance = Infinity;
        // Match Police's two-second road replans while the direct chase target
        // follows the current player position every fixed update.
        for (let frame = 0; frame < 30 / FIXED_DT; frame++) {
          const time = frame * FIXED_DT, goal = goalAt(time);
          ai.chase = v3(goal.x, 0, goal.z);
          if (frame % 120 === 0) ai.routeTo(goal.x, goal.z);
          ai.update(FIXED_DT);
          vehicle.fixedUpdate(FIXED_DT); world.physics.step(FIXED_DT); vehicle.postStep(FIXED_DT);
          const distance = Math.hypot(vehicle.position.x - goal.x, vehicle.position.z - goal.z);
          minDistance = Math.min(minDistance, distance);
          // The same sustained physical approach conditions required by the
          // automatic joint pursuit film, without calling a film probe hook.
          const ready = distance > 8 && distance < 32 && vehicle.grounded && vehicle.speed > 1 && Math.abs(vehicle.body.getLinearVelocity().y) < 0.8;
          readyFor = ready ? readyFor + FIXED_DT : 0;
          if (readyFor >= 0.3 && readyAt === null) readyAt = time;
        }
        results.push({ type, moving, readyAt, minDistance });
      } finally { vehicle.dispose(); }
    }
    process.stdout.write(`native police approach ${JSON.stringify(results)}\n`);
    for (const result of results) {
      expect(result.readyAt, `${result.type}, moving=${result.moving}`).not.toBeNull();
      expect(result.readyAt!).toBeLessThan(15);
      expect(result.minDistance).toBeLessThan(32);
    }
  } finally { world.scene.dispose(); }
}, 90000);
