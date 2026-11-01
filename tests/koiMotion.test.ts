import { describe, expect, it } from "vitest";
import { koiPose } from "../src/alternate/koiMotion";
import { JAPAN_POND } from "../src/alternate/japanMap";

describe("koi movement", () => {
  it("keeps swimming fish clear of the pond edge", () => {
    for (let i = 0; i < 3; i++) for (let t = 0; t < 40; t += 0.2) for (const feeding of [0, 0.5, 1]) {
      const p = koiPose(t, i, feeding);
      const d = ((p.x - JAPAN_POND.x) / (JAPAN_POND.rx - 0.5)) ** 2 + ((p.z - JAPAN_POND.z) / (JAPAN_POND.rz - 0.5)) ** 2;
      expect(d).toBeLessThan(1);
      expect(Number.isFinite(p.yaw)).toBe(true);
    }
  });
  it("moves and gathers on the feeding side", () => {
    expect(koiPose(1, 0, 0)).not.toEqual(koiPose(2, 0, 0));
    expect(koiPose(1, 0, 1).x).toBeLessThan(JAPAN_POND.x);
  });
});
