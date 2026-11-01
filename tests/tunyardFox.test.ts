import { describe, expect, it } from "vitest";
import { NullEngine, Scene, VertexBuffer } from "../src/babylon";
import { createTunyardFox } from "../src/alternate/TunyardFox";
import fox from "../src/alternate/assets/toonFox.json";

describe("Tunyard fox", () => {
  it("retains all baked source triangles and colors in the new scene", () => {
    const engine = new NullEngine(), scene = new Scene(engine);
    try {
      const root = createTunyardFox(scene);
      const meshes = root.getChildMeshes();
      const sourceVertices = fox.meshes.flatMap((m) => m.groups).reduce((sum, group) => sum + group.count, 0);
      const sourceColors = new Set(fox.meshes.flatMap((m) => m.groups.map((g) => g.color)));
      expect(meshes.length).toBe(sourceColors.size);
      expect(meshes.reduce((sum, mesh) => sum + mesh.getTotalVertices(), 0)).toBe(sourceVertices);
      for (const mesh of meshes) {
        expect(mesh.getVerticesData(VertexBuffer.NormalKind)?.length).toBe(mesh.getTotalVertices() * 3);
        expect(mesh.material).toBeTruthy();
      }
    } finally { scene.dispose(); engine.dispose(); }
  });
});
