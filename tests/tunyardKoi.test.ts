import { describe, expect, it } from 'vitest';
import { NullEngine, Scene } from '../src/babylon';
import { addTunyardKoi } from '../src/alternate/TunyardKoi';
import data from '../src/alternate/assets/koiAssets.json';

describe('Tunyard koi bridge', () => {
  it('retains original colored triangles, joint hierarchy and shared resources', () => {
    const engine = new NullEngine(), scene = new Scene(engine);
    try {
      for (const variant of ['kohaku', 'ogon'] as const) {
        const a = addTunyardKoi(scene, variant, 0, 0.2, 1);
        const b = addTunyardKoi(scene, variant, 2, 0.2, 1);
        const meshes = a.root.getChildMeshes(), clones = b.root.getChildMeshes();
        const expected = data.assets[variant].meshes.flatMap(m => m.groups).reduce((sum, g) => sum + g.count, 0);
        expect(meshes.reduce((sum, m) => sum + m.getTotalVertices(), 0)).toBe(expected);
        expect(meshes.length).toBeGreaterThanOrEqual(3);
        expect(a.tail.parent).toBe(a.mid);
        expect(a.mid.parent?.parent).toBe(a.root);
        a.mid.rotation.y = 0.1; a.tail.rotation.y = -0.2;
        expect(b.mid.rotation.y).toBe(0); expect(b.tail.rotation.y).toBe(0);
        for (let i = 0; i < meshes.length; i++) {
          expect(meshes[i]!.geometry).toBe(clones[i]!.geometry);
          expect(meshes[i]!.material).toBe(clones[i]!.material);
        }
        a.root.dispose(); expect(b.root.isEnabled()).toBe(true);
      }
    } finally { scene.dispose(); engine.dispose(); }
  });
});
