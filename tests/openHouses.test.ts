import { describe, expect, it } from "vitest";
import { ALWAYS_OPEN_IDS, HOUSE_BELLS, OPEN_HOUSES, WALK_IN_IDS, houseToWorld, kothiDoorU, kothiGate, openHouseAt, openPlotAt } from "../src/world/openHouses";
import { HOME_ID } from "../src/world/home";
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

  it("every kothi has a bell; the open houses have interiors, and family and two neighbours stay open", () => {
    expect(ALWAYS_OPEN_IDS.size).toBe(3);
    expect(ALWAYS_OPEN_IDS.has(HOME_ID)).toBe(true);
    expect(WALK_IN_IDS.size).toBe(OPEN_HOUSES.length);
    expect(HOUSE_BELLS.length).toBe(OUTER_BUILDINGS.filter((q) => q.style === "kothi").length);
    expect(HOUSE_BELLS.length).toBeGreaterThan(OPEN_HOUSES.length * 4);
    expect(HOUSE_BELLS.filter((b) => b.walkIn).length).toBe(OPEN_HOUSES.length);
    for (const h of OPEN_HOUSES) expect(openHouseAt(h.talk.x, h.talk.z)?.id).toBe(h.id);
    for (const b of HOUSE_BELLS) {
      // The bell stands on the kerb just outside the plot, in front of the gate.
      const plot = OUTER_BUILDINGS.find((q) => q.id === b.id)!;
      const dx = Math.max(plot.x0 - b.bell.x, 0, b.bell.x - plot.x1), dz = Math.max(plot.z0 - b.bell.z, 0, b.bell.z - plot.z1);
      expect(Math.hypot(dx, dz), b.id + " bell is not at the gate").toBeGreaterThan(0.5);
      expect(Math.hypot(dx, dz), b.id + " bell is too far from the gate").toBeLessThan(1.6);
      expect(kothiGate(plot).gw).toBeGreaterThan(0.5);
      expect(Math.hypot(b.gate.x - b.bell.x, b.gate.z - b.bell.z)).toBeLessThan(3.5);
      expect(kothiDoorU(plot, b.walkIn)).toBeGreaterThanOrEqual(0.4);
    }
  });
});
