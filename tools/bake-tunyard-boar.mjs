// Rebuild the boar's neutral pose and palette atlases from the user's Tunyard.
// Usage: BROWSER_PATH=/path/to/chromium node tools/bake-tunyard-boar.mjs /path/to/tunyard
import { cpSync, mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { spawn, spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { browserOptions } from './browser.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
if (!process.argv[2]) throw Error('Pass a clean checkout of Tunyard as the first argument');
const source = resolve(process.argv[2]);
const commit = '4de2d594e9ea54553af1884ac1d2add62058a41b';
const git = (...args) => { const r = spawnSync('git', ['-C', source, ...args], { encoding: 'utf8' }); if (r.status !== 0) throw Error(r.stderr); return r.stdout.trim(); };
if (git('rev-parse', 'HEAD') !== commit || git('status', '--porcelain')) throw Error(`Tunyard must be clean and checked out at ${commit}`);
if (JSON.parse(readFileSync(join(root, 'node_modules/three/package.json'), 'utf8')).version !== '0.170.0') throw Error('Install Three.js 0.170.0, the version used by this Tunyard checkout');
const tmp = mkdtempSync(join(tmpdir(), 'tunyard-boar-'));
let server, browser;
try {
  mkdirSync(join(tmp, 'src/assets/lowpolyAnimals'), { recursive: true });
  cpSync(join(source, 'src/core'), join(tmp, 'src/core'), { recursive: true });
  for (const name of ['common.ts', 'boar.ts']) cpSync(join(source, 'src/assets/lowpolyAnimals', name), join(tmp, 'src/assets/lowpolyAnimals', name));
  symlinkSync(join(root, 'node_modules'), join(tmp, 'node_modules'), 'dir');
  writeFileSync(join(tmp, 'index.html'), '<script type="module" src="/src/main.ts"></script>');
  writeFileSync(join(tmp, 'src/main.ts'), "import { lpBoar } from './assets/lowpolyAnimals/boar'; import { buildAsset } from './core/registry'; (window as any).asset = buildAsset(lpBoar, { animate: false }, 1);");
  const port = 5199;
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
  page.on('pageerror', e => console.error(e));
  await page.goto(url);
  await page.waitForFunction(() => window.asset, null, { timeout: 60000 });
  const data = await page.evaluate(() => {
    const b64 = array => { const bytes = new Uint8Array(array.buffer, array.byteOffset, array.byteLength); let s = ''; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000)); return btoa(s); };
    const meshes = [], textures = [], textureIds = new Map();
    window.asset.updateMatrixWorld(true);
    window.asset.traverse(o => {
      if (!o.isMesh) return;
      const geo = o.geometry.clone();
      if (geo.index) throw Error(`Expected non-indexed geometry: ${o.name}`);
      geo.applyMatrix4(o.matrixWorld);
      const ms = Array.isArray(o.material) ? o.material : [o.material];
      const groups = geo.groups.length ? geo.groups : [{ start: 0, count: geo.attributes.position.count, materialIndex: 0 }];
      const out = groups.map(g => {
        const m = ms[g.materialIndex];
        let texture = null;
        if (m.map?.image) {
          const uri = m.map.image.toDataURL('image/png');
          if (!textureIds.has(uri)) { textureIds.set(uri, textures.length); textures.push(uri); }
          texture = textureIds.get(uri);
        }
        return { start: g.start, count: g.count, texture, color: m.color?.getHexString() ?? 'ffffff', transparent: !!m.transparent, opacity: m.opacity ?? 1 };
      });
      meshes.push({ name: o.name, position: b64(geo.attributes.position.array), normal: b64(geo.attributes.normal.array), uv: b64(geo.attributes.uv.array), groups: out });
    });
    return { meshes, textures };
  });
  if (!data.meshes.length || !data.textures.length) throw Error('The boar bake must include its meshes and palette textures');
  const out = join(root, 'src/animals/assets'), images = join(root, 'public/tunyard/boar');
  mkdirSync(out, { recursive: true }); mkdirSync(images, { recursive: true });
  writeFileSync(join(out, 'boar.json'), JSON.stringify({ source: `rahulbhola877/tunyard@${commit} src/assets/lowpolyAnimals/boar.ts`, seed: 1, params: { animate: false }, meshes: data.meshes }));
  for (let i = 0; i < data.textures.length; i++) writeFileSync(join(images, `palette-${i}.png`), Buffer.from(data.textures[i].split(',')[1], 'base64'));
  console.log(`Baked ${data.meshes.length} Tunyard boar mesh parts and ${data.textures.length} palette atlases.`);
} finally {
  await browser?.close();
  server?.kill();
  rmSync(tmp, { recursive: true, force: true });
}
