import type { AbstractMesh, Mesh, Scene } from "../babylon";
import { StaticColliderBuilder } from "../physics/Physics";
import type { Materials } from "../render/Materials";
import type { SignAtlas } from "../render/Signs";
import { Kit } from "./Kit";
import type { LoadedRegion } from "./LazyRegionStreamer";

export interface KitRegionResources extends LoadedRegion {
  readonly meshes: readonly Mesh[];
  readonly casters: readonly AbstractMesh[];
}

/**
 * Build one isolated authored region on demand. The returned handle owns its
 * meshes and compound collision; shared materials, signs and the scene remain
 * owned by the world. Hooks let the world register and remove shadow casters.
 */
export function loadKitRegion(
  scene: Scene,
  mats: Materials,
  signs: SignAtlas,
  build: (kit: Kit) => void,
  hooks: { loaded?: (resources: KitRegionResources) => void; unloading?: (resources: KitRegionResources) => void } = {},
): KitRegionResources {
  const colliders = new StaticColliderBuilder(), kit = new Kit(scene, mats, signs, colliders);
  let disposed = false;
  const handle: KitRegionResources = {
    meshes: kit.meshes,
    casters: kit.casters,
    dispose() {
      if (disposed) return;
      disposed = true;
      try { hooks.unloading?.(handle); }
      finally {
        try { colliders.dispose(); }
        finally { for (const mesh of kit.meshes) mesh.dispose(); }
      }
    },
  };
  try {
    build(kit);
    kit.finish();
    colliders.build(scene);
    hooks.loaded?.(handle);
    return handle;
  } catch (error) {
    handle.dispose();
    throw error;
  }
}
