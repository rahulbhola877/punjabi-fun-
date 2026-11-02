import { describe, expect, it } from "vitest";
import { Ray } from "@babylonjs/core/Culling/ray";
import { MeshBuilder, NullEngine, Scene, Vector3 } from "../src/babylon";
import { neonPortalCameraEye } from "../src/alternate/NeonWorld";

describe("Neon return portal camera clearance", () => {
  it("clears the actual beam triangles that obstruct the default arrival body", () => {
    const engine = new NullEngine(), scene = new Scene(engine);
    try {
      const beam = MeshBuilder.CreateBox("portalTop", { width: 3.7, height: 0.35, depth: 0.35 }, scene);
      beam.position.set(0, 4, -27); beam.computeWorldMatrix(true);
      const target = new Vector3(0, 1.45, -20), eye = new Vector3(0, 1.7 + Math.sin(0.34) * 8, -20 - Math.cos(0.34) * 8);
      const rayTo = (at: Vector3) => new Ray(target, at.subtract(target).normalize(), Vector3.Distance(target, at));
      expect(rayTo(eye).intersectsMesh(beam).hit).toBe(true);
      const safe = neonPortalCameraEye(target, eye);
      expect(rayTo(safe).intersectsMesh(beam).hit).toBe(false);
      expect(safe.z).toBeGreaterThan(-26.825);
      expect(Vector3.Distance(safe, target)).toBeGreaterThan(6);
      expect(Vector3.Distance(safe, eye)).toBeLessThan(1.2);
    } finally { scene.dispose(); engine.dispose(); }
  });

  it("also clears the opaque portal face and both posts during orbit", () => {
    for (const [target, eye, axis, limit] of [
      [new Vector3(0, 1.45, -24), new Vector3(0, 2, -30), "z", -26.9],
      [new Vector3(-4, 2, -27), new Vector3(0, 2, -27), "x", -1.875],
      [new Vector3(4, 2, -27), new Vector3(0, 2, -27), "x", 1.875],
    ] as const) {
      const safe = neonPortalCameraEye(target, eye);
      expect(Vector3.Distance(safe, target)).toBeLessThan(Vector3.Distance(eye, target));
      if (target[axis] < eye[axis]) expect(safe[axis]).toBeLessThan(limit);
      else expect(safe[axis]).toBeGreaterThan(limit);
    }
  });

  it("preserves unobstructed street, elevated and side views", () => {
    const target = new Vector3(0, 1.45, -20);
    for (const eye of [new Vector3(8, 4, -20), new Vector3(0, 8, -28), new Vector3(0, 4, -12)]) {
      expect(neonPortalCameraEye(target, eye)).toBe(eye);
    }
    expect(neonPortalCameraEye(target, target)).toBe(target);
  });
});
