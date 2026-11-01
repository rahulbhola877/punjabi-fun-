import { expect, it } from "vitest";
import { StandardMaterial, TransformNode } from "../../src/babylon";
import { FIXED_DT, Group } from "../../src/app/config";
import type { Materials } from "../../src/render/Materials";
import type { SignAtlas } from "../../src/render/Signs";
import { OuterRegions } from "../../src/world/outerRegions";
import { OasisWater } from "../../src/world/oasis";
import { outerHeight } from "../../src/world/outerTerrain";
import { addGroundSlabs } from "../../src/world/groundSlabs";
import { CANAL, CORE_WORLD } from "../../src/world/region";
import { Vehicle } from "../../src/vehicles/Vehicle";
import { SPECS } from "../../src/vehicles/specs";
import "../primeWorldAssets";
import { makeWorld, v3 } from "./harness";

it("preloads outer terrain and collisions, covers tile seams, and unloads both", async () => {
  const { scene, physics } = await makeWorld(undefined, 0);
  const engine = scene.getEngine(), material = new StandardMaterial("outer-test", scene);
  const mats = { get: () => material } as unknown as Materials;
  const stream = new OuterRegions(scene, mats, {} as SignAtlas, {}, false);
  const ray = (x: number, z: number) => physics.raycast(v3(x, 100, z), v3(x, -10, z), Group.STATIC);
  try {
    expect(ray(-2400, 0)).toBeNull();
    stream.preload([{ x: -2400, z: 0 }]);
    expect(stream.activeCount).toBeGreaterThan(0);
    expect(stream.activeCount).toBeLessThan(50);
    for (const [x, z] of [[-2400, 0], [-2400, 300], [-2399.9, 300.1], [-2100, 100]]) {
      const hit = ray(x, z);
      expect(hit, `${x}, ${z}`).not.toBeNull();
      expect(hit!.hitPointWorld.y).toBeCloseTo(outerHeight(x, z), 1);
    }
    stream.update([{ x: 2500, z: 500 }]);
    expect(ray(-2400, 0)).toBeNull();
    expect(ray(2500, 500)).not.toBeNull();
    stream.dispose();
    expect(scene.meshes).toHaveLength(0);
    expect(ray(2500, 500)).toBeNull();
  } finally { stream.dispose(); scene.dispose(); engine.dispose(); }
});

it("drives from the dunes across the old district boundary", async () => {
  const { scene, physics } = await makeWorld((c) => addGroundSlabs(c, CORE_WORLD, CANAL), 0);
  const engine = scene.getEngine(), material = new StandardMaterial("outer-drive", scene);
  const stream = new OuterRegions(scene, { get: () => material } as unknown as Materials, {} as SignAtlas, {}, false);
  const root = new TransformNode("drive-root", scene), steer = new TransformNode("drive-steer", scene);
  const model = { root, steer, wheels: SPECS.car.wheels.map(() => new TransformNode("wheel", scene)), meshes: [], paintable: [] };
  try {
    stream.preload([{ x: 300, z: -1230 }]);
    const car = new Vehicle("outer-test", "car", scene, physics, model, v3(300, outerHeight(300, -1230) + 0.1, -1230), 0, "mint");
    car.hasDriver = true;
    for (let i = 0; i < 600; i++) {
      car.controls = { throttle: 1, steer: 0, handbrake: false };
      car.fixedUpdate(FIXED_DT); physics.step(FIXED_DT); car.postStep(FIXED_DT);
    }
    expect(car.position.z).toBeGreaterThan(-1200);
    expect(car.position.y).toBeGreaterThan(-1);
    expect(car.dir(v3(0, 1, 0)).y).toBeGreaterThan(0.7);
  } finally { stream.dispose(); scene.dispose(); engine.dispose(); }
});

it("keeps ground beneath each old-to-new terrain boundary", async () => {
  const { scene, physics } = await makeWorld((c) => addGroundSlabs(c, CORE_WORLD, CANAL), 0);
  const engine = scene.getEngine(), material = new StandardMaterial("outer-join", scene);
  const stream = new OuterRegions(scene, { get: () => material } as unknown as Materials, {} as SignAtlas, {}, false);
  try {
    const joins = [[-1200, -160], [1500, -160], [300, -1200], [0, 2100]] as const;
    stream.preload(joins.map(([x, z]) => ({ x, z })));
    for (const [x, z] of joins) for (const [dx, dz] of [[0, 0], [-0.05, 0], [0.05, 0], [0, -0.05], [0, 0.05]]) {
      const hit = physics.raycast(v3(x + dx!, 10, z + dz!), v3(x + dx!, -5, z + dz!), Group.STATIC);
      expect(hit, `${x + dx!}, ${z + dz!}`).not.toBeNull();
      expect(hit!.hitPointWorld.y).toBeCloseTo(0, 1);
    }
  } finally { stream.dispose(); scene.dispose(); engine.dispose(); }
});

it("keeps collision under an actor moving at aircraft speed with budgeted loads", async () => {
  const { scene, physics } = await makeWorld(undefined, 0);
  const engine = scene.getEngine(), material = new StandardMaterial("outer-fast", scene);
  const stream = new OuterRegions(scene, { get: () => material } as unknown as Materials, {} as SignAtlas, {}, false);
  try {
    stream.preload([{ x: -3800, z: 0 }]);
    for (let i = 0; i < 150; i++) {
      const x = -3800 + i * 46 * 0.25;
      stream.update([{ x, z: 0 }]);
      expect(physics.raycast(v3(x, 100, 0), v3(x, -5, 0), Group.STATIC), `x=${x}`).not.toBeNull();
    }
  } finally { stream.dispose(); scene.dispose(); engine.dispose(); }
});

it("builds and disposes the real scenery for all four biomes", async () => {
  const { scene } = await makeWorld(undefined, 0);
  const engine = scene.getEngine(), material = new StandardMaterial("outer-scenery", scene);
  const stream = new OuterRegions(scene, { get: () => material } as unknown as Materials, {} as SignAtlas);
  try {
    for (const anchor of [{ x: -2250, z: 150 }, { x: 150, z: -1650 }, { x: 2250, z: 450 }, { x: 150, z: 3150 }]) {
      const start = performance.now();
      stream.preload([anchor]);
      if (process.env.PFS_PROFILE_OUTER) {
        const meshes = scene.meshes.filter((m) => m.metadata?.outerTile);
        console.log("outer profile", anchor, { tiles: stream.activeCount, meshes: meshes.length, vertices: meshes.reduce((n, m) => n + m.getTotalVertices(), 0), preloadMs: Math.round(performance.now() - start) });
        if (anchor.x === -2250) {
          const times: number[] = [];
          for (let i = 1; i <= 70; i++) {
            const before = performance.now();
            stream.update([{ x: anchor.x + i * 46 * 0.25, z: anchor.z }]);
            times.push(performance.now() - before);
          }
          times.sort((a, b) => a - b);
          console.log("budgeted traversal", { updates: times.length, p95Ms: Math.round(times[Math.floor(times.length * 0.95)]!), maxMs: Math.round(times[times.length - 1]!) });
        }
      }
      expect(stream.activeCount).toBeGreaterThan(0);
      expect(stream.activeCount).toBeLessThan(50);
    }
    stream.dispose();
    expect(scene.meshes).toHaveLength(0);
  } finally { stream.dispose(); scene.dispose(); engine.dispose(); }
});

it("keeps the oasis workshop doorway open and switches the actual irrigation surface", async () => {
  const { scene, physics } = await makeWorld(undefined, 0);
  const engine = scene.getEngine(), material = new StandardMaterial("oasis-test", scene);
  const mats = { get: () => material } as unknown as Materials;
  const stream = new OuterRegions(scene, mats, {} as SignAtlas);
  const water = new OasisWater(scene, mats);
  try {
    stream.preload([{ x: 150, z: -1650 }]);
    const y = outerHeight(150, -1650) + 1.4;
    const ray = (x: number) => physics.raycast(v3(x, y, -1648), v3(x, y, -1654), Group.STATIC);
    expect(ray(134), "open workshop doorway").toBeNull();
    expect(ray(131.5), "workshop wall").not.toBeNull();
    const surface = scene.getMeshByName("oasis_irrigation_water")!;
    const turn = scene.getMeshByName("oasis_irrigation_turn")!;
    expect(surface.isEnabled()).toBe(false);
    expect(turn.isEnabled()).toBe(false);
    water.sync(true);
    expect(surface.isEnabled()).toBe(true);
    expect(turn.isEnabled()).toBe(true);
    water.sync(false);
    expect(surface.isEnabled()).toBe(false);
    expect(turn.isEnabled()).toBe(false);
  } finally { water.dispose(); stream.dispose(); scene.dispose(); engine.dispose(); }
});
