import { describe, expect, it } from "vitest";
import { NullEngine, Scene, VertexBuffer } from "../src/babylon";
import { addJapanAsset } from "../src/alternate/JapanAssets";
import data from "../src/alternate/assets/japanAssets.json";

describe("Tunyard Japan asset bridge", () => {
  it("preserves source triangles and shares geometry between placed copies", () => {
    const engine = new NullEngine(), scene = new Scene(engine);
    try {
      for (const kind of ["cherry", "torii", "lantern", "teahouse", "zen", "bamboo"] as const) {
        const first = addJapanAsset(scene, kind, 1, 0, 2);
        const second = addJapanAsset(scene, kind, -3, 0, 8, 0.6, 0.5);
        const meshes = first.getChildMeshes(), clones = second.getChildMeshes();
        const source: ReadonlyArray<{ groups: ReadonlyArray<{ count: number }> }> = data.assets[kind];
        const expected = source.flatMap((m) => m.groups).reduce((n, g) => n + g.count, 0);
        expect(meshes.length).toBeGreaterThan(0);
        expect(meshes.reduce((n, m) => n + m.getTotalVertices(), 0)).toBe(expected);
        expect(clones.length).toBe(meshes.length);
        for (let i = 0; i < meshes.length; i++) {
          expect(meshes[i]!.geometry).toBe(clones[i]!.geometry);
          expect(meshes[i]!.material).toBe(clones[i]!.material);
          expect(meshes[i]!.getVerticesData(VertexBuffer.ColorKind)?.length).toBe(meshes[i]!.getTotalVertices() * 4);
        }
        expect(first.isEnabled()).toBe(true);
        expect(second.position.x).toBe(-3);
      }
    } finally { scene.dispose(); engine.dispose(); }
  });
});
