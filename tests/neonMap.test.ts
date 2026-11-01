import { describe, expect, it } from "vitest";
import { canWalkNeon, collectNeonBeacons, NEON_BEACONS, NEON_FOX, NEON_WORLD, neonFoxHint, normalizeNeonProgress } from "../src/alternate/neonMap";

describe("Neon Quay", () => {
  it("blocks building walls and world edges", () => {
    expect(canWalkNeon(-14, -17)).toBe(false);
    expect(canWalkNeon(NEON_WORLD.maxX, 0)).toBe(false);
    expect(canWalkNeon(NEON_WORLD.start.x, NEON_WORLD.start.z)).toBe(true);
  });
  it("allows walking from arrival to all beacons, the relay and the return portal", () => {
    const start: readonly [number, number] = [NEON_WORLD.start.x, NEON_WORLD.start.z], queue: Array<readonly [number, number]> = [start], seen = new Set([start.join(",")]);
    for (let i = 0; i < queue.length; i++) {
      const [x, z] = queue[i]!;
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const nx = x + dx, nz = z + dz, key = `${nx},${nz}`;
        if (!seen.has(key) && canWalkNeon(nx, nz)) { seen.add(key); queue.push([nx, nz]); }
      }
    }
    for (const p of [...NEON_BEACONS, NEON_FOX, NEON_WORLD.relay, NEON_WORLD.portal]) expect(seen.has(`${p.x},${p.z}`)).toBe(true);
  });
  it("collects once and sanitizes saved beacon progress", () => {
    expect(collectNeonBeacons(-20, -7, new Set())).toEqual([0]);
    expect(collectNeonBeacons(-20, -7, new Set([0]))).toEqual([]);
    expect(normalizeNeonProgress({ found: [2, 2, 7, -1], completed: true })).toEqual({ found: [2], completed: false });
    expect(normalizeNeonProgress({ found: [2, 1, 0], completed: true })).toEqual({ found: [0, 1, 2], completed: true });
  });
  it("offers a useful hint for the next missing signal and acknowledges completion", () => {
    expect(neonFoxHint(new Set(), false)).toContain("west");
    expect(neonFoxHint(new Set([0]), false)).toContain("east");
    expect(neonFoxHint(new Set([0, 1]), false)).toContain("north");
    expect(neonFoxHint(new Set([0, 1, 2]), false)).toContain("relay");
    expect(neonFoxHint(new Set([0, 1, 2]), true)).toContain("Thanks");
  });
});
