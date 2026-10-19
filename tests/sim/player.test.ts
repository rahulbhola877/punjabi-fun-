import { describe, expect, it } from "vitest";
import { StandardMaterial } from "../../src/babylon";
import { makeWorld, v3 } from "./harness";
import { Player } from "../../src/characters/Player";
import { PLAYER_LOOKS } from "../../src/characters/appearances";
import { FIXED_DT, Group } from "../../src/app/config";
import type { Input } from "../../src/input/Input";

function fakeInput(keys: Set<string>): Input {
  return {
    axis: (neg: string, pos: string) => (keys.has(pos) ? 1 : 0) - (keys.has(neg) ? 1 : 0),
    isDown: (a: string) => keys.has(a),
    wasPressed: (a: string) => keys.has(`press:${a}`),
  } as unknown as Input;
}

async function setup(build: Parameters<typeof makeWorld>[0]) {
  const w = await makeWorld(build);
  const keys = new Set<string>();
  const p = new Player(w.scene, fakeInput(keys));
  p.raycast = (a, b) => {
    const h = w.physics.raycast(a, b, Group.STATIC | Group.PROP | Group.VEHICLE);
    return h ? { y: h.hitPointWorld.y, ny: h.hitNormalWorld.y } : null;
  };
  p.spawn(PLAYER_LOOKS[0]!.look, new StandardMaterial("m", w.scene), v3(0, 0.0, 0), Math.PI / 2);
  const run = (secs: number) => { for (let i = 0; i < Math.round(secs / FIXED_DT); i++) { p.frameInput(); p.fixedUpdate(FIXED_DT, Math.PI / 2); w.physics.step(FIXED_DT); } };
  return { w, p, keys, run };
}

describe("player controller", () => {
  it("stands still on flat ground", async () => {
    const { p, run } = await setup(undefined);
    run(1.5);
    expect(Math.abs(p.feet.x)).toBeLessThan(0.05);
    expect(p.feet.y).toBeGreaterThan(-0.05);
    expect(p.feet.y).toBeLessThan(0.1);
    expect(p.grounded).toBe(true);
  });
  it.each([0.15, 0.3])("walks up a %s m step (kerb / doorstep)", async (h) => {
    const { p, keys, run } = await setup((c) => c.add(17, h / 2, 0, 30, h, 6));
    run(0.5);
    keys.add("forward");
    run(2.5);
    expect(p.feet.x).toBeGreaterThan(3);
    expect(p.feet.y).toBeGreaterThan(h - 0.05);
  });
  it("chained kerb + doorstep (0.15 then 0.3) like the dhaba entrance", async () => {
    const { p, keys, run } = await setup((c) => { c.add(3.25, 0.075, 0, 2.5, 0.15, 6); c.add(19.5, 0.15, 0, 30, 0.3, 6); });
    run(0.5);
    keys.add("forward");
    run(3);
    expect(p.feet.x).toBeGreaterThan(6);
    expect(p.feet.y).toBeGreaterThan(0.25);
  });
  it("is blocked by a wall taller than a step", async () => {
    const { p, keys, run } = await setup((c) => c.add(3, 0.5, 0, 1, 1.0, 6));
    keys.add("forward");
    run(3);
    expect(p.feet.x).toBeLessThan(2.6);
  });
  it("jumps and lands", async () => {
    const { p, keys, run } = await setup(undefined);
    run(0.5);
    keys.add("press:jump");
    run(FIXED_DT);
    keys.delete("press:jump");
    let peak = 0;
    for (let i = 0; i < 90; i++) { run(FIXED_DT); peak = Math.max(peak, p.feet.y); }
    expect(peak).toBeGreaterThan(0.6);
    expect(p.feet.y).toBeLessThan(0.1);
    expect(p.grounded).toBe(true);
  });
});
