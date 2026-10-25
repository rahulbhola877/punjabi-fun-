import { describe, expect, it } from "vitest";
import { NullEngine, Scene, StandardMaterial } from "../src/babylon";
import { buildVehicleModel } from "../src/vehicles/models";
import { SPECS, type VehicleType } from "../src/vehicles/specs";
import type { Materials } from "../src/render/Materials";
import type { SignAtlas } from "../src/render/Signs";

describe("vehicle geometry", () => {
  it("white civilian vehicles never acquire police equipment from their paint colour", () => {
    const engine = new NullEngine(), scene = new Scene(engine);
    try {
      const material = new StandardMaterial("test", scene);
      const mats = { get: () => material } as unknown as Materials;
      const signs = { material, get: () => ({ u0:0,u1:1,v0:0,v1:1,aspect:4.57 }) } as unknown as SignAtlas;
      for (const type of ["jeep", "motorcycle", "car"] as const) {
        const civilian = buildVehicleModel(scene, mats, signs, type, "#f0f0ee", "#1e3a8a", "parade");
        const police = buildVehicleModel(scene, mats, signs, type, "#f0f0ee", "#1e3a8a", "duty", true);
        const count = (model: typeof civilian) => model.meshes.reduce((n,m) => n + m.getTotalIndices(), 0);
        expect(count(police)).toBeGreaterThan(count(civilian));
        civilian.root.dispose(); police.root.dispose();
      }
    } finally { scene.dispose(); engine.dispose(); }
  });
  for (const type of Object.keys(SPECS) as VehicleType[]) it(`${type}: valid geometry, cheap distant wheels, complete disposal`, () => {
    const engine = new NullEngine(), scene = new Scene(engine);
    try {
      const material = new StandardMaterial("test", scene);
      const mats = {get: () => material} as unknown as Materials;
      const signs = {material, get: () => ({u0:0,u1:1,v0:0,v1:1,aspect:4.57})} as unknown as SignAtlas;
      const model = buildVehicleModel(scene, mats, signs, type, "#1d4f91", "#e9e3d0", "test");
      expect(model.wheels.length).toBe(SPECS[type].wheels.length);
      for (const mesh of scene.meshes) {
        expect(mesh.getVerticesData("position")?.every(Number.isFinite),mesh.name).toBe(true);
        expect(mesh.getTotalIndices(),mesh.name).toBeGreaterThan(0);
      }
      for (const wheel of model.wheels) {
        const tyre = model.meshes.find(m => m.parent === wheel && m.name.endsWith("|rubber"));
        if (!tyre) continue;
        const low = tyre.getLODLevels()[0]!.mesh!;
        expect(low.getTotalIndices()).toBeLessThan(tyre.getTotalIndices() * 0.4);
      }
      model.root.dispose();
      expect(scene.meshes).toHaveLength(0);
    } finally { scene.dispose(); engine.dispose(); }
  });
});
