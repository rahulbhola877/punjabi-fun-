import { describe, expect, it } from "vitest";
import { NullEngine, Scene, VertexBuffer } from "../src/babylon";
import { addChinaAsset } from "../src/alternate/ChinaAssets";
import data from "../src/alternate/assets/chinaMarketAssets.json";

describe("Tunyard market assets", () => {
  it("keeps every source triangle while sharing the converted geometry", () => {
    const engine = new NullEngine(), scene = new Scene(engine);
    try {
      for (const kind of ["marketStall", "lanternString"] as const) {
        const first = addChinaAsset(scene, kind, 1, 0, 2);
        const second = addChinaAsset(scene, kind, -3, 0, 8, 0.6, 0.5);
        const meshes = first.getChildMeshes(), copies = second.getChildMeshes();
        const expected = data.assets[kind].flatMap((m) => m.groups).reduce((n, g) => n + g.count, 0);
        expect(meshes.length).toBeGreaterThan(0);
        expect(meshes.reduce((n, m) => n + (m.getIndices()?.length ?? 0), 0)).toBe(expected);
        expect(meshes.reduce((n, m) => n + m.getTotalVertices(), 0)).toBeLessThan(expected);
        expect(copies.length).toBe(meshes.length);
        for (let i = 0; i < meshes.length; i++) {
          expect(copies[i]!.geometry).toBe(meshes[i]!.geometry);
          expect(copies[i]!.material).toBe(meshes[i]!.material);
          expect(meshes[i]!.getVerticesData(VertexBuffer.ColorKind)?.length).toBe(meshes[i]!.getTotalVertices() * 4);
        }
        // Reconstruct the indexed mesh in its original triangle order. This
        // catches incorrect welding at UV or normal seams, not just a count.
        const key = (g: (typeof data.assets.marketStall)[number]["groups"][number]) =>
          [g.texture, g.normalTexture, g.alphaTest, g.opacity, g.doubleSided, g.roughness, g.metalness].join(":");
        const offsets = new Map<string, number>();
        const decode = (s: string) => {
          const bytes = Uint8Array.from(atob(s), (v) => v.charCodeAt(0));
          return new Float32Array(bytes.buffer);
        };
        for (const source of data.assets[kind]) {
          const p = decode(source.position), n = decode(source.normal), uv = decode(source.uv);
          for (const group of source.groups) {
            const k = key(group), mesh = meshes.find((m) => m.name.endsWith(`china-market-${kind}-${k}`))!;
            expect(mesh).toBeDefined();
            const positions = mesh.getVerticesData(VertexBuffer.PositionKind)!, normals = mesh.getVerticesData(VertexBuffer.NormalKind)!;
            const uvs = mesh.getVerticesData(VertexBuffer.UVKind)!, indices = mesh.getIndices()!;
            let offset = offsets.get(k) ?? 0;
            for (let i = group.start; i < group.start + group.count; i++, offset++) {
              const j = indices[offset]!;
              if (positions[j * 3] !== -p[i * 3] || positions[j * 3 + 1] !== p[i * 3 + 1] || positions[j * 3 + 2] !== p[i * 3 + 2]
                  || normals[j * 3] !== -n[i * 3] || normals[j * 3 + 1] !== n[i * 3 + 1] || normals[j * 3 + 2] !== n[i * 3 + 2]
                  || uvs[j * 2] !== uv[i * 2] || uvs[j * 2 + 1] !== uv[i * 2 + 1]) throw new Error(`${kind} triangle mismatch at ${i}`);
            }
            offsets.set(k, offset);
          }
        }
      }
    } finally { scene.dispose(); engine.dispose(); }
  });
});
