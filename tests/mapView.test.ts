import { describe, expect, it } from "vitest";
import { WORLD_BOUNDS } from "../src/app/config";
import { mapPoint, mapView } from "../src/ui/mapView";

describe("full map view", () => {
  it("fits all world corners on landscape and portrait canvases", () => {
    for (const [w, h] of [[1000, 600], [400, 700]]) {
      const v = mapView(w!, h!, 1, { x: 0, z: 0 });
      for (const x of [WORLD_BOUNDS.minX, WORLD_BOUNDS.maxX]) for (const z of [WORLD_BOUNDS.minZ, WORLD_BOUNDS.maxZ]) {
        expect(w! / 2 + (x - v.cx) * v.scale).toBeGreaterThan(0);
        expect(w! / 2 + (x - v.cx) * v.scale).toBeLessThan(w!);
        expect(h! / 2 - (z - v.cz) * v.scale).toBeGreaterThan(0);
        expect(h! / 2 - (z - v.cz) * v.scale).toBeLessThan(h!);
      }
    }
  });
  it("maps a clicked point back to the coordinates drawn at either zoom", () => {
    for (const zoom of [1, 4]) {
      const w = 800, h = 600, v = mapView(w, h, zoom, { x: 150, z: -200 });
      const x = 420, z = -50;
      const p = mapPoint(w, h, (w / 2 + (x - v.cx) * v.scale) / w, (h / 2 - (z - v.cz) * v.scale) / h, v);
      expect(p.x).toBeCloseTo(x);
      expect(p.z).toBeCloseTo(z);
    }
  });
});
