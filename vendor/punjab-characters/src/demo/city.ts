import * as THREE from 'three';
import type { Obstacle } from '../lib/crowd';

const mat = (c: string, r = 0.9, m = 0) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m });
const box = (w: number, h: number, d: number, m: THREE.Material, x = 0, y = 0, z = 0) => {
  const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y + h / 2, z); o.castShadow = true; o.receiveShadow = true; return o;
};

function sign(text: string, sub: string, bg: string, fg: string, w = 3, h = 0.8) {
  const cv = document.createElement('canvas'); cv.width = 512; cv.height = Math.round(512 * h / w);
  const g = cv.getContext('2d')!;
  g.fillStyle = bg; g.fillRect(0, 0, cv.width, cv.height);
  g.strokeStyle = fg; g.lineWidth = 6; g.strokeRect(8, 8, cv.width - 16, cv.height - 16);
  g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = `bold ${cv.height * 0.42}px "Noto Sans Gurmukhi","Nirmala UI",Arial,sans-serif`; g.fillText(text, cv.width / 2, cv.height * 0.38);
  g.font = `${cv.height * 0.24}px "Noto Sans Gurmukhi","Nirmala UI",Arial,sans-serif`; g.fillText(sub, cv.width / 2, cv.height * 0.76);
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.7 }));
  return m;
}

function shopRow(side: 1 | -1, z0: number, n: number, obstacles: Obstacle[]) {
  const g = new THREE.Group();
  const names: [string, string, string, string][] = [
    ['Sharma Sweets', 'ਮਿਠਿਆਈ', '#c0392b', '#fff3d0'], ['Jatt Tailors', 'ਦਰਜ਼ੀ', '#1d3f8a', '#ffe9a8'], ['Kulcha Hub', 'ਕੁਲਚਾ', '#e08a1e', '#2b1604'],
    ['Punjab Cycle Store', 'ਸਾਈਕਲ', '#0f6d5d', '#f6f1e4'], ['Phulkari House', 'ਫੁਲਕਾਰੀ', '#b02a6e', '#fff0f5'], ['Chai Wala', 'ਚਾਹ', '#6b3a1e', '#ffe9a8'],
    ['Lassi Corner', 'ਲੱਸੀ', '#f2c230', '#3a2800'], ['Gill Jewellers', 'ਸੁਨਿਆਰਾ', '#7d1530', '#ffd76a'],
  ];
  const walls = ['#e9d3b0', '#d9b88a', '#e6c4a0', '#c9d6c4', '#e9bfa8', '#d8cfae'];
  for (let i = 0; i < n; i++) {
    const w = 4.2, d = 5, h = 5.2 + (i % 3) * 1.2;
    const x = side * 9.5, z = z0 + i * (w + 0.25);
    const b = new THREE.Group();
    b.add(box(d, h, w, mat(walls[i % walls.length]), 0, 0, 0));
    // upper floor windows + jharokha balcony
    for (let k = 0; k < 2; k++) {
      const win = box(0.08, 1.1, 0.8, mat('#2c3a46'), -side * (d / 2 + 0.02), 3.3, (k - 0.5) * 1.8);
      b.add(win);
      b.add(box(0.5, 0.12, 1.1, mat('#8a5a30'), -side * (d / 2 + 0.25), 3.2, (k - 0.5) * 1.8));
    }
    // shop front opening + awning
    const [t, s, bg, fg] = names[(i + (side > 0 ? 0 : 3)) % names.length];
    b.add(box(0.1, 2.3, 3.2, mat('#241a12'), -side * (d / 2 + 0.01), 0, 0));
    const awning = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.08, 3.6), mat(bg)); awning.position.set(-side * (d / 2 + 0.75), 2.55, 0); awning.rotation.z = side * 0.25; awning.castShadow = true; b.add(awning);
    const sg = sign(t, s, bg, fg, 3.4, 0.85); sg.position.set(-side * (d / 2 + 0.08), 3.1 + 0.0, 0); sg.rotation.y = -side * Math.PI / 2; sg.position.y = 2.95; b.add(sg);
    // goods counter
    b.add(box(0.7, 0.9, 3, mat('#7a5230'), -side * (d / 2 + 0.55), 0, 0));
    for (let k = 0; k < 5; k++) b.add(box(0.3, 0.25, 0.3, mat(['#e08a1e', '#c0392b', '#f2c230', '#f6f1e4', '#0f6d5d'][k]), -side * (d / 2 + 0.6), 0.9, (k - 2) * 0.55));
    b.position.set(x, 0, z);
    g.add(b);
    obstacles.push({ x: side * 6.6, z, r: 0.01 });
  }
  return g;
}

function gurdwara() {
  const g = new THREE.Group();
  const marble = mat('#f4efe6', 0.5), gold = mat('#e0a82a', 0.3, 0.7);
  g.add(box(14, 0.8, 14, marble, 0, 0, 0));
  g.add(box(10, 4.5, 10, marble, 0, 0.8, 0));
  g.add(box(10.6, 0.35, 10.6, gold, 0, 5.1, 0));
  const dome = new THREE.Mesh(new THREE.SphereGeometry(3.4, 28, 16, 0, Math.PI * 2, 0, Math.PI / 2), gold); dome.position.y = 5.4; dome.scale.y = 1.15; dome.castShadow = true; g.add(dome);
  const spire = new THREE.Mesh(new THREE.ConeGeometry(0.35, 1.6, 10), gold); spire.position.y = 5.4 + 3.4 * 1.15 + 0.6; g.add(spire);
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), gold); ball.position.y = spire.position.y + 1.0; g.add(ball);
  for (const [x, z] of [[-4.6, -4.6], [4.6, -4.6], [-4.6, 4.6], [4.6, 4.6], [0, -5.2], [0, 5.2], [-5.2, 0], [5.2, 0]]) {
    g.add(box(0.7, 2.2, 0.7, marble, x, 5.45, z));
    const d = new THREE.Mesh(new THREE.SphereGeometry(0.62, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), gold); d.position.set(x, 7.65, z); g.add(d);
  }
  // arched doorways
  for (const s of [-1, 1]) { g.add(box(1.6, 2.4, 0.2, mat('#3a2a1a'), 0, 0.8, s * 5.05)); }
  // nishan sahib flag
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 11, 8), mat('#d9a21f', 0.4, 0.5)); pole.position.set(9, 5.5, 4); g.add(pole);
  const flag = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 2.6), new THREE.MeshStandardMaterial({ color: '#e87a10', side: THREE.DoubleSide })); flag.position.set(9.9, 9.4, 4); g.add(flag);
  const sarovar = new THREE.Mesh(new THREE.PlaneGeometry(22, 8), new THREE.MeshStandardMaterial({ color: '#3a86a8', roughness: 0.1, metalness: 0.2 })); sarovar.rotation.x = -Math.PI / 2; sarovar.position.set(0, 0.04, 12); g.add(sarovar);
  return g;
}

function bunting(z0: number, z1: number) {
  const g = new THREE.Group();
  const cols = ['#e87a10', '#d9467a', '#f2c230', '#0f6d5d', '#1d3f8a', '#c0392b'];
  for (let z = z0; z <= z1; z += 6) {
    const pts = [new THREE.Vector3(-8.5, 5.4, z), new THREE.Vector3(0, 4.3, z), new THREE.Vector3(8.5, 5.4, z)];
    const curve = new THREE.CatmullRomCurve3(pts);
    const line = new THREE.Mesh(new THREE.TubeGeometry(curve, 24, 0.015, 4), mat('#3a2a1a')); g.add(line);
    for (let i = 1; i < 24; i++) {
      const p = curve.getPoint(i / 24);
      const tri = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.42, 3), new THREE.MeshStandardMaterial({ color: cols[(((i + Math.floor(z / 6)) % cols.length) + cols.length) % cols.length], side: THREE.DoubleSide }));
      tri.position.set(p.x, p.y - 0.22, p.z); tri.rotation.set(Math.PI, 0, Math.PI / 2 * 0); g.add(tri);
    }
  }
  return g;
}

function tree(x: number, z: number, s = 1) {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.15 * s, 0.22 * s, 2.2 * s, 6), mat('#6b4a2a')); trunk.position.y = 1.1 * s; trunk.castShadow = true; g.add(trunk);
  for (let i = 0; i < 3; i++) { const c = new THREE.Mesh(new THREE.IcosahedronGeometry((1.3 - i * 0.2) * s, 0), mat(['#3d7a35', '#4b8f3c', '#356a2f'][i])); c.position.set((i - 1) * 0.4 * s, (2.6 + i * 0.5) * s, (i % 2) * 0.3 * s); c.castShadow = true; g.add(c); }
  g.position.set(x, 0, z);
  return g;
}

function charpai(x: number, z: number, rot = 0) {
  const g = new THREE.Group();
  const wood = mat('#8a4a20'), rope = mat('#e6c98a');
  g.add(box(1.9, 0.08, 1.0, rope, 0, 0.42, 0));
  for (const [dx, dz] of [[-0.9, -0.45], [0.9, -0.45], [-0.9, 0.45], [0.9, 0.45]]) g.add(box(0.08, 0.45, 0.08, wood, dx, 0, dz));
  g.add(box(2.0, 0.06, 0.08, wood, 0, 0.42, 0.5)); g.add(box(2.0, 0.06, 0.08, wood, 0, 0.42, -0.5));
  g.position.set(x, 0, z); g.rotation.y = rot;
  return g;
}

function chaiStall(x: number, z: number) {
  const g = new THREE.Group();
  g.add(box(2.6, 1.0, 1.0, mat('#7a5230'), 0, 0, 0));
  for (const dx of [-1.2, 1.2]) g.add(box(0.1, 2.3, 0.1, mat('#5a3a20'), dx, 0, 0.45));
  const roof = new THREE.Mesh(new THREE.BoxGeometry(3, 0.1, 1.6), mat('#c0392b')); roof.position.set(0, 2.4, 0.3); roof.rotation.x = 0.12; roof.castShadow = true; g.add(roof);
  const kettle = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.26, 0.35, 12), mat('#cfd5dc', 0.25, 0.9)); kettle.position.set(-0.6, 1.2, 0); g.add(kettle);
  const stove = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.12, 12), mat('#2a2a30')); stove.position.set(-0.6, 1.03, 0); g.add(stove);
  for (let i = 0; i < 4; i++) { const gl = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.035, 0.1, 8), mat('#cfd5dc', 0.25, 0.9)); gl.position.set(0.2 + i * 0.2, 1.05, 0.1); g.add(gl); }
  g.position.set(x, 0, z);
  return g;
}

function tractor(x: number, z: number) {
  const g = new THREE.Group();
  g.add(box(1.0, 0.8, 2.0, mat('#c0392b'), 0, 0.6, 0));
  g.add(box(0.9, 0.9, 0.9, mat('#c0392b'), 0, 1.4, -0.5));
  g.add(box(0.95, 0.06, 0.95, mat('#2a2a30'), 0, 2.28, -0.5));
  for (const [dx, dz, r] of [[-0.65, -0.7, 0.6], [0.65, -0.7, 0.6], [-0.55, 0.8, 0.38], [0.55, 0.8, 0.38]]) {
    const w = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.35, 14), mat('#1c1c20')); w.rotation.z = Math.PI / 2; w.position.set(dx, r, dz); w.castShadow = true; g.add(w);
  }
  g.position.set(x, 0, z);
  return g;
}

export function buildCity(): { group: THREE.Group; obstacles: Obstacle[]; bounds: { minX: number; maxX: number; minZ: number; maxZ: number } } {
  const group = new THREE.Group();
  const obstacles: Obstacle[] = [];
  // ground: paved bazaar street + dusty verge
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(160, 160), mat('#b9a98a')); ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; group.add(ground);
  const street = new THREE.Mesh(new THREE.PlaneGeometry(14, 120), mat('#8d8578')); street.rotation.x = -Math.PI / 2; street.position.set(0, 0.01, -10); street.receiveShadow = true; group.add(street);
  // tile pattern
  const tileTex = (() => { const cv = document.createElement('canvas'); cv.width = cv.height = 128; const g = cv.getContext('2d')!; g.fillStyle = '#9a9184'; g.fillRect(0, 0, 128, 128); g.strokeStyle = '#7d766a'; g.lineWidth = 3; g.strokeRect(0, 0, 128, 128); g.strokeRect(0, 0, 64, 64); g.strokeRect(64, 64, 64, 64); const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(7, 60); t.colorSpace = THREE.SRGBColorSpace; return t; })();
  (street.material as THREE.MeshStandardMaterial).map = tileTex;
  const plaza = new THREE.Mesh(new THREE.CircleGeometry(9, 40), new THREE.MeshStandardMaterial({ color: '#d8c9a6', roughness: 0.9 })); plaza.rotation.x = -Math.PI / 2; plaza.position.set(0, 0.02, -2); plaza.receiveShadow = true; group.add(plaza);

  group.add(shopRow(1, -34, 8, obstacles), shopRow(-1, -34, 8, obstacles));
  const gur = gurdwara(); gur.position.set(0, 0, -62); group.add(gur);
  group.add(bunting(-30, 6));

  // fountain / centre piece with tall nishan
  const fountain = new THREE.Group();
  fountain.add(box(2.4, 0.5, 2.4, mat('#e6dccb'), 0, 0, 0));
  const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.35, 0.5, 12), mat('#e0a82a', 0.3, 0.7)); cup.position.y = 1.0; fountain.add(cup);
  const water = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.0, 0.04, 20), new THREE.MeshStandardMaterial({ color: '#4aa0c4', roughness: 0.1 })); water.position.y = 0.52; fountain.add(water);
  fountain.position.set(0, 0, -2); group.add(fountain); obstacles.push({ x: 0, z: -2, r: 1.5 });

  const stall = chaiStall(-5.3, 4); stall.rotation.y = 0.3; group.add(stall); obstacles.push({ x: -5.3, z: 4, r: 1.7 });
  group.add(charpai(5.2, 3.5, 0.4), charpai(5.6, 0.5, -0.2)); obstacles.push({ x: 5.2, z: 3.5, r: 1.2 }, { x: 5.6, z: 0.5, r: 1.2 });
  const tr = tractor(-6.3, -12); tr.rotation.y = 0.5; group.add(tr); obstacles.push({ x: -6.3, z: -12, r: 1.6 });
  for (const [x, z, s] of [[-14, 10, 1.2], [14, 8, 1.1], [-16, -20, 1.4], [16, -24, 1.3], [-12, 22, 1], [12, 24, 1.2], [20, 0, 1], [-22, -4, 1.2]] as [number, number, number][]) group.add(tree(x, z, s));
  return { group, obstacles, bounds: { minX: -6.2, maxX: 6.2, minZ: -26, maxZ: 12 } };
}
