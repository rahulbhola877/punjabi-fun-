// Bake the user's original Tunyard Grass Tuft to a transparent crossed-card sprite.
// Usage: node tools/bake-tunyard-grass.mjs /path/to/clean/tunyard
import { cpSync, mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { spawn, spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { browserOptions } from './browser.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = process.argv[2] && resolve(process.argv[2]);
const commit = '4de2d594e9ea54553af1884ac1d2add62058a41b';
if (!source) throw Error('Pass a clean Tunyard checkout');
const git = (...args) => {
  const r = spawnSync('git', ['-C', source, ...args], { encoding: 'utf8' });
  if (r.status !== 0) throw Error(r.stderr);
  return r.stdout.trim();
};
if (git('rev-parse', 'HEAD') !== commit || git('status', '--porcelain')) throw Error(`Tunyard must be clean at ${commit}`);
const pkg = JSON.parse(readFileSync(join(root, 'node_modules/three/package.json'), 'utf8'));
if (pkg.version !== '0.170.0') throw Error('Tunyard checkout requires Three.js 0.170.0');
const tmp = mkdtempSync(join(tmpdir(), 'tunyard-grass-'));
let server, browser;
try {
  mkdirSync(join(tmp, 'src/assets'), { recursive: true });
  cpSync(join(source, 'src/core'), join(tmp, 'src/core'), { recursive: true });
  cpSync(join(source, 'src/assets/grass.ts'), join(tmp, 'src/assets/grass.ts'));
  symlinkSync(join(root, 'node_modules'), join(tmp, 'node_modules'), 'dir');
  writeFileSync(join(tmp, 'index.html'), '<script type="module" src="/src/main.ts"></script>');
  writeFileSync(join(tmp, 'src/main.ts'), `
    import * as THREE from 'three';
    import { grass } from './assets/grass';
    import { buildAsset } from './core/registry';
    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-0.42, 0.42, 0.42, -0.42, 0.01, 20);
    camera.position.set(2, 0.85, 3); camera.lookAt(0, 0.22, 0);
    scene.add(new THREE.HemisphereLight(0xffffff, 0x71815b, 2));
    const sun = new THREE.DirectionalLight(0xfff3db, 1.5); sun.position.set(-3, 5, 4); scene.add(sun);
    const obj = buildAsset(grass, { blades: 36, height: 0.55, spread: 0.24, bend: 0.65 }, 27);
    scene.add(obj);
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true });
    renderer.setSize(256, 256); renderer.setPixelRatio(1); renderer.setClearColor(0, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.render(scene, camera);
    // Trim the transparent margin so the plant's base sits on the ground.
    const src = document.createElement('canvas'); src.width = src.height = 256;
    const s = src.getContext('2d')!; s.drawImage(renderer.domElement, 0, 0);
    const pixels = s.getImageData(0, 0, 256, 256).data;
    let x0 = 256, y0 = 256, x1 = 0, y1 = 0;
    for (let y = 0; y < 256; y++) for (let x = 0; x < 256; x++) if (pixels[(y * 256 + x) * 4 + 3] > 8) {
      x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
    }
    const w = x1 - x0 + 1, h = y1 - y0 + 1, scale = Math.min(230 / w, 220 / h);
    const atlas = document.createElement('canvas'); atlas.width = 512; atlas.height = 256;
    const c = atlas.getContext('2d')!;
    const dw = w * scale, dh = h * scale, left = (256 - dw) / 2, top = 253 - dh;
    c.drawImage(src, x0, y0, w, h, left, top, dw, dh);
    c.drawImage(src, x0, y0, w, h, left + 256, top, dw, dh);
    // A few meadow flowers provide a second, less frequent variation.
    for (const [x, y] of [[326, 98], [378, 74], [428, 109]]) {
      c.strokeStyle = '#55704a'; c.lineWidth = 2; c.beginPath(); c.moveTo(x, 250); c.quadraticCurveTo(x + 4, y + 50, x, y); c.stroke();
      c.fillStyle = '#e7e6cb';
      for (let k = 0; k < 5; k++) { const a = k * Math.PI * 2 / 5; c.beginPath(); c.arc(x + Math.cos(a) * 3, y + Math.sin(a) * 3, 2.2, 0, Math.PI * 2); c.fill(); }
      c.fillStyle = '#c0a151'; c.beginPath(); c.arc(x, y, 2, 0, Math.PI * 2); c.fill();
    }
    (window as any).sprite = atlas.toDataURL('image/png');
  `);
  const port = 5196;
  server = spawn(join(root, 'node_modules/.bin/vite'), ['--host', '127.0.0.1', '--port', String(port), '--strictPort'], { cwd: tmp, stdio: 'inherit' });
  const url = `http://127.0.0.1:${port}/`;
  let ready = false;
  for (let i = 0; i < 100; i++) {
    try { if ((await fetch(url)).ok) { ready = true; break; } } catch { /* server starting */ }
    if (server.exitCode !== null) throw Error('Vite failed to start');
    await new Promise(r => setTimeout(r, 100));
  }
  if (!ready) throw Error('Vite did not start');
  browser = await chromium.launch(browserOptions());
  const page = await browser.newPage();
  await page.goto(url);
  await page.waitForFunction(() => window.sprite);
  const uri = await page.evaluate(() => window.sprite);
  const images = join(root, 'public/tunyard/grass');
  mkdirSync(images, { recursive: true });
  writeFileSync(join(images, 'tuft.png'), Buffer.from(uri.split(',')[1], 'base64'));
  console.log('Baked Tunyard Grass Tuft sprite.');
} finally {
  await browser?.close();
  server?.kill();
  rmSync(tmp, { recursive: true, force: true });
}
