// Contact sheet of a kit clip, rendered with three.js (bundled by tools/kitpose.mjs).
import * as THREE from "three";
import { Character, STOCKY } from "../../src/kit";

const q = new URLSearchParams(location.search);
if (q.get("noguard")) (globalThis as any).__noguard = true;
const arch = (q.get("arch") ?? "male") as any, outfit = q.get("outfit") ?? undefined, clip = q.get("clip") ?? "walk";
const cols = Number(q.get("n") ?? 6), views = (q.get("views") ?? "side,front,q").split(","), cell = Number(q.get("cell") ?? 220);
const zoom = Number(q.get("zoom") ?? 1), focusY = q.get("fy") ? Number(q.get("fy")) : null;
const W = cell * cols, Hh = cell * views.length;
const r = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
r.setSize(W, Hh); r.setScissorTest(true);
document.body.appendChild(r.domElement);
const scene = new THREE.Scene();
scene.add(new THREE.HemisphereLight(0xffffff, 0x665544, 1.6));
const sun = new THREE.DirectionalLight(0xffffff, 1.6); sun.position.set(2, 4, 3); scene.add(sun);
const grid = new THREE.GridHelper(4, 16, 0x888888, 0x444444); scene.add(grid);
const ch = new Character({ archetype: arch, outfit, colors: JSON.parse(q.get("colors") ?? "{}"), build: q.get("build") === "stocky" ? STOCKY : undefined });
scene.add(ch.root);
ch.play(clip, { fade: 0 });
const act = ch.actions.get(clip)!;
const dur = act.getClip().duration;
const h = ch.rig.dims.hipsY / 0.92 * 1.75;
const cam = new THREE.PerspectiveCamera(30, 1, 0.05, 50);
const dist = h * 2.3 / zoom, fy = focusY ?? h * 0.55;
const dirs: Record<string, [number, number, number]> = { side: [1, 0.05, 0], front: [0, 0.05, 1], q: [0.7, 0.25, 0.7], back: [0, 0.1, -1], top: [0.2, 1, 0.3], left: [-1, 0.05, 0], ql: [-0.7, 0.25, 0.7] };
for (let i = 0; i < cols; i++) {
  ch.mixer!.setTime(0);
  act.time = ((Number(q.get("p0") ?? 0) + i / cols) % 1) * dur;
  ch.mixer!.update(0);
  ch.root.updateMatrixWorld(true);
  views.forEach((v, j) => {
    const d = new THREE.Vector3(...dirs[v]).normalize();
    cam.position.set(d.x * dist, fy + d.y * dist, d.z * dist);
    cam.lookAt(0, fy, 0);
    r.setViewport(i * cell, Hh - (j + 1) * cell, cell, cell); r.setScissor(i * cell, Hh - (j + 1) * cell, cell, cell);
    r.setClearColor(j % 2 ? 0x2c3238 : 0x343b42); r.clear();
    r.render(scene, cam);
  });
}
(window as any).done = true;
