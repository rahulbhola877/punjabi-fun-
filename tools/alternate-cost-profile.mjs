import fs from 'node:fs';
import {launch,waitFor}from './pt-lib.mjs';
import {summarize,cpuDelta,instrumentSystems}from './cost-profile-core.mjs';
const base=process.argv[2]??'http://127.0.0.1:4176/',label=process.env.LABEL??'9b-alternates',out=`artifacts/system-profiles/${label}`;
fs.mkdirSync(out,{recursive:true});
const {browser,page,log}=await launch(`${base}?probe&hour=9`,{w:1280,h:720,settings:{quality:'high',renderer:'webgl',renderScale:1},seed:0x48192});
const cdp=await page.context().newCDPSession(page),system=await browser.newBrowserCDPSession(),rows=[];
await cdp.send('Profiler.enable');await cdp.send('Profiler.setSamplingInterval',{interval:500});
try{
 await page.waitForFunction(()=>window.__pfs?.snapshot().state==='title',null,{timeout:300000});await page.locator('#title .menu button').first().click();await page.locator('#title .looks button').first().click();
 const skip=page.locator('[data-cinematic-skip]');if(await skip.count()){await skip.waitFor({state:'visible',timeout:180000});await skip.click();}
 await waitFor(page,s=>s.state==='playing',180000);await instrumentSystems(cdp,page);
 for(const [name,id]of[['Japan','japan'],['China','china']]){
  console.log('ENTER',name);await page.getByRole('button',{name:'Worlds: choose a destination'}).click();await page.locator('.menu-panel button').filter({hasText:name}).click();
  const world=page.locator(`[data-${id}-world]`);await world.waitFor({timeout:180000});
  await page.evaluate(async()=>{const e=window.__pfs.scene().getEngine(),s=e.scenes.at(-1);for(let i=0;i<8;i++)await new Promise(r=>s.onAfterRenderObservable.addOnce(()=>r()));const loops=e._activeRenderLoops;if(loops.length!==1)throw Error('Expected one active district loop');window.__districtLoop=loops[0];e.stopRenderLoop(loops[0]);window.__districtDelta=e.getDeltaTime;e.getDeltaTime=()=>1000/30;e._gl.finish();});
  for(const [mode,frames]of[['rendered',24],['update-only',120]]){
   console.log('PROFILE',id,mode);const before=await system.send('SystemInfo.getProcessInfo');await cdp.send('Profiler.start');
   const data=await page.evaluate(async({mode,frames})=>{
    const e=window.__pfs.scene().getEngine(),s=e.scenes.at(-1),render=s.render,updates=[],renders=[],draws=[],tris=[];let start=0,drawStart=0;window.__costSpans.clear();
    const observer=s.onBeforeRenderObservable.add(()=>drawStart=e._drawCalls.current);
    s.render=function(...args){updates.push(performance.now()-start);const t=performance.now();if(mode==='rendered')render.apply(s,args);renders.push(performance.now()-t);};
    try{for(let i=0;i<frames;i++){e.beginFrame();start=performance.now();window.__districtLoop();draws.push(mode==='rendered'?e._drawCalls.current-drawStart:0);tris.push(s.getActiveIndices()/3);e.endFrame();if(mode==='rendered')await new Promise(r=>setTimeout(r,0));}}
    finally{s.render=render;s.onBeforeRenderObservable.remove(observer);}
    e._gl.finish();const stat=a=>{a.sort((a,b)=>a-b);return{median:a[Math.floor(a.length/2)],p95:a[Math.floor(a.length*.95)]};};
    return{frames,mode,resolution:[e.getRenderWidth(),e.getRenderHeight()],renderer:e.getInfo(),updateElapsedMs:stat(updates),renderElapsedMs:stat(renders),draws:stat(draws),triangles:stat(tris),shadow:s.metadata?.districtShadowWork,systems:[...window.__costSpans].map(([name,m])=>({name,calls:m.calls,totalMsPerFrame:m.total/frames,selfMsPerFrame:m.self/frames})),skeletons:s.skeletons.length};
   },{mode,frames});
   const {profile}=await cdp.send('Profiler.stop'),after=await system.send('SystemInfo.getProcessInfo');fs.writeFileSync(`${out}/${id}-${mode}.cpuprofile`,JSON.stringify(profile));
   rows.push({name:id,...data,processCpu:cpuDelta(before,after,frames),sampled:summarize(profile)});fs.writeFileSync(`${out}/measurements.json`,JSON.stringify({label,notes:'Controlled fixed-step diagnostic, 1280×720. Update-only disables rendering temporarily; not device FPS.',rows,log,external:page.__external},null,2));console.log(JSON.stringify({id,mode,update:data.updateElapsedMs,render:data.renderElapsedMs,draws:data.draws}));
  }
  await page.evaluate(()=>{const e=window.__pfs.scene().getEngine();e.beginFrame();window.__districtLoop();e.endFrame();e.getDeltaTime=window.__districtDelta;e.runRenderLoop(window.__districtLoop);});await page.screenshot({path:`${out}/${id}.png`});
  await world.locator(`[data-${id}-return]`).click();await waitFor(page,s=>s.state==='playing',180000);
 }
 if(log.some(s=>/^\[(http|error|pageerror)/.test(s))||page.__external.length)throw Error(JSON.stringify({log,external:page.__external}));
}finally{await browser.close();}
