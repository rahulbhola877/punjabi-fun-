import { describe, expect, it } from "vitest";
import { NullEngine, Scene, StandardMaterial } from "../src/babylon";
import type { Materials } from "../src/render/Materials";
import { WaysideLitter, cleanupAvailable, cleanupStep, collectLitter, finishCleanup, startCleanup } from "../src/missions/WaysideCleanup";

describe("wayside clean-up", () => {
  it("requires every piece in order, then returns to the bin once per day", () => {
    const home: Record<string, number> = {};
    expect(startCleanup(home, 0)).toBe(true);
    expect(finishCleanup(home, 0)).toBe(false);
    expect(collectLitter(home, 2)).toBe(false);
    for (let i = 0; i < 3; i++) {
      expect(collectLitter(home, i)).toBe(true);
      expect(collectLitter(home, i)).toBe(false);
    }
    expect(cleanupStep(home)).toBe(4);
    expect(finishCleanup(home, 0)).toBe(true);
    expect(finishCleanup(home, 0)).toBe(false);
    expect(cleanupAvailable(home, 0)).toBe(false);
    expect(cleanupAvailable(home, 1)).toBe(true);
  });
  it("restores a partial round from saved numbers", () => {
    const home: Record<string, number> = {};
    startCleanup(home, 2);
    collectLitter(home, 0);
    const restored = JSON.parse(JSON.stringify(home)) as Record<string, number>;
    expect(cleanupStep(restored)).toBe(2);
    expect(collectLitter(restored, 1)).toBe(true);
  });
  it("removes picked litter from the scene and restores it on the next day", () => {
    const engine = new NullEngine(), scene = new Scene(engine);
    const material = new StandardMaterial("test", scene);
    const visual = new WaysideLitter(scene, { get: () => material } as unknown as Materials);
    const home: Record<string, number> = {};
    try {
      startCleanup(home, 0);
      visual.sync(home, 0);
      expect(scene.getMeshByName("wayside_litter_0")!.isEnabled()).toBe(true);
      collectLitter(home, 0);
      visual.sync(home, 0);
      expect(scene.getMeshByName("wayside_litter_0")!.isEnabled()).toBe(false);
      expect(scene.getMeshByName("wayside_litter_1")!.isEnabled()).toBe(true);
      collectLitter(home, 1); collectLitter(home, 2); finishCleanup(home, 0);
      visual.sync(home, 0);
      expect(scene.getMeshByName("wayside_litter_2")!.isEnabled()).toBe(false);
      visual.sync(home, 1);
      expect(scene.getMeshByName("wayside_litter_0")!.isEnabled()).toBe(true);
    } finally { scene.dispose(); engine.dispose(); }
  });
});
