// Bake the owner's self-contained LowPoly Lab viewer; its Three runtime is
// used only in this offline tool and never enters the game's runtime bundle.
// Usage: BROWSER_PATH=/path/to/chromium node tools/bake-lowpoly-nature.mjs viewer.html
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { chromium } from 'playwright';
import { browserOptions } from './browser.mjs';

const source = process.argv[2];
if (!source) throw Error('Pass the owner-provided lowpoly-lab-viewer.html');
const html = readFileSync(source, 'utf8');
const sha256 = createHash('sha256').update(html).digest('hex');
const url = 'http://127.0.0.1:5196/__lowpoly_source.html';
const recipes = [
  { id: 'broadleaf-7', preset: 'Spring Oak', seed: 7, height: 4.8, width: 3.3 },
  { id: 'broadleaf-31', preset: 'Spring Oak', seed: 31, height: 4.8, width: 3.3 },
  { id: 'broadleaf-67', preset: 'Spring Oak', seed: 67, height: 4.8, width: 3.3 },
  { id: 'shrub-17', preset: 'Karikomi Ball', seed: 17, height: 0.9, width: 1.15 },
  { id: 'shrub-41', preset: 'Karikomi Ball', seed: 41, height: 0.9, width: 1.15 },
];
const overrides = {
  artStyle: 'stylized', groundOn: false, fruitCount: 0, rocks: 0, tufts: 0,
  canopyDetail: 0, branchCount: 5, blobsPerBranch: 2, trunkSides: 6, trunkRings: 4,
  leafCount: 0, foliageStyle: 'blob', snow: 0, wind: 0, autoRotate: false,
  leafShadow: '#254a35', leafBase: '#548246', leafLight: '#99b866',
  barkBase: '#715641', barkTop: '#ab8960', colorNoise: 0, hueJitter: 0.015,
};
const browser = await chromium.launch(browserOptions());
try {
  const page = await browser.newPage({ viewport: { width: 1100, height: 800 } });
  // Serve through a local browser test origin without copying the viewer into
  // public/ or depending on a second HTTP server. Abort external requests.
  await page.route('**/*', route => route.request().url() === url
    ? route.fulfill({ contentType: 'text/html', body: html })
    : /^(data|blob):/.test(route.request().url()) ? route.continue() : route.abort());
  await page.goto(url);
  await page.waitForFunction(() => window.LowPoly?.ready, null, { timeout: 60000 });
  const variants = await page.evaluate(({ recipes, overrides }) => {
    const L = window.LowPoly, T = L.THREE;
    const b64 = array => {
      const bytes = new Uint8Array(array.buffer, array.byteOffset, array.byteLength);
      let text = '';
      for (let i = 0; i < bytes.length; i += 32768) text += String.fromCharCode(...bytes.subarray(i, i + 32768));
      return btoa(text);
    };
    const out = [];
    for (const recipe of recipes) {
      L.preset(recipe.preset);
      L.set({ ...overrides, seed: recipe.seed });
      const params = L.params, built = L.build();
      built.group.updateMatrixWorld(true);
      const bounds = new T.Box3().setFromObject(built.group), size = bounds.getSize(new T.Vector3());
      const sxz = recipe.width / Math.max(size.x, size.z), sy = recipe.height / size.y;
      const centre = bounds.getCenter(new T.Vector3()), meshes = [];
      let triangles = 0;
      built.group.traverse(mesh => {
        if (!mesh.isMesh) return;
        const g = mesh.geometry, mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        if (mats.some(m => m.transparent || m.alphaTest > 0 || m.opacity < 1)) throw Error(`${recipe.id} contains alpha geometry`);
        const part = mats[0].name.toLowerCase().includes('bark') ? 'bark' : 'leaves';
        const p = g.attributes.position, n = g.attributes.normal, c = g.attributes.color;
        if (!p || !n || !c || mats.length !== 1) throw Error('Unsupported source geometry');
        const positions = [], normals = [], colors = [];
        const normalMatrix = new T.Matrix3().getNormalMatrix(mesh.matrixWorld);
        const point = new T.Vector3(), normal = new T.Vector3();
        for (let i = 0; i < p.count; i++) {
          point.fromBufferAttribute(p, i).applyMatrix4(mesh.matrixWorld);
          positions.push((point.x - centre.x) * sxz, (point.y - bounds.min.y) * sy, (point.z - centre.z) * sxz);
          normal.fromBufferAttribute(n, i).applyNormalMatrix(normalMatrix);
          normal.set(normal.x / sxz, normal.y / sy, normal.z / sxz).normalize();
          normals.push(normal.x, normal.y, normal.z);
          colors.push(c.getX(i), c.getY(i), c.getZ(i));
        }
        const index = g.index ? Array.from(g.index.array) : Array.from({ length: p.count }, (_, i) => i);
        triangles += index.length / 3;
        meshes.push({ part, position: b64(new Float32Array(positions)), normal: b64(new Float32Array(normals)), color: b64(new Float32Array(colors)), indices: index });
      });
      if (triangles > 500) throw Error(`${recipe.id} exceeds the 500-triangle budget: ${triangles}`);
      out.push({ id: recipe.id, preset: recipe.preset, params, normalized: { height: recipe.height, maxWidth: recipe.width }, triangles, meshes });
      built.group.traverse(mesh => { if (mesh.isMesh) mesh.geometry.dispose(); });
    }
    return out;
  }, { recipes, overrides });
  const target = resolve('src/world/assets'); mkdirSync(target, { recursive: true });
  const asset = { source: 'Owner-provided LowPoly Lab viewer (Three.js r187)', sourceSha256: sha256, schema: 1, variants };
  writeFileSync(resolve(target, 'lowpoly-nature.json'), JSON.stringify(asset));
  writeFileSync(resolve(target, 'lowpoly-nature-manifest.json'), JSON.stringify({ source: asset.source, sourceSha256: sha256, generator: 'tools/bake-lowpoly-nature.mjs', recipes, overrides, variants: variants.map(({ id, triangles, normalized }) => ({ id, triangles, normalized })) }, null, 2) + '\n');
  console.log(JSON.stringify(variants.map(({ id, triangles }) => ({ id, triangles }))));
} finally { await browser.close(); }
