import { describe, expect, it } from "vitest";
import { orchardHeight, ORCHARD } from "../src/world/orchardTerrain";
import { onOrchardPath } from "../src/world/orchard";
import { PLOTS, ROADS } from "../src/world/region";

describe("northern orchard", () => {
  it("raises a gentle hill and meets the surrounding flat ground", () => {
    expect(orchardHeight(365, 1350)).toBeGreaterThan(6);
    for (const [x, z] of [[220, 1350], [600, 1350], [365, 1240], [365, 1460]]) expect(orchardHeight(x!, z!)).toBe(0);
  });

  it("reserves the orchard from generated fields and connects to the north road", () => {
    expect(PLOTS.some(p => p.x1 > ORCHARD.x0 && p.x0 < ORCHARD.x1 && p.z1 > ORCHARD.z0 && p.z0 < ORCHARD.z1)).toBe(false);
    expect(ROADS.some(r => r.x0 <= 249 && r.x1 >= 249 && r.z0 <= 1230 && r.z1 >= 1230)).toBe(true);
    expect(onOrchardPath(250, 1240)).toBe(true);
    expect(onOrchardPath(365, 1350)).toBe(true);
    expect(onOrchardPath(570, 1410)).toBe(false);
  });
});
