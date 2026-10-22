import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { ARCHETYPES, BODIES, Character, Crowd, POPULATIONS, SKIN_TONES, outfitsFor, communityOf, COMMUNITIES, COMMUNITY_LABEL, GREETINGS, type Archetype, type Community } from '../lib';
import { buildCity } from './city';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

// ------------------------------------------------------------------ renderer / scene
const canvas = $<HTMLCanvasElement>('view');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
const scene = new THREE.Scene();
scene.background = new THREE.Color('#9fc6e0');
scene.fog = new THREE.Fog('#bcd6e6', 45, 130);
const camera = new THREE.PerspectiveCamera(48, 1, 0.1, 300);
camera.position.set(1.2, 2.3, 11.8);
scene.add(new THREE.HemisphereLight('#fff4dd', '#9a8a6a', 1.1));
const sun = new THREE.DirectionalLight('#fff1d0', 2.2);
sun.position.set(14, 22, 10);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -22, right: 22, top: 22, bottom: -22, near: 1, far: 70 });
sun.shadow.bias = -0.0004;
scene.add(sun, sun.target);

const city = buildCity();
scene.add(city.group);
const crowd = new Crowd(city.bounds);
crowd.obstacles = city.obstacles;
scene.add(crowd.group);

const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true; controls.maxPolarAngle = Math.PI * 0.49; controls.minDistance = 1.5; controls.maxDistance = 30;
controls.target.set(0, 1.15, 6);

function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
}
addEventListener('resize', resize); resize();

// ------------------------------------------------------------------ player character
let arch: Archetype = 'male';
let outfitId = 'kurta_pajama';
let colors: Record<string, string> = {};
let player: Character;
let skelHelper: THREE.SkeletonHelper | null = null;
let manual: string | null = null;      // clip chosen from the UI / hotkey
let jumping = false;
const playerPos = new THREE.Vector3(0, 0, 6);
let playerYaw = Math.PI;

function makePlayer() {
  const old = player;
  player = new Character({ archetype: arch, outfit: outfitId, colors });
  player.root.traverse((o) => { if ((o as THREE.Mesh).isMesh) o.castShadow = true; });
  player.root.position.copy(playerPos); player.root.rotation.y = playerYaw;
  scene.add(player.root);
  player.play('idle', { fade: 0 });
  if (old) { scene.remove(old.root); old.dispose(); }
  if (skelHelper) { scene.remove(skelHelper); skelHelper = new THREE.SkeletonHelper(player.root); scene.add(skelHelper); }
  manual = null;
  buildClipUI(); buildTweakUI();
}

// ------------------------------------------------------------------ UI
const archEl = $('arch'), outfitsEl = $('outfits'), tweaksEl = $('tweaks'), skinsEl = $('skins'), clipsEl = $('clips'), exprEl = $('exprs');

function chip(label: string, on: boolean, fn: () => void, cls = 'chip') {
  const b = document.createElement('button'); b.className = cls + (on ? ' on' : ''); b.textContent = label; b.onclick = fn; return b;
}
function buildArchUI() {
  archEl.innerHTML = '';
  const names: Record<string, string> = { male: 'Man', female: 'Woman', uncle: 'Uncle', aunty: 'Aunty', boy: 'Boy', girl: 'Girl' };
  for (const a of ARCHETYPES) archEl.append(chip(names[a], a === arch, () => {
    arch = a; colors = {};
    const list = outfitsFor(a); if (!list.find((o) => o.id === outfitId)) outfitId = list[0].id;
    makePlayer(); buildArchUI(); buildOutfitUI(); buildSkinUI();
  }));
}
let commFilter: Community | 'all' = 'all';
function buildOutfitUI() {
  const commsEl = $('comms'); commsEl.innerHTML = '';
  const all = outfitsFor(arch);
  for (const c of ['all', ...COMMUNITIES] as const) {
    const n = c === 'all' ? all.length : all.filter((o) => communityOf(o) === c).length;
    if (!n) continue;
    commsEl.append(chip(`${c === 'all' ? 'All' : c === 'universal' ? 'Everyday' : COMMUNITY_LABEL[c]} · ${n}`, c === commFilter, () => { commFilter = c; buildOutfitUI(); }));
  }
  if (commFilter !== 'all' && !all.some((o) => communityOf(o) === commFilter)) commFilter = 'all';
  outfitsEl.innerHTML = '';
  for (const o of all.filter((o) => commFilter === 'all' || communityOf(o) === commFilter)) {
    const b = document.createElement('button'); b.className = 'chip outfit' + (o.id === outfitId ? ' on' : '');
    b.innerHTML = `<b>${o.label}</b><span>${o.blurb}</span>`;
    b.onclick = () => { outfitId = o.id; const skin = colors.skin; colors = skin ? { skin } : {}; player.setOutfit(outfitId, colors); buildOutfitUI(); buildTweakUI(); };
    outfitsEl.append(b);
  }
}
function buildSkinUI() {
  skinsEl.innerHTML = '';
  for (const s of SKIN_TONES) {
    const b = document.createElement('button'); b.className = 'sw' + (colors.skin === s ? ' on' : ''); b.style.background = s; b.title = 'Skin tone';
    b.onclick = () => { colors.skin = s; player.setOutfit(outfitId, colors); buildSkinUI(); };
    skinsEl.append(b);
  }
}
function buildTweakUI() {
  tweaksEl.innerHTML = '';
  const def = outfitsFor(arch).find((o) => o.id === outfitId)!;
  const cur: Record<string, string> = {
    top: def.top.color, bottom: def.bottom.color, head: def.head.color, dupatta: def.dupatta?.color ?? '#ffffff', outer: def.outer?.color ?? '#ffffff',
  };
  for (const k of def.tweak ?? []) {
    const l = document.createElement('label'); l.className = 'col'; l.append(k + ' ');
    const inp = document.createElement('input'); inp.type = 'color'; inp.value = colors[k] ?? cur[k];
    inp.oninput = () => { colors[k] = inp.value; player.setOutfit(outfitId, colors); };
    l.append(inp); tweaksEl.append(l);
  }
}
const CAT_LABEL: Record<string, string> = { locomotion: 'Move', greeting: 'Greet & pray', combat: 'Fight', daily: 'Daily life', emote: 'Emotions', dance: 'Dance' };
function buildClipUI() {
  clipsEl.innerHTML = '';
  const cats: Record<string, typeof player.clipList> = {};
  for (const c of player.clipList) (cats[c.category] ??= []).push(c);
  for (const cat of ['greeting', 'locomotion', 'combat', 'daily', 'emote', 'dance']) {
    const box = document.createElement('div'); box.style.marginBottom = '6px';
    box.innerHTML = `<div style="font-size:11px;font-weight:700;color:#14264f;margin:4px 0 3px">${CAT_LABEL[cat]}</div>`;
    const row = document.createElement('div'); row.className = 'row';
    for (const c of cats[cat] ?? []) row.append(chip(c.label, false, () => playClip(c.name)));
    box.append(row); clipsEl.append(box);
  }
}
const EXPRS = ['neutral', 'happy', 'laugh', 'greet', 'proud', 'smirk', 'focus', 'angry', 'shout', 'sad', 'cry', 'surprised', 'pain', 'serene'];
for (const e of EXPRS) exprEl.append(chip(e, false, () => { player.faceCtl.set(e, 1); }));

function playClip(name: string) {
  jumping = false;
  if (name === 'greet') { manual = player.greeting.clip; bubble(player.greet(), 2.6); return; }
  manual = name;
  player.play(name, { restart: true });
  const g = Object.values(GREETINGS).find((x) => x.clip === name && name !== 'wave');
  if (g) bubble(g.text, 2.6);
}

// crowd UI
const presetEl = $<HTMLSelectElement>('preset');
for (const p of POPULATIONS) { const o = document.createElement('option'); o.value = p.id; o.textContent = `${p.label} - ${p.blurb}`; presetEl.append(o); }
const countEl = $<HTMLInputElement>('count');
countEl.oninput = () => { $('cnt').textContent = countEl.value; };
const populate = () => { crowd.clear(); crowd.spawn(presetEl.value, +countEl.value); };
$('populate').onclick = populate;
presetEl.onchange = populate;
$('clear').onclick = () => crowd.clear();
$('skel').onclick = (e) => {
  const b = e.currentTarget as HTMLElement; b.classList.toggle('on');
  if (skelHelper) { scene.remove(skelHelper); skelHelper = null; } else { skelHelper = new THREE.SkeletonHelper(player.root); scene.add(skelHelper); }
};
let playerMode = true;
$('follow').onclick = (e) => { playerMode = !playerMode; (e.currentTarget as HTMLElement).classList.toggle('on', playerMode); };
$('toggle').onclick = () => $('panel').classList.toggle('hide');
if (innerWidth < 700) $('panel').classList.add('hide');

// speech bubble
const bubbleEl = $('bubble'); let bubbleT = 0;
function bubble(t: string, s: number) { bubbleEl.textContent = t; bubbleT = s; }

// ------------------------------------------------------------------ input
const keys = new Set<string>();
const HOT: Record<string, string> = { g: 'greet', h: 'wave', f: 'punch', k: 'kick', b: 'block', e: 'eat', t: 'drink_chai', n: 'bhangra', c: 'clap', x: 'die', l: 'laugh', p: 'pray', v: 'victory', r: 'salute' };
addEventListener('keydown', (e) => {
  const tag = (e.target as HTMLElement).tagName;
  if (tag === 'INPUT' || tag === 'SELECT') return;
  const k = e.key.toLowerCase();
  keys.add(k);
  if (k === ' ') { e.preventDefault(); doJump(); }
  else if (HOT[k]) playClip(HOT[k]);
});
addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));
function doJump() { if (jumping) return; jumping = true; manual = null; player.play('jump', { restart: true }); }
$('mb-jump').onclick = doJump; $('mb-greet').onclick = () => playClip('greet'); $('mb-punch').onclick = () => playClip('punch');

// virtual joystick
const joy = $('joy'), knob = joy.querySelector('i') as HTMLElement; const joyV = new THREE.Vector2();
const joyMove = (e: PointerEvent) => {
  const r = joy.getBoundingClientRect(); let x = (e.clientX - r.left - r.width / 2) / 40, y = (e.clientY - r.top - r.height / 2) / 40;
  const l = Math.hypot(x, y); if (l > 1) { x /= l; y /= l; }
  joyV.set(x, y); knob.style.transform = `translate(${x * 30}px,${y * 30}px)`;
};
joy.addEventListener('pointerdown', (e) => { joy.setPointerCapture(e.pointerId); joyMove(e); });
joy.addEventListener('pointermove', (e) => { if (e.buttons || e.pressure) joyMove(e); });
joy.addEventListener('pointerup', () => { joyV.set(0, 0); knob.style.transform = ''; });

// ------------------------------------------------------------------ main loop
const clock = new THREE.Clock();
const fwd = new THREE.Vector3(), right = new THREE.Vector3(), mv = new THREE.Vector3();
let fpsAcc = 0, fpsN = 0;
const tmp = new THREE.Vector3();

function updatePlayer(dt: number) {
  if (jumping && player.finished) jumping = false;
  const oneShot = !!manual && !!player.clipList.find((c) => c.name === manual && !c.loop);
  const busy = (oneShot && !player.finished) || jumping;
  mv.set(0, 0, 0);
  if (playerMode) {
    const f = (keys.has('w') || keys.has('arrowup') ? 1 : 0) - (keys.has('s') || keys.has('arrowdown') ? 1 : 0) - joyV.y;
    const r = (keys.has('d') || keys.has('arrowright') ? 1 : 0) - (keys.has('a') || keys.has('arrowleft') ? 1 : 0) + joyV.x;
    camera.getWorldDirection(fwd); fwd.y = 0; fwd.normalize(); right.crossVectors(fwd, new THREE.Vector3(0, 1, 0)).normalize();
    mv.addScaledVector(fwd, f).addScaledVector(right, r);
  }
  const moving = mv.lengthSq() > 0.02;
  const run = keys.has('shift') || joyV.length() > 0.85;
  if (moving && manual && !busy) manual = null;       // movement cancels looping emotes
  if (moving && !busy) {
    mv.normalize();
    const want = Math.atan2(mv.x, mv.z);
    let dy = want - playerYaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
    playerYaw += dy * Math.min(1, dt * 10);
    const sp = player.speedFor(run ? 'run' : 'walk');
    playerPos.addScaledVector(mv, sp * dt);
    playerPos.x = THREE.MathUtils.clamp(playerPos.x, -6.4, 6.4); playerPos.z = THREE.MathUtils.clamp(playerPos.z, -28, 14);
    player.play(run ? 'run' : 'walk');
  } else if (!busy) {
    if (manual && oneShot) manual = null;
    if (!manual) player.play('idle');
  }
  player.root.position.copy(playerPos); player.root.rotation.y = playerYaw;
  player.update(dt);
}

function loop() {
  const dt = Math.min(clock.getDelta(), 0.05);
  updatePlayer(dt);
  crowd.update(dt);
  // camera follows the player
  tmp.set(playerPos.x, 1.15, playerPos.z).sub(controls.target);
  controls.target.add(tmp); camera.position.add(tmp);
  controls.update();
  sun.position.set(playerPos.x + 14, 22, playerPos.z + 10); sun.target.position.copy(playerPos);
  if (bubbleT > 0) {
    bubbleT -= dt;
    const v = new THREE.Vector3(playerPos.x, BODIES[arch].s * 1.95, playerPos.z).project(camera);
    bubbleEl.style.left = ((v.x * 0.5 + 0.5) * innerWidth) + 'px'; bubbleEl.style.top = ((-v.y * 0.5 + 0.5) * innerHeight) + 'px'; bubbleEl.style.opacity = '1';
  } else bubbleEl.style.opacity = '0';
  renderer.render(scene, camera);
  fpsAcc += dt; fpsN++;
  if (fpsAcc > 0.5) { const i = renderer.info.render; $('stats').textContent = `${(fpsN / fpsAcc).toFixed(0)} fps\n${i.calls} draws · ${(i.triangles / 1000).toFixed(0)}k tris\n${crowd.agents.length + 1} characters`; fpsAcc = 0; fpsN = 0; }
  requestAnimationFrame(loop);
}

buildArchUI(); makePlayer(); buildOutfitUI(); buildSkinUI();
crowd.spawn('bazaar', 24, 7);
(window as any).__demo = { playClip, crowd, get player() { return player; }, camera, controls, scene, renderer, setArch: (a: Archetype, o: string) => { arch = a; outfitId = o; colors = {}; makePlayer(); buildArchUI(); buildOutfitUI(); buildSkinUI(); } };
loop();
