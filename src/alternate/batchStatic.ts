import { Mesh, type Scene } from "../babylon";

/**
 * Join explicitly selected, opaque static primitives that share a material
 * and local area. Alternate worlds have many tiny facade/road boxes; merging
 * them cuts draw calls while leaving moving and story-controlled objects alone.
 * Keeping batches spatial prevents a single distant detail from keeping the
 * entire neighborhood visible. Positions are baked in world space by Babylon.
 */
export function batchStatic(scene: Scene, names: ReadonlySet<string>, cellSize = 40): { before: number; after: number } {
  const groups = new Map<string, Mesh[]>();
  for (const item of scene.meshes) {
    if (!(item instanceof Mesh) || !names.has(item.name) || item.parent || !item.material || item.material.alpha < 1 || !item.isEnabled()) continue;
    const key = `${item.material.uniqueId}:${Math.floor(item.position.x / cellSize)},${Math.floor(item.position.z / cellSize)}:${item.sideOrientation}`;
    const group = groups.get(key) ?? [];
    group.push(item); groups.set(key, group);
  }
  let before = 0, after = 0;
  for (const group of groups.values()) {
    if (group.length < 2) continue;
    // MergeMeshes preserves every vertex, normal and UV, including each
    // source transform. The shared material and scene own their own resources.
    const merged = Mesh.MergeMeshes(group, true, true);
    if (!merged) continue;
    merged.name = `static-batch-${after}`;
    merged.isPickable = false; merged.freezeWorldMatrix();
    before += group.length; after++;
  }
  return { before, after };
}
