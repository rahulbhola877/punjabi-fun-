// Diagnostic only: unchanged render resolution; separate sampled JS/WASM,
// process CPU counters and main-thread elapsed intervals. The update-only
// experiment suppresses rendering temporarily and is never an FPS benchmark.
import fs from 'node:fs';
import {summarize,cpuDelta,instrumentSystems,geometryInventory}from './cost-profile-core.mjs';
import {launch,waitFor} from './pt-lib.mjs';
const base=process.argv[2]??'http://127.0.0.1:4176/',label=process.env.LABEL??'9b-before';
const out=`artifacts/system-profiles/${label}`;
fs.mkdirSync(out,{recursive:true});
const {browser,page,log}=await launch(`${base}?probe&hour=9`,{w:1280,h:720,settings:{quality:'high',renderer:'webgl',renderScale:1},seed:0x48192});
const cdp=await page.context().newCDPSession(page),system=await browser.newBrowserCDPSession(),rows=[];
await cdp.send('Profiler.enable');await cdp.send('Profiler.setSamplingInterval',{interval:500});
try{
 await page.waitForFunction(()=>window.__pfs?.snapshot().state==='title',null,{timeout:300000});await page.locator('#title .menu button').first().click();await page.locator('#title .looks button').first().click();
 const skip=page.locator('[data-cinematic-skip]');if(await skip.count()){await skip.waitFor({state:'visible',timeout:180000});await skip.click();}
 await waitFor(page,s=>s.state==='playing',180000);await page.evaluate(()=>{window.__pfs.captureHold(true);window.__pfs.stage(999);});
 await instrumentSystems(cdp,page);
 await page.evaluate(enabled=>window.__fixedPopulation=enabled,process.env.FIXED_POPULATION==='1');
 for(const [name,x,z,yaw,driving]of [['bazaar',0,-42,0,false],['canada',1108,1748,0,false],['drive',80,-160,Math.PI/2,true]].filter(r=>!process.env.SCENARIOS||process.env.SCENARIOS.split(',').includes(r[0]))){
  console.log('SETUP',name);
  await page.evaluate(({x,z,yaw,driving})=>{const p=window.__pfs;if(driving){if(!p.driveAt('car',x,z,yaw))throw Error('Drive setup failed');}else p.teleport(x,z,yaw);},{x,z,yaw,driving});
  await page.evaluate(async()=>{const p=window.__pfs,e=p.scene().getEngine();for(let i=0;i<20;i++){e.beginFrame();p.tick(1,null);e.endFrame();await new Promise(r=>setTimeout(r,0));}e._gl.finish();});
  if(process.env.STEADY==='1'){
   const settled=await page.evaluate(async()=>{
    const p=window.__pfs,g=window.__costGame,s=p.scene(),e=s.getEngine(),render=s.render,counts=[];s.render=()=>{};
    try{for(let batch=0;batch<10;batch++){for(let i=0;i<120;i++){e.beginFrame();p.tick(1,null);e.endFrame();}const q=p.snapshot();counts.push({traffic:q.traffic,residents:q.residents,vehicles:q.vehicleCount,kitBuilds:q.kit.builds});if(counts.length>=3&&JSON.stringify(counts.at(-1))===JSON.stringify(counts.at(-2))&&JSON.stringify(counts.at(-2))===JSON.stringify(counts.at(-3)))break;}}
    finally{s.render=render;}
    for(let i=0;i<6;i++){e.beginFrame();p.tick(1,null);e.endFrame();await new Promise(r=>setTimeout(r,0));}e._gl.finish();return counts;
   });console.log('SETTLED',name,JSON.stringify(settled));
  }
  for(const [mode,frames]of [['rendered',24],['update-only',120]]){
   console.log('PROFILE',name,mode);const before=await system.send('SystemInfo.getProcessInfo');await cdp.send('Profiler.start');
   const data=await page.evaluate(async({mode,frames})=>{
    const p=window.__pfs,s=p.scene(),e=s.getEngine(),original=s.render,updates=[],renders=[],ends=[],total=[],draws=[],triangles=[],shadowDraws=[];let started=0,lastActive=[],drawStart=0;
    const g=window.__costGame,oldSpawn=g.traffic.spawnT,oldFolk=g.folkT,folk=g.updateFolk,release=g.traffic.release;
    // Controlled fixture only: population management is excluded; existing
    // resident/driver AI, animation, collision and physics remain active.
    // Timers alone did not stop pending folk fills or far-car removals.
    if(window.__fixedPopulation){g.traffic.spawnT=Infinity;g.folkT=Infinity;g.updateFolk=()=>{};g.traffic.release=()=>{};}
    const frameDrawObserver=s.onBeforeRenderObservable.add(()=>drawStart=e._drawCalls.current);
    window.__costSpans.clear();
    const shadows=s.lights.map(l=>l.getShadowGenerator?.()?.getShadowMap()).filter(Boolean),observers=[];
    for(const target of shadows){let d=0;observers.push([target,target.onBeforeRenderObservable.add(()=>d=e._drawCalls.current),target.onAfterRenderObservable.add(()=>shadowDraws.push(e._drawCalls.current-d))]);}
    s.render=function(...args){updates.push(performance.now()-started);const begin=performance.now();if(mode==='rendered')original.apply(s,args);renders.push(performance.now()-begin);};
    window.dispatchEvent(new KeyboardEvent('keydown',{code:'KeyW',key:'w',bubbles:true}));
    const first=p.snapshot();
    try{for(let i=0;i<frames;i++){e.beginFrame();started=performance.now();p.tick(1,null);const end=performance.now();draws.push(mode==='rendered'?e._drawCalls.current-drawStart:0);triangles.push(s.getActiveIndices()/3);if(i===frames-1){const am=s.getActiveMeshes();lastActive=am.data.slice(0,am.length).map(m=>({name:m.name,material:m.material?.name,family:m.name.startsWith('world_')?'static-world':m.skeleton?'skinned-people':'other',triangles:m.getTotalIndices()/3*(m.thinInstanceCount||1)}));}e.endFrame();ends.push(performance.now()-end);total.push(performance.now()-started);if(mode==='rendered')await new Promise(r=>setTimeout(r,0));}}
    finally{window.dispatchEvent(new KeyboardEvent('keyup',{code:'KeyW',key:'w',bubbles:true}));s.render=original;s.onBeforeRenderObservable.remove(frameDrawObserver);g.traffic.spawnT=oldSpawn;g.folkT=oldFolk;g.updateFolk=folk;g.traffic.release=release;for(const [t,a,b]of observers){t.onBeforeRenderObservable.remove(a);t.onAfterRenderObservable.remove(b);}}
    const drain=performance.now();e._gl.finish();const drainMs=performance.now()-drain;
    const stat=a=>{a.sort((a,b)=>a-b);return{median:a[Math.floor(a.length/2)],p95:a[Math.floor(a.length*.95)]};},families={};for(const m of lastActive){const f=families[m.family]??={meshes:0,triangles:0};f.meshes++;f.triangles+=m.triangles;}
    return{mode,frames,fixedPopulation:!!window.__fixedPopulation,resolution:[e.getRenderWidth(),e.getRenderHeight()],renderer:e.getInfo(),updateElapsedMs:stat(updates),renderElapsedMs:stat(renders),endFrameElapsedMs:stat(ends),tickElapsedMs:stat(total),drainMs,draws:stat(draws),triangles:stat(triangles),shadowDraws:stat(shadowDraws),shadowCasterCounts:shadows.map(t=>t.renderList.length),activeMeshes:lastActive.length,totalMeshes:s.meshes.length,families,topMeshes:lastActive.sort((a,b)=>b.triangles-a.triangles).slice(0,30),systemSpans:[...window.__costSpans].map(([name,m])=>({name,calls:m.calls,totalMsPerFrame:m.total/frames,selfMsPerFrame:m.self/frames})).sort((a,b)=>b.selfMsPerFrame-a.selfMsPerFrame),populationTargets:{civil:window.__costGame.traffic.target,auto:window.__costGame.traffic.autoTarget,patrol:window.__costGame.traffic.patrolTarget},first,last:p.snapshot()};
   },{mode,frames});
   const {profile}=await cdp.send('Profiler.stop'),after=await system.send('SystemInfo.getProcessInfo');
   fs.writeFileSync(`${out}/${name}-${mode}.cpuprofile`,JSON.stringify(profile));
   const geometry=await page.evaluate(geometryInventory);
   const row={name,...data,geometry,processCpu:cpuDelta(before,after,frames),sampled:summarize(profile)};rows.push(row);console.log(JSON.stringify({name,mode,update:data.updateElapsedMs,render:data.renderElapsedMs,geometry,processCpu:row.processCpu}));
   fs.writeFileSync(`${out}/measurements.json`,JSON.stringify({label,notes:'Update-only suppresses scene rendering for diagnosis; not device FPS. Process CPU is summed over threads; SwiftShader GPU process is software CPU. Profiles include sampling overhead.',rows,log,external:page.__external},null,2));
   if(data.fixedPopulation&&['traffic','residents','vehicleCount'].some(key=>data.first[key]!==data.last[key]))throw Error(`Controlled population changed in ${name}/${mode}`);
  }
  await page.evaluate(()=>{const p=window.__pfs,e=p.scene().getEngine();e.beginFrame();p.tick(1,null);e.endFrame();});await page.screenshot({path:`${out}/${name}.png`});
 }
 if(log.some(s=>/^\[(http|error|pageerror)/.test(s))||page.__external.length||rows.some(r=>r.last.errors?.length))throw Error(JSON.stringify({log,external:page.__external}));
}finally{await browser.close();}
