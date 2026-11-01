import { expect, it } from "vitest";
import { Group } from "../../src/app/config";
import { addGroundSlabs } from "../../src/world/groundSlabs";
import { CANAL, CORE_WORLD } from "../../src/world/region";
import { makeWorld, v3 } from "./harness";

it("supports rays on both sides of each ground join without closing the canal", async () => {
  const { scene, physics, step } = await makeWorld((c) => addGroundSlabs(c, CORE_WORLD, CANAL), 0);
  const engine = scene.getEngine();
  try {
    step(1);
    const hit = (x: number, z: number) => physics.raycast(v3(x, 10, z), v3(x, -4, z), Group.STATIC);
    for (const x of [-1000, -800, 0, 200, 400, 1200]) {
      for (const offset of [-0.05, 0, 0.05]) expect(hit(x + offset, 1582), `${x + offset}`).not.toBeNull();
    }
    expect(hit(200, (CANAL.z0 + CANAL.z1) / 2)).toBeNull();
  } finally {
    scene.dispose();
    engine.dispose();
  }
});
