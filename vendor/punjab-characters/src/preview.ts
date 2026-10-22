import * as THREE from 'three';
import { makeCtx } from './lib/animations';
import { Character, BODIES, type Archetype } from './lib';

const W = 512, H = 640;
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setSize(W, H);
renderer.setPixelRatio(1);
renderer.shadowMap.enabled = false;
document.body.appendChild(renderer.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color('#9fb7c9');
scene.add(new THREE.HemisphereLight('#ffffff', '#6a5a4a', 1.4));
const sun = new THREE.DirectionalLight('#fff4e0', 2.2); sun.position.set(2, 4, 3); scene.add(sun);
const fill = new THREE.DirectionalLight('#aac8ff', 0.6); fill.position.set(-3, 2, -2); scene.add(fill);
const ground = new THREE.Mesh(new THREE.CircleGeometry(3, 32), new THREE.MeshStandardMaterial({ color: '#7d8a6a' }));
ground.rotation.x = -Math.PI / 2; scene.add(ground);
const cam = new THREE.PerspectiveCamera(30, W / H, 0.05, 50);

const cache = new Map<string, Character>();
let current: Character | null = null;

(window as any).shot = (cfg: { arch: Archetype; outfit?: string; clip?: string; t?: number; expr?: string; view?: string; colors?: any; w?: number; h?: number }) => {
  const key = `${cfg.arch}|${cfg.outfit}|${JSON.stringify(cfg.colors ?? {})}`;
  if (current) scene.remove(current.root);
  let c = cache.get(key);
  if (!c) { c = new Character({ archetype: cfg.arch, outfit: cfg.outfit, colors: cfg.colors }); cache.set(key, c); }
  current = c; scene.add(c.root);
  c.faceCtl.blinkEnabled = false;
  const clip = cfg.clip ?? 'idle';
  const a = c.actions.get(clip)!;
  c.mixer!.stopAllAction();
  c.currentClip = '';
  c.play(clip, { fade: 0 });
  a.reset().play(); a.setEffectiveWeight(1); a.paused = false;
  c.mixer!.setTime(cfg.t ?? 0);
  if (cfg.expr) { c.setExpression(cfg.expr); c.faceCtl.talk = 0; c.faceCtl.chew = 0; }
  for (let i = 0; i < 30; i++) c.faceCtl.update(0.05);
  c.update(0);
  const s = BODIES[cfg.arch].s;
  const view = cfg.view ?? 'front';
  const hgt = 1.8 * s;
  let tgt = new THREE.Vector3(0, hgt * 0.5, 0), dist = hgt * 2.35, az = 0.0;
  if (view === 'face') { tgt = new THREE.Vector3(0, 1.62 * s, 0); dist = 0.75 * s + 0.25; }
  if (view === 'bust') { tgt = new THREE.Vector3(0, 1.4 * s, 0); dist = 1.7 * s + 0.4; }
  if (view === 'side') az = Math.PI / 2;
  if (view === 'back') az = Math.PI;
  if (view === 'q') az = 0.65;
  if (view === 'qb') az = 2.5;
  cam.position.set(tgt.x + Math.sin(az) * dist, tgt.y + 0.15 * s, tgt.z + Math.cos(az) * dist);
  cam.lookAt(tgt);
  renderer.render(scene, cam);
  let tris = 0; c.root.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh && (m as any).geometry.index) tris += (m as any).geometry.index.count / 3; });
  return { tris };
};
(window as any).ready = true;

(window as any).dbg = (arch: Archetype) => { const c = new Character({ archetype: arch, noAnimation: true }); const x = makeCtx(c.rig); const f = (v: THREE.Vector3) => v.toArray().map((n) => +n.toFixed(3)); return { s: x.s, mouth: f(x.mouth), eye: f(x.eye), headTop: f(x.headTop), shL: f(x.shoulder.L), up: x.upA, lo: x.loA, chest: f(x.chestWorld) }; };
import { OUTFITS } from './lib/outfits';
(window as any).list = () => OUTFITS.map((o) => [o.id, o.for.join(',')]);
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
(window as any).exportGLB = async (arch: string, outfit: string) => {
  const c = new Character({ archetype: arch as any, outfit });
  const clips = c.clips;
  const scene = new THREE.Scene(); scene.add(c.root);
  const ex = new GLTFExporter();
  const buf: ArrayBuffer = await new Promise((res, rej) => ex.parse(scene, (r) => res(r as ArrayBuffer), rej, { binary: true, animations: clips, onlyVisible: false }));
  const u = new Uint8Array(buf); let s = ''; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000));
  return { b64: btoa(s), clips: clips.length };
};

import { auditClips } from './lib/animations';
import { buildRig } from './lib/rig';
(window as any).audit = (arch: string, guard: boolean) => auditClips(buildRig(BODIES[arch as Archetype]), guard);

import { debugArm } from './lib/animations';
(window as any).dbgArm = (a: string, c: string, ph: number) => debugArm(buildRig(BODIES[a as Archetype]), c, ph);
import { bakeClips } from './lib/animations';
(window as any).timeBake = (a: string, guard: boolean) => { const rig = buildRig(BODIES[a as Archetype]); const t = performance.now(); bakeClips(rig, { bakeFace: true, guard }); return performance.now() - t; };
