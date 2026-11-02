import { describe, expect, it } from "vitest";
import { MeshBuilder, NullEngine, Scene, TransformNode } from "../src/babylon";
import { EnabledMeshCandidates } from "../src/render/EnabledMeshCandidates";

describe("enabled render candidates", () => {
  it("tracks initial meshes, inherited disables, reparenting, later spawns and disposal", async () => {
    const engine = new NullEngine(), scene = new Scene(engine);
    const previous = scene.getActiveMeshCandidates;
    const a = MeshBuilder.CreateBox("a", {}, scene);
    const b = MeshBuilder.CreateBox("b", {}, scene); b.setEnabled(false);
    const root = new TransformNode("root", scene);
    const child = MeshBuilder.CreateBox("child", {}, scene); child.parent = root;
    const candidates = new EnabledMeshCandidates(scene);
    const names = () => { const list = scene.getActiveMeshCandidates(); return list.data.slice(0, list.length).map(mesh => mesh.name).sort(); };
    try {
      expect(names()).toEqual(["a", "child"]);
      root.setEnabled(false);
      expect(names()).toEqual(["a"]);
      b.setEnabled(true);
      expect(names()).toEqual(["a", "b"]);
      child.parent = null;
      expect(names()).toEqual(["a", "b", "child"]);
      child.parent = root;
      expect(names()).toEqual(["a", "b"]);
      root.setEnabled(true);
      expect(names()).toEqual(["a", "b", "child"]);
      const spawned = MeshBuilder.CreateBox("spawned", {}, scene);
      expect(names()).toEqual(["a", "b", "child", "spawned"]);
      spawned.setEnabled(false);
      expect(names()).toEqual(["a", "b", "child"]);
      spawned.setEnabled(true); spawned.dispose();
      // New-mesh notifications run later. A disposed spawn must not be added
      // back by its queued notification.
      await new Promise(resolve => setTimeout(resolve, 20));
      a.dispose();
      expect(names()).toEqual(["b", "child"]);
      // Invisible templates must remain candidates: they can own live instances.
      b.isVisible = false;
      expect(names()).toEqual(["b", "child"]);
      // Explicit depth-list proxies stay enabled for shadow submission, but
      // never need colour-pass readiness or LOD checks.
      const depth=MeshBuilder.CreateBox("depth-only",{},scene);depth.layerMask=0;depth.metadata={shadowDepthOnly:true};
      expect(names()).toEqual(["b","child"]);expect(depth.isEnabled()).toBe(true);
      depth.setEnabled(false);depth.setEnabled(true);expect(names()).toEqual(["b","child"]);
      candidates.dispose();
      expect(scene.getActiveMeshCandidates).toBe(previous);
    } finally { candidates.dispose(); scene.dispose(); engine.dispose(); }
  });
});
