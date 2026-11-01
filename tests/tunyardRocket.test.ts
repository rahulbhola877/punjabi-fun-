import { describe, expect, it } from "vitest";
import { NullEngine, Scene, VertexBuffer } from "../src/babylon";
import { createTunyardRocket } from "../src/alternate/TunyardRocket";
import rocket from "../src/alternate/assets/toonRocket.json";

describe("Tunyard rocket", () => {
  it("retains all baked source triangles and colors in the new scene", () => {
    const engine = new NullEngine(), scene = new Scene(engine);
    try {
      const root = createTunyardRocket(scene);
      const meshes = root.getChildMeshes();
      const sourceVertices = rocket.meshes.flatMap((m) => m.groups).reduce((sum, group) => sum + group.count, 0);
      const sourceColors = new Set(rocket.meshes.flatMap((m) => m.groups.map((g) => g.color)));
      expect(meshes.length).toBe(sourceColors.size);
      expect(meshes.reduce((sum, mesh) => sum + mesh.getTotalVertices(), 0)).toBe(sourceVertices);
      for (const mesh of meshes) {
        expect(mesh.getVerticesData(VertexBuffer.NormalKind)?.length).toBe(mesh.getTotalVertices() * 3);
        expect(mesh.material).toBeTruthy();
      }
    } finally { scene.dispose(); engine.dispose(); }
  });
});
