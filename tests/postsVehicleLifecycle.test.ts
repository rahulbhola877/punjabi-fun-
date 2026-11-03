import { describe, expect, it } from 'vitest';
import { Vector3 } from '../src/babylon';
import { Posts, type PostsHost } from '../src/combat/Posts';
import type { Vehicle } from '../src/vehicles/Vehicle';

function harness(restored: string[] = []) {
  let position = new Vector3(150, 0, -300); // Wake only the east GT post, away from its stop interaction.
  const vehicles = new Map(restored.map(id => [id, { id } as Vehicle]));
  const owned = new Set(restored);
  const spawned: string[] = [], despawned: string[] = [];
  const residents: object[] = [];
  const host = {
    playerPos: () => position,
    playerVehicle: () => null,
    findVehicle: (id: string) => owned.has(id) ? vehicles.get(id) : undefined,
    isOwnedVehicle: (v: Vehicle) => owned.has(v.id),
    spawnVehicle: (id: string) => { const v = { id } as Vehicle; spawned.push(id); vehicles.set(id, v); return v; },
    despawnVehicle: (v: Vehicle) => { despawned.push(v.id); vehicles.delete(v.id); },
    crowd: {
      residents,
      spawn: () => { const r = {}; residents.push(r); return r; },
      say: () => {},
      remove: (r: object) => { const i = residents.indexOf(r); if (i >= 0) residents.splice(i, 1); },
    },
  } as unknown as PostsHost;
  return { posts: new Posts(host), vehicles, owned, spawned, despawned, residents, move: (x: number, z: number) => { position = new Vector3(x, 0, z); } };
}

describe('police post vehicle lifecycle', () => {
  it('reuses saved exact IDs without spawning duplicates or deleting owned vehicles on sleep, re-wake, or reset', () => {
    const ids = ['nakaGtEast_jeep3', 'nakaGtEast_bike4'];
    const h = harness(ids);
    h.posts.fixedUpdate(1 / 60);
    expect(h.spawned).toEqual([]);
    expect(h.vehicles.size).toBe(2);
    h.move(1000, 1000); h.posts.fixedUpdate(1 / 60);
    expect(h.despawned).toEqual([]);
    expect([...h.vehicles.keys()]).toEqual(ids);
    h.move(150, -300); h.posts.fixedUpdate(1 / 60);
    expect(h.spawned).toEqual([]);
    h.posts.reset();
    expect([...h.vehicles.keys()]).toEqual(ids);
    expect(h.residents).toHaveLength(0);
    h.posts.fixedUpdate(1 / 60);
    expect(h.spawned).toEqual([]);
  });

  it('despawns fresh post vehicles on sleep and reset, and restarts IDs for a new session', () => {
    const h = harness();
    h.posts.fixedUpdate(1 / 60);
    expect(h.spawned).toEqual(['nakaGtEast_jeep3', 'nakaGtEast_bike4']);
    h.move(1000, 1000); h.posts.fixedUpdate(1 / 60);
    expect(h.despawned).toEqual(h.spawned);
    expect(h.vehicles.size).toBe(0);
    h.move(150, -300); h.posts.fixedUpdate(1 / 60);
    expect(h.vehicles.size).toBe(2);
    h.posts.reset();
    expect(h.vehicles.size).toBe(0);
    expect(h.residents).toHaveLength(0);
    h.posts.fixedUpdate(1 / 60);
    expect(h.spawned.slice(-2)).toEqual(['nakaGtEast_jeep3', 'nakaGtEast_bike4']);
  });

  it('keeps a newly acquired post vehicle through sleep and reuses it on re-wake', () => {
    const h = harness(); h.posts.fixedUpdate(1 / 60);
    h.owned.add('nakaGtEast_jeep3');
    h.move(1000, 1000); h.posts.fixedUpdate(1 / 60);
    expect([...h.vehicles.keys()]).toEqual(['nakaGtEast_jeep3']);
    h.move(150, -300); h.posts.fixedUpdate(1 / 60);
    expect([...h.vehicles.keys()].filter(id => id.includes('jeep'))).toEqual(['nakaGtEast_jeep3']);
    h.posts.reset();
    expect([...h.vehicles.keys()]).toEqual(['nakaGtEast_jeep3']);
  });
});
