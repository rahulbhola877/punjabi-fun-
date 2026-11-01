import { describe, expect, it } from "vitest";
import { NullEngine, Scene } from "../src/babylon";
import { cacheBakedAsset } from "../src/world/bakedAssets";
import source from "../src/world/assets/broadleaf.json";
import { addChinaTree } from "../src/alternate/ChinaTrees";

describe("Harbor trees", () => {
  it("uses the original tree triangles and shares geometry between instances", () => {
    cacheBakedAsset("broadleaf", source);
    const engine = new NullEngine(), scene = new Scene(engine);
    try {
      addChinaTree(scene, 3, 1.5, 4, 1, 0);
      addChinaTree(scene, 9, 0, 2, 1.2, 1);
      const instances = scene.transformNodes.filter((n) => n.name === "harbor-tree");
      expect(instances).toHaveLength(2);
      const a = instances[0]!.getChildMeshes(), b = instances[1]!.getChildMeshes();
      const expected = source.meshes.flatMap((m) => m.groups).reduce((sum, g) => sum + g.count, 0);
      expect(a.reduce((sum, mesh) => sum + (mesh.getIndices()?.length ?? 0), 0)).toBe(expected);
      expect(a.length).toBeGreaterThan(0);
      for (let i = 0; i < a.length; i++) { expect(a[i]!.geometry).toBe(b[i]!.geometry); expect(a[i]!.material).toBe(b[i]!.material); }
      expect(instances[0]!.position.y).toBe(1.5);
    } finally { scene.dispose(); engine.dispose(); }
  });
});
