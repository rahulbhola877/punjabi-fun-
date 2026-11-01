import { expect, it } from "vitest";
import { Group } from "../../src/app/config";
import { StaticColliderBuilder } from "../../src/physics/Physics";
import { World } from "../../src/world/World";
import { buildTerrainCollider } from "../../src/world/terrainCollider";
import { orchardCollider } from "../../src/world/orchard";
import { buildRidgeCollider } from "../../src/world/ridge";
import { makeWorld, v3 } from "./harness";

it("removes region collision and nodes on unload, then permits the area to be built again", async () => {
  const { scene, physics, step } = await makeWorld(undefined, 0);
  const engine = scene.getEngine();
  try {
    const addRegion = () => {
      const c = new StaticColliderBuilder();
      c.add(4, 0, 4, 2, 2, 2);
      c.add(50, 0, 4, 2, 2, 2);
      c.build(scene);
      step(1);
      return c;
    };
    const hit = (x: number) => physics.raycast(v3(x, 4, 4), v3(x, -4, 4), Group.STATIC);
    const c = addRegion();
    expect(hit(4)).not.toBeNull();
    expect(hit(50)).not.toBeNull();
    expect(scene.getTransformNodeByName("static_0,0")).not.toBeNull();
    c.dispose();
    c.dispose(); // unload is safe to repeat
    step(1);
    expect(hit(4)).toBeNull();
    expect(hit(50)).toBeNull();
    expect(scene.getTransformNodeByName("static_0,0")).toBeNull();
    const again = addRegion();
    expect(hit(4)).not.toBeNull();
    again.dispose();
  } finally {
    scene.dispose();
    engine.dispose();
  }
});

it("releases each owned terrain mesh and physics body when the world unloads", async () => {
  const { scene, physics, step } = await makeWorld(undefined, 0);
  const engine = scene.getEngine();
  try {
    const bodies = [buildTerrainCollider(scene), orchardCollider(scene), buildRidgeCollider(scene)];
    const world = new World(scene, physics);
    (world as unknown as { terrainBodies: typeof bodies }).terrainBodies = bodies;
    step(1);
    expect(scene.getMeshByName("terrain_collider")).not.toBeNull();
    expect(scene.getMeshByName("orchard_collider")).not.toBeNull();
    expect(scene.getMeshByName("ridge_collider")).not.toBeNull();
    world.dispose();
    world.dispose();
    expect(bodies.every((b) => b.isDisposed)).toBe(true);
    expect(scene.getMeshByName("terrain_collider")).toBeNull();
    expect(scene.getMeshByName("orchard_collider")).toBeNull();
    expect(scene.getMeshByName("ridge_collider")).toBeNull();
  } finally {
    scene.dispose();
    engine.dispose();
  }
});
