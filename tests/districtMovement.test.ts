import { describe, expect, it } from "vitest";
import { districtFrameDelta, moveInDistrict } from "../src/alternate/districtMovement";
import { canWalkJapan, JAPAN_WORLD } from "../src/alternate/japanMap";
import { canWalkChina, CHINA_WORLD } from "../src/alternate/chinaMap";

describe("district walking during slow foreground frames", () => {
  it("covers the same distance at 5 and 60 FPS, with no diagonal speed bonus", () => {
    const walk = (fps: number, dx: number, dz: number) => {
      const p = { x: 0, z: 0 };
      for (let i = 0; i < fps; i++) moveInDistrict(p, dx, dz, 4.4, districtFrameDelta(1 / fps), () => true);
      return Math.hypot(p.x, p.z);
    };
    expect(walk(5, 0, 1)).toBeCloseTo(4.4, 8);
    expect(walk(5, 0, 1)).toBeCloseTo(walk(60, 0, 1), 8);
    expect(walk(5, 1, 1)).toBeCloseTo(walk(60, 0, 1), 8);
  });

  it("substeps running so a slow frame cannot skip a narrow solid object", () => {
    const p = { x: 0, z: 0 };
    moveInDistrict(p, 1, 0, 7, 0.25, x => x < 0.45 || x > 0.75);
    expect(p.x).toBeLessThan(0.45);
    // Forward progress along a wall remains possible rather than sticking.
    moveInDistrict(p, 1, 1, 7, 0.25, x => x < 0.45 || x > 0.75);
    expect(p.x).toBeLessThan(0.45);
    expect(p.z).toBeGreaterThan(1);
  });

  it("keeps actual district footprints solid while running at low FPS", () => {
    const japan = { x: 0, z: JAPAN_WORLD.shopkeeper.z };
    const china = { x: CHINA_WORLD.start.x, z: CHINA_WORLD.start.z };
    for (let i = 0; i < 30; i++) {
      moveInDistrict(japan, -1, 0, 5.8, 0.2, canWalkJapan);
      moveInDistrict(china, 1, 0, 7, 0.2, canWalkChina);
    }
    expect(canWalkJapan(japan.x, japan.z)).toBe(true);
    expect(japan.x).toBeGreaterThan(-6.1);
    expect(canWalkChina(china.x, china.z)).toBe(true);
    expect(china.x).toBeLessThan(CHINA_WORLD.maxX);
  });

  it("discards background-tab time rather than teleporting on return", () => {
    expect(districtFrameDelta(12)).toBe(0.05);
    expect(districtFrameDelta(0.2)).toBe(0.2);
    expect(districtFrameDelta(0.9)).toBe(0.25);
    for (const dt of [NaN, Infinity, -1, 0]) expect(districtFrameDelta(dt)).toBe(0);
  });
});
