import { describe, expect, it } from "vitest";
import { SPECS, VEHICLE_TYPES } from "../src/vehicles/specs";
import { TANKS } from "../src/vehicles/Fuel";
import { VEHICLE_SPAWNS, inRect } from "../src/world/layout";
import { PLOTS } from "../src/world/region";

describe("pickup", () => {
  it("has a powered four-wheel-drive setup and a fuel tank", () => {
    expect(VEHICLE_TYPES).toContain("pickup");
    expect(SPECS.pickup.wheels).toHaveLength(4);
    expect(SPECS.pickup.wheels.every(w => w.drive)).toBe(true);
    expect(SPECS.pickup.wheels.filter(w => w.steer)).toHaveLength(2);
    expect(TANKS.pickup?.fuel).toBe("diesel");
  });

  it("starts outside cultivated plots on the orchard road shoulder", () => {
    const spawn = VEHICLE_SPAWNS.find(v => v.id === "pickup_orchard")!;
    expect(spawn.type).toBe("pickup");
    expect(PLOTS.some(p => inRect(p, spawn.x, spawn.z, 1))).toBe(false);
  });
});
