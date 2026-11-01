import { describe, expect, it } from "vitest";
import { canWalkJapan, japanConversation, japanParkConversation, JAPAN_PARK, JAPAN_POND, JAPAN_WORLD, JAPAN_ZEN, normalizeJapanProgress } from "../src/alternate/japanMap";

describe("Sakura Street", () => {
  it("keeps buildings solid and provides walking routes to all residents and the return", () => {
    expect(canWalkJapan(-10, 2)).toBe(false);
    expect(canWalkJapan(6.4, -5)).toBe(false);
    expect(canWalkJapan(-11, 27)).toBe(false);
    expect(canWalkJapan(JAPAN_POND.x, JAPAN_POND.z)).toBe(false);
    expect(canWalkJapan(JAPAN_POND.feedX, JAPAN_POND.feedZ)).toBe(true);
    expect(canWalkJapan(16.25, 27)).toBe(false);
    const start: readonly [number, number] = [0, -20], q: Array<readonly [number, number]> = [start], seen = new Set([start.join(",")]);
    for (let i = 0; i < q.length; i++) {
      const [x, z] = q[i]!;
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const nx = x + dx, nz = z + dz, key = `${nx},${nz}`;
        if (!seen.has(key) && canWalkJapan(nx, nz)) { seen.add(key); q.push([nx, nz]); }
      }
    }
    for (const p of [JAPAN_WORLD.shopkeeper, JAPAN_WORLD.resident, JAPAN_WORLD.neighbor, JAPAN_WORLD.portal, { x: JAPAN_POND.feedX, z: JAPAN_POND.feedZ }, { x: JAPAN_PARK.cameraX, z: JAPAN_PARK.cameraZ }, { x: 33.8, z: -2 }]) {
      expect([...seen].some((key) => { const [x, z] = key.split(",").map(Number); return Math.hypot(x! - p.x, z! - p.z) < 1.6; })).toBe(true);
    }
  });
  it("preserves the park story independently of the tea errand", () => {
    expect(normalizeJapanProgress({ stage: 2, parkStage: 99 })).toEqual({ stage: 2, parkStage: 0 });
    expect(japanParkConversation(0).stage).toBe(1);
    expect(japanParkConversation(1).stage).toBe(1);
    expect(japanParkConversation(2).stage).toBe(3);
    expect(japanParkConversation(3).stage).toBe(3);
    expect(canWalkJapan(17.25, 6)).toBe(false);
    expect(canWalkJapan(17.25, -7)).toBe(true);
    expect(canWalkJapan(JAPAN_ZEN.x, JAPAN_ZEN.z)).toBe(false);
    expect(canWalkJapan(26, 3)).toBe(true);
    expect(canWalkJapan(JAPAN_PARK.cameraX, JAPAN_PARK.cameraZ)).toBe(true);
  });
  it("completes the tea delivery only by visiting both people in order", () => {
    expect(japanConversation(0, "resident").stage).toBe(0);
    expect(japanConversation(0, "shopkeeper").stage).toBe(1);
    expect(japanConversation(1, "shopkeeper").stage).toBe(1);
    expect(japanConversation(1, "resident").stage).toBe(2);
    expect(japanConversation(2, "shopkeeper").stage).toBe(3);
    expect(japanConversation(3, "shopkeeper").stage).toBe(3);
    expect(normalizeJapanProgress({ stage: 4 }).stage).toBe(0);
  });
});
