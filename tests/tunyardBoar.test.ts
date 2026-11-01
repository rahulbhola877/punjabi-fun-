import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { tunyardBoarGeometry } from "../src/animals/tunyardBoar";

describe("Tunyard boar asset", () => {
  it("retains complete, finite geometry and all of its palette atlases", () => {
    const parts = tunyardBoarGeometry();
    expect(parts.length).toBeGreaterThan(1);
    const positions = parts.flatMap(p => p.builder.positions);
    expect(positions.length).toBeGreaterThan(1000);
    expect(positions.every(Number.isFinite)).toBe(true);
    for (const p of parts) {
      expect(p.builder.indices.length % 3).toBe(0);
      expect(p.builder.uvs.length).toBe(p.builder.vertexCount * 2);
      expect(p.builder.normals.length).toBe(p.builder.vertexCount * 3);
      expect(p.builder.indices.every(i => i >= 0 && i < p.builder.vertexCount)).toBe(true);
      if (p.texture !== null) expect(existsSync(`public/tunyard/boar/palette-${p.texture}.png`)).toBe(true);
    }
    const ys = positions.filter((_, i) => i % 3 === 1);
    const zs = positions.filter((_, i) => i % 3 === 2);
    expect(Math.min(...ys)).toBeLessThan(0.1);
    expect(Math.max(...ys)).toBeGreaterThan(0.8);
    expect(Math.max(...zs) - Math.min(...zs)).toBeGreaterThan(1);
  });
});
