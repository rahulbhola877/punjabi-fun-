import { WORLD_BOUNDS } from '../app/config';
import { hillY } from '../world/hillTerrain';
import { SAFE_SPOTS } from '../world/layout';
import type { SaveData } from './schema';

/** The save reader clamps positions to current bounds. A save made in the
 * experimental outer world can consequently land exactly in a boundary wall.
 * Place only those edge-clamped actors on the nearest known safe road. */
export function recoverClampedToCore(data: Pick<SaveData, 'player' | 'vehicles'>): void {
  const atEdge = (p: { x: number; z: number }): boolean =>
    p.x <= WORLD_BOUNDS.minX + 1 || p.x >= WORLD_BOUNDS.maxX - 1 || p.z <= WORLD_BOUNDS.minZ + 1 || p.z >= WORLD_BOUNDS.maxZ - 1;
  const actors = [data.player, ...data.vehicles];
  // Preserve already parked local vehicles and reserve each selected spot so
  // several recovered vehicles cannot spawn on top of one another or the player.
  const occupied = actors.filter((p) => !atEdge(p)).map((p) => ({ x: p.x, z: p.z }));
  const rehome = (p: { x: number; y: number; z: number }): void => {
    if (!atEdge(p)) return;
    let nearest = SAFE_SPOTS[0]!, distance = Infinity, foundClear = false, bestClearance = -Infinity;
    for (const spot of SAFE_SPOTS) {
      const d = (spot.x - p.x) ** 2 + (spot.z - p.z) ** 2;
      let clearance = Infinity;
      for (const o of occupied) clearance = Math.min(clearance, (spot.x - o.x) ** 2 + (spot.z - o.z) ** 2);
      if (clearance >= 12 ** 2) {
        if (!foundClear || d < distance) { nearest = spot; distance = d; foundClear = true; }
      } else if (!foundClear && (clearance > bestClearance || (clearance === bestClearance && d < distance))) {
        nearest = spot; distance = d; bestClearance = clearance;
      }
    }
    p.x = nearest.x; p.z = nearest.z; p.y = hillY(p.x, p.z) + 0.2;
    occupied.push({ x: p.x, z: p.z });
  };
  for (const actor of actors) rehome(actor);
}
