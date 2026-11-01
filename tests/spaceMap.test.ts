import { describe, expect, it } from "vitest";
import { canDriveSpace, canWalkSpace, normalizeSpaceProgress, SPACE_CRATER_ROCKS, SPACE_SOLIDS, SPACE_WORLD, spaceHeight, spaceInteraction } from "../src/alternate/spaceMap";

describe("Chand Outpost", () => {
  it("restores only valid saved mission stages", () => {
    expect(normalizeSpaceProgress({ stage: 4 })).toEqual({ stage: 4 });
    for (const stage of [-1, 5, 1.5, NaN]) expect(normalizeSpaceProgress({ stage })).toEqual({ stage: 0 });
  });

  it("requires the player to recover the cell before repairing and reporting", () => {
    expect(spaceInteraction(0, "relay").stage).toBe(0);
    expect(spaceInteraction(0, "cell").stage).toBe(0);
    expect(spaceInteraction(0, "pilot").stage).toBe(1);
    expect(spaceInteraction(1, "pilot").stage).toBe(1);
    expect(spaceInteraction(1, "cell").stage).toBe(2);
    expect(spaceInteraction(2, "relay").stage).toBe(3);
    expect(spaceInteraction(3, "pilot").stage).toBe(4);
    expect(spaceInteraction(4, "pilot").stage).toBe(4);
    expect(spaceInteraction(2, "fox").stage).toBe(2);
  });

  it("keeps buildings solid and all objectives reachable on foot", () => {
    for (const b of SPACE_SOLIDS) expect(canWalkSpace(b.x, b.z)).toBe(false);
    expect(canWalkSpace(SPACE_WORLD.minX - 1, 0)).toBe(false);
    // Half-metre cells also exercise the narrow interaction band around the
    // relay, whose visible base is wider than a single metre.
    const pending: Array<[number, number]> = [[0, -64]], seen = new Set(["0,-64"]);
    for (let i = 0; i < pending.length; i++) {
      const [x, z] = pending[i]!;
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const nx = x + dx, nz = z + dz, key = `${nx},${nz}`;
        if (!seen.has(key) && canWalkSpace(nx / 2, nz / 2)) { seen.add(key); pending.push([nx, nz]); }
      }
    }
    for (const p of [SPACE_WORLD.portal, SPACE_WORLD.pilot, SPACE_WORLD.cell, SPACE_WORLD.relay, SPACE_WORLD.fox]) {
      expect([...seen].some((k) => { const [x, z] = k.split(",").map(Number); return Math.hypot(x! / 2 - p.x, z! / 2 - p.z) < 2.6; })).toBe(true);
    }
  });
  it("has shaped uplands and a collision-clear rover approach to the crater", () => {
    expect(spaceHeight(SPACE_WORLD.start.x, SPACE_WORLD.start.z)).toBe(0);
    expect(spaceHeight(-66, 22)).toBeGreaterThan(3);
    expect(canWalkSpace(SPACE_CRATER_ROCKS[0]!.x, SPACE_CRATER_ROCKS[0]!.z)).toBe(false);
    const route = [SPACE_WORLD.rover, { x: 28, z: -7 }, { x: 42, z: 9 }, { x: 51, z: 31 }, { x: 57, z: 55 }, { x: 58, z: 69 }];
    for (let i = 1; i < route.length; i++) {
      const a = route[i - 1]!, b = route[i]!;
      const steps = Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) * 2);
      for (let j = 0; j <= steps; j++) expect(canDriveSpace(a.x + (b.x - a.x) * j / steps, a.z + (b.z - a.z) * j / steps)).toBe(true);
    }
  });

});
