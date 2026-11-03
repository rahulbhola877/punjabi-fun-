import { describe, expect, it } from "vitest";
import { Matrix, NullEngine, Scene, StandardMaterial } from "../src/babylon";
import { GeoBuilder } from "../src/render/GeoBuilder";
import { spatialBatches } from "../src/render/spatialBatch";
import { Kit } from "../src/world/Kit";
import { StaticColliderBuilder } from "../src/physics/Physics";
import type { Materials } from "../src/render/Materials";
import type { SignAtlas } from "../src/render/Signs";

function fixture(skin = false): GeoBuilder {
  const b = new GeoBuilder(2.5);
  if (skin) b.skin = { a: 2, b: 3, w: 0.3 };
  for (const x of [-400, 400]) {
    b.setTransform(Matrix.RotationY(0.3).multiply(Matrix.Translation(x, 7, -210)));
    const a = b.vertex(0, 0, 0, 0, 1, 0, 0.17, 0.23, [0.1, 0.7, 0.3], 0.9);
    const c = b.vertex(0, 0, 2, 0, 1, 0, 0.19, 0.29, [0.3, 0.2, 0.5], 0.8);
    const d = b.vertex(2, 1, 0, 0, 1, 0, 0.41, 0.53, [0.6, 0.4, 0.1], 0.7);
    for (let i = 0; i < 1100; i++) b.tri(a, c, d);
  }
  // A distant sliver and a triangle sharing vertices across the two buckets.
  b.tri(0, 1, 3);
  return b;
}

function triangles(b: GeoBuilder): string[] {
  const streams = [[b.positions, 3], [b.normals, 3], [b.uvs, 2], [b.colors, 4], [b.boneIdx, 4], [b.boneW, 4]] as const;
  const out: string[] = [];
  for (let i = 0; i < b.indices.length; i += 3) {
    out.push(JSON.stringify(b.indices.slice(i, i + 3).map(v => streams.map(([values, width]) => values.slice(v * width, (v + 1) * width)))));
  }
  return out.sort();
}

describe("oversized opaque spatial batches", () => {
  it.each([false, true])("preserves complete transformed triangles and every stream (skin=%s)", skin => {
    const original = fixture(skin), parts = spatialBatches(original, 160)!;
    expect(parts).toHaveLength(2);
    expect(parts.flatMap(p => triangles(p.geometry)).sort()).toEqual(triangles(original));
    expect(parts.every(p => p.geometry.indices.length >= 64 * 3)).toBe(true);
    expect(parts.some(p => p.cellX < 0 && p.cellZ < 0)).toBe(true);
    expect(parts.reduce((n, p) => n + p.geometry.vertexCount, 0)).toBeGreaterThan(original.vertexCount);
    expect(parts.every(p => p.geometry.uvScale === original.uvScale)).toBe(true);
  });

  it("keeps already-local and small geometry untouched", () => {
    const small = new GeoBuilder(); small.box(0, 1, 0, 2, 2, 2, [1, 1, 1]);
    expect(spatialBatches(small, 160)).toBeNull();
    const local = fixture();
    for (let i = 0; i < local.positions.length; i += 3) local.positions[i] = local.positions[i]! / 20;
    expect(spatialBatches(local, 160)).toBeNull();
  });

  it("retains spanning triangle bounds instead of clipping at cell edges", () => {
    const parts = spatialBatches(fixture(), 160)!;
    const crossing = parts.find(p => p.geometry.positions.some((v, i) => i % 3 === 0 && v < -390)
      && p.geometry.positions.some((v, i) => i % 3 === 0 && v > 390));
    expect(crossing).toBeDefined();
  });

  it("preserves Kit materials, caster/cull state, mesh flags and colliders", () => {
    const engine = new NullEngine(), scene = new Scene(engine);
    try {
      const material = new StandardMaterial("opaque", scene);
      const kit = new Kit(scene, { get: () => material } as unknown as Materials, {} as SignAtlas, new StaticColliderBuilder());
      kit.chunkSize = 160; kit.cullDistance = 310; kit.frame(0, 0, 0, 0);
      kit.g("plaster").append(fixture());
      kit.collide(3, 1, 5, 2, 2, 2);
      const boxes = structuredClone(kit.colliders.boxes);
      const meshes = kit.finish();
      expect(meshes).toHaveLength(2);
      expect(kit.casters).toEqual(meshes);
      expect(kit.colliders.boxes).toEqual(boxes);
      expect(meshes.reduce((n, m) => n + m.getTotalIndices(), 0)).toBe(fixture().indices.length);
      for (const mesh of meshes) {
        expect(mesh.name.startsWith("world_plaster|160:0,0|spatial:")).toBe(true);
        expect(mesh.metadata.sourceBatch).toBe("world_plaster|160:0,0");
        expect(mesh.metadata.authoredCullDistance).toBe(310);
        expect(mesh.metadata.detailCull).toBe(false);
        expect(mesh.metadata.spatialCell.size).toBe(160);
        expect(mesh.getLODLevels()[0]!.distanceOrScreenCoverage).toBe(310);
        expect(mesh.material).toBe(material);
        expect(mesh.receiveShadows).toBe(true);
        expect(mesh.isPickable).toBe(false);
        expect(mesh.isWorldMatrixFrozen).toBe(true);
      }
    } finally { scene.dispose(); engine.dispose(); }
  });
});
