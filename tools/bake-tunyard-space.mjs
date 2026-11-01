// Rebuild original Tunyard sci-fi assets from a clean, exact source checkout.
// Usage: BROWSER_PATH=/path/to/chromium node tools/bake-tunyard-space.mjs /path/to/tunyard
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
const tmp = mkdtempSync(join(tmpdir(), 'tunyard-space-'));
let server, browser;
try {
  mkdirSync(join(tmp, 'src/assets'), { recursive: true });
  cpSync(join(source, 'src/core'), join(tmp, 'src/core'), { recursive: true });
  cpSync(join(source, 'src/assets/scifi'), join(tmp, 'src/assets/scifi'), { recursive: true });
  cpSync(join(source, 'src/assets/lpVehicles'), join(tmp, 'src/assets/lpVehicles'), { recursive: true });
  symlinkSync(join(root, 'node_modules'), join(tmp, 'node_modules'), 'dir');
  writeFileSync(join(tmp, 'index.html'), '<script type="module" src="/src/main.ts"></script>');
  writeFileSync(join(tmp, 'src/main.ts'), `import { buildAsset } from './core/registry';
import { scifiLandingPad } from './assets/scifi/landingPad'; import { scifiDish } from './assets/scifi/dish';
import { scifiSolarArray } from './assets/scifi/solarArray'; import { scifiCryoPod } from './assets/scifi/cryoPod'; import { rover } from './assets/lpVehicles/misc/scifi';
(window as any).assets = { pad: buildAsset(scifiLandingPad,{radius:5,ramps:1,lights:2},1), dish: buildAsset(scifiDish,{},1), solar: buildAsset(scifiSolarArray,{},1), pod: buildAsset(scifiCryoPod,{},1), rover: buildAsset(rover,{variant:'Crew',animate:false},1) };`);
  const port = 5193;
  server = spawn(join(root, 'node_modules/.bin/vite'), ['--host', '127.0.0.1', '--port', String(port), '--strictPort'], { cwd: tmp, stdio: 'inherit' });
  const url = `http://127.0.0.1:${port}/`;
  let ready = false;
  for (let i = 0; i < 100; i++) { try { if ((await fetch(url)).ok) { ready = true; break; } } catch {} if (server.exitCode !== null) throw Error('Vite failed to start'); await new Promise(r => setTimeout(r, 100)); }
  if (!ready) throw Error('Vite did not start');
  browser = await chromium.launch(browserOptions());
  const page = await browser.newPage(); page.on('pageerror', e => console.error(e));
  await page.goto(url); await page.waitForFunction(() => window.assets, null, { timeout: 60000 });
  const data = await page.evaluate(() => {
    const b64 = array => { const bytes = new Uint8Array(array.buffer, array.byteOffset, array.byteLength); let s = ''; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000)); return btoa(s); };
    const textures = [], ids = new Map(), outputs = {};
    const tex = t => { const uri = t?.image?.toDataURL?.('image/png'); if (!uri) return null; if (!ids.has(uri)) { ids.set(uri, textures.length); textures.push(uri); } return ids.get(uri); };
    for (const [name, object] of Object.entries(window.assets)) {
      const meshes = []; object.updateMatrixWorld(true);
      object.traverse(o => {
        if (!o.isMesh || o.userData?.noExport || o.material?.name === 'outline') return;
        let geo = o.geometry.clone(); if (geo.index) geo = geo.toNonIndexed(); geo.applyMatrix4(o.matrixWorld);
        const p = geo.attributes.position, n = geo.attributes.normal, uv = geo.attributes.uv;
        if (!p || !n || !uv) throw Error(`Missing geometry attributes in ${name}/${o.name}`);
        const materials = Array.isArray(o.material) ? o.material : [o.material];
        const groups = (geo.groups.length ? geo.groups : [{start:0,count:p.count,materialIndex:0}]).map(g => {
          const m = materials[g.materialIndex];
          return { start:g.start, count:g.count, color:m.color?.getHexString() ?? 'ffffff', texture:tex(m.map), normalTexture:tex(m.normalMap), alphaTest:m.alphaTest ?? 0, opacity:m.opacity ?? 1, doubleSided:m.side === 2, roughness:m.roughness ?? 1, metalness:m.metalness ?? 0 };
        });
        meshes.push({name:o.name, position:b64(p.array), normal:b64(n.array), uv:b64(uv.array), groups});
      });
      if (!meshes.length) throw Error(`No meshes in ${name}`);
      outputs[name] = meshes;
    }
    return { outputs, textures };
  });
  const out = join(root, 'src/alternate/assets'), images = join(root, 'public/tunyard/space');
  mkdirSync(out, {recursive:true}); mkdirSync(images,{recursive:true});
  writeFileSync(join(out, 'spaceAssets.json'), JSON.stringify({source:`rahulbhola877/tunyard@${commit}`, seed:1, assets:data.outputs}));
  for (let i = 0; i < data.textures.length; i++) writeFileSync(join(images, `${i}.png`), Buffer.from(data.textures[i].split(',')[1], 'base64'));
  console.log(`Baked ${Object.keys(data.outputs).length} sci-fi assets and ${data.textures.length} source texture maps.`);
} finally { await browser?.close(); server?.kill(); rmSync(tmp,{recursive:true,force:true}); }
