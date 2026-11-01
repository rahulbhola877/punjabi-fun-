import type { StaticColliderBuilder } from "../physics/Physics";

/** Large flat ground bodies straddle their neighbours slightly. Without this
 * overlap Havok rays exactly on a 200 m join can miss both boxes. The canal
 * opening is kept separate and is not overlapped in the north/south direction. */
export function addGroundSlabs(colliders: StaticColliderBuilder, bounds: { minX: number; maxX: number; minZ: number; maxZ: number }, canal: { z0: number; z1: number }): void {
  for (let x = bounds.minX; x < bounds.maxX; x += 200) {
    const width = Math.min(200, bounds.maxX - x), centre = x + width / 2;
    colliders.add(centre, -0.5, (bounds.minZ + canal.z0) / 2, width + 0.2, 1, canal.z0 - bounds.minZ);
    colliders.add(centre, -0.5, (canal.z1 + bounds.maxZ) / 2, width + 0.2, 1, bounds.maxZ - canal.z1);
  }
}
