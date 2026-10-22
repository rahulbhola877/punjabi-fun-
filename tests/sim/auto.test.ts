import { describe, expect, it } from "vitest";
import { makeWorld, v3 } from "./harness";
import { Vehicle } from "../../src/vehicles/Vehicle";
import { TransformNode } from "../../src/babylon";
import { FIXED_DT } from "../../src/app/config";
import { SPECS } from "../../src/vehicles/specs";

function fakeModel(scene: import("../../src/babylon").Scene, n: number) {
  return { root: new TransformNode("vis", scene), steer: new TransformNode("s", scene), wheels: Array.from({ length: n }, () => new TransformNode("w", scene)), meshes: [], paintable: [] };
}

/** Drive an auto with a steering programme; return the worst tilt seen (min up.y) and the worst roll. */
async function drive(steer: (t: number) => number, secs: number, holes = false, driver = true) {
  const w = await makeWorld();
  const a = new Vehicle("a", "auto", w.scene, w.physics, fakeModel(w.scene, SPECS.auto.wheels.length), v3(0, 0.05, 0), 0, "cng");
  // Potholes under the left rear wheel's track only (one-sided jolts).
  if (holes) a.surface = (x, z) => (Math.floor(z / 6) % 2 === 0 && x < -0.2 ? { kind: "pothole", depth: 0.1 } : null);
  a.hasDriver = driver;
  let minUp = 1, maxRoll = 0, maxPitch = 0;
  for (let i = 0; i < secs / FIXED_DT; i++) {
    const t = i * FIXED_DT;
    a.controls = { throttle: 1, steer: t > 2 ? steer(t) : 0, handbrake: false };
    a.fixedUpdate(FIXED_DT); w.physics.step(FIXED_DT); a.postStep(FIXED_DT);
    const up = a.dir(v3(0, 1, 0));
    minUp = Math.min(minUp, up.y);
    maxPitch = Math.max(maxPitch, Math.abs(a.dir(v3(0, 0, 1)).y));
    maxRoll = Math.max(maxRoll, Math.abs(Math.asin(Math.max(-1, Math.min(1, -a.dir(v3(1, 0, 0)).y)))));
  }
  return { minUp, maxRoll, speed: a.speed };
}

describe("auto-rickshaw stability", () => {
  it("full-lock turn at top speed stays upright", async () => {
    const r = await drive(() => 1, 10);
    expect(r.minUp).toBeGreaterThan(0.9);
  });
  it("hard slalom stays upright", async () => {
    const r = await drive((t) => (Math.floor(t / 0.9) % 2 ? 1 : -1), 12);
    expect(r.minUp).toBeGreaterThan(0.9);
    expect(r.maxRoll).toBeLessThan(0.35);
  });
  it("one-sided potholes at speed do not tip it", async () => {
    const r = await drive(() => 0, 10, true);
    expect(r.minUp).toBeGreaterThan(0.9);
  });
  it("potholes while turning do not tip it", async () => {
    const r = await drive(() => 0.7, 10, true);
    expect(r.minUp).toBeGreaterThan(0.88);
  });
});
