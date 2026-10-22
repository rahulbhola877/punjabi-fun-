import * as THREE from 'three';
import type { PropId } from './outfits';

const matCache = new Map<string, THREE.MeshStandardMaterial>();
const mat = (c: string, rough = 0.7, metal = 0) => {
  const k = `${c}|${rough}|${metal}`;
  let m = matCache.get(k);
  if (!m) { m = new THREE.MeshStandardMaterial({ color: c, roughness: rough, metalness: metal }); matCache.set(k, m); }
  return m;
};
const mesh = (g: THREE.BufferGeometry, m: THREE.Material, pos: [number, number, number] = [0, 0, 0], rot: [number, number, number] = [0, 0, 0]) => {
  const o = new THREE.Mesh(g, m);
  o.position.set(...pos);
  o.rotation.set(...rot);
  return o;
};

export type PropAttach = 'hand' | 'chest';
export const PROP_ATTACH: Partial<Record<PropId, PropAttach>> = { schoolbag: 'chest' };

/** Build a prop in the local frame of a Hand bone (grip at origin, fingers curl around local Z). */
export function makeProp(id: PropId, s: number, side: 'L' | 'R' = 'R'): THREE.Group {
  const g = new THREE.Group();
  g.name = `Prop_${id}`;
  const m = side === 'L' ? 1 : -1; // palm faces -X on the left hand, +X on the right
  switch (id) {
    case 'tasbih': {
      g.add(mesh(new THREE.TorusGeometry(0.05 * s, 0.0085 * s, 6, 26), mat('#2b1a0e', 0.45), [0, -0.1 * s, 0.01 * s], [0, Math.PI / 2, 0]));
      g.add(mesh(new THREE.SphereGeometry(0.011 * s, 8, 6), mat('#e3b83e', 0.4, 0.4), [0, -0.152 * s, 0.01 * s]));
      g.add(mesh(new THREE.CylinderGeometry(0.003 * s, 0.005 * s, 0.045 * s, 5), mat('#c4122f'), [0, -0.18 * s, 0.01 * s]));
      break;
    }
    case 'lathi': {
      g.add(mesh(new THREE.CylinderGeometry(0.016 * s, 0.014 * s, 0.7 * s, 8), mat('#6b3f1d', 0.8), [0, -0.05 * s, 0.22 * s], [Math.PI / 2 - 0.12, 0, 0]));
      g.add(mesh(new THREE.CylinderGeometry(0.019 * s, 0.019 * s, 0.05 * s, 8), mat('#17171a'), [0, -0.045 * s, -0.1 * s], [Math.PI / 2 - 0.12, 0, 0]));
      break;
    }
    case 'stick':
    case 'cane': {
      const len = id === 'stick' ? 0.95 : 0.8;
      g.add(mesh(new THREE.CylinderGeometry(0.014 * s, 0.012 * s, len * s, 8), mat(id === 'stick' ? '#7a4a22' : '#3a2616', 0.6), [0, -len * 0.5 * s + 0.02 * s, 0.1 * s], [0.12, 0, 0]));
      if (id === 'cane') g.add(mesh(new THREE.TorusGeometry(0.04 * s, 0.012 * s, 6, 10, Math.PI), mat('#3a2616', 0.6), [0, 0.0, 0.0], [0, Math.PI / 2, 0]));
      g.add(mesh(new THREE.SphereGeometry(0.02 * s, 8, 6), mat('#caa84a', 0.4, 0.6), [0, 0.0, 0]));
      break;
    }
    case 'briefcase': {
      g.add(mesh(new THREE.BoxGeometry(0.1 * s, 0.28 * s, 0.4 * s), mat('#2a1c14', 0.55), [0, -0.24 * s, 0]));
      g.add(mesh(new THREE.TorusGeometry(0.06 * s, 0.008 * s, 5, 12, Math.PI), mat('#16100c'), [0, -0.095 * s, 0], [0, Math.PI / 2, 0]));
      g.add(mesh(new THREE.BoxGeometry(0.108 * s, 0.02 * s, 0.05 * s), mat('#cfd5dc', 0.3, 0.8), [0, -0.2 * s, 0]));
      break;
    }
    case 'handbag': {
      g.add(mesh(new THREE.BoxGeometry(0.08 * s, 0.2 * s, 0.26 * s), mat('#7a1d3a', 0.5), [0, -0.19 * s, 0]));
      g.add(mesh(new THREE.TorusGeometry(0.05 * s, 0.006 * s, 5, 12, Math.PI), mat('#4a1022'), [0, -0.09 * s, 0], [0, Math.PI / 2, 0]));
      break;
    }
    case 'ladle': {
      g.add(mesh(new THREE.CylinderGeometry(0.01 * s, 0.01 * s, 0.34 * s, 6), mat('#b9c0c8', 0.3, 0.9), [0, -0.03 * s, 0.1 * s], [Math.PI / 2 - 0.35, 0, 0]));
      g.add(mesh(new THREE.SphereGeometry(0.05 * s, 10, 7, 0, Math.PI * 2, 0, Math.PI / 2), mat('#b9c0c8', 0.3, 0.9), [0, -0.1 * s, 0.26 * s], [Math.PI * 0.85, 0, 0]));
      break;
    }
    case 'chai': {
      g.add(mesh(new THREE.CylinderGeometry(0.036 * s, 0.03 * s, 0.1 * s, 12, 1, true), mat('#cfd5dc', 0.25, 0.9), [m * -0.01 * s, -0.05 * s, 0.0], [Math.PI / 2, 0, 0]));
      g.add(mesh(new THREE.CylinderGeometry(0.034 * s, 0.034 * s, 0.004 * s, 12), mat('#9a5a2a', 0.5), [m * -0.01 * s, -0.05 * s, 0.04 * s], [Math.PI / 2, 0, 0]));
      g.add(mesh(new THREE.CylinderGeometry(0.03 * s, 0.03 * s, 0.004 * s, 12), mat('#cfd5dc', 0.25, 0.9), [m * -0.01 * s, -0.05 * s, -0.05 * s], [Math.PI / 2, 0, 0]));
      break;
    }
    case 'roti': {
      const r = mesh(new THREE.CylinderGeometry(0.075 * s, 0.075 * s, 0.01 * s, 14), mat('#d9a85a', 0.9), [m * -0.01 * s, -0.09 * s, 0.03 * s], [0, 0, Math.PI / 2]);
      g.add(r);
      g.add(mesh(new THREE.SphereGeometry(0.02 * s, 6, 5), mat('#c0392b'), [m * -0.025 * s, -0.09 * s, 0.05 * s]));
      break;
    }
    case 'thali': {
      g.add(mesh(new THREE.CylinderGeometry(0.15 * s, 0.12 * s, 0.025 * s, 18), mat('#cfd5dc', 0.25, 0.9), [m * -0.04 * s, -0.08 * s, 0.0], [0, 0, Math.PI / 2 * m]));
      for (const [x, z, c] of [[0.05, 0.03, '#d9a21f'], [-0.04, 0.05, '#7a3b1a'], [0.0, -0.05, '#2f8f3a']] as [number, number, string][]) {
        g.add(mesh(new THREE.CylinderGeometry(0.035 * s, 0.03 * s, 0.02 * s, 10), mat(c, 0.8), [m * -0.056 * s, (-0.08 + x) * s, z * s], [0, 0, Math.PI / 2 * m]));
      }
      break;
    }
    case 'schoolbag': {
      g.add(mesh(new THREE.BoxGeometry(0.26 * s, 0.34 * s, 0.13 * s), mat('#d8392b', 0.7), [0, -0.02 * s, -0.17 * s]));
      g.add(mesh(new THREE.BoxGeometry(0.2 * s, 0.14 * s, 0.05 * s), mat('#f2b705', 0.7), [0, -0.07 * s, -0.255 * s]));
      for (const sx of [1, -1]) g.add(mesh(new THREE.BoxGeometry(0.04 * s, 0.2 * s, 0.01 * s), mat('#2a2a30', 0.8), [sx * 0.085 * s, 0.05 * s, 0.09 * s], [0.0, 0, 0]));
      break;
    }
    case 'phone': {
      g.add(mesh(new THREE.BoxGeometry(0.03 * s, 0.14 * s, 0.07 * s), mat('#16161a', 0.4), [m * -0.02 * s, -0.04 * s, 0.01 * s]));
      break;
    }
    default: break;
  }
  return g;
}
