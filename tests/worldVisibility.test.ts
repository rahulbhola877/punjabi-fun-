import { describe, expect, it } from "vitest";
import { Color3, MeshBuilder, NullEngine, Scene, UniversalCamera, Vector3, type Mesh } from "../src/babylon";
import type { Physics } from "../src/physics/Physics";
import type { Materials } from "../src/render/Materials";
import { World } from "../src/world/World";

describe("distance culling of scenery batches", () => {
  it("keeps nearby geometry in a wide batch visible even if its centre is far away", () => {
    const engine = new NullEngine(), scene = new Scene(engine);
    const camera = new UniversalCamera("test-camera", Vector3.Zero(), scene); scene.activeCamera = camera;
    // A batch from x=0..1000 reproduces old world-space geometry mixed into
    // a single chunk: the camera is beside its edge but 500 m from its centre.
    const mesh = MeshBuilder.CreateBox("wide", { width: 1000, height: 2, depth: 2 }, scene);
    mesh.position.x = 500; mesh.computeWorldMatrix(true); mesh.refreshBoundingInfo();
    mesh.addLODLevel(220, null);
    const world = new World(scene, {} as Physics);
    (world as unknown as { staticMeshes: Mesh[] }).staticMeshes = [mesh];
    world.mats = { get: () => ({ reflectionColor: Color3.Black(), albedoTexture: null, bumpTexture: null }) } as unknown as Materials;
    try {
      world.setDrawDistance(220); camera.getViewMatrix(true); world.update(0.3);
      expect(mesh.isEnabled()).toBe(true);
      expect(mesh.getLOD(camera)).toBe(mesh);
      // The large sphere reaches this camera, but the narrow box is 499 m
      // away; manual culling can still reject it without hiding nearby parts.
      camera.position.set(500, 0, -500); camera.getViewMatrix(true); world.update(0.3);
      expect(mesh.isEnabled()).toBe(false);
      camera.position.x = -1000; camera.getViewMatrix(true); world.update(0.3);
      expect(mesh.isEnabled()).toBe(false);
      expect(mesh.getLOD(camera)).toBeNull();
      camera.position.set(0, 0, 0); camera.getViewMatrix(true); world.update(0.3);
      expect(mesh.isEnabled()).toBe(true);
      expect(mesh.getLOD(camera)).toBe(mesh);
      // Arrival must not depend on a rendered global camera matrix or the
      // next quarter-second culling tick.
      world.syncVisibilityAt(new Vector3(500,0,-500));expect(mesh.isEnabled()).toBe(false);
      world.syncVisibilityAt(Vector3.Zero());expect(mesh.isEnabled()).toBe(true);
      expect(world.isSceneryReadyAt(Vector3.Zero())).toBe(true);
      expect(world.isSceneryReadyAt(new Vector3(500,0,-500))).toBe(false);
    } finally { scene.dispose(); engine.dispose(); }
  });
});
