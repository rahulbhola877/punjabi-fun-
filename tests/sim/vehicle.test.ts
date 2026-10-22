import { describe, expect, it } from "vitest";
import { TransformNode } from "../../src/babylon";
import { makeWorld, v3 } from "./harness";
import { Vehicle } from "../../src/vehicles/Vehicle";
import type { VehicleModel } from "../../src/vehicles/models";
import { FIXED_DT } from "../../src/app/config";
import { SPECS, VEHICLE_TYPES, type VehicleType } from "../../src/vehicles/specs";

/** Minimum speed after 4 s of full throttle from rest. */
const MIN_SPEED: Record<VehicleType, number> = { scooter: 8, auto: 6, bicycle: 5, motorcycle: 10, car: 8, jeep: 7, tractor: 6, truck: 6, erickshaw: 5, rickshaw: 4, bus: 5 };

function fakeModel(scene: import("../../src/babylon").Scene, n: number): VehicleModel {
  const root = new TransformNode("vis", scene);
  const steer = new TransformNode("steer", scene);
  return { root, steer, wheels: Array.from({ length: n }, () => new TransformNode("w", scene)), meshes: [], paintable: [] };
}

async function spawn(type: VehicleType, build?: Parameters<typeof makeWorld>[0]) {
  const w = await makeWorld(build);
  const v = new Vehicle("t", type, w.scene, w.physics, fakeModel(w.scene, SPECS[type].wheels.length), v3(0, 0.05, 0), 0, "mint");
  const run = (secs: number, ctl?: () => void) => w.step(Math.round(secs / FIXED_DT), () => { ctl?.(); v.fixedUpdate(FIXED_DT); });
  const tick = (secs: number, ctl?: () => void) => {
    for (let i = 0; i < Math.round(secs / FIXED_DT); i++) { ctl?.(); v.fixedUpdate(FIXED_DT); w.physics.step(FIXED_DT); v.postStep(FIXED_DT); }
  };
  void run;
  return { w, v, tick };
}

describe.each([...VEHICLE_TYPES])("%s physics", (type) => {
  it("stays parked and settles on its suspension", async () => {
    const { v, tick } = await spawn(type);
    tick(3);
    expect(Math.hypot(v.position.x, v.position.z)).toBeLessThan(0.15);
    expect(v.position.y).toBeGreaterThan(-0.08);
    expect(v.position.y).toBeLessThan(0.15);
    expect(v.dir(v3(0, 1, 0)).y).toBeGreaterThan(0.95);
  });
  it("accelerates forward, stays upright, and brakes to a stop", async () => {
    const { v, tick } = await spawn(type);
    v.hasDriver = true;
    tick(0.5);
    tick(4, () => (v.controls = { throttle: 1, steer: 0, handbrake: false }));
    expect(v.forwardSpeed).toBeGreaterThan(MIN_SPEED[type]);
    expect(v.position.z).toBeGreaterThan(8);
    expect(Math.abs(v.position.x)).toBeLessThan(1.5);
    expect(v.dir(v3(0, 1, 0)).y).toBeGreaterThan(0.9);
    // Brake before reverse: holding "back" first stops the vehicle, then reverses slowly.
    let stoppedAt = -1, reversedAt = -1, t = 0;
    tick(6, () => {
      v.controls = { throttle: -1, steer: 0, handbrake: false };
      t += FIXED_DT;
      if (stoppedAt < 0 && Math.abs(v.forwardSpeed) < 0.5) stoppedAt = t;
      if (reversedAt < 0 && v.forwardSpeed < -0.6) reversedAt = t;
    });
    expect(stoppedAt).toBeGreaterThan(0);
    expect(reversedAt).toBeGreaterThan(stoppedAt);
    expect(v.forwardSpeed).toBeLessThan(-0.6);
    expect(v.forwardSpeed).toBeGreaterThan(-(v.spec.reverseMax + 0.5));
  });
  it("turns when steering and does not tip over", async () => {
    const { v, tick } = await spawn(type);
    v.hasDriver = true;
    tick(0.5);
    tick(2.5, () => (v.controls = { throttle: 1, steer: 0, handbrake: false }));
    // Accumulate yaw change step by step (heading may wrap past ±π).
    let last = v.yaw, d = 0, minUp = 1;
    tick(2, () => {
      v.controls = { throttle: 0.6, steer: 1, handbrake: false };
      d += Math.atan2(Math.sin(v.yaw - last), Math.cos(v.yaw - last));
      last = v.yaw;
      minUp = Math.min(minUp, v.dir(v3(0, 1, 0)).y);
    });
    expect(d).toBeGreaterThan(0.5); // turned right (positive yaw)
    expect(minUp).toBeGreaterThan(0.75);
  });
});

describe.each(["scooter", "auto"] as const)("%s over street features", (type) => {
  it("crosses a speed breaker at full throttle without flipping", async () => {
    const { speedBreakerColliders } = await import("../../src/world/street");
    const { v, tick } = await spawn(type, (c) => { speedBreakerColliders(c, 25); speedBreakerColliders(c, 45); });
    v.hasDriver = true;
    let minUp = 1;
    tick(9, () => { v.controls = { throttle: 1, steer: 0, handbrake: false }; minUp = Math.min(minUp, v.dir(v3(0, 1, 0)).y); });
    expect(v.position.z).toBeGreaterThan(50);
    expect(minUp).toBeGreaterThan(0.8);
  });
  it("mounts a 15 cm kerb at an angle without flipping", async () => {
    const { v, tick } = await spawn(type, (c) => c.add(25, 0.075, 75, 70, 0.15, 120));
    v.hasDriver = true;
    let minUp = 1;
    // Head toward the kerb (which starts at z=15) at ~30 degrees.
    tick(0.3);
    tick(6, () => { v.controls = { throttle: 0.8, steer: v.yaw < 0.5 ? 0.6 : 0, handbrake: false }; minUp = Math.min(minUp, v.dir(v3(0, 1, 0)).y); });
    expect(v.position.z).toBeGreaterThan(16);
    expect(v.position.y).toBeGreaterThan(0.05);
    expect(minUp).toBeGreaterThan(0.75);
  });
});

describe("recovery", () => {
  it("placeAt teleports a flipped vehicle upright", async () => {
    const { v, tick } = await spawn("auto");
    tick(0.5);
    v.placeAt(v3(10, 0.3, 5), 1.0);
    tick(1.5);
    expect(Math.hypot(v.position.x - 10, v.position.z - 5)).toBeLessThan(0.3);
    expect(v.dir(v3(0, 1, 0)).y).toBeGreaterThan(0.95);
    expect(Math.abs(v.yaw - 1.0)).toBeLessThan(0.05);
  });
});

describe("collision filtering", () => {
  it("a kinematic resident capsule sweeping through a parked vehicle does not move it", async () => {
    const { PhysicsBody, PhysicsMotionType, PhysicsShapeCapsule, Quaternion } = await import("../../src/babylon");
    const { Group } = await import("../../src/app/config");
    const { w, v, tick } = await spawn("auto");
    tick(1);
    const node = new TransformNode("res", w.scene);
    node.position.set(-5, 0, 0);
    const shape = new PhysicsShapeCapsule(v3(0, 0.3, 0), v3(0, 1.4, 0), 0.28, w.scene);
    shape.filterMembershipMask = Group.RESIDENT;
    shape.filterCollideMask = Group.PLAYER | Group.STATIC;
    const body = new PhysicsBody(node, PhysicsMotionType.ANIMATED, false, w.scene);
    body.shape = shape;
    let x = -5;
    tick(1, () => { x += 0.4; body.setTargetTransform(v3(x, 0, 0), Quaternion.Identity()); });
    expect(Math.hypot(v.position.x, v.position.z)).toBeLessThan(0.2);
  });
});

describe("being stuck", () => {
  it("notices a vehicle shoving against something with its wheels on the road", async () => {
    // A wall a couple of metres in front. Driving into it is how you get
    // stuck in a bazaar — against a parked rehri, a handcart, a kerb — and
    // detection used to require the vehicle to be off the ground, so the
    // "press R to recover" prompt never showed and R did nothing. You sat
    // with the throttle open and no way out but to get off and walk.
    const { v, tick } = await spawn("scooter", (c) => c.add(0, 1, 4, 8, 2, 0.5));
    v.hasDriver = true;
    tick(4, () => { v.controls = { throttle: 1, steer: 0, handbrake: false }; });
    expect(v.speed).toBeLessThan(1);
    expect(v.stuckTime, "shoving a wall should count as stuck").toBeGreaterThan(0.8);
  });

  it("does not call ordinary driving stuck", async () => {
    const { v, tick } = await spawn("scooter");
    v.hasDriver = true;
    tick(5, () => { v.controls = { throttle: 1, steer: 0, handbrake: false }; });
    expect(v.speed).toBeGreaterThan(5);
    expect(v.stuckTime).toBe(0);
  });
});
