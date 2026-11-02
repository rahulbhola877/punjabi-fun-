// Isolate the static shadow strategy in the same final scene, with identical
// actor transforms/camera/materials. ABBA blocks alternate original casters and
// the spatial depth proxies. This is render-only diagnosis, not game FPS.
import fs from 'node:fs';
import {launch,waitFor}from './pt-lib.mjs';
import {instrumentSystems,cpuDelta,geometryInventory}from './cost-profile-core.mjs';
const base=process.argv[2]??'http://127.0.0.1:4180/',out='artifacts/shadow-strategy-ab';fs.mkdirSync(out,{recursive:true});
const {browser,page,log}=await launch(`${base}?probe&hour=9`,{w:1280,h:720,settings:{quality:'high',renderer:'webgl',renderScale:1},seed:0x48192});
const cdp=await page.context().newCDPSession(page),system=await browser.newBrowserCDPSession(),rows=[];
try{
 await waitFor(page,s=>s.state==='title',300000);await page.locator('#title .menu button').first().click();await page.locator('#title .looks button').first().click();await page.locator('[data-cinematic-skip]').waitFor({state:'visible',timeout:180000});await page.locator('[data-cinematic-skip]').click();await waitFor(page,s=>s.state==='playing',180000);
 await page.evaluate(()=>{window.__pfs.captureHold(true);window.__pfs.stage(999);});await instrumentSystems(cdp,page);
 for(const [name,x,z,yaw,drive]of [['bazaar',0,-42,0,false],['canada',1108,1748,0,false],['highway',80,-160,Math.PI/2,true]]){
  console.log('SETUP',name);
  await page.evaluate(async({x,z,yaw,drive})=>{
   const p=window.__pfs,s=p.scene(),e=s.getEngine();if(drive){if(!p.driveAt('car',x,z,yaw))throw Error('drive setup');}else p.teleport(x,z,yaw);
   const render=s.render;s.render=()=>{};try{for(let i=0;i<600;i++)p.tick(1,null);}finally{s.render=render;}
   for(let i=0;i<3;i++){e.beginFrame();p.tick(1,null);e.endFrame();await new Promise(r=>setTimeout(r,0));}e._gl.finish();
   const q=p.snapshot();window.__shadowPose=JSON.stringify([q.player,q.vehicles,q.people]);window.__shadowRaw=[...window.__costGame.world.staticSourceCasters,...[...window.__costGame.world.regionDepth.keys()].flatMap(r=>r.casters)];
  },{x,z,yaw,drive});
  for(const [block,strategy]of ['original','cells','cells','original'].entries()){
   await page.evaluate(async strategy=>{const p=window.__pfs,g=window.__costGame,s=p.scene(),e=s.getEngine(),w=g.world;w.depthEnabled=strategy==='cells';w.staticCasters=window.__shadowRaw;w.shadowCentre.set(1e9,0,0);w.followShadows(g.playerPos());for(let i=0;i<2;i++){e.beginFrame();s.render();e.endFrame();await new Promise(r=>setTimeout(r,0));}e._gl.finish();},strategy);
   const before=await system.send('SystemInfo.getProcessInfo');
   const data=await page.evaluate(async()=>{
    const p=window.__pfs,s=p.scene(),e=s.getEngine(),shadow=window.__costGame.world.shadows.getShadowMap(),times=[],draws=[],triangles=[],shadowDraws=[];let begin=0,shadowBegin=0;
    const a=s.onBeforeRenderObservable.add(()=>begin=e._drawCalls.current),b=shadow.onBeforeRenderObservable.add(()=>shadowBegin=e._drawCalls.current),c=shadow.onAfterRenderObservable.add(()=>shadowDraws.push(e._drawCalls.current-shadowBegin));
    try{for(let i=0;i<8;i++){e.beginFrame();const start=performance.now();s.render();times.push(performance.now()-start);draws.push(e._drawCalls.current-begin);triangles.push(s.getActiveIndices()/3);e.endFrame();await new Promise(r=>setTimeout(r,0));}e._gl.finish();}
    finally{s.onBeforeRenderObservable.remove(a);shadow.onBeforeRenderObservable.remove(b);shadow.onAfterRenderObservable.remove(c);}
    const q=p.snapshot(),poseUnchanged=window.__shadowPose===JSON.stringify([q.player,q.vehicles,q.people]);
    const casterFamilies={};for(const mesh of shadow.renderList){const key=mesh.metadata?.shadowDepthOnly?'depth cells':mesh.skeleton?'skinned actors':mesh.material?.needAlphaTesting()?'cutout foliage':mesh.name.startsWith('world_')?'opaque scenery':'other moving parts';const f=casterFamilies[key]??={meshes:0,triangles:0};f.meshes++;f.triangles+=(mesh.getTotalIndices?.()??0)/3;}
    return{times,draws,triangles,shadowDraws,casterFamilies,poseUnchanged,traffic:q.traffic,residents:q.residents,vehicles:q.vehicleCount,camera:q.cameraPos,resolution:[e.getRenderWidth(),e.getRenderHeight()],renderer:e.getInfo()};
   });
   const after=await system.send('SystemInfo.getProcessInfo'),geometry=await page.evaluate(geometryInventory);rows.push({name,block,strategy,...data,geometry,processCpu:cpuDelta(before,after,8)});
   fs.writeFileSync(`${out}/measurements.json`,JSON.stringify({notes:'Same final scene, identical actor poses, camera and visible materials, warmed ABBA blocks. Render-only diagnostic; process GPU CPU is SwiftShader, not device GPU time/FPS.',rows,log,external:page.__external},null,2));
   console.log(JSON.stringify({name,block,strategy,draws:data.draws[0],shadow:data.shadowDraws[0],geometry,poseUnchanged:data.poseUnchanged}));
   if(!data.poseUnchanged)throw Error('Actor pose changed during render-only block');
   if(block<2)await page.screenshot({path:`${out}/${name}-${strategy}.png`,timeout:180000});
  }
  await page.evaluate(()=>{const g=window.__costGame;g.world.depthEnabled=true;g.world.shadowCentre.set(1e9,0,0);g.world.followShadows(g.playerPos());});
 }
 if(log.some(s=>/^\[(http|error|pageerror)/.test(s))||page.__external.length)throw Error(JSON.stringify({log,external:page.__external}));
}finally{await browser.close();}
