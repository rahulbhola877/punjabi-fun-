// Rebuild the corner shop from a clean checkout of the user's Tunyard.
// Usage: BROWSER_PATH=/path/to/chromium node tools/bake-tunyard-corner-shop.mjs /path/to/tunyard
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
if (!source) throw Error('Pass a clean checkout of Tunyard as the first argument');
const git = (...args) => {
  const r = spawnSync('git', ['-C', source, ...args], { encoding: 'utf8' });
  if (r.status !== 0) throw Error(r.stderr);
  return r.stdout.trim();
};
if (git('rev-parse', 'HEAD') !== commit || git('status', '--porcelain')) throw Error(`Tunyard must be clean and checked out at ${commit}`);
const pkg = JSON.parse(readFileSync(join(root, 'node_modules/three/package.json'), 'utf8'));
if (pkg.version !== '0.170.0') throw Error('Install Three.js 0.170.0, the version used by this Tunyard checkout');
const tmp = mkdtempSync(join(tmpdir(), 'tunyard-corner-'));
let server, browser;
try {
  mkdirSync(join(tmp, 'src/assets'), { recursive: true });
  cpSync(join(source, 'src/core'), join(tmp, 'src/core'), { recursive: true });
  cpSync(join(source, 'src/assets/city'), join(tmp, 'src/assets/city'), { recursive: true });
  symlinkSync(join(root, 'node_modules'), join(tmp, 'node_modules'), 'dir');
  writeFileSync(join(tmp, 'index.html'), '<script type="module" src="/src/main.ts"></script>');
  writeFileSync(join(tmp, 'src/main.ts'), "import { cornerShop } from './assets/city/cornerShop'; import { buildAsset } from './core/registry'; (window as any).cornerObj = buildAsset(cornerShop, { floors: 2, bays: 3, bayWidth: 3, depth: 10, corner: 'none', walls: 'cream render', signText: 'NORTH GROCER', tables: 0, bladeSign: false, flowerBoxes: false }, 1);");
  const port = 5198;
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
  await page.waitForFunction(() => window.cornerObj);
  const data = await page.evaluate(() => {
    const b64 = array => { const bytes = new Uint8Array(array.buffer, array.byteOffset, array.byteLength); let s = ''; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000)); return btoa(s); };
    const textures = [], texIds = new WeakMap(), materials = [], matKeys = new Map(), meshes = [];
    const texture = t => {
      if (!t?.image?.toDataURL) return null;
      let id = texIds.get(t);
      if (id === undefined) { id = textures.length; texIds.set(t, id); textures.push(t.image.toDataURL('image/png')); }
      return id;
    };
    const material = m => {
      const map = texture(m.map), normal = texture(m.normalMap);
      const desc = { name: m.name, map, normal, roughness: m.roughness ?? 0.8, metalness: m.metalness ?? 0, transparent: m.transparent ?? false, opacity: m.opacity ?? 1, doubleSided: m.side === 2, alphaTest: m.alphaTest ?? 0 };
      const signature = JSON.stringify(desc);
      let id = matKeys.get(signature);
      if (id === undefined) { id = materials.length; matKeys.set(signature, id); materials.push(desc); }
      return id;
    };
    window.cornerObj.traverse(o => {
      if (!o.isMesh) return;
      const geo = o.geometry, ms = Array.isArray(o.material) ? o.material : [o.material];
      const groups = geo.groups.map(g => ({ start: g.start, count: g.count, mat: material(ms[g.materialIndex]), color: ms[g.materialIndex].color?.getHexString() ?? 'ffffff' }));
      meshes.push({ name: o.name, position: b64(geo.attributes.position.array), normal: b64(geo.attributes.normal.array), uv: b64(geo.attributes.uv.array), groups });
    });
    return { meshes, materials, textures };
  });
  const out = join(root, 'src/world/assets'), images = join(root, 'public/tunyard/corner-shop');
  mkdirSync(out, { recursive: true }); mkdirSync(images, { recursive: true });
  writeFileSync(join(out, 'cornerShop.json'), JSON.stringify({ source: `rahulbhola877/tunyard@${commit} src/assets/city/cornerShop.ts`, seed: 1, params: { floors: 2, bays: 3, bayWidth: 3, depth: 10, corner: 'none', walls: 'cream render', signText: 'NORTH GROCER', tables: 0, bladeSign: false, flowerBoxes: false }, meshes: data.meshes, materials: data.materials }));
  for (const [id, uri] of data.textures.entries()) writeFileSync(join(images, `${id}.png`), Buffer.from(uri.split(',')[1], 'base64'));
  console.log('Baked Tunyard corner shop geometry and textures.');
} finally {
  await browser?.close();
  server?.kill();
  rmSync(tmp, { recursive: true, force: true });
}
