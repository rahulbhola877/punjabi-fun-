import { describe, expect, it } from "vitest";
import { TransformNode, Vector3 } from "../../src/babylon";
import { FIXED_DT } from "../../src/app/config";
import { Vehicle } from "../../src/vehicles/Vehicle";
import type { VehicleModel } from "../../src/vehicles/models";
import { SPECS } from "../../src/vehicles/specs";
import { makeWorld, v3 } from "./harness";

describe("light plane on a runway", () => {
  it("accelerates, takes off, and descends after reducing power", async () => {
    const w = await makeWorld(undefined, 3000);
    const model: VehicleModel = { root: new TransformNode("plane-vis", w.scene), steer: new TransformNode("plane-steer", w.scene), wheels: SPECS.plane.wheels.map(() => new TransformNode("wheel", w.scene)), meshes: [], paintable: [] };
    const v = new Vehicle("plane", "plane", w.scene, w.physics, model, v3(0, 0.05, 0), 0, "planeWhite");
    let approachSink = 0;
    const tick = (seconds: number, throttle: number, pitch: number, steer = 0) => {
      for (let i = 0; i < Math.round(seconds / FIXED_DT); i++) {
        v.controls = { throttle, steer, handbrake: false, pitch };
        v.fixedUpdate(FIXED_DT); w.physics.step(FIXED_DT); v.postStep(FIXED_DT);
        if (v.position.y > 0.4 && v.position.y < 1.5) approachSink = Math.max(approachSink, -v.body.getLinearVelocity().y);
      }
    };
    try {
      v.hasDriver = true;
      tick(12, 1, 1);
      expect(v.position.z).toBeGreaterThan(30);
      expect(v.position.y).toBeGreaterThan(2);
      expect(v.dir(new Vector3(0, 1, 0)).y).toBeGreaterThan(0.7);
      const heading = v.yaw;
      tick(2, 1, 0, 1);
      expect(v.yaw - heading, JSON.stringify({ speed: v.forwardSpeed, pos: v.position.asArray(), grounded: v.grounded })).toBeGreaterThan(0.1);
      expect(v.dir(new Vector3(0, 1, 0)).y).toBeGreaterThan(0.7);
      const peak = v.position.y;
      // Fly a controlled approach: retain airspeed, lower the nose gently,
      // and raise it as descent steepens. A long, unpowered dive is a crash,
      // even if the aircraft later happens to settle upright.
      for (let i = 0; i < Math.round(30 / FIXED_DT) && !(v.grounded && v.position.y < 1); i++) {
        const descent = v.body.getLinearVelocity().y;
        const pitch = descent < -2 ? 1 : -1;
        const throttle = v.forwardSpeed < 20 ? 1 : 0;
        tick(FIXED_DT, throttle, pitch);
      }
      // Roll out without power after reaching the ground.
      tick(6, 0, 0);
      expect(v.position.y).toBeLessThan(peak);
      expect(v.position.y).toBeLessThan(1);
      expect(v.position.y).toBeGreaterThan(-0.1);
      expect(v.dir(new Vector3(0, 1, 0)).y).toBeGreaterThan(0.8);
      expect(v.grounded, JSON.stringify({ pos: v.position.asArray(), speed: v.forwardSpeed, velocity: v.body.getLinearVelocity().asArray(), forward: v.dir(new Vector3(0,0,1)).asArray(), approachSink })).toBe(true);
      expect(approachSink).toBeLessThan(6);
    } finally { w.scene.dispose(); }
  });

  it("makes a controlled runway approach and brakes to a stop", async () => {
    const w = await makeWorld(undefined, 6000);
    const model: VehicleModel = { root: new TransformNode("plane-vis", w.scene), steer: new TransformNode("plane-steer", w.scene), wheels: SPECS.plane.wheels.map(() => new TransformNode("wheel", w.scene)), meshes: [], paintable: [] };
    const v = new Vehicle("plane", "plane", w.scene, w.physics, model, v3(830, 6, 1891), -Math.PI / 2, "planeWhite");
    v.hasDriver = true;
    v.body.setLinearVelocity(v3(-20, -1, 0));
    let touchdown: Vector3 | null = null, worstSink = 0;
    try {
      for (let i = 0; i < Math.round(35 / FIXED_DT); i++) {
        const vy = v.body.getLinearVelocity().y;
        if (v.position.y > 0.4 && v.position.y < 1.5) worstSink = Math.max(worstSink, -vy);
        v.controls = { throttle: v.forwardSpeed < 20 ? 1 : 0, steer: 0, handbrake: false, pitch: vy < -2 ? 1 : -1 };
        v.fixedUpdate(FIXED_DT); w.physics.step(FIXED_DT); v.postStep(FIXED_DT);
        if (!touchdown && v.grounded && v.position.y < 1) touchdown = v.position.clone();
        if (touchdown) break;
      }
      expect(touchdown, "plane never touched down").not.toBeNull();
      for (let i = 0; i < Math.round(8 / FIXED_DT) && Math.abs(v.forwardSpeed) >= 0.5; i++) {
        v.controls = { throttle: -1, steer: 0, handbrake: false, pitch: 0 };
        v.fixedUpdate(FIXED_DT); w.physics.step(FIXED_DT); v.postStep(FIXED_DT);
      }
      expect(touchdown!.x).toBeGreaterThan(380);
      expect(touchdown!.x).toBeLessThan(840);
      expect(touchdown!.z).toBeGreaterThan(1872);
      expect(touchdown!.z).toBeLessThan(1910);
      expect(worstSink).toBeLessThan(6);
      expect(v.dir(new Vector3(0, 1, 0)).y).toBeGreaterThan(0.85);
      expect(Math.abs(v.forwardSpeed), JSON.stringify({ touchdown: touchdown!.asArray(), final: v.position.asArray(), grounded: v.grounded, velocity: v.body.getLinearVelocity().asArray() })).toBeLessThan(0.5);
      expect(v.position.x).toBeGreaterThan(380);
      expect(v.grounded).toBe(true);
    } finally { w.scene.dispose(); }
  });
});
