import { describe, expect, it } from "vitest";
import { MeshBuilder, NullEngine, Scene, StandardMaterial, TransformNode, Vector3, VertexBuffer } from "../src/babylon";
import { batchStatic } from "../src/alternate/batchStatic";

describe("alternate-world static batching", () => {
  it("keeps hidden, faded and differently routed meshes in separate batches", () => {
    const engine = new NullEngine(), scene = new Scene(engine);
    try {
      const paint = new StandardMaterial("paint", scene);
      const states = [
        { visibility: 1, renderingGroupId: 0, layerMask: 0x0fffffff, receiveShadows: false },
        { visibility: 0, renderingGroupId: 0, layerMask: 0x0fffffff, receiveShadows: false },
        { visibility: 0.35, renderingGroupId: 0, layerMask: 0x0fffffff, receiveShadows: false },
        { visibility: 1, renderingGroupId: 1, layerMask: 0x0fffffff, receiveShadows: false },
        { visibility: 1, renderingGroupId: 0, layerMask: 2, receiveShadows: false },
        { visibility: 1, renderingGroupId: 0, layerMask: 0x0fffffff, receiveShadows: true },
      ];
      for (const state of states) for (let i = 0; i < 2; i++) {
        const mesh = MeshBuilder.CreateBox("window", { size: 1 }, scene);
        mesh.material = paint; Object.assign(mesh, state);
      }
      expect(batchStatic(scene, new Set(["window"]))).toEqual({ before: 12, after: 6 });
      const actual = scene.meshes.map(({ visibility, renderingGroupId, layerMask, receiveShadows }) => ({ visibility, renderingGroupId, layerMask, receiveShadows }));
      expect(actual).toEqual(states);
    } finally { scene.dispose(); engine.dispose(); }
  });

  it("retains building shadow silhouettes without adding trim or submerged stones", () => {
    const engine = new NullEngine(), scene = new Scene(engine);
    try {
      const paint = new StandardMaterial("paint", scene);
      const names = ["roof0", "block1", "habitat2", "customHouse", "window", "window", "submergedRock", "submergedRock"];
      for (const name of names) {
        const mesh = MeshBuilder.CreateBox(name, { size: 1 }, scene); mesh.material = paint;
        if (name === "customHouse") mesh.metadata = { districtSilhouette: true };
      }
      expect(batchStatic(scene, new Set(names))).toEqual({ before: 8, after: 2 });
      const caster = scene.meshes.filter(mesh => mesh.metadata?.districtSilhouette);
      const noncaster = scene.meshes.filter(mesh => !mesh.metadata?.districtSilhouette);
      expect(caster).toHaveLength(1); expect(noncaster).toHaveLength(1);
      expect(caster[0]!.getTotalIndices() / 3).toBe(48);
      expect(noncaster[0]!.getTotalIndices() / 3).toBe(48);
    } finally { scene.dispose(); engine.dispose(); }
  });

  it("keeps explicitly selected parent-baked asset silhouettes", () => {
    const engine = new NullEngine(), scene = new Scene(engine);
    try {
      const material = new StandardMaterial("paint", scene), root = new TransformNode("lantern", scene);
      for (let i = 0; i < 2; i++) {
        const mesh = MeshBuilder.CreateBox("japan-lantern-part", { size: 1 }, scene);
        mesh.material = material; mesh.parent = root;
      }
      expect(batchStatic(scene, new Set(["japan-lantern-part"]), 8, true)).toEqual({ before: 2, after: 1 });
      expect(scene.meshes[0]!.metadata?.districtSilhouette).toBe(true);
    } finally { scene.dispose(); engine.dispose(); }
  });

  it("preserves transformed geometry, spatial culling and shared materials while excluding dynamic meshes", () => {
    const engine = new NullEngine(), scene = new Scene(engine);
    try {
      const paint = new StandardMaterial("paint", scene), glass = new StandardMaterial("glass", scene);
      const make = (name: string, x: number, z: number, material = paint) => {
        const mesh = MeshBuilder.CreateBox(name, { width: 2, height: 3, depth: 1 }, scene);
        mesh.position.set(x, 1.5, z); mesh.rotation.y = 0.3; mesh.material = material; mesh.computeWorldMatrix(true); return mesh;
      };
      const a = make("windowFrame", 1, 2), b = make("windowFrame", 4, 2);
      const far = make("windowFrame", 100, 2), otherMaterial = make("windowFrame", 5, 2, glass);
      const dynamic = make("fishingLine", 6, 2), parent = new TransformNode("festival", scene);
      const child = make("windowFrame", 7, 2); child.parent = parent;
      const translucent = new StandardMaterial("translucent", scene); translucent.alpha = 0.5;
      const water = make("windowFrame", 8, 2, translucent), disabled = make("windowFrame", 9, 2); disabled.setEnabled(false);
      const originals = [a, b].map(m => ({ min: m.getBoundingInfo().boundingBox.minimumWorld.clone(), max: m.getBoundingInfo().boundingBox.maximumWorld.clone() }));
      const sourceVertices = [a, b].flatMap((m) => {
        const positions = m.getVerticesData(VertexBuffer.PositionKind)!, uvs = m.getVerticesData(VertexBuffer.UVKind)!, world = m.computeWorldMatrix(true);
        return Array.from(m.getIndices()!, index => {
          const p = Vector3.TransformCoordinates(Vector3.FromArray(positions, index * 3), world);
          return [p.x, p.y, p.z, uvs[index * 2]!, uvs[index * 2 + 1]!];
        });
      });
      const bounds = { min: Vector3.Minimize(originals[0]!.min, originals[1]!.min), max: Vector3.Maximize(originals[0]!.max, originals[1]!.max) };
      expect(batchStatic(scene, new Set(["windowFrame"]))).toEqual({ before: 2, after: 1 });
      const batch = scene.getMeshByName("static-batch-0")!;
      expect(batch.material).toBe(paint);
      expect(batch.getTotalIndices()).toBe(72);
      expect(batch.getBoundingInfo().boundingBox.minimumWorld.asArray()).toEqual(bounds.min.asArray());
      expect(batch.getBoundingInfo().boundingBox.maximumWorld.asArray()).toEqual(bounds.max.asArray());
      const positions = batch.getVerticesData(VertexBuffer.PositionKind)!, uvs = batch.getVerticesData(VertexBuffer.UVKind)!;
      Array.from(batch.getIndices()!).forEach((index, i) => {
        const actual = [positions[index * 3]!, positions[index * 3 + 1]!, positions[index * 3 + 2]!, uvs[index * 2]!, uvs[index * 2 + 1]!];
        actual.forEach((value, axis) => expect(value).toBeCloseTo(sourceVertices[i]![axis]!, 5));
      });
      expect(a.isDisposed()).toBe(true); expect(b.isDisposed()).toBe(true);
      expect(far.isDisposed()).toBe(false); expect(otherMaterial.isDisposed()).toBe(false);
      expect(dynamic.isDisposed()).toBe(false); expect(child.isDisposed()).toBe(false);
      expect(water.isDisposed()).toBe(false); expect(disabled.isDisposed()).toBe(false);
    } finally { scene.dispose(); engine.dispose(); }
  });
});
