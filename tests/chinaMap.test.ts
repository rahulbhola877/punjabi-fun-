import { describe, expect, it } from "vitest";
import { canWalkChina, chinaConversation, chinaHeight, CHINA_WORLD, inChinaWater, normalizeChinaProgress } from "../src/alternate/chinaMap";

describe("Lantern Harbor", () => {
  it("preserves story progress and pays off only in order", () => {
    expect(normalizeChinaProgress({ stage: 99 }).stage).toBe(0);
    expect(chinaConversation(0, "musician").stage).toBe(0);
    let stage = chinaConversation(0, "host").stage;
    stage = chinaConversation(stage, "artisan").stage;
    stage = chinaConversation(stage, "musician").stage;
    stage = chinaConversation(stage, "host").stage;
    expect(stage).toBe(4);
    expect(chinaConversation(stage, "host").stage).toBe(4);
  });
  it("has two walkable crossings and an accessible raised lookout", () => {
    expect(inChinaWater(0, 20)).toBe(true);
    expect(canWalkChina(0, 20)).toBe(false);
    expect(canWalkChina(0, 2)).toBe(true);
    expect(canWalkChina(0, 48)).toBe(true);
    expect(chinaHeight(CHINA_WORLD.keeper.x, CHINA_WORLD.keeper.z)).toBeGreaterThan(5);
    for (const p of [CHINA_WORLD.start, CHINA_WORLD.host, CHINA_WORLD.artisan, CHINA_WORLD.musician, CHINA_WORLD.keeper]) expect(canWalkChina(p.x, p.z)).toBe(true);
  });
  it("connects each story person and the return stop across actual walking space", () => {
    const start: [number, number] = [CHINA_WORLD.start.x, CHINA_WORLD.start.z];
    const key = (x: number, z: number) => `${x},${z}`;
    const seen = new Set([key(...start)]), queue: Array<[number, number]> = [start];
    for (let i = 0; i < queue.length; i++) {
      const [x, z] = queue[i]!;
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const a = x + dx!, b = z + dz!, k = key(a, b);
        if (!seen.has(k) && canWalkChina(a, b)) { seen.add(k); queue.push([a, b]); }
      }
    }
    for (const p of [CHINA_WORLD.portal, CHINA_WORLD.host, CHINA_WORLD.artisan, CHINA_WORLD.musician, CHINA_WORLD.keeper]) expect(seen.has(key(p.x, p.z)), `${p.x}, ${p.z}`).toBe(true);
  });
});
