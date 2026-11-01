import { chromium } from 'playwright';
import fs from 'node:fs';
import { browserOptions } from './browser.mjs';
const base=process.argv[2]??'http://127.0.0.1:5173/',label=process.env.LABEL??'after';
const out=`artifacts/district-render/${label}`;fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch(browserOptions()); const errors=[],external=[],rows=[];
try {
 const page=await browser.newPage({viewport:{width:1280,height:720}});
 await page.routeWebSocket('**',socket=>socket.onMessage(()=>{}));
 page.on('console',m=>{if(m.type()==='error'){errors.push(m.text());console.log('ERROR',m.text());}});
 page.on('pageerror',e=>{errors.push(e.message);console.log('ERROR',e.message);});
 await page.route('**/*',r=>{const u=r.request().url();if(u.endsWith('/src/main.ts'))return r.fulfill({body:'',contentType:'text/javascript'});if(u.startsWith(new URL(base).origin)||/^(data|blob):/.test(u))return r.continue();external.push(u);r.abort();});
 await page.goto(base);await page.addStyleTag({path:'src/ui/styles.css'});
 await page.evaluate(async()=>{const {Engine}=await import('/src/babylon.ts'); const {preloadBakedAssets}=await import('/src/world/bakedAssets.ts'); await preloadBakedAssets(["broadleaf","cottage","cornerShop","pickup"]);document.body.innerHTML='<canvas id="audit" style="width:100vw;height:100vh"></canvas><div id="overlay"></div>';window.engine=new Engine(document.querySelector('canvas'),true);window.engine.setHardwareScalingLevel(1);});
 for(const [id,module,fn,eye,at] of [
 ['japan','JapanWorld','openJapanWorld',[1.5,4.3,-27.5],[0,1.35,-17.8]],
 ['china','ChinaWorld','openChinaWorld',[43,6,-74],[41,1.35,-59]],
 ['neon','NeonWorld','openNeonWorld',[12,19,-48],[0,1.2,-26]],
 ['space','SpaceWorld','openSpaceWorld',[3.5,5.5,-49],[0,1.5,-35]]].filter(row=>!process.env.WORLDS||process.env.WORLDS.split(',').includes(row[0]))) {
  console.log('OPEN',id);
  await page.evaluate(async({module,fn})=>{const m=await import(`/src/alternate/${module}.ts`);window.world=m[fn](document.querySelector('#overlay'),window.engine,()=>{});},{module,fn});
  if(id==='space')await page.locator('[data-space-skip]').click();
  await page.waitForTimeout(1200);
  const capture=async(name,eye,at)=>{
   const row=await page.evaluate(async({eye,at})=>{
    const s=window.engine.scenes[0],e=window.engine,frames=[],cpu=[],updateCpu=[],draws=[],tris=[];let before=0,drawBefore=0,last=0,begin=0,warm=0;
    const start=e.onBeginFrameObservable.add(()=>{begin=performance.now();});
    const a=s.onBeforeRenderObservable.add(()=>{s.activeCamera.position.set(...eye);s.activeCamera.setTarget(new s.activeCamera.position.constructor(...at));s.updateTransformMatrix(true);before=performance.now();drawBefore=e._drawCalls.current;});
    const b=s.onAfterRenderObservable.add(()=>{const t=performance.now();if(warm++<4)return;cpu.push(t-before);updateCpu.push(before-begin);if(last)frames.push(t-last);last=t;draws.push(e._drawCalls.current>=drawBefore?e._drawCalls.current-drawBefore:e._drawCalls.current);tris.push(s.getActiveIndices()/3);});
    const sampleStart=performance.now();
    await new Promise(resolve=>{const poll=()=>{if((cpu.length>=20&&performance.now()-sampleStart>=6000)||performance.now()-sampleStart>60000)resolve();else setTimeout(poll,100);};poll();});
    const stat=a=>{a.sort((a,b)=>a-b);return {median:a[Math.floor(a.length/2)]??null,p95:a[Math.floor(a.length*.95)]??null};};
    window.shotObserver=a;s.onAfterRenderObservable.remove(b);e.onBeginFrameObservable.remove(start);
    const active=s.getActiveMeshes();
    return {renderer:e.getInfo(),resolution:[e.getRenderWidth(),e.getRenderHeight()],samples:cpu.length,renderCpuMs:stat(cpu),updateCpuMs:stat(updateCpu),frameIntervalMs:stat(frames),draws:stat(draws),triangles:stat(tris),meshes:s.meshes.length,shadowWork:s.metadata?.districtShadowWork??null,top:active.data.slice(0,active.length).map(m=>({name:m.name,triangles:m.getTotalIndices()/3})).sort((a,b)=>b.triangles-a.triangles).slice(0,8)};
   },{eye,at});
   await page.screenshot({path:`${out}/${name}.png`});await page.evaluate(()=>window.engine.scenes[0].onBeforeRenderObservable.remove(window.shotObserver));
   rows.push({name,...row});console.log(JSON.stringify(rows.at(-1)));fs.writeFileSync(`${out}/measurements.json`,JSON.stringify({label,software:process.env.SOFTWARE==='1',rows,errors,external},null,2));
  };
  await capture(id,eye,at);
  if(id==='japan')await capture('japan-pond',[6.5,3.2,22],[10.5,0.15,27.5]);
  if(id==='china')await capture('china-river',[5,5,10],[-1,0,35]);
  if(id==='china') {
   await page.evaluate(async()=>{window.world.dispose();const m=await import('/src/alternate/ChinaWorld.ts');window.world=m.openChinaWorld(document.querySelector('#overlay'),window.engine,()=>{},{stage:4});});
   const restored=await page.evaluate(()=>{const c=window.engine.scenes[0].clearColor;return c.r>c.b;});if(!restored)throw Error('Saved evening lighting not restored');
  }
  await page.evaluate(()=>window.world.dispose());
 }
 if(!process.env.WORLDS||process.env.WORLDS.split(',').includes('pixel')) {
  const row=await page.evaluate(async()=>{
   const cpu=[],commands=[],frames=[],raf=window.requestAnimationFrame.bind(window);let count=0,last=0,warm=0;
   const original=CanvasRenderingContext2D.prototype.fillRect;CanvasRenderingContext2D.prototype.fillRect=function(...args){count++;return original.apply(this,args);};
   window.requestAnimationFrame=callback=>raf(time=>{const start=performance.now(),before=count;callback(time);if(warm++>4){cpu.push(performance.now()-start);commands.push(count-before);if(last)frames.push(time-last);last=time;}});
   const module=await import('/src/alternate/PixelWorld.ts');window.pixel=module.openPixelWorld(document.querySelector('#overlay'),()=>{});
   await new Promise(r=>setTimeout(r,6000));
   const canvas=document.querySelector('[data-pixel-world] canvas'),stat=a=>{a.sort((a,b)=>a-b);return{median:a[Math.floor(a.length/2)]??null,p95:a[Math.floor(a.length*.95)]??null};};
   const result={resolution:[canvas.width,canvas.height],displayResolution:[innerWidth,innerHeight],samples:cpu.length,tickCpuMs:stat(cpu),canvasFillCommands:stat(commands),frameIntervalMs:stat(frames)};
   window.requestAnimationFrame=raf;CanvasRenderingContext2D.prototype.fillRect=original;return result;
  });
  await page.screenshot({path:`${out}/pixel.png`});await page.evaluate(()=>window.pixel.dispose());rows.push({name:'pixel',...row});
  fs.writeFileSync(`${out}/measurements.json`,JSON.stringify({label,software:process.env.SOFTWARE==='1',rows,errors,external},null,2));console.log(JSON.stringify(rows.at(-1)));
 }
 if(errors.length||external.length)throw Error(JSON.stringify({errors,external}));
}finally{await browser.close();}
