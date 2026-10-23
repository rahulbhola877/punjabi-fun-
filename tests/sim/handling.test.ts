import { describe, expect, it } from "vitest";
import { TransformNode, Vector3 } from "../../src/babylon";
import { makeWorld, v3 } from "./harness";
import { Vehicle } from "../../src/vehicles/Vehicle";
import { FIXED_DT } from "../../src/app/config";
import { SPECS, type VehicleType } from "../../src/vehicles/specs";

function fakeModel(scene: import("../../src/babylon").Scene, n: number) {
  return { root: new TransformNode("vis", scene), steer: new TransformNode("s", scene), wheels: Array.from({ length: n }, () => new TransformNode("w", scene)), meshes: [], paintable: [] };
}

/**
 * How each vehicle drives on a flat road: pull-away, top speed, braking, a
 * full-lock turn at speed and letting go of the bars. Run with DIAG=1 to print
 * the numbers.
 */
describe.each(["motorcycle", "scooter", "car", "auto", "jeep"] as VehicleType[])("%s handling", (type) => {
  it("pulls away, stops, turns and straightens up cleanly", async () => {
    const w = await makeWorld(undefined, 1600);
    const spec = SPECS[type];
    const v = new Vehicle("t", type, w.scene, w.physics, fakeModel(w.scene, spec.wheels.length), v3(0, 0.05, -700), 0, "mint");
    v.hasDriver = true;
    let t = 0;
    const tick = (throttle: number, steer: number) => {
      v.controls = { throttle, steer, handbrake: false };
      v.fixedUpdate(FIXED_DT); w.physics.step(FIXED_DT); v.postStep(FIXED_DT); t += FIXED_DT;
    };
    const roll = () => Math.asin(Math.max(-1, Math.min(1, -v.dir(v3(1, 0, 0)).y)));
    for (let i = 0; i < 30; i++) tick(0, 0);
    // Pull-away: time to 60% of top speed, then top speed after 14 s.
    let t60 = -1; t = 0;
    while (t < 14) { tick(1, 0); if (t60 < 0 && v.forwardSpeed > spec.maxSpeed * 0.6) t60 = t; }
    const top = v.forwardSpeed;
    // Brake from there to a stop.
    const z0 = v.position.z; t = 0;
    while (v.forwardSpeed > 0.3 && t < 10) tick(-1, 0);
    const stopDist = v.position.z - z0, stopT = t;
    // Full lock at a brisk speed for 4 s: stays upright, turns, does not slide out.
    while (v.forwardSpeed < Math.min(12, spec.maxSpeed * 0.7)) tick(1, 0);
    const turnV = v.forwardSpeed;
    let maxRoll = 0, minUp = 1, maxSlip = 0, yawSum = 0; t = 0;
    let lastYaw = v.yaw;
    const yaw0 = v.yaw;
    while (t < 4) {
      tick(0.4, 1);
      maxRoll = Math.max(maxRoll, Math.abs(roll()));
      minUp = Math.min(minUp, v.dir(v3(0, 1, 0)).y);
      const lin = v.body.getLinearVelocity();
      maxSlip = Math.max(maxSlip, Math.abs(Vector3.Dot(lin, v.dir(v3(1, 0, 0)))));
      yawSum += Math.abs(Math.atan2(Math.sin(v.yaw - lastYaw), Math.cos(v.yaw - lastYaw))); lastYaw = v.yaw;
    }
    void yaw0;
    // Let go of the bars: the yaw rate dies away and the lean comes back up.
    let settleYaw = 0, settleRoll = 0; t = 0;
    while (t < 2.5) { tick(0.4, 0); if (t > 1.5) { settleYaw = Math.max(settleYaw, Math.abs(v.body.getAngularVelocity().y)); settleRoll = Math.max(settleRoll, Math.abs(roll())); } }
    if (process.env.DIAG) console.log(type, JSON.stringify({ t60: +t60.toFixed(2), top: +top.toFixed(1), stopDist: +stopDist.toFixed(1), stopT: +stopT.toFixed(2), turnV: +turnV.toFixed(1), maxRoll: +maxRoll.toFixed(2), minUp: +minUp.toFixed(2), maxSlip: +maxSlip.toFixed(2), turned: +yawSum.toFixed(2), settleYaw: +settleYaw.toFixed(3), settleRoll: +settleRoll.toFixed(3) }));
    expect(t60).toBeGreaterThan(0);
    expect(top).toBeGreaterThan(spec.maxSpeed * 0.75);
    // Full lock for 4 s goes round at least a quarter turn.
    expect(yawSum).toBeGreaterThan(1.6);
    expect(stopDist).toBeLessThan(top * top / 4);
    expect(minUp).toBeGreaterThan(0.75);
    expect(maxSlip).toBeLessThan(1.5);
    expect(settleYaw).toBeLessThan(0.08);
    expect(settleRoll).toBeLessThan(0.08);
  }, 60000);
});
