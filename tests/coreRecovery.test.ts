import { describe, expect, it } from 'vitest';
import { WORLD_BOUNDS } from '../src/app/config';
import { SAFE_SPOTS } from '../src/world/layout';
import { recoverClampedToCore } from '../src/save/coreRecovery';
import { newSave, validate } from '../src/save/schema';

describe('returning an experimental save to the authored district', () => {
  it('moves edge-clamped actors onto safe interior spots without changing progress or local vehicles', () => {
    const save = newSave('hero', { x: 2500, z: 900, yaw: 0 }, [
      { id: 'outer', type: 'car', x: -2500, y: 14, z: 100, yaw: 0, paint: 'mint' },
      { id: 'local', type: 'car', x: 10, y: 0.2, z: 10, yaw: 0, paint: 'mint' },
      { id: 'outer2', type: 'car', x: 2500, y: 14, z: 900, yaw: 0, paint: 'mint' },
      { id: 'outer3', type: 'car', x: 2500, y: 14, z: 900, yaw: 0, paint: 'mint' },
    ]);
    save.rep = 12; save.flags.visited = true; save.home.day = 8;
    const loaded = validate(save, ['hero'], WORLD_BOUNDS);
    recoverClampedToCore(loaded);
    for (const p of [loaded.player, loaded.vehicles[0]!]) {
      expect(SAFE_SPOTS.some(s => s.x === p.x && s.z === p.z)).toBe(true);
      expect(p.x).toBeGreaterThan(WORLD_BOUNDS.minX + 1);
      expect(p.x).toBeLessThan(WORLD_BOUNDS.maxX - 1);
      expect(p.y).toBeGreaterThanOrEqual(0.2);
    }
    expect(loaded.vehicles[1]).toMatchObject({ x: 10, y: 0.2, z: 10 });
    const actors = [loaded.player, ...loaded.vehicles];
    for (let i = 0; i < actors.length; i++) for (let j = i + 1; j < actors.length; j++) {
      expect(Math.hypot(actors[i]!.x - actors[j]!.x, actors[i]!.z - actors[j]!.z)).toBeGreaterThanOrEqual(12);
    }
    expect(loaded.rep).toBe(12);
    expect(loaded.flags.visited).toBe(true);
    expect(loaded.home.day).toBe(8);
  });
});
