import { describe, expect, it } from 'vitest';
import { WORLD_BOUNDS } from '../src/app/config';
import { SAFE_SPOTS } from '../src/world/layout';
import { inRetiredCanada, recoverClampedToCore, recoverRetiredCanada } from '../src/save/coreRecovery';
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

describe('retired Canada save recovery', () => {
  it('moves the player and every saved vehicle, preserving progress and remaining idempotent', () => {
    const save = newSave('hero', { x: 940, z: 1640, yaw: 0.7 }, [
      { id: 'owned1', type: 'car', x: 1450, y: 3, z: 2040, yaw: 1, paint: 'royal' },
      { id: 'owned2', type: 'pickup', x: 1200, y: 4, z: 1800, yaw: 2, paint: 'mint' },
      { id: 'airfield', type: 'plane', x: 405, y: 0.2, z: 1858, yaw: 3, paint: 'mint' },
      { id: 'punjab', type: 'car', x: 939, y: 0.2, z: 1640, yaw: 0, paint: 'mint' },
    ]);
    save.introStage = 4; save.bag.canada_biscuit = 2; save.fuel.owned1 = 0.42;
    save.home.canadaRinkGoals = 5; save.flags.visited = true;
    save.activeJob = { kind: 'delivery', destId: 'home', elapsed: 3, par: 30, limit: 60, condition: 0.8, routeLen: 100 };
    const before = structuredClone(save);
    recoverRetiredCanada(save);
    for (const actor of [save.player, ...save.vehicles.slice(0, 2)]) {
      expect(inRetiredCanada(actor)).toBe(false);
      expect(SAFE_SPOTS.some(s => s.x === actor.x && s.z === actor.z)).toBe(true);
    }
    const actors = [save.player, ...save.vehicles];
    for (let i = 0; i < 3; i++) for (let j = i + 1; j < actors.length; j++) {
      expect(Math.hypot(actors[i]!.x - actors[j]!.x, actors[i]!.z - actors[j]!.z)).toBeGreaterThanOrEqual(12);
    }
    expect(save.vehicles.slice(2)).toEqual(before.vehicles.slice(2));
    expect(save.vehicles.slice(0, 2).map(({ id, type, yaw, paint }) => ({ id, type, yaw, paint })))
      .toEqual(before.vehicles.slice(0, 2).map(({ id, type, yaw, paint }) => ({ id, type, yaw, paint })));
    expect({ ...save, player: before.player, vehicles: before.vehicles }).toEqual(before);
    const once = structuredClone(save);
    recoverRetiredCanada(save);
    expect(save).toEqual(once);
  });
});
