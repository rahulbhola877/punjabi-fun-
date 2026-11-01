import { describe, expect, it } from "vitest";
import { StandardMaterial } from "../../src/babylon";
import { Player } from "../../src/characters/Player";
import { PLAYER_LOOKS } from "../../src/characters/appearances";
import { FIXED_DT } from "../../src/app/config";
import { CANAL, CORE_WORLD } from "../../src/world/region";
import type { Input } from "../../src/input/Input";
import { makeWorld, v3 } from "./harness";

async function setup(x = 0) {
  const midZ = (CANAL.z0 + CANAL.z1) / 2;
  const w = await makeWorld(c => c.add(x, CANAL.bedY - 0.5, midZ, 100, 1, 100), 0);
  const keys = new Set<string>();
  const input = {
    axis: (a: string, b: string) => (keys.has(b) ? 1 : 0) - (keys.has(a) ? 1 : 0),
    isDown: (a: string) => keys.has(a), wasPressed: (a: string) => keys.has(`press:${a}`), moveMagnitude: 1, touchMode: false,
  } as unknown as Input;
  const player = new Player(w.scene, input);
  player.spawn(PLAYER_LOOKS[0]!.look, new StandardMaterial("waterPlayer", w.scene), v3(x, 0.4, midZ), Math.PI / 2);
  const run = (n: number) => { for (let i = 0; i < n; i++) { player.frameInput(); player.fixedUpdate(FIXED_DT, Math.PI / 2); w.physics.step(FIXED_DT); } };
  return { w, player, run, keys };
}

describe("swimming in Havok", () => {
  it("detects an actual fall, splashes once, floats, and can swim against the current", async () => {
    const { w, player, run, keys } = await setup();
    try {
      let splashes = 0;
      player.onSplash = () => splashes++;
      run(240);
      expect(player.swimming).toBe(true);
      expect(splashes).toBe(1);
      expect(player.feet.y).toBeCloseTo(CANAL.waterY - 1.1, 1);
      expect(player.feet.x).toBeGreaterThan(0.8);
      const drifted = player.feet.x;
      keys.add("back");
      run(180);
      expect(player.feet.x).toBeLessThan(drifted - 1);
      player.teleport(v3(0, 0.1, CANAL.z1 + 2), 0);
      expect(player.swimming).toBe(false);
    } finally { w.scene.dispose(); }
  });
  it("does not swim in an invisible continuation beyond the canal's X boundary", async () => {
    const { w, player, run } = await setup(CORE_WORLD.maxX + 20);
    try {
      player.teleport(v3(CORE_WORLD.maxX + 20, -2, (CANAL.z0 + CANAL.z1) / 2), 0);
      run(1);
      expect(player.swimming).toBe(false);
    } finally { w.scene.dispose(); }
  });
});
