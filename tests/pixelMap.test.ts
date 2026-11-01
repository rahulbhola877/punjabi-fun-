import { describe, expect, it } from "vitest";
import { canWalkPixel, collectPixelLanterns, LANTERNS, normalizePixelProgress, PIXEL_WORLD } from "../src/alternate/pixelMap";

describe("pixel world", () => {
  it("keeps water and houses solid while allowing travel on both bridges", () => {
    expect(canWalkPixel(21.5, 10.5)).toBe(false);
    expect(canWalkPixel(21.5, 14.5)).toBe(true);
    expect(canWalkPixel(21.5, 25.5)).toBe(true);
    expect(canWalkPixel(29.5, 18.5)).toBe(false);
  });

  it("has a walkable route from arrival to every lantern, shrine and return portal", () => {
    const start = [Math.floor(PIXEL_WORLD.start.x), Math.floor(PIXEL_WORLD.start.y)] as const;
    const queue: Array<readonly [number, number]> = [start], seen = new Set([start.join(",")]);
    for (let i = 0; i < queue.length; i++) {
      const [x, y] = queue[i]!;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const nx = x + dx, ny = y + dy, key = `${nx},${ny}`;
        if (!seen.has(key) && canWalkPixel(nx + 0.5, ny + 0.5)) { seen.add(key); queue.push([nx, ny]); }
      }
    }
    for (const p of [...LANTERNS, PIXEL_WORLD.shrine, PIXEL_WORLD.portal]) {
      expect(seen.has(`${Math.floor(p.x)},${Math.floor(p.y)}`)).toBe(true);
    }
  });

  it("collects a nearby lantern only once", () => {
    const p = LANTERNS[0];
    expect(collectPixelLanterns(p.x, p.y, new Set())).toEqual([0]);
    expect(collectPixelLanterns(p.x, p.y, new Set([0]))).toEqual([]);
    expect(collectPixelLanterns(10, 10, new Set())).toEqual([]);
  });

  it("restores only valid unique lanterns and requires all five for completion", () => {
    expect(normalizePixelProgress({ found: [4, 2, 2, -1, 9], completed: true })).toEqual({ found: [2, 4], completed: false });
    expect(normalizePixelProgress({ found: [4, 3, 2, 1, 0], completed: true })).toEqual({ found: [0, 1, 2, 3, 4], completed: true });
  });
});
