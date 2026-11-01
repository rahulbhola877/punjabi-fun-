import { expect, it } from "vitest";
import { NullEngine, Scene, StandardMaterial } from "../src/babylon";
import { StaticColliderBuilder } from "../src/physics/Physics";
import type { Materials } from "../src/render/Materials";
import type { SignAtlas } from "../src/render/Signs";
import { Kit } from "../src/world/Kit";
import { tunyardCornerShop } from "../src/world/tunyardCornerShop";
import { cacheBakedAsset } from "../src/world/bakedAssets";
import shop from "../src/world/assets/cornerShop.json";

cacheBakedAsset("cornerShop", shop);

it("places the authored shop geometry, its painted signs and a solid footprint at the requested position", () => {
  const engine = new NullEngine(), scene = new Scene(engine);
  try {
    const material = new StandardMaterial("shopTest", scene), colliders = new StaticColliderBuilder();
    const kit = new Kit(scene, { get: () => material } as unknown as Materials, {} as SignAtlas, colliders);
    kit.chunkSize = 160; kit.cullDistance = 220;
    tunyardCornerShop(kit, 1130, 0, 1848, Math.PI);
    const meshes = kit.finish();
    for (const key of ["cornerRender", "cornerSign0", "cornerSign1", "cornerSign2", "cornerStripes"]) {
      const mesh = meshes.find(m => m.name.startsWith(`world_${key}|`));
      expect(mesh?.getTotalVertices(), key).toBeGreaterThan(0);
    }
    expect(colliders.boxes).toHaveLength(1);
    expect(colliders.boxes[0]).toMatchObject({ cx: 1130, cz: 1853, sx: 9, sz: 10, rotY: Math.PI });
    const building = meshes.find(m => m.name.startsWith("world_cornerRender|"))!;
    const bounds = building.getBoundingInfo().boundingBox;
    expect(bounds.minimumWorld.x).toBeLessThan(1130);
    expect(bounds.maximumWorld.x).toBeGreaterThan(1130);
  } finally { scene.dispose(); engine.dispose(); }
});
