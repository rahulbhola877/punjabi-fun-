import { describe, expect, it } from "vitest";
import { TransformNode } from "../../src/babylon";
import { makeWorld, v3 } from "./harness";
import { Vehicle } from "../../src/vehicles/Vehicle";
import type { VehicleModel } from "../../src/vehicles/models";
import { FIXED_DT } from "../../src/app/config";

function fakeModel(scene: import("../../src/babylon").Scene, n: number): VehicleModel {
  const root = new TransformNode("vis", scene);
  const steer = new TransformNode("steer", scene);
  return { root, steer, wheels: Array.from({ length: n }, () => new TransformNode("w", scene)), meshes: [], paintable: [] };
}

async function spawn(type: "scooter" | "auto", build?: Parameters<typeof makeWorld>[0]) {
  const w = await makeWorld(build);
  const v = new Vehicle("t", type, w.scene, w.physics, fakeModel(w.scene, type === "auto" ? 3 : 2), v3(0, 0.05, 0), 0, "mint");
  const run = (secs: number, ctl?: () => void) => w.step(Math.round(secs / FIXED_DT), () => { ctl?.(); v.fixedUpdate(FIXED_DT); });
  const tick = (secs: number, ctl?: () => void) => {
    for (let i = 0; i < Math.round(secs / FIXED_DT); i++) { ctl?.(); v.fixedUpdate(FIXED_DT); w.physics.step(FIXED_DT); v.postStep(FIXED_DT); }
  };
  void run;
  return { w, v, tick };
}

describe.each(["scooter", "auto"] as const)("%s physics", (type) => {
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
    expect(v.forwardSpeed).toBeGreaterThan(type === "scooter" ? 8 : 6);
    expect(v.position.z).toBeGreaterThan(8);
    expect(Math.abs(v.position.x)).toBeLessThan(1.5);
    expect(v.dir(v3(0, 1, 0)).y).toBeGreaterThan(0.9);
    tick(4, () => (v.controls = { throttle: -1, steer: 0, handbrake: false }));
    // Brake before reverse: the scooter has no reverse and must be stopped.
    if (type === "scooter") expect(Math.abs(v.forwardSpeed)).toBeLessThan(0.5);
    else expect(v.forwardSpeed).toBeLessThan(0.5);
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
