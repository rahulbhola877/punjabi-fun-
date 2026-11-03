import type { Scene, TransformNode } from "../babylon";
import { batchStatic } from "./batchStatic";

/** Hide the outpost until descent/skip, then initialize its presentation once.
 * Depth and contact meshes must not exist during the Earth launch: they do not
 * inherit the source colour meshes' numeric visibility. */
export function lunarPresentation(scene: Scene, rocket: TransformNode, initialize: () => void): () => void {
  batchStatic(scene,new Set(scene.meshes.filter(m=>/^(block|roof|forecourt|door|street|window|habitat|doorGlow|beaconStem|moonStone|distantRidge|sampleCase|workbench|yardRack|craterRim)/.test(m.name)).map(m=>m.name)),24);
  const meshes = scene.meshes.filter(mesh => !mesh.isDescendantOf(rocket)).map(mesh => ({ mesh, visibility: mesh.visibility }));
  for (const item of meshes) item.mesh.visibility = 0;
  let initialized = false;
  return (): void => {
    if (initialized || scene.isDisposed) return;
    // Restore the live batches before building the cached shadow map. Flight
    // only transitions toward the outpost; later descent frames reuse it.
    for (const item of meshes) item.mesh.visibility = item.visibility;
    initialize();
    initialized = true;
  };
}
