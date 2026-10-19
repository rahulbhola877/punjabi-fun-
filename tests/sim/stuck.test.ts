import { describe, expect, it } from "vitest";
import { StandardMaterial } from "../../src/babylon";
import { makeWorld, v3 } from "./harness";
import { districtColliders } from "./district";
import { Player } from "../../src/characters/Player";
import { PLAYER_LOOKS } from "../../src/characters/appearances";
import { FIXED_DT, Group } from "../../src/app/config";
import { BUILDINGS, facadeToWorld, facadeFrame } from "../../src/world/layout";
import type { Input } from "../../src/input/Input";
import { OBSTACLES } from "../../src/world/props";

/** Player with a programmable "stick" (world-space direction). */
async function setup() {
  const w = await makeWorld((c, scene) => districtColliders(scene, c));
  let dir = { x: 0, z: 0 };
  const input = {
    axis: (neg: string, pos: string) => (neg === "back" && pos === "forward" ? Math.hypot(dir.x, dir.z) : 0),
    isDown: () => false,
    wasPressed: () => false,
    moveMagnitude: 1,
    touchMode: false,
  } as unknown as Input;
  const p = new Player(w.scene, input);
  p.raycast = (a, b) => {
    const h = w.physics.raycast(a, b, Group.STATIC | Group.PROP | Group.VEHICLE);
    return h ? { y: h.hitPointWorld.y, ny: h.hitNormalWorld.y } : null;
  };
  p.spawn(PLAYER_LOOKS[1]!.look, new StandardMaterial("m", w.scene), v3(0, 0.2, 0), 0);
  // Camera yaw = movement direction, "forward" = push the stick that way.
  const walk = (dx: number, dz: number, secs: number) => {
    dir = { x: dx, z: dz };
    const yaw = Math.atan2(dx, dz);
    for (let i = 0; i < Math.round(secs / FIXED_DT); i++) { p.frameInput(); p.fixedUpdate(FIXED_DT, yaw); w.physics.step(FIXED_DT); }
    dir = { x: 0, z: 0 };
  };
  return { p, walk };
}

const shops = BUILDINGS.filter((b) => (b.side === "west" || b.side === "east") && b.use !== "workshop" && b.use !== "dhaba");

describe("no getting stuck at shop fronts", () => {
  it.each(shops.map((b) => [b.id, b] as const))("walk into %s's counter and back out", async (_id, b) => {
    const { p, walk } = await setup();
    const fr = facadeFrame(b);
    // Pick a spot along the frontage that is clear of trees, poles and bins.
    const u = [0.5, 0.35, 0.65, 0.2, 0.8].map((k) => k * fr.width).find((uu) => {
      const q = facadeToWorld(b, uu, 1.3);
      return OBSTACLES.every((o) => Math.hypot(o.x - q.x, o.z - q.z) > o.r + 0.9);
    }) ?? fr.width / 2;
    const start = facadeToWorld(b, u, 1.3);
    p.teleport(v3(start.x, 0.2, start.z), 0);
    const inward = facadeToWorld(b, u, 0);
    const dx = inward.x - start.x, dz = inward.z - start.z, l = Math.hypot(dx, dz);
    walk(dx / l, dz / l, 2.0); // press into the counter
    walk(-dx / l, -dz / l, 1.5); // and back out
    const end = p.feet;
    const back = Math.hypot(end.x - inward.x, end.z - inward.z);
    expect(back, `${b.id} ended ${back.toFixed(2)} m from the façade`).toBeGreaterThan(2.0);
    // Then walk along the shop front (diagonal scrape) and make progress.
    const a = facadeToWorld(b, fr.width / 2, 0.6);
    const before = p.feet.clone();
    void a;
    walk(-dz / l, dx / l, 1.0);
    expect(p.feet.subtract(before).length()).toBeGreaterThan(1.2);
  });
});

describe("random-walk trap sweep over the whole district", () => {
  it("never leaves the player trapped (some direction always escapes)", async () => {
    const { p, walk } = await setup();
    const { SAFE_SPOTS } = await import("../../src/world/layout");
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const traps: string[] = [];
    for (const start of SAFE_SPOTS) {
      p.teleport(v3(start.x, 0.2, start.z), 0);
      for (let i = 0; i < 40; i++) {
        const a = rnd() * Math.PI * 2;
        const before = p.feet.clone();
        walk(Math.sin(a), Math.cos(a), 0.6);
        if (p.feet.subtract(before).length() > 0.15) continue;
        // Stalled: can we get out in any of 8 directions?
        const here = p.feet.clone();
        let escaped = false;
        for (let k = 0; k < 8 && !escaped; k++) {
          const b = (k / 8) * Math.PI * 2;
          walk(Math.sin(b), Math.cos(b), 0.5);
          if (p.feet.subtract(here).length() > 0.4) escaped = true;
        }
        if (!escaped) traps.push(`${here.x.toFixed(1)},${here.y.toFixed(2)},${here.z.toFixed(1)}`);
      }
    }
    expect(traps, `trapped at: ${traps.join(" | ")}`).toEqual([]);
  }, 600000);
});
