import { describe, expect, it } from "vitest";
import { NullEngine, Scene } from "../src/babylon";
import { Kit } from "../src/world/Kit";
import { StaticColliderBuilder } from "../src/physics/Physics";
import { lowpolyBroadleaf, lowpolyShrubTemplate, lowpolyTreeTemplate } from "../src/world/lowpolyNature";
import source from "../src/world/assets/lowpoly-nature.json";

describe("owner-provided LowPoly nature", () => {
  it.each([0, 1, 2])("retains complete source broadleaf variant %s within the geometry and footprint budgets", variant => {
    const tree = lowpolyTreeTemplate(variant);
    const meshes = [tree.bark, tree.leaves];
    const positions = meshes.flatMap(g => g.positions);
    expect(tree.bark.vertexCount).toBeGreaterThan(0);
    expect(tree.leaves.vertexCount).toBeGreaterThan(0);
    expect(meshes.reduce((n, g) => n + g.indices.length / 3, 0)).toBe(source.variants[variant]!.triangles);
    expect(meshes.reduce((n, g) => n + g.indices.length / 3, 0)).toBeLessThanOrEqual(500);
    expect(positions.every(Number.isFinite)).toBe(true);
    const ys = positions.filter((_, i) => i % 3 === 1);
    const xs = positions.filter((_, i) => i % 3 === 0), zs = positions.filter((_, i) => i % 3 === 2);
    expect(Math.min(...ys)).toBeCloseTo(0, 5);
    expect(Math.max(...ys)).toBeCloseTo(4.8, 5);
    expect(Math.max(...xs) - Math.min(...xs)).toBeLessThan(3.301);
    expect(Math.max(...zs) - Math.min(...zs)).toBeLessThan(3.301);
    for (const g of meshes) {
      expect(g.indices.every(i => i >= 0 && i < g.vertexCount)).toBe(true);
      expect(g.normals.every(Number.isFinite)).toBe(true);
      expect(g.colors.length).toBe(g.vertexCount * 4);
      expect(g.colors.filter((_, i) => i % 4 === 3).every(alpha => alpha === 1)).toBe(true);
    }
  });
  it.each([0, 1])("keeps shrub %s grounded and bounded", variant => {
    const shrub = lowpolyShrubTemplate(variant);
    const positions = [...shrub.bark.positions, ...shrub.leaves.positions];
    const ys = positions.filter((_, i) => i % 3 === 1);
    expect(Math.min(...ys)).toBeCloseTo(0, 5);
    expect(Math.max(...ys)).toBeCloseTo(0.9, 5);
    expect((shrub.bark.indices.length + shrub.leaves.indices.length) / 3).toBeLessThanOrEqual(500);
  });
  it("batches bark and leaves together while retaining the authored trunk collision and whole-tree street constraint", () => {
    const engine = new NullEngine(), scene = new Scene(engine), colliders = new StaticColliderBuilder();
    try {
      const kit = new Kit(scene, {} as never, {} as never, colliders);
      lowpolyBroadleaf(kit, 10, 2, 30, 1.2, 0.7, { width: 0.44, height: 2.4, worldXScale: 0.4 });
      expect(colliders.boxes).toHaveLength(1);
      expect(colliders.boxes[0]).toMatchObject({ cx: 10, cy: 3.2, cz: 30, sx: 0.44, sy: 2.4, sz: 0.44 });
      const batch = kit.g("lowpolyNature");
      expect(batch.vertexCount).toBeGreaterThan(0);
      const ys = batch.positions.filter((_, i) => i % 3 === 1);
      expect(Math.min(...ys)).toBeCloseTo(2, 5);
      expect(Math.max(...ys)).toBeCloseTo(2 + 4.8 * 1.2, 5);
      // No other geometry/material batch is introduced for a source leaf.
      expect(kit.g("plant").vertexCount).toBe(0);
    } finally { scene.dispose(); engine.dispose(); }
  });
});
