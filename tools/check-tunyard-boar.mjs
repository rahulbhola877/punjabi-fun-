// Side-by-side neutral-pose comparison of the source asset and Babylon bridge.
// Usage: BROWSER_PATH=/usr/bin/chromium SOFTWARE=1 node tools/check-tunyard-boar.mjs /path/to/tunyard
import { cpSync, mkdtempSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { browserOptions } from './browser.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
if (!process.argv[2]) throw Error('Pass a Tunyard checkout');
const source = resolve(process.argv[2]);
const tmp = mkdtempSync(join(tmpdir(), 'boar-visual-'));
let server, browser;
try {
  mkdirSync(join(tmp, 'src/assets/lowpolyAnimals'), { recursive: true });
  mkdirSync(join(tmp, 'src/animals/assets'), { recursive: true });
  mkdirSync(join(tmp, 'src/render'), { recursive: true });
  mkdirSync(join(tmp, 'public/tunyard'), { recursive: true });
  cpSync(join(source, 'src/core'), join(tmp, 'src/core'), { recursive: true });
  for (const name of ['common.ts', 'boar.ts']) cpSync(join(source, 'src/assets/lowpolyAnimals', name), join(tmp, 'src/assets/lowpolyAnimals', name));
  for (const name of ['src/babylon.ts', 'src/render/GeoBuilder.ts', 'src/animals/tunyardBoar.ts', 'src/animals/assets/boar.json']) cpSync(join(root, name), join(tmp, name));
  cpSync(join(root, 'public/tunyard/boar'), join(tmp, 'public/tunyard/boar'), { recursive: true });
  symlinkSync(join(root, 'node_modules'), join(tmp, 'node_modules'), 'dir');
  writeFileSync(join(tmp, 'index.html'), '<style>body{margin:0;background:#ddd;display:flex}canvas{width:480px;height:480px}</style><canvas id="source"></canvas><canvas id="game"></canvas><script type="module" src="/src/main.ts"></script>');
  writeFileSync(join(tmp, 'src/main.ts'), `
import * as THREE from 'three';
import { lpBoar } from './assets/lowpolyAnimals/boar';
import { buildAsset } from './core/registry';
import { Engine, Scene, UniversalCamera, HemisphericLight, DirectionalLight, Vector3, Color4 } from './babylon';
import { createTunyardBoar } from './animals/tunyardBoar';
const tr = new THREE.WebGLRenderer({canvas: document.querySelector('#source')!, antialias: true});
tr.setSize(480,480); const ts = new THREE.Scene(); ts.background = new THREE.Color('#ccd4c2');
const tc = new THREE.PerspectiveCamera(40,1,0.1,100); tc.position.set(2.8,1.7,3.5); tc.lookAt(0,0.55,0);
ts.add(new THREE.HemisphereLight(0xffffff,0x777777,1.0)); const td = new THREE.DirectionalLight(0xffffff,2.0); td.position.set(3,6,4); ts.add(td);
ts.add(buildAsset(lpBoar,{animate:false},1)); tr.render(ts,tc);
const e = new Engine(document.querySelector('#game')!,true); const s = new Scene(e); s.clearColor = new Color4(.6,.66,.56,1);
const c = new UniversalCamera('camera',new Vector3(-2.8,1.7,3.5),s); c.setTarget(new Vector3(0,.55,0)); c.fov=40*Math.PI/180;
const hemi = new HemisphericLight('hemi',new Vector3(0,1,0),s); hemi.intensity=.8;
const d = new DirectionalLight('sun',new Vector3(3,-6,-4),s); d.intensity=1;
createTunyardBoar(s); await s.whenReadyAsync(); s.render(); (window as any).rendered=true;
`);
  server = spawn(join(root, 'node_modules/.bin/vite'), ['--host', '127.0.0.1', '--port', '5199', '--strictPort'], { cwd: tmp, stdio: 'inherit' });
  let ready = false;
  for (let i = 0; i < 100; i++) { try { if ((await fetch('http://127.0.0.1:5199/')).ok) { ready = true; break; } } catch {} await new Promise(r => setTimeout(r, 100)); }
  if (!ready) throw Error('Vite did not start');
  browser = await chromium.launch(browserOptions());
  const page = await browser.newPage({ viewport: { width: 960, height: 480 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('http://127.0.0.1:5199/');
  await page.waitForFunction(() => window.rendered, null, { timeout: 120000 });
  if (errors.length) throw Error(errors.join('\n'));
  await page.screenshot({path:'/tmp/tunyard-boar-comparison.png'});
  console.log('Wrote /tmp/tunyard-boar-comparison.png (source left, game right).');
} finally { await browser?.close(); server?.kill(); rmSync(tmp, { recursive: true, force: true }); }
