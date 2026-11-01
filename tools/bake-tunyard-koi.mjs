// Bake the original Tunyard koi's articulated geometry and materials.
// BROWSER_PATH=/usr/bin/chromium node tools/bake-tunyard-koi.mjs /path/to/tunyard
import { cpSync, mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { spawn, spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { browserOptions } from './browser.mjs';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
if (!process.argv[2]) throw Error('Pass a clean checkout of Tunyard');
const source = resolve(process.argv[2]), commit = '4de2d594e9ea54553af1884ac1d2add62058a41b';
const git = (...args) => { const r=spawnSync('git',['-C',source,...args],{encoding:'utf8'}); if(r.status!==0) throw Error(r.stderr); return r.stdout.trim(); };
if (git('rev-parse','HEAD')!==commit || git('status','--porcelain')) throw Error(`Tunyard must be clean at ${commit}`);
if (JSON.parse(readFileSync(join(root,'node_modules/three/package.json'),'utf8')).version !== '0.170.0') throw Error('Three.js 0.170.0 required');
const tmp=mkdtempSync(join(tmpdir(),'tunyard-koi-')); let server,browser;
try {
  mkdirSync(join(tmp,'src/assets'),{recursive:true});
  cpSync(join(source,'src/core'),join(tmp,'src/core'),{recursive:true});
  cpSync(join(source,'src/assets/lpAnimals'),join(tmp,'src/assets/lpAnimals'),{recursive:true});
  mkdirSync(join(tmp,'src/assets/lowpolyAnimals'),{recursive:true});
  cpSync(join(source,'src/assets/lowpolyAnimals/common.ts'),join(tmp,'src/assets/lowpolyAnimals/common.ts'));
  symlinkSync(join(root,'node_modules'),join(tmp,'node_modules'),'dir');
  writeFileSync(join(tmp,'index.html'),'<script type="module" src="/src/main.ts"></script>');
  writeFileSync(join(tmp,'src/main.ts'),`import { buildAsset } from './core/registry'; import { lpaKoi } from './assets/lpAnimals/birdsea/fish'; (window as any).assets = { kohaku: buildAsset(lpaKoi,{pattern:'Kohaku',animate:false},1), ogon: buildAsset(lpaKoi,{pattern:'Ogon',animate:false},1) };`);
  const port=5193; server=spawn(join(root,'node_modules/.bin/vite'),['--host','127.0.0.1','--port',String(port),'--strictPort'],{cwd:tmp,stdio:'inherit'});
  const url=`http://127.0.0.1:${port}/`; let ready=false;
  for(let i=0;i<100;i++){try{if((await fetch(url)).ok){ready=true;break;}}catch{} if(server.exitCode!==null) throw Error('Vite failed'); await new Promise(r=>setTimeout(r,100));} if(!ready) throw Error('Vite timed out');
  browser=await chromium.launch(browserOptions()); const page=await browser.newPage(); page.on('pageerror',e=>console.error(e)); await page.goto(url); await page.waitForFunction(()=>window.assets,null,{timeout:60000});
  const data=await page.evaluate(()=>{
    const b64=array=>{const b=new Uint8Array(array.buffer,array.byteOffset,array.byteLength);let s='';for(let i=0;i<b.length;i+=0x8000)s+=String.fromCharCode(...b.subarray(i,i+0x8000));return btoa(s);};
    const textures=[],ids=new Map(),outputs={};
    const tex=t=>{const uri=t?.image?.toDataURL?.('image/png');if(!uri)return null;if(!ids.has(uri)){ids.set(uri,textures.length);textures.push(uri);}return ids.get(uri);};
    for(const [name,object] of Object.entries(window.assets)){
      const joints=['a','b','c'].map(n=>object.getObjectByName(`lpa-koi-carp-${n}`));
      if(joints.some(x=>!x))throw Error('Koi joints missing');
      // Restore the rig to a straight reference pose; bake around source pivots.
      for(const j of joints) j.quaternion.identity(); object.updateMatrixWorld(true);
      const pivots=joints.map(j=>{const p=j.getWorldPosition(j.position.clone());return [p.x,p.y,p.z];});
      const meshes=[];
      object.traverse(o=>{
        if(!o.isMesh||o.userData?.noExport||o.material?.name==='outline')return;
        let joint=0; for(let p=o.parent;p;p=p.parent){let i=joints.indexOf(p);if(i>=0){joint=i;break;}}
        let geo=o.geometry.clone();if(geo.index)geo=geo.toNonIndexed();geo.applyMatrix4(o.matrixWorld);
        const p=geo.attributes.position,n=geo.attributes.normal,uv=geo.attributes.uv;if(!p||!n||!uv)throw Error(`Missing attributes ${o.name}`);
        for(let i=0;i<p.count;i++){p.array[3*i]-=pivots[joint][0];p.array[3*i+1]-=pivots[joint][1];p.array[3*i+2]-=pivots[joint][2];}
        const mats=Array.isArray(o.material)?o.material:[o.material];
        const groups=(geo.groups.length?geo.groups:[{start:0,count:p.count,materialIndex:0}]).map(g=>{const m=mats[g.materialIndex];return {start:g.start,count:g.count,color:m.color?.getHexString()??'ffffff',texture:tex(m.map),opacity:m.opacity??1,doubleSided:m.side===2,roughness:m.roughness??1,metalness:m.metalness??0};});
        meshes.push({name:o.name,joint,position:b64(p.array),normal:b64(n.array),uv:b64(uv.array),groups});
      });
      outputs[name]={pivots,meshes};
    } return {outputs,textures};
  });
  mkdirSync(join(root,'src/alternate/assets'),{recursive:true});mkdirSync(join(root,'public/tunyard/koi'),{recursive:true});
  writeFileSync(join(root,'src/alternate/assets/koiAssets.json'),JSON.stringify({source:`rahulbhola877/tunyard@${commit}`,seed:1,assets:data.outputs}));
  for(let i=0;i<data.textures.length;i++)writeFileSync(join(root,'public/tunyard/koi',`${i}.png`),Buffer.from(data.textures[i].split(',')[1],'base64'));
  console.log(`Baked ${Object.keys(data.outputs).length} rigged koi variants, ${data.textures.length} textures`);
} finally {await browser?.close();server?.kill();rmSync(tmp,{recursive:true,force:true});}
