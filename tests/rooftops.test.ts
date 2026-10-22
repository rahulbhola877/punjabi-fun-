import { describe, expect, it } from "vitest";
import { ROOF_SPOTS } from "../src/world/rooftops";
import { OUTER_BUILDINGS } from "../src/world/region";

describe("roof spots for kite flyers", () => {
  it("stand on each kothi's own roof, behind the front, at roof height", () => {
    expect(ROOF_SPOTS.length).toBeGreaterThan(200);
    for (const s of ROOF_SPOTS) {
      const b = OUTER_BUILDINGS.find((q) => q.id === s.id)!;
      expect(s.x > b.x0 + 0.5 && s.x < b.x1 - 0.5 && s.z > b.z0 + 0.5 && s.z < b.z1 - 0.5, s.id).toBe(true);
      expect(s.y).toBeCloseTo(0.45 + b.floors * 3.15, 5);
    }
  });
});
