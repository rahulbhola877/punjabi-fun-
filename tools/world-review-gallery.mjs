import fs from 'node:fs';
import {launch,waitFor} from './pt-lib.mjs';

// Real production-page evidence only. Run under an outer timeout (<=420s).
// SIGTERM closes this runner's browser; captures/checks survive partial runs.
const base=process.argv[2]??'http://127.0.0.1:4188/';
const out=process.env.GALLERY_OUT??'artifacts/handoff-gallery'; fs.mkdirSync(out,{recursive:true});
const part=process.env.GALLERY_PART??'main',only=process.env.GALLERY_SHOTS?.split(',');
const settings={quality:'high',renderer:'webgl',renderScale:1,shadows:'high'},seed=0x48192;
const result={part,base,source:process.env.GALLERY_SOURCE??'ee2ddf6',startedAtUTC:new Date().toISOString(),requestedShots:only??null,viewport:[1280,720],settings,seed,initialHour:9,software:process.env.SOFTWARE==='1',note:'Actual game renders. Software GPU capture: no performance inference. Scripted review cameras; UI navigation for separate worlds.',rows:[],shadowChecks:[],log:[],external:[]};
const save=()=>fs.writeFileSync(`${out}/checks-${part}${only?'-'+only.join('-'):''}.json`,JSON.stringify(result,null,2));
let browser;
for(const sig of ['SIGTERM','SIGINT'])process.once(sig,async()=>{result.interrupted=sig;save();await browser?.close();process.exit(124);});
const progress=s=>{console.log(new Date().toISOString(),s);save();};
try{
 progress('launch');
 const launched=await launch(`${base}?probe&hour=9`,{w:1280,h:720,settings,seed});
 browser=launched.browser;const {page,log}=launched;result.log=log;result.external=page.__external;
 await waitFor(page,s=>s.state==='title',150000);progress('title ready');
 await page.locator('#title .menu button').first().click();await page.locator('#title .looks button').first().click();
 await page.locator('[data-cinematic-skip]').waitFor({state:'visible',timeout:90000});await page.locator('[data-cinematic-skip]').click();
 await waitFor(page,s=>s.state==='playing',90000);await page.evaluate(()=>window.__pfs.captureHold(true));progress('playing');
 if(part==='main'||part==='review'){
  // Extract this existing probe closure's Game for visibility/shadow sync only.
  const cdp=await page.context().newCDPSession(page);await cdp.send('Debugger.enable');
  const f=await cdp.send('Runtime.evaluate',{expression:'window.__pfs.tick'});
  const b=await cdp.send('Debugger.setBreakpointOnFunctionCall',{objectId:f.result.objectId});
  const paused=new Promise((resolve,reject)=>cdp.once('Debugger.paused',async e=>{try{await cdp.send('Debugger.evaluateOnCallFrame',{callFrameId:e.callFrames[0].callFrameId,expression:'window.__galleryGame=this;true',returnByValue:true});resolve();}catch(err){reject(err);}finally{await cdp.send('Debugger.removeBreakpoint',{breakpointId:b.breakpointId});await cdp.send('Debugger.resume');}}));
  await Promise.all([paused,cdp.send('Runtime.evaluate',{expression:'window.__pfs.tick(0)'})]);await cdp.send('Debugger.disable');
  for(const [name,player,eye,at] of [
   ['punjab-street-neem',[-1,2],[2.8,2.7,-3.5],[-5.3,2.5,7.8]],
   ['punjab-shop-signs',[0,-30],[1.8,2.3,-32],[-7.8,2.5,-23]],
   ['punjab-field-bund',[180,530],[180,3.5,525],[215,1,570]],
   ['kinnow-grove',[280,1294],[278,5,1291],[309,5.4,1313]],
   ['orchard-picnic',[365,1336],[360,9.3,1331],[371,7.7,1344]],
   ['hill-station',[1300,325],[1300,22,312],[1310,20,345]],
   ['canada-arrival',[1108,1748],[1101,3.2,1736],[1110,2.3,1763]],
   ['canada-road-shrubs',[1188,1820],[1188,3.1,1807],[1200,2.1,1837]],
   ['airfield-hangar',[635,1676],[628,3,1663],[635,2.4,1689]],
  ]){
   if(only&&!only.includes(name))continue;
   progress(`stage ${name}`);
   await page.evaluate(({player})=>{window.__pfs.teleport(...player);window.__pfs.tick(1,null);},{player});
   // Streaming work is pumped by real simulation ticks, not fabricated geometry.
   for(let i=0;i<3;i++)await page.evaluate(()=>{const p=window.__pfs,s=p.scene(),render=s.render;s.render=()=>{};try{p.tick(2);}finally{s.render=render;}});
   const row=await page.evaluate(async({eye,at,name})=>{
    const p=window.__pfs,g=window.__galleryGame,s=p.scene(),e=s.getEngine(),V=s.activeCamera.position.constructor;
    const cy=name==='hill-station'?p.snapshot().player.y:0;
    if(name==='hill-station'){eye[1]=cy+5;at[1]=cy+2;}
    p.tick(1,{eye,at});g.world.syncVisibilityAt(new V(...eye));g.world.followShadows(g.playerPos());
    for(let i=0;i<3;i++){e.beginFrame();s.render();e.endFrame();await new Promise(r=>setTimeout(r,0));}e._gl.finish();
    return{name,snapshot:p.snapshot(),eye:s.activeCamera.position.asArray(),at:s.activeCamera.getTarget().asArray(),resolution:[e.getRenderWidth(),e.getRenderHeight()],renderer:e.getInfo(),sceneryReady:g.world.isSceneryReadyAt(new V(...eye)),outerRegions:p.outerRegions()};
   },{eye,at,name});
   await page.screenshot({path:`${out}/${name}.png`,timeout:60000});result.rows.push({...row,captureFile:`${name}.png`});progress(`captured ${name}`);
  }
 }
 if(part!=='main'){
  for(const [name,id,views]of [
   ['Japan','japan',[['japan-street',[1.5,4.3,-27.5],[0,1.35,-17.8]],['japan-pond',[6.5,3.2,22],[10.5,.15,27.5]]]],
   ['China','china',[['china-street',[43,6,-74],[41,1.35,-59]],['china-river',[5,5,10],[-1,0,35]]]],
   ['Neon','neon',[['neon-quay',[4,5.8,-21],[0,1.5,9]]]],
   ['Space','space',[['moon-outpost',null,null]]],
   ['Pixel','pixel',[['pixel-valley',null,null]]],
  ]){
   if(only&&!views.some(([shot])=>only.includes(shot)))continue;
   progress(`navigate ${id}`);await page.getByRole('button',{name:'Worlds: choose a destination'}).click();
   await page.locator('.menu-panel button').filter({hasText:name}).click();const world=page.locator(`[data-${id}-world]`);await world.waitFor({timeout:90000});
   if(id==='space'){await page.locator('[data-space-skip]').click();await page.waitForFunction(()=>document.querySelector('[data-space-world]')?.dataset.spaceReady==='true');}
   if(id!=='pixel'){
    const check=await page.evaluate(async()=>{
     const e=window.__pfs.scene().getEngine(),s=e.scenes.at(-1),maps=s.lights.flatMap(l=>{const g=l.getShadowGenerator?.();return g?.getShadowMap()?[g.getShadowMap()]:[];});
     const counts=maps.map(()=>0),obs=maps.map((m,i)=>m.onAfterRenderObservable.add(()=>counts[i]++));
     const frames=async n=>{for(let i=0;i<n;i++)await new Promise(r=>s.onAfterRenderObservable.addOnce(r));};
     await frames(8);const warm=counts.slice();await frames(12);const after=counts.slice();
     maps.forEach((m,i)=>m.onAfterRenderObservable.remove(obs[i]));
     return{maps:maps.map(m=>({name:m.name,refreshRate:m.refreshRate})),warmupFrames:8,observedFrames:12,warmupRenders:warm,subsequentRenders:after.map((n,i)=>n-warm[i]),metadata:s.metadata?.districtShadowWork};
    });result.shadowChecks.push({id,...check});progress(`shadow observer ${id}: ${JSON.stringify(check.subsequentRenders)}`);
   }
   for(const [shot,eye,at]of views){
    const row=await page.evaluate(async({eye,at,id,shot})=>{
     const e=window.__pfs.scene().getEngine(),s=e.scenes.at(-1);
     if(id==='pixel')return{shot,id,canvas:[...document.querySelectorAll('canvas')].map(c=>({width:c.width,height:c.height})),dataset:{...document.querySelector('[data-pixel-world]').dataset}};
     if(eye)window.__galleryCamera=s.onBeforeRenderObservable.add(()=>{s.activeCamera.position.set(...eye);s.activeCamera.setTarget(new s.activeCamera.position.constructor(...at));s.updateTransformMatrix(true);});
     for(let i=0;i<4;i++)await new Promise(r=>s.onAfterRenderObservable.addOnce(r));e._gl.finish();
     return{shot,id,eye:s.activeCamera.position.asArray(),at:s.activeCamera.getTarget().asArray(),resolution:[e.getRenderWidth(),e.getRenderHeight()],renderer:e.getInfo()};
    },{eye,at,id,shot});
    await page.screenshot({path:`${out}/${shot}.png`,timeout:60000});result.rows.push({...row,captureFile:`${shot}.png`});progress(`captured ${shot}`);
    if(eye)await page.evaluate(()=>{const s=window.__pfs.scene().getEngine().scenes.at(-1);s.onBeforeRenderObservable.remove(window.__galleryCamera);});
   }
   await world.locator(`[data-${id}-return]`).click();await waitFor(page,s=>s.state==='playing',90000);
  }
 }
 result.complete=true;progress('complete');
}catch(error){result.error=String(error.stack??error);save();console.error(error);process.exitCode=1;}finally{await browser?.close();save();}
