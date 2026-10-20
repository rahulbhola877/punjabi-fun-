import { describe, expect, it } from "vitest";
import { makeWorld, v3 } from "./harness";
import { Vehicle } from "../../src/vehicles/Vehicle";
import { TransformNode } from "../../src/babylon";
import { FIXED_DT } from "../../src/app/config";
import { SPECS, type VehicleType } from "../../src/vehicles/specs";

function fakeModel(scene: import("../../src/babylon").Scene, n: number) {
  return { root: new TransformNode("vis", scene), steer: new TransformNode("s", scene), wheels: Array.from({ length: n }, () => new TransformNode("w", scene)), meshes: [], paintable: [] };
}

/** Drive with a steering programme; report the worst tilt, roll, pitch and body bounce. */
export async function run(type: VehicleType, steer: (t: number) => number, secs: number, holes = false) {
  const w = await makeWorld();
  const v = new Vehicle("v", type, w.scene, w.physics, fakeModel(w.scene, SPECS[type].wheels.length), v3(0, 0.05, 0), 0, "silver");
  if (holes) v.surface = (x, z) => (Math.floor(z / 7) % 2 === 0 && x < -0.2 ? { kind: "pothole" } : null);
  v.hasDriver = true;
  let minUp = 1, maxRoll = 0, maxPitch = 0, minY = 9, maxY = -9;
  for (let i = 0; i < secs / FIXED_DT; i++) {
    const t = i * FIXED_DT;
    v.controls = { throttle: 1, steer: t > 2 ? steer(t) : 0, handbrake: false };
    v.fixedUpdate(FIXED_DT); w.physics.step(FIXED_DT); v.postStep(FIXED_DT);
    const up = v.dir(v3(0, 1, 0));
    minUp = Math.min(minUp, up.y);
    maxRoll = Math.max(maxRoll, Math.abs(v.dir(v3(1, 0, 0)).y));
    maxPitch = Math.max(maxPitch, Math.abs(v.dir(v3(0, 0, 1)).y));
    if (t > 3) { minY = Math.min(minY, v.position.y); maxY = Math.max(maxY, v.position.y); }
  }
  return { minUp, maxRoll, maxPitch, bounce: maxY - minY, speed: v.speed };
}

const FOUR: VehicleType[] = ["car", "jeep", "truck", "tractor"];
describe("four-wheelers stay planted", () => {
  for (const type of FOUR) {
    it(`${type}: slalom, full lock and one-sided potholes`, async () => {
      const slalom = await run(type, (t) => (Math.floor(t / 1.1) % 2 ? 1 : -1), 12);
      const lock = await run(type, () => 1, 10);
      const holes = await run(type, () => 0.4, 10, true);
      if (process.env.DBG) console.log(type, JSON.stringify({ slalom, lock, holes }, (_k, x) => (typeof x === "number" ? +x.toFixed(3) : x)));
      for (const r of [slalom, lock, holes]) {
        expect(r.minUp).toBeGreaterThan(0.93);
        expect(r.maxRoll).toBeLessThan(0.3);
      }
    });
  }
});
