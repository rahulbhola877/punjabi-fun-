import { WORLD_BOUNDS } from '../app/config';
import { hillY } from '../world/hillTerrain';
import { SAFE_SPOTS } from '../world/layout';
import type { SaveData } from './schema';

/** Retired Canada neighbourhood, inclusive of its former boundary. */
export function inRetiredCanada(p: { x: number; z: number }): boolean {
  return p.x >= 940 && p.x <= 1450 && p.z >= 1640 && p.z <= 2040;
}

type Position = { x: number; z: number };
const atEdge = (p: Position): boolean =>
  p.x <= WORLD_BOUNDS.minX + 1 || p.x >= WORLD_BOUNDS.maxX - 1 || p.z <= WORLD_BOUNDS.minZ + 1 || p.z >= WORLD_BOUNDS.maxZ - 1;

/** Recover boundary-clamped and retired-district actors to known safe roads. */
export function recoverClampedToCore(data: Pick<SaveData, 'player' | 'vehicles'>): void {
  recover(data, (p) => atEdge(p) || inRetiredCanada(p));
}

/** Recover the retired district even when experimental outer bounds are enabled. */
export function recoverRetiredCanada(data: Pick<SaveData, 'player' | 'vehicles'>): void {
  recover(data, inRetiredCanada);
}

function recover(data: Pick<SaveData, 'player' | 'vehicles'>, needsRecovery: (p: Position) => boolean): void {
  const actors = [data.player, ...data.vehicles];
  // Preserve already parked local vehicles and reserve each selected spot so
  // several recovered vehicles cannot spawn on top of one another or the player.
  const occupied = actors.filter((p) => !needsRecovery(p)).map((p) => ({ x: p.x, z: p.z }));
  const rehome = (p: { x: number; y: number; z: number }): void => {
    if (!needsRecovery(p)) return;
    let nearest = SAFE_SPOTS.find((spot) => !inRetiredCanada(spot) && !atEdge(spot))!, distance = Infinity, foundClear = false, bestClearance = -Infinity;
    for (const spot of SAFE_SPOTS) {
      if (inRetiredCanada(spot) || atEdge(spot)) continue;
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
