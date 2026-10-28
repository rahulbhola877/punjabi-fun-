import { describe, expect, it } from "vitest";
import { StandardMaterial, TransformNode, type Scene } from "../../src/babylon";
import { makeWorld, v3 } from "./harness";
import { Vehicle } from "../../src/vehicles/Vehicle";
import type { TrolleyLoad, VehicleModel } from "../../src/vehicles/models";
import type { Materials } from "../../src/render/Materials";
import { SPECS } from "../../src/vehicles/specs";
import { FIXED_DT } from "../../src/app/config";
import { isOpenGround } from "../../src/world/layout";
import { LOOSE_TROLLEYS, REACH, STOPPED, TONGUE, TRACTOR_HITCH, Trolley, Trolleys } from "../../src/traffic/Trolley";

type Controls = { throttle: number; steer: number; handbrake: boolean };
const GO: Controls = { throttle: 1, steer: 0, handbrake: false };
const COAST: Controls = { throttle: 0, steer: 0, handbrake: false };
const BRAKE: Controls = { throttle: 0, steer: 0, handbrake: true };

function fakeModel(scene: Scene, n: number): VehicleModel {
  const root = new TransformNode("vis", scene);
  const steer = new TransformNode("steer", scene);
  return { root, steer, wheels: Array.from({ length: n }, () => new TransformNode("w", scene)), meshes: [], paintable: [] };
}

/** A tractor on a flat, clear road, and a trolley list to hitch it to, in a fresh physics world. */
async function farm() {
  const w = await makeWorld(undefined, 3000);
  const material = new StandardMaterial("m", w.scene);
  const mats = { get: () => material } as unknown as Materials;
  const trolleys = new Trolleys({ scene: w.scene, mats, physics: w.physics, caster: { addCaster: () => {}, removeCaster: () => {} } });
  const tractor = new Vehicle("t", "tractor", w.scene, w.physics, fakeModel(w.scene, SPECS.tractor.wheels.length), v3(0, 0.05, 0), 0, "mint");
  tractor.hasDriver = true;
  /** Steps in the game's order: the tractor, the trolleys (`after` runs once they have trailed), then physics. */
  const step = (secs: number, controls: Controls, after?: () => void) => {
    for (let i = 0; i < Math.round(secs / FIXED_DT); i++) {
      tractor.controls = controls;
      tractor.fixedUpdate(FIXED_DT);
      trolleys.fixedUpdate(FIXED_DT);
      after?.();
      w.physics.step(FIXED_DT);
      tractor.postStep(FIXED_DT);
    }
  };
  return { w, tractor, trolleys, step };
}

/** A loose trolley standing behind the tractor's hitch, its ring `gap` metres short of the hitch, facing the tractor. */
function parkBehind(trolleys: Trolleys, tractor: Vehicle, gap: number, load: TrolleyLoad = "sugarcane"): Trolley {
  const h = Trolley.hitchOf(tractor);
  return trolleys.place(h.x, h.z - gap - TONGUE, 0, load, "#2e7d32");
}

describe("tractor trolleys", () => {
  it("a loose trolley is in reach only when its ring is within REACH of the hitch", async () => {
    const { w, tractor, trolleys } = await farm();
    try {
      const far = parkBehind(trolleys, tractor, REACH + 1);
      expect(trolleys.reach(tractor)).toBeNull();
      const near = parkBehind(trolleys, tractor, REACH - 0.5, "straw");
      expect(trolleys.reach(tractor)).toBe(near);
      expect(far.state).toBe("loose");
    } finally { w.scene.dispose(); }
  });

  it("trails the tractor on its tongue once coupled: the axle stays TONGUE behind the hitch", async () => {
    const { w, tractor, trolleys, step } = await farm();
    try {
      parkBehind(trolleys, tractor, 0.8);
      expect(trolleys.toggle(tractor)).toBe("hitched");
      const towed = trolleys.towedBy(tractor)!;
      expect(towed.state).toBe("towed");
      const gapToHitch = () => {
        const h = Trolley.hitchOf(tractor);
        return Math.hypot(towed.root.position.x - h.x, towed.root.position.z - h.z);
      };
      // Checked straight after the trolley trails the hitch, on every step, so the rope is exact.
      let worst = 0;
      const rope = () => { worst = Math.max(worst, Math.abs(gapToHitch() - TONGUE)); };
      step(4, GO, rope);
      expect(tractor.towDrag).toBeGreaterThan(0);
      expect(tractor.position.z).toBeGreaterThan(8);
      expect(towed.root.position.z).toBeLessThan(tractor.position.z - TRACTOR_HITCH);
      const f = tractor.dir(v3(0, 0, 1));
      expect(towed.yaw).toBeCloseTo(Math.atan2(f.x, f.z), 1);
      step(4, { throttle: 1, steer: 1, handbrake: false }, rope);
      expect(worst).toBeLessThan(1e-3);
    } finally { w.scene.dispose(); }
  });

  it("hitches and unhitches only while the tractor is stopped", async () => {
    const { w, tractor, trolleys, step } = await farm();
    try {
      step(1, GO);
      expect(tractor.speed).toBeGreaterThan(STOPPED);
      expect(trolleys.toggle(tractor)).toBe("moving");
      step(6, BRAKE);
      expect(tractor.speed).toBeLessThan(STOPPED);
      parkBehind(trolleys, tractor, 0.8);
      expect(trolleys.toggle(tractor)).toBe("hitched");
      const towed = trolleys.towedBy(tractor)!;
      step(2, GO);
      expect(trolleys.toggle(tractor)).toBe("moving");
      expect(towed.state).toBe("towed");
      step(6, BRAKE);
      expect(trolleys.toggle(tractor)).toBe("unhitched");
      expect(towed.state).toBe("loose");
      expect(tractor.towDrag).toBe(0);
    } finally { w.scene.dispose(); }
  });

  it("a tractor that goes away takes its trolley with it", async () => {
    const { w, tractor, trolleys } = await farm();
    try {
      parkBehind(trolleys, tractor, 0.8, "bricks");
      expect(trolleys.toggle(tractor)).toBe("hitched");
      trolleys.drop(tractor);
      expect(trolleys.all).toHaveLength(0);
      expect(trolleys.towedBy(tractor)).toBeNull();
      expect(tractor.towDrag).toBe(0);
    } finally { w.scene.dispose(); }
  });

  it("a trolley in tow adds rolling drag to the tractor that pulls it", async () => {
    const coastDecel = async (hitched: boolean) => {
      const { w, tractor, trolleys, step } = await farm();
      try {
        if (hitched) { parkBehind(trolleys, tractor, 0.8); trolleys.toggle(tractor); }
        step(4, GO);
        const before = tractor.forwardSpeed;
        step(4, COAST);
        return (before - tractor.forwardSpeed) / 4;
      } finally { w.scene.dispose(); }
    };
    const bare = await coastDecel(false);
    const towing = await coastDecel(true);
    expect(towing).toBeGreaterThan(bare + 0.1);
  });

  it("the load slides back as the tractor pulls away, forward as it brakes, and settles", async () => {
    const { w, tractor, trolleys, step } = await farm();
    try {
      parkBehind(trolleys, tractor, 0.8, "sugarcane");
      trolleys.toggle(tractor);
      const load = trolleys.towedBy(tractor)!.loadRoot;
      let back = 0, forward = 0;
      step(2, GO, () => { back = Math.min(back, load.position.z); });
      expect(back).toBeLessThan(-0.05);
      step(2, BRAKE, () => { forward = Math.max(forward, load.position.z); });
      expect(forward).toBeGreaterThan(0.05);
      step(8, COAST);
      expect(Math.abs(load.position.z)).toBeLessThan(0.02);
    } finally { w.scene.dispose(); }
  });
});

describe("loose trolleys on the farm roads", () => {
  it("each starting spot is open ground under the whole bed", () => {
    // The bed (2 m wide, from 1.6 m behind the axle to 2 m ahead) and the tongue's end (3.2 m ahead), from each axle.
    const spots: Array<[number, number]> = [[0, 0], [-1, -1.6], [1, -1.6], [-1, 2], [1, 2], [0, 3.2]];
    const off: string[] = [];
    for (const t of LOOSE_TROLLEYS) {
      const right = { x: Math.cos(t.yaw), z: -Math.sin(t.yaw) };
      const fwd = { x: Math.sin(t.yaw), z: Math.cos(t.yaw) };
      for (const [across, along] of spots) {
        const x = t.x + across * right.x + along * fwd.x;
        const z = t.z + across * right.z + along * fwd.z;
        if (!isOpenGround(x, z)) off.push(`trolley at ${t.x}, ${t.z}: point ${across}, ${along} is at ${x.toFixed(1)}, ${z.toFixed(1)}`);
      }
    }
    expect(off).toEqual([]);
  });
});
