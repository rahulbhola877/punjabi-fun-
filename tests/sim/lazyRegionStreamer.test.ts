import { expect, it } from "vitest";
import { StandardMaterial } from "../../src/babylon";
import { Group } from "../../src/app/config";
import type { Materials } from "../../src/render/Materials";
import type { SignAtlas } from "../../src/render/Signs";
import { LazyRegionStreamer, type LazyRegion } from "../../src/world/LazyRegionStreamer";
import { loadKitRegion } from "../../src/world/KitRegion";
import { makeWorld, v3 } from "./harness";

it("builds region geometry and collision only near anchors, preloads travel, then releases it", async () => {
  const { scene, physics } = await makeWorld(undefined, 0);
  const engine = scene.getEngine(), shared = new StandardMaterial("shared-region-material", scene);
  const mats = { get: () => shared } as unknown as Materials;
  const signs = {} as SignAtlas;
  const events: string[] = [];
  try {
    const region = (id: string, x: number): LazyRegion => ({
      id, x0: x - 2, x1: x + 2, z0: -2, z1: 2,
      load: () => loadKitRegion(scene, mats, signs, (kit) => {
        kit.frame(x, 0, 0, 0);
        kit.solid("plaster", 0, 0, 0, 4, 2, 4, [1, 1, 1]);
      }, { loaded: () => events.push(`load:${id}`), unloading: () => events.push(`unload:${id}`) }),
    });
    const stream = new LazyRegionStreamer([region("one", 0), region("two", 1000)], 40, 70);
    const hit = (x: number) => physics.raycast(v3(x, 5, 0), v3(x, -5, 0), Group.STATIC);
    expect(scene.meshes).toHaveLength(0);
    expect(hit(0)).toBeNull();
    stream.update([{ x: 0, z: 0 }]);
    expect(stream.isLoaded("one")).toBe(true);
    expect(stream.isLoaded("two")).toBe(false);
    expect(hit(0)).not.toBeNull();
    expect(hit(1000)).toBeNull();
    expect(scene.meshes).toHaveLength(1);
    // A move just beyond the load distance stays inside the unload margin.
    stream.update([{ x: 60, z: 0 }]);
    expect(stream.isLoaded("one")).toBe(true);
    // The destination must be preloaded before a teleport or remote ray.
    stream.preload([{ x: 0, z: 0 }, { x: 1000, z: 0 }]);
    expect(hit(1000)).not.toBeNull();
    expect(scene.meshes).toHaveLength(2);
    stream.update([{ x: 1000, z: 0 }]);
    expect(hit(0)).toBeNull();
    expect(hit(1000)).not.toBeNull();
    stream.dispose();
    stream.dispose();
    expect(hit(1000)).toBeNull();
    expect(scene.meshes).toHaveLength(0);
    expect(scene.materials).toContain(shared);
    expect(events).toEqual(["load:one", "load:two", "unload:one", "unload:two"]);
  } finally { scene.dispose(); engine.dispose(); }
});

it("cleans up geometry and collision if a loaded hook fails", async () => {
  const { scene, physics } = await makeWorld(undefined, 0);
  const engine = scene.getEngine(), shared = new StandardMaterial("shared", scene);
  const mats = { get: () => shared } as unknown as Materials;
  try {
    expect(() => loadKitRegion(scene, mats, {} as SignAtlas, (kit) => {
      kit.solid("plaster", 0, 0, 0, 4, 2, 4, [1, 1, 1]);
    }, { loaded: () => { throw new Error("registration failed"); } })).toThrow("registration failed");
    expect(scene.meshes).toHaveLength(0);
    expect(physics.raycast(v3(0, 5, 0), v3(0, -5, 0), Group.STATIC)).toBeNull();
    expect(scene.materials).toContain(shared);
  } finally { scene.dispose(); engine.dispose(); }
});

it("prioritizes closest regions under a loading budget and validates configuration", () => {
  const loads: string[] = [];
  const r = (id: string, x: number): LazyRegion => ({ id, x0: x, x1: x + 1, z0: 0, z1: 1, load: () => { loads.push(id); return { dispose() {} }; } });
  const stream = new LazyRegionStreamer([r("far", 20), r("near", 2)], 50, 60);
  expect(stream.update([{ x: 0, z: 0 }], 1)).toEqual({ ready: false, pending: 1 });
  expect(loads).toEqual(["near"]);
  expect(stream.update([{ x: 0, z: 0 }], 1)).toEqual({ ready: true, pending: 0 });
  expect(loads).toEqual(["near", "far"]);
  expect(() => stream.update([{ x: NaN, z: 0 }])).toThrow("Invalid region streaming anchor");
  expect(() => new LazyRegionStreamer([r("same", 0), r("same", 10)], 1, 2)).toThrow("Invalid or duplicate lazy region");
  stream.dispose();
});

it("loads all safety-critical regions before applying the ordinary budget", () => {
  const loads: string[] = [];
  const r = (id: string, x: number): LazyRegion => ({ id, x0: x, x1: x + 1, z0: 0, z1: 1, load: () => { loads.push(id); return { dispose() {} }; } });
  const stream = new LazyRegionStreamer([r("far", 40), r("near", 2), r("also-near", 5)], 50, 60);
  expect(stream.update([{ x: 0, z: 0 }], 1, 10)).toEqual({ ready: false, pending: 1 });
  expect(loads).toEqual(["near", "also-near"]);
  expect(stream.update([{ x: 0, z: 0 }], 1, 10)).toEqual({ ready: true, pending: 0 });
  expect(loads).toEqual(["near", "also-near", "far"]);
  expect(() => stream.update([{ x: 0, z: 0 }], 1, 51)).toThrow("Invalid critical region radius");
  stream.dispose();
});
