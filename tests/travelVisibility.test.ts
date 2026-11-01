import { expect, it } from "vitest";
import "./primeWorldAssets";
import { NullEngine, Scene, StandardMaterial } from "../src/babylon";
import { StaticColliderBuilder } from "../src/physics/Physics";
import type { Materials } from "../src/render/Materials";
import type { SignAtlas } from "../src/render/Signs";
import { Kit } from "../src/world/Kit";
import { buildTravelDistrict } from "../src/world/travelDistrict";
import { buildWinterBackdrop } from "../src/world/winterBackdrop";
import { AIRFIELD_ARRIVAL, AIRFIELD_CHECKIN, CANADA_ARRIVAL, CANADA_CHECKIN, CANADA_SIDEWALKS } from "../src/world/travelDistrictLayout";

it("keeps runway pavement visible near both ends on the low draw-distance preset", () => {
  const engine = new NullEngine(), scene = new Scene(engine);
  try {
    const material = new StandardMaterial("test", scene);
    const signs = { material, get: () => ({u0: 0, v0: 0, u1: 1, v1: 1, aspect: 4}) } as unknown as SignAtlas;
    const colliders = new StaticColliderBuilder();
    const kit = new Kit(scene, { get: () => material } as unknown as Materials, signs, colliders);
    kit.chunkSize = 160;
    kit.cullDistance = 220;
    buildTravelDistrict(kit);
    // Preserve clear, walkable transfer points as scenery is refined.
    for (const [name, p] of Object.entries({ AIRFIELD_ARRIVAL, AIRFIELD_CHECKIN, CANADA_ARRIVAL, CANADA_CHECKIN })) {
      expect(colliders.boxes.some(b => b.cy - b.sy / 2 < 1.8 && Math.abs(b.cx - p.x) < b.sx / 2 + 0.45 && Math.abs(b.cz - p.z) < b.sz / 2 + 0.45), name).toBe(false);
    }
    for (const z of CANADA_SIDEWALKS) for (let x = 1080; x <= 1280; x += 4) {
      expect(colliders.boxes.some(b => b.cy - b.sy / 2 < 1.8 && Math.abs(b.cx - x) < b.sx / 2 + 0.45 && Math.abs(b.cz - z) < b.sz / 2 + 0.45), `${x},${z}`).toBe(false);
    }
    for (let z = 1750; z <= 1806; z += 2) {
      expect(colliders.boxes.some(b => b.cy - b.sy / 2 < 1.8 && Math.abs(b.cx - 1106) < b.sx / 2 + 0.45 && Math.abs(b.cz - z) < b.sz / 2 + 0.45), `arrival walk at ${z}`).toBe(false);
    }
    const asphalt = kit.finish().filter(m => m.name.startsWith("world_asphalt|"));
    for (const x of [390, 830]) {
      expect(asphalt.some(m => {
        const b = m.getBoundingInfo().boundingBox, centre = m.getBoundingInfo().boundingSphere.centerWorld;
        return b.minimumWorld.x <= x && b.maximumWorld.x >= x && b.minimumWorld.z <= 1891 && b.maximumWorld.z >= 1891 && Math.hypot(centre.x - x, centre.z - 1891) < 220;
      }), `runway at ${x}`).toBe(true);
    }
  } finally { scene.dispose(); engine.dispose(); }
});

it("faces the winter skyline toward players approaching from the south", () => {
  const engine = new NullEngine(), scene = new Scene(engine);
  try {
    const material = new StandardMaterial("test", scene);
    const signs = { material, get: () => ({u0: 0, v0: 0, u1: 1, v1: 1, aspect: 4}) } as unknown as SignAtlas;
    const kit = new Kit(scene, { get: () => material } as unknown as Materials, signs, new StaticColliderBuilder());
    kit.chunkSize = 160;
    buildWinterBackdrop(kit);
    let skylineVertices = 0;
    for (const mesh of kit.finish()) {
      const positions = mesh.getVerticesData("position"), normals = mesh.getVerticesData("normal");
      if (!positions || !normals) continue;
      for (let i = 0; i < positions.length; i += 3) {
        if (Math.abs(positions[i + 2]! - 2120) > 0.001) continue;
        expect(normals[i + 2]).toBeLessThan(-0.99);
        skylineVertices++;
      }
    }
    expect(skylineVertices).toBeGreaterThan(0);
  } finally { scene.dispose(); engine.dispose(); }
});
