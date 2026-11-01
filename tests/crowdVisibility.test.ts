import { describe, expect, it } from "vitest";
import { MeshBuilder, NullEngine, Scene, StandardMaterial, Vector3 } from "../src/babylon";
import { Crowd } from "../src/crowds/Crowd";
import { farmer } from "../src/crowds/countryFolk";
import type { Physics } from "../src/physics/Physics";

describe("resident visual distance", () => {
  it("hides complete distant bodies while leaving their simulation and gesture clocks running, then restores them", () => {
    const engine = new NullEngine(), scene = new Scene(engine), material = new StandardMaterial("person", scene);
    const crowd = new Crowd(scene, { raycast: () => null } as unknown as Physics, material);
    try {
      crowd.visualRange = 85;
      const resident = crowd.spawn({ id: "test", name: "Test", role: "roamer", look: farmer(44), x: 100, z: 0, y: 0, yaw: 0 });
      resident.born = 0; resident.groundT = 10;
      const child = MeshBuilder.CreateBox("held-prop", {}, scene); child.parent = resident.human.root;
      resident.anim.play("wave", 0.1);
      crowd.update(0.2, 1, Vector3.Zero());
      expect(resident.human.root.isEnabled()).toBe(false);
      expect(child.isEnabled()).toBe(false);
      expect(resident.anim.gestureLeft).toBe(0);
      const previousX = resident.pos.x;
      resident.brain = (r) => { r.vel.x = 1; };
      crowd.fixedUpdate(0.1, null, []);
      expect(resident.pos.x).toBeGreaterThan(previousX);
      crowd.update(0.1, 1, Vector3.Zero());
      // Scripted participants can be linked to separate scene objects, such
      // as a rider on a procession float; they must remain present together.
      expect(resident.human.root.isEnabled()).toBe(true);
      resident.brain = null;
      crowd.update(0.1, 1, Vector3.Zero());
      expect(resident.human.root.isEnabled()).toBe(false);
      expect(resident.human.root.position.x).toBeCloseTo(resident.pos.x);
      // A kite and its string are separate meshes. Never hide the flyer while
      // leaving those visible in the sky.
      const kite = MeshBuilder.CreateBox("separate-kite", {}, scene);
      resident.kite = true;
      crowd.update(0.1, 1, Vector3.Zero());
      expect(kite.isEnabled()).toBe(true);
      expect(resident.human.root.isEnabled()).toBe(true);
      resident.kite = false;
      crowd.update(0.1, 1, Vector3.Zero());
      expect(resident.human.root.isEnabled()).toBe(false);
      crowd.update(0.1, 1, new Vector3(resident.pos.x, 0, resident.pos.z));
      expect(resident.human.root.isEnabled()).toBe(true);
      expect(child.isEnabled()).toBe(true);
      expect(resident.human.mesh.isVisible).toBe(true);
    } finally { crowd.dispose(); scene.dispose(); engine.dispose(); }
  });
});
