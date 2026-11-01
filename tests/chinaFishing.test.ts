import { describe, expect, it } from "vitest";
import { castChinaFishing, CHINA_FISHING_SPOT, CHINA_FISHMONGER, deliverChinaFishing, reelChinaFishing, startChinaFishing, tickChinaFishing } from "../src/alternate/chinaFishing";
import { canWalkChina, CHINA_WORLD } from "../src/alternate/chinaMap";

describe("Lantern Harbor fishing", () => {
  it("rewards timing the bite, rather than casting or reeling early", () => {
    let state = startChinaFishing();
    state = castChinaFishing(state);
    expect(reelChinaFishing(state)).toMatchObject({ phase: "idle", catches: 0 });
    state = tickChinaFishing(state, 2.6);
    expect(state.phase).toBe("bite");
    state = reelChinaFishing(state);
    expect(state).toMatchObject({ phase: "idle", catches: 1 });
    state = tickChinaFishing(castChinaFishing(state), 20);
    expect(state).toMatchObject({ phase: "idle", catches: 1 });
  });
  it("requires three catches to deliver the cook's meal and restores a saved delivery", () => {
    let state = startChinaFishing();
    expect(deliverChinaFishing(state).phase).toBe("idle");
    for (let i = 0; i < 3; i++) state = reelChinaFishing(tickChinaFishing(castChinaFishing(state), 2.6 + i * 0.6));
    expect(state).toMatchObject({ phase: "ready", catches: 3 });
    expect(deliverChinaFishing(state).phase).toBe("delivered");
    expect(startChinaFishing(true).phase).toBe("delivered");
  });
  it("connects the river rod and the cook to the arrival point", () => {
    const key = (x: number, z: number) => `${x},${z}`;
    const queue: Array<[number, number]> = [[CHINA_WORLD.start.x, CHINA_WORLD.start.z]];
    const seen = new Set([key(...queue[0]!)]);
    for (let i = 0; i < queue.length; i++) {
      const [x, z] = queue[i]!;
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx!, nz = z + dz!, k = key(nx, nz);
        if (!seen.has(k) && canWalkChina(nx, nz)) { seen.add(k); queue.push([nx, nz]); }
      }
    }
    for (const p of [CHINA_FISHING_SPOT, CHINA_FISHMONGER]) expect(seen.has(key(p.x, p.z)), `${p.x},${p.z}`).toBe(true);
  });
});
