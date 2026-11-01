import { expect, it } from "vitest";
import { NullEngine, Scene, StandardMaterial } from "../src/babylon";
import { StaticColliderBuilder } from "../src/physics/Physics";
import type { Materials } from "../src/render/Materials";
import type { SignAtlas } from "../src/render/Signs";
import { Kit } from "../src/world/Kit";
import { tunyardModernHouse } from "../src/world/tunyardModernHouse";

it("places the original modern house with its palette and matching solid footprint", () => {
  const engine = new NullEngine(), scene = new Scene(engine);
  try {
    const material = new StandardMaterial("test", scene), colliders = new StaticColliderBuilder();
    const kit = new Kit(scene, { get: () => material } as unknown as Materials, {} as SignAtlas, colliders);
    kit.chunkSize = 160; kit.cullDistance = 220;
    tunyardModernHouse(kit, 1180, 0, 1848, 1, Math.PI);
    const meshes = kit.finish();
    expect(meshes.find(m => m.name.startsWith("world_modernHousePalette|"))?.getTotalVertices()).toBeGreaterThan(0);
    expect(meshes.find(m => m.name.startsWith("world_modernHouseGlass|"))?.getTotalVertices()).toBeGreaterThan(0);
    expect(colliders.boxes).toHaveLength(1);
    expect(colliders.boxes[0]).toMatchObject({ cx: 1180, cz: 1848, sx: 10, sz: 8, rotY: Math.PI });
  } finally { scene.dispose(); engine.dispose(); }
});
