// Generate the drivable pickup's static body and separate wheel meshes from
// the user's clean Tunyard checkout; animated doors are baked closed.
import { cpSync, mkdtempSync, mkdirSync, symlinkSync, writeFileSync, rmSync } from 'node:fs';
import { spawn, spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { chromium } from 'playwright';
import { browserOptions } from './browser.mjs';
const root = process.cwd(), source = resolve(process.argv[2]);
const commit = '4de2d594e9ea54553af1884ac1d2add62058a41b';
const git = (...args) => { const r = spawnSync('git', ['-C', source, ...args], { encoding: 'utf8' }); if (r.status !== 0) throw Error(r.stderr); return r.stdout.trim(); };
if (git('rev-parse', 'HEAD') !== commit || git('status', '--porcelain')) throw Error(`Tunyard must be clean at ${commit}`);
const tmp = mkdtempSync(join(tmpdir(), 'tunyard-pickup-'));
let server, browser;
try {
  mkdirSync(join(tmp, 'src/assets'), { recursive:true });
  cpSync(join(source, 'src/core'), join(tmp, 'src/core'), { recursive:true });
  cpSync(join(source, 'src/assets/cars'), join(tmp, 'src/assets/cars'), { recursive:true });
  symlinkSync(join(root, 'node_modules'), join(tmp, 'node_modules'), 'dir');
  writeFileSync(join(tmp, 'index.html'), '<script type="module" src="/src/main.ts"></script>');
  writeFileSync(join(tmp, 'src/main.ts'), "import { carPickup } from './assets/cars/pickup'; import { buildAsset } from './core/registry'; (window as any).asset = buildAsset(carPickup, { drive: 'right', animate: false, plate: 'PB 10 A 0521' }, 1);");
  server = spawn(join(root, 'node_modules/.bin/vite'), ['--host','127.0.0.1','--port','5196','--strictPort'], { cwd:tmp, stdio:'inherit' });
  let ready=false;
  for (let i=0;i<100;i++) { try { if ((await fetch('http://127.0.0.1:5196/')).ok) { ready=true; break; } } catch {} await new Promise(r=>setTimeout(r,100)); }
  if (!ready) throw Error('Vite did not start');
  browser=await chromium.launch(browserOptions());
  const page=await browser.newPage();
  page.on('pageerror', e=>console.error(e));
  await page.goto('http://127.0.0.1:5196/');
  await page.waitForFunction(()=>window.asset, {timeout:120000});
  const result=await page.evaluate(()=> {
    const b64 = array => { const bytes = new Uint8Array(array.buffer, array.byteOffset, array.byteLength); let s = ''; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000)); return btoa(s); };
    const result=[], textures={};
    window.asset.updateMatrixWorld(true);
    window.asset.traverse(o=>{
      if (!o.isMesh) return;
      const match = /^(wheel|brake)_(fl|fr|rl|rr)_mesh$/.exec(o.name);
      let matrix=o.matrixWorld;
      if (match) {
        let hub=o.parent;
        while (hub && !/^(steer|hub)_(fl|fr|rl|rr)$/.test(hub.name)) hub=hub.parent;
        if (!hub) throw Error(`No wheel hub for ${o.name}`);
        matrix=hub.matrixWorld.clone().invert().multiply(o.matrixWorld);
      }
      const geo=o.geometry.clone();
      if (geo.index) throw Error('Expected non-indexed Tunyard geometry');
      geo.applyMatrix4(matrix);
      const materials=Array.isArray(o.material)?o.material:[o.material];
      for (const m of materials) if (['canvas', 'iron', 'carPlate'].includes(m.name) && !textures[m.name]) {
        textures[m.name] = { albedo: m.map?.image?.toDataURL('image/png'), normal: m.normalMap?.image?.toDataURL('image/png') };
      }
      result.push({ name:o.name, wheel:match?.[2]??null, position:b64(geo.attributes.position.array), normal:b64(geo.attributes.normal.array), uv:b64(geo.attributes.uv.array), groups:geo.groups.map(g=>({ ...g, mat:materials[g.materialIndex].name, color:materials[g.materialIndex].color.getHexString() })) });
    });
    return { meshes: result, textures };
  });
  mkdirSync(join(root,'src/vehicles/assets'),{recursive:true});
  const texturePath=join(root,'public/tunyard/pickup');
  mkdirSync(texturePath,{recursive:true});
  for (const [name,maps] of Object.entries(result.textures)) for (const [kind,uri] of Object.entries(maps)) if (uri) writeFileSync(join(texturePath,`${name}-${kind}.png`),Buffer.from(uri.split(',')[1],'base64'));
  writeFileSync(join(root,'src/vehicles/assets/tunyard-pickup.json'),JSON.stringify({source:`rahulbhola877/tunyard@${commit} src/assets/cars/pickup.ts`,params:{drive:'right',animate:false,plate:'PB 10 A 0521'},meshes:result.meshes}));
  console.log('Baked Tunyard pickup body, wheels and texture maps.');
} finally {await browser?.close();server?.kill();rmSync(tmp,{recursive:true,force:true});}
