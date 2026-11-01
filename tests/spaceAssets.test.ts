import { describe, expect, it } from "vitest";
import { NullEngine, Scene, VertexBuffer } from "../src/babylon";
import { addSpaceAsset } from "../src/alternate/SpaceAssets";
import data from "../src/alternate/assets/spaceAssets.json";

describe("Tunyard space asset bridge", () => {
  it("keeps all source triangles and shares geometry and materials between copies", () => {
    const engine = new NullEngine(), scene = new Scene(engine);
    try {
      for (const kind of ["pad", "dish", "solar", "pod", "rover"] as const) {
        const first = addSpaceAsset(scene, kind, 0, 0, 0);
        const second = addSpaceAsset(scene, kind, 5, 0, 8, 0.7, 0.5);
        const meshes = first.getChildMeshes(), clones = second.getChildMeshes();
        if (kind === "rover") expect(first.getChildTransformNodes().filter((node) => /\.wheel-[fmr][rl]$/.test(node.name))).toHaveLength(6);
        const source: ReadonlyArray<{ groups: ReadonlyArray<{ count: number }> }> = data.assets[kind];
        const expected = source.flatMap((m) => m.groups).reduce((n, g) => n + g.count, 0);
        expect(meshes.length).toBeGreaterThan(0);
        expect(meshes.reduce((n, m) => n + m.getTotalVertices(), 0)).toBe(expected);
        expect(clones.length).toBe(meshes.length);
        for (let i = 0; i < meshes.length; i++) {
          expect(clones[i]!.geometry).toBe(meshes[i]!.geometry);
          expect(clones[i]!.material).toBe(meshes[i]!.material);
          expect(meshes[i]!.getVerticesData(VertexBuffer.ColorKind)?.length).toBe(meshes[i]!.getTotalVertices() * 4);
        }
      }
    } finally { scene.dispose(); engine.dispose(); }
  });
});
