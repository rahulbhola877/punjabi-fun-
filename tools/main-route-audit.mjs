import fs from 'node:fs';
import {launch,waitFor}from './pt-lib.mjs';
const base=process.argv[2]??'http://127.0.0.1:5173/',label=process.env.LABEL??'current',out=`artifacts/main-routes/${label}`;
fs.mkdirSync(out,{recursive:true});
const {browser,page,log}=await launch(`${base}?probe&hour=9`,{w:1280,h:720,settings:{quality:'high',renderer:'webgl',renderScale:1},blockWebSockets:true,seed:0x48192});const rows=[];
try {
 await page.waitForFunction(()=>window.__pfs?.snapshot().state==='title',null,{timeout:300000});await page.locator('#title .menu button').first().click();await page.locator('#title .looks button').first().click();
 const skip=page.locator('[data-cinematic-skip]');if(await skip.count()){await skip.waitFor({state:'visible',timeout:180000});await skip.click();}
 await waitFor(page,s=>s.state==='playing',180000);await page.evaluate(()=>{window.__pfs.captureHold(true);window.__pfs.stage(999);});
 for(const [name,x,z]of [['punjab-bazaar',0,-42],['punjab-highway',90,-160],['ludhiana',-470,-266],['canada',1108,1748]]) {
  console.log('ROUTE',name);
  const data=await page.evaluate(async({x,z})=>{
   const probe=window.__pfs,s=probe.scene(),e=s.getEngine(),camera={eye:[x+8,6,z-10],at:[x,1.4,z],fov:0.8};probe.teleport(x,z,0);
   const frame=async()=>{e.beginFrame();probe.tick(1,camera);e.endFrame();await new Promise(r=>setTimeout(r,0));};
   for(let i=0;i<20;i++)await frame();
   const cpu=[],update=[],draws=[],triangles=[],total=[];let start=0,before=0,d=0;
   const a=s.onBeforeRenderObservable.add(()=>{before=performance.now();d=e._drawCalls.current;});
   const b=s.onAfterRenderObservable.add(()=>{cpu.push(performance.now()-before);update.push(before-start);draws.push(e._drawCalls.current>=d?e._drawCalls.current-d:e._drawCalls.current);triangles.push(s.getActiveIndices()/3);});
   window.dispatchEvent(new KeyboardEvent('keydown',{code:'KeyW',key:'w',bubbles:true}));
   for(let i=0;i<20;i++){start=performance.now();await frame();total.push(performance.now()-start);}
   window.dispatchEvent(new KeyboardEvent('keyup',{code:'KeyW',key:'w',bubbles:true}));
   s.onBeforeRenderObservable.remove(a);s.onAfterRenderObservable.remove(b);
   const stat=a=>{a.sort((a,b)=>a-b);return{median:a[Math.floor(a.length/2)]??null,p95:a[Math.floor(a.length*.95)]??null};};
   return{samples:cpu.length,resolution:[e.getRenderWidth(),e.getRenderHeight()],renderer:e.getInfo(),renderCpuMs:stat(cpu),updateCpuMs:stat(update),manualStepWallMs:stat(total),draws:stat(draws),triangles:stat(triangles),residents:probe.snapshot().residents,endpoint:probe.snapshot().player,errors:probe.snapshot().errors};
  },{x,z});
  if(data.resolution[0]!==1280||data.resolution[1]!==720)throw Error('Resolution changed');
  await page.screenshot({path:`${out}/${name}.png`});rows.push({name,...data});console.log(JSON.stringify(rows.at(-1)));fs.writeFileSync(`${out}/measurements.json`,JSON.stringify({label,software:process.env.SOFTWARE==='1',fixedSimulationStep:1/30,walking:true,randomSeed:0x48192,rows,log,external:page.__external},null,2));
 }
 if(log.some(s=>/^\[(http|error|pageerror)/.test(s))||page.__external.length||rows.some(r=>r.errors?.length))throw Error(JSON.stringify({log,external:page.__external}));
}catch(error){await page.screenshot({path:`${out}/failure.png`}).catch(()=>{});throw error;}finally{await browser.close();}
