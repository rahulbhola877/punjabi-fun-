import { describe, expect, it } from "vitest";
import { Color3, DirectionalLight, HemisphericLight, Mesh, MeshBuilder, NullEngine, Scene, Vector3 } from "../src/babylon";
import { DayNight } from "../src/world/DayNight";
import type { World } from "../src/world/World";

describe("outdoor daylight", () => {
  it("keeps a blue daytime sky while smoothly restoring night lights and the night sky", () => {
    const engine = new NullEngine(), scene = new Scene(engine);
    const sky = MeshBuilder.CreateSphere("sky", { diameter: 900, segments: 12, sideOrientation: Mesh.BACKSIDE }, scene);
    const sun = new DirectionalLight("sun", new Vector3(0, -1, 0), scene);
    const hemi = new HemisphericLight("hemi", new Vector3(0, 1, 0), scene);
    const emissive = { emissiveIntensity: 0 };
    const world = { sun, hemi, mats: { get: () => emissive } } as unknown as World;
    const cycle = new DayNight(scene, world);
    cycle.set(9);
    expect(cycle.base.clear.b).toBeGreaterThan(cycle.base.clear.r);
    expect(cycle.base.hemi).toBeGreaterThan(0.6);
    expect(cycle.lamps).toBe(0);
    const colors = sky.getVerticesData("color")!;
    expect(colors.length).toBeGreaterThan(0);
    expect(colors.some((c, i) => i % 4 === 2 && c > colors[i - 2]!)).toBe(true);
    cycle.set(0);
    expect(cycle.lamps).toBe(1);
    expect(cycle.base.clear.b).toBeLessThan(0.3);
    expect(emissive.emissiveIntensity).toBeGreaterThan(2);
    const late = new Color3(); cycle.set(23.999); late.copyFrom(cycle.base.clear);
    cycle.set(0.001);
    expect(Math.hypot(late.r - cycle.base.clear.r, late.g - cycle.base.clear.g, late.b - cycle.base.clear.b)).toBeLessThan(0.01);
    scene.dispose(); engine.dispose();
  });
});
