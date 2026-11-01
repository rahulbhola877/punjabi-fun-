// Rebuild the toon fox's neutral pose and colors from the user's Tunyard.
// Usage: BROWSER_PATH=/path/to/chromium node tools/bake-tunyard-fox.mjs /path/to/tunyard
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
const tmp = mkdtempSync(join(tmpdir(), 'tunyard-fox-'));
let server, browser;
try {
  mkdirSync(join(tmp, 'src/assets/toonAnimals'), { recursive: true });
  cpSync(join(source, 'src/core'), join(tmp, 'src/core'), { recursive: true });
  mkdirSync(join(tmp, 'src/assets/toon'), { recursive: true });
  cpSync(join(source, 'src/assets/toon/common.ts'), join(tmp, 'src/assets/toon/common.ts'));
  for (const name of ['common.ts', 'toonFox.ts']) cpSync(join(source, 'src/assets/toonAnimals', name), join(tmp, 'src/assets/toonAnimals', name));
  symlinkSync(join(root, 'node_modules'), join(tmp, 'node_modules'), 'dir');
  writeFileSync(join(tmp, 'index.html'), '<script type="module" src="/src/main.ts"></script>');
  writeFileSync(join(tmp, 'src/main.ts'), "import { toonFox } from './assets/toonAnimals/toonFox'; import { buildAsset } from './core/registry'; (window as any).asset = buildAsset(toonFox, { animate: false, scarf: true }, 1);");
  const port = 5192;
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
    const meshes = [];
    window.asset.updateMatrixWorld(true);
    window.asset.traverse(o => {
      if (!o.isMesh || o.material?.name === 'outline') return;
      const geo = o.geometry.clone();
      if (geo.index) throw Error(`Expected non-indexed geometry: ${o.name}`);
      geo.applyMatrix4(o.matrixWorld);
      const ms = Array.isArray(o.material) ? o.material : [o.material];
      const groups = geo.groups.length ? geo.groups : [{ start: 0, count: geo.attributes.position.count, materialIndex: 0 }];
      const out = groups.map(g => {
        const m = ms[g.materialIndex];
        const texture = null;
        return { start: g.start, count: g.count, texture, color: m.color?.getHexString() ?? 'ffffff', transparent: !!m.transparent, opacity: m.opacity ?? 1 };
      });
      meshes.push({ name: o.name, position: b64(geo.attributes.position.array), normal: b64(geo.attributes.normal.array), uv: b64(geo.attributes.uv.array), groups: out });
    });
    return { meshes };
  });
  if (!data.meshes.length) throw Error('The fox bake must include its meshes');
  const out = join(root, 'src/alternate/assets');
  mkdirSync(out, { recursive: true });
  writeFileSync(join(out, 'toonFox.json'), JSON.stringify({ source: `rahulbhola877/tunyard@${commit} src/assets/toonAnimals/toonFox.ts`, seed: 1, params: { animate: false, scarf: true }, meshes: data.meshes }));
  console.log(`Baked ${data.meshes.length} Tunyard fox mesh parts.`);
} finally {
  await browser?.close();
  server?.kill();
  rmSync(tmp, { recursive: true, force: true });
}
