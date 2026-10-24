import { describe, expect, it } from "vitest";
import { GeoBuilder } from "../src/render/GeoBuilder";
import { buildCropCards, cropShape } from "../src/world/crops";
import { PLOTS } from "../src/world/region";

describe("crop plants", () => {
  it("every cropped field builds a ribbon of plants within a vertex budget; fallow builds nothing", () => {
    let total = 0, worst = 0;
    for (const p of PLOTS) {
      const g = new GeoBuilder(1);
      const n = buildCropCards(g, p, false);
      if (p.crop === "fallow") { expect(n).toBe(0); continue; }
      expect(n, p.id).toBeGreaterThan(0);
      expect(g.indices.length % 3).toBe(0);
      expect(Math.max(...g.indices)).toBeLessThan(g.vertexCount);
      total += n; worst = Math.max(worst, n);
    }
    // The world has about a thousand fields; the near ones only are ever made (CropStreamer).
    expect(worst).toBeLessThan(9000);
    expect(total).toBeGreaterThan(100000);
  });
  it("the Low preset has fewer, longer rows", () => {
    const p = PLOTS.find((q) => q.crop === "wheat")!;
    const a = new GeoBuilder(1), b = new GeoBuilder(1);
    expect(buildCropCards(b, p, true)).toBeLessThan(buildCropCards(a, p, false) / 2);
    expect(cropShape("sugarcane", false).height).toBeGreaterThan(cropShape("wheat", false).height);
  });
});
