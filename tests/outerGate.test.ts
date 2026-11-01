import { expect, it } from "vitest";
import { OUTER_WORLD_ENABLED, WORLD_BOUNDS } from "../src/app/config";
import { outerWorldEnabled } from "../src/app/outerGate";

it("requires both an explicit probe and development mode for sparse outer terrain", () => {
  expect(outerWorldEnabled("", true)).toBe(false);
  expect(outerWorldEnabled("?outer=1", true)).toBe(false);
  expect(outerWorldEnabled("?probe", true)).toBe(false);
  expect(outerWorldEnabled("?probe&outer=0", true)).toBe(false);
  expect(outerWorldEnabled("?probe&outer=1", false)).toBe(false);
  expect(outerWorldEnabled("?probe&outer=1", true)).toBe(true);
  expect(OUTER_WORLD_ENABLED).toBe(false);
  expect(WORLD_BOUNDS).toEqual({ minX: -1200, maxX: 1500, minZ: -1200, maxZ: 2100 });
});
