import { describe, expect, it } from "vitest";
import { CANAL, CORE_WORLD, BRIDGES } from "../src/world/region";
import { canalWaterAt, submergedFraction, swimVelocity, waterVelocityDelta } from "../src/physics/water";

const midZ = (CANAL.z0 + CANAL.z1) / 2;
const water = canalWaterAt(0, midZ)!;

describe("the physical canal volume", () => {
  it("has finite authored bounds, including the bed extension and water below bridges", () => {
    expect(canalWaterAt(CORE_WORLD.maxX - 1, midZ)).not.toBeNull();
    expect(canalWaterAt(CORE_WORLD.maxX + 1, midZ)).toBeNull();
    expect(canalWaterAt(CORE_WORLD.minX - 1, midZ)).toBeNull();
    expect(canalWaterAt(0, CANAL.z0)).toBeNull();
    expect(canalWaterAt(0, CANAL.z1)).toBeNull();
    expect(canalWaterAt(Number.NaN, midZ)).toBeNull();
    expect(canalWaterAt(BRIDGES[0]!.x, midZ)).not.toBeNull();
  });
  it("has a slower boundary current than mid-channel", () => {
    expect(canalWaterAt(0, CANAL.z0 + 0.4)!.currentX).toBeLessThan(water.currentX);
  });
});

describe("fluid response", () => {
  it("only displaces the submerged part and applies no force above the surface", () => {
    expect(submergedFraction(0, 0.9, water.surfaceY)).toBe(0);
    expect(submergedFraction(water.surfaceY - 0.45, 0.9, water.surfaceY)).toBeCloseTo(0.5);
    expect(waterVelocityDelta({ x: 3, y: -4, z: 2 }, water, 1 / 60, 0, 4)).toEqual({ x: -0, y: 0, z: -0 });
  });
  it("damps relative motion without reversing it and adds upward buoyancy", () => {
    const v = { x: 10, y: -2, z: -6 };
    const dv = waterVelocityDelta(v, water, 0.25, 1, 4);
    expect(v.x + dv.x).toBeGreaterThan(water.currentX);
    expect(v.x + dv.x).toBeLessThan(v.x);
    expect(v.z + dv.z).toBeGreaterThan(v.z);
    expect(v.z + dv.z).toBeLessThan(0);
    expect(dv.y).toBeGreaterThan(0);
  });
  it("a resting swimmer settles at chest depth while drifting with the current", () => {
    let v = { x: 0, y: -3, z: 0 }, feetY = water.surfaceY - 0.8;
    for (let i = 0; i < 600; i++) {
      v = swimVelocity(v, { x: 0, y: 0, z: 0 }, feetY, water, 1 / 60);
      feetY += v.y / 60;
    }
    expect(feetY).toBeCloseTo(water.surfaceY - 1.1, 4);
    expect(v.x).toBeCloseTo(water.currentX, 4);
    expect(v.y).toBeCloseTo(0, 4);
    const next = swimVelocity(v, { x: -1.5, y: 0, z: 0 }, feetY, water, 1 / 60);
    expect(next.x).toBeLessThan(v.x);
    expect(next.x).toBeGreaterThan(-1.5 + water.currentX); // strokes accelerate, not teleport
  });
});
