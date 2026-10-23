import { describe, expect, it } from "vitest";
import { OPEN_HOUSES, houseToWorld, openPlotAt } from "../src/world/openHouses";
import { colonyLife } from "../src/world/colonySeats";
import { OUTER_BUILDINGS } from "../src/world/region";

describe("open houses", () => {
  it("are a few dozen colony kothis, host and talk spot inside the house", () => {
    expect(OPEN_HOUSES.length).toBeGreaterThan(20);
    expect(OPEN_HOUSES.length).toBeLessThan(160);
    for (const h of OPEN_HOUSES) {
      const b = OUTER_BUILDINGS.find((q) => q.id === h.id)!;
      for (const p of [h.host, h.talk]) {
        expect(p.x > b.x0 + 0.3 && p.x < b.x1 - 0.3 && p.z > b.z0 + 0.3 && p.z < b.z1 - 0.3, h.id).toBe(true);
        expect(p.x > h.rect.x0 && p.x < h.rect.x1 && p.z > h.rect.z0 && p.z < h.rect.z1, h.id).toBe(true);
      }
      // The gate (front of the plot) is outside the house rect, on the street side.
      const g = houseToWorld(h, h.w / 2, 0.5);
      expect(g.x > h.rect.x0 && g.x < h.rect.x1 && g.z > h.rect.z0 && g.z < h.rect.z1).toBe(false);
    }
  });

  it("keep street life out: walk spots and the gate's outside point are off every plot", () => {
    for (const l of colonyLife()) for (const w of l.walks) expect(openPlotAt(w.x, w.z, 0.3)?.id ?? null, `${w.x},${w.z}`).toBe(null);
    for (const h of OPEN_HOUSES) {
      expect(openPlotAt(h.out.x, h.out.z, 0.3), h.id).toBe(null);
      expect(openPlotAt(h.host.x, h.host.z)?.id, h.id).toBe(h.id);
    }
  });
});
