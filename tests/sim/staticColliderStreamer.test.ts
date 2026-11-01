import { expect, it } from "vitest";
import { Group } from "../../src/app/config";
import { StaticColliderBuilder } from "../../src/physics/Physics";
import { StaticColliderStreamer } from "../../src/physics/StaticColliderStreamer";
import { makeWorld, v3 } from "./harness";

it("loads multiple actor regions, supports destination preloading and unloads collision", async () => {
  const { scene, physics } = await makeWorld(undefined, 0);
  const engine = scene.getEngine();
  try {
    const boxes = new StaticColliderBuilder();
    for (const x of [0, 300, 600]) boxes.add(x, 0, 0, 4, 2, 4);
    const stream = new StaticColliderStreamer(scene, boxes.boxes, 40, 60);
    const hit = (x: number) => physics.raycast(v3(x, 5, 0), v3(x, -5, 0), Group.STATIC);
    stream.update([{ x: 0, z: 0 }, { x: 600, z: 0 }]);
    expect(stream.activeChunks).toBe(2);
    expect(hit(0)).not.toBeNull();
    expect(hit(300)).toBeNull();
    expect(hit(600)).not.toBeNull();
    // Load the destination before a teleport or raycast, without dropping the origin.
    stream.update([{ x: 0, z: 0 }, { x: 300, z: 0 }]);
    expect(hit(0)).not.toBeNull();
    expect(hit(300)).not.toBeNull();
    expect(hit(600)).toBeNull();
    stream.update([{ x: 300, z: 0 }]);
    expect(hit(0)).toBeNull();
    // A small move beyond the loading distance must not thrash a loaded chunk.
    stream.update([{ x: 350, z: 0 }]);
    expect(hit(300)).not.toBeNull();
    stream.update([{ x: 363, z: 0 }]);
    expect(hit(300)).toBeNull();
    stream.update([{ x: 300, z: 0 }]);
    expect(() => stream.update([{ x: Number.NaN, z: 0 }])).toThrow("Invalid collision streaming anchor");
    stream.dispose();
    stream.dispose();
    expect(hit(300)).toBeNull();
  } finally { scene.dispose(); engine.dispose(); }
});

it("keeps long ground slabs and rotated collision active away from their centres", async () => {
  const { scene, physics } = await makeWorld(undefined, 0);
  const engine = scene.getEngine();
  try {
    const boxes = new StaticColliderBuilder();
    boxes.add(0, -0.5, 0, 2000, 1, 10);
    boxes.add(0, 0, 200, 160, 2, 4, Math.PI / 2);
    const stream = new StaticColliderStreamer(scene, boxes.boxes, 20, 30);
    const hit = (x: number, z: number) => physics.raycast(v3(x, 5, z), v3(x, -5, z), Group.STATIC);
    stream.update([{ x: 900, z: 0 }]);
    expect(hit(900, 0)).not.toBeNull();
    stream.update([{ x: 0, z: 270 }]);
    expect(hit(0, 270)).not.toBeNull();
    expect(hit(900, 0)).toBeNull();
    stream.dispose();
  } finally { scene.dispose(); engine.dispose(); }
});
