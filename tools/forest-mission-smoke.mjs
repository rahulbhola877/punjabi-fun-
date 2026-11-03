import fs from 'node:fs';
import {launch,waitFor} from './pt-lib.mjs';
import {instrumentSystems} from './cost-profile-core.mjs';

// Run only in an exclusive browser slot, under an outer wall-time timeout.
// Mission progress/rewards come exclusively from E and visible dialogue buttons.
const base=process.argv[2]??'http://127.0.0.1:4190/';
const out=process.env.OUT??'artifacts/forest-mission';
fs.mkdirSync(out,{recursive:true});
const result={base,source:process.env.SOURCE??'3839962',complete:false,software:process.env.SOFTWARE==='1',
  setup:'New game; skip opening; intro stage999; terrain-aware teleports; dry weather; advance saved day by one for review. No forest stage/flag writes, direct interaction calls or reward injection.',
  note:'Actual final-build game and native contacts. Bounded manual30Hz ticks with sparse renders; no device FPS or performance claim.',
  checks:[],stages:[],samples:[],captures:[],log:[],external:[]};
let browser,page,manualFrames=0;
const save=()=>fs.writeFileSync(`${out}/checks.json`,JSON.stringify(result,null,2));
const check=(condition,message)=>{if(!condition)throw Error(message);result.checks.push(message);save();};
const progress=message=>{console.log(new Date().toISOString(),message);save();};
for(const signal of ['SIGTERM','SIGINT'])process.once(signal,async()=>{
  result.interrupted=signal;save();await browser?.close();process.exit(124);
});

async function advance(frames=1){
  if(!Number.isInteger(frames)||frames<0||frames>120||manualFrames+frames>900)throw Error('Forest manual-frame budget exceeded');
  manualFrames+=frames;
  await page.evaluate(n=>{
    const probe=window.__pfs,scene=probe.scene(),render=scene.render;
    scene.render=()=>{};
    try{for(let i=0;i<n;i++)probe.tick(1,null);}finally{scene.render=render;}
  },frames);
}

async function sample(name){
  const row=await page.evaluate(name=>{
    const g=window.__costGame,p=window.__pfs,scene=p.scene(),feet=g.player.feet;
    const forest=g.forestWater,saved=JSON.parse(localStorage.getItem('pfs.save'));
    const logs=Array.from({length:3},(_,i)=>scene.getMeshByName(`forest_water_log_${i}`));
    const rayBodies=logs.map(log=>{
      const above=log.position.clone();above.y+=2;
      const below=log.position.clone();below.y-=2;
      return g.physics.raycast(above,below,1)?.body?.transformNode.name??null;
    });
    return{name,state:g.state,stage:g.save.home.forestWaterStage??0,persistedStage:saved?.home?.forestWaterStage??0,
      rep:g.save.rep,money:g.save.money,feet:feet.asArray(),grounded:g.player.grounded,swimming:g.player.swimming,
      surface:forest.surfaceYAt(feet.x,feet.z),depth:forest.depthAt(feet.x,feet.z,feet.y),wadeMul:g.wadeMul,shallowWet:g.shallowWet,
      interaction:p.snapshot().interactionId,objective:p.snapshot().objective,
      logs:logs.map(log=>({name:log.name,enabled:log.isEnabled(),bodyDisposed:log.physicsBody?.isDisposed??null})),rayBodies,
      originalBodiesDisposed:window.__forestLogBodies?.map(body=>body.isDisposed)??null,
      water:['forest_spring_water','forest_pool_water','forest_hillside_water'].map(name=>{const mesh=scene.getMeshByName(name);return{name,enabled:mesh?.isEnabled(),visible:mesh?.isVisible,vertices:mesh?.getTotalVertices()};}),
      ripples:scene.meshes.filter(mesh=>/^contactRipple\d+$/.test(mesh.name)&&mesh.isEnabled()).map(mesh=>({name:mesh.name,position:mesh.position.asArray(),surface:forest.surfaceYAt(mesh.position.x,mesh.position.z)})),
      errors:p.snapshot().errors};
  },name);
  result.samples.push(row);save();return row;
}

async function stage(expected,label){
  await page.waitForFunction(n=>(window.__costGame.save.home.forestWaterStage??0)===n,expected,{timeout:10000});
  const row=await sample(label);
  check(row.stage===expected&&row.persistedStage===expected,`${label}: stage${expected} reached and persisted through real interaction`);
  result.stages.push(expected);save();return row;
}

async function atInteraction(id,x,z){
  let last;
  for(const [dx,dz] of [[0,0],[0,-1],[1,0],[-1,0],[0,1]]){
    await page.evaluate(({x,z})=>window.__pfs.teleport(x,z,0),{x:x+dx,z:z+dz});
    await advance(8);
    last=await page.evaluate(()=>({snapshot:window.__pfs.snapshot(),reach:window.__pfs.reach()}));
    if(last.snapshot.interactionId===id)return;
  }
  throw Error(`Cannot naturally reach ${id}: ${JSON.stringify(last)}`);
}

async function pressE(){
  await page.keyboard.down('KeyE');
  try{await advance(1);}finally{await page.keyboard.up('KeyE');}
  await advance(1);
}

async function choose(label){
  const button=page.locator('.dialogue button').filter({hasText:label});
  await button.waitFor({state:'visible',timeout:10000});await button.click();
  await page.waitForFunction(()=>window.__pfs.snapshot().state==='playing',null,{timeout:10000});
  await advance(1);
}

async function capture(name){
  await page.evaluate(async()=>{
    const probe=window.__pfs,g=window.__costGame,scene=probe.scene(),engine=scene.getEngine();
    g.world.syncVisibilityAt(g.cam.camera.position);g.world.followShadows(g.player.feet);
    for(let i=0;i<2;i++){engine.beginFrame();scene.render();engine.endFrame();await new Promise(resolve=>setTimeout(resolve,0));}
    engine._gl?.finish();
  });
  await page.screenshot({path:`${out}/${name}.png`,timeout:30000});
  result.captures.push(`${name}.png`);save();progress(`captured ${name}`);
}

try{
  progress('launch');
  const run=await launch(`${base}?probe&hour=9`,{w:1280,h:720,settings:{quality:'high',renderer:'webgl',renderScale:1,shadows:'high'},seed:0x48192});
  ({browser,page}=run);result.log=run.log;result.external=page.__external;
  await waitFor(page,s=>s.state==='title',150000);
  await page.locator('#title .menu button').first().click();await page.locator('#title .looks button').first().click();
  const skip=page.locator('[data-cinematic-skip]');await skip.waitFor({state:'visible',timeout:90000});await skip.click();
  await waitFor(page,s=>s.state==='playing',90000);
  await page.evaluate(()=>{window.__pfs.captureHold(true);window.__pfs.stage(999);window.__pfs.weather(false);});
  const cdp=await page.context().newCDPSession(page);await instrumentSystems(cdp,page);
  const initial=await sample('initial');check(initial.stage===0,'Forest progress starts at0 without injected mission flags');

  await atInteraction('forest_ranger',-895,1900);await pressE();await choose("I'll help");
  await stage(1,'accepted');await capture('01-ranger-accepted');
  await atInteraction('forest_channel',-883,1909);await pressE();
  const blocked=await stage(2,'inspected');
  check(blocked.logs.every(log=>log.enabled&&log.bodyDisposed===false),'All3 visible branches have live native contacts before clearing');
  check(blocked.rayBodies.every(name=>/^forest_water_log_/.test(name??'')),'Native downward rays hit the rendered obstruction logs');
  await page.evaluate(()=>{window.__forestLogBodies=Array.from({length:3},(_,i)=>window.__pfs.scene().getMeshByName(`forest_water_log_${i}`).physicsBody);});

  await atInteraction('forest_blockage',-874,1918);await pressE();
  const cleared=await stage(3,'cleared');
  check(cleared.logs.every(log=>!log.enabled)&&cleared.originalBodiesDisposed.every(Boolean),'Clearing through E disables all3 logs and disposes their original native bodies');
  check(cleared.rayBodies.every(name=>name==='ridge_collider'),'Cleared log rays immediately reach the actual ridge instead of stale collision');
  await capture('02-branches-cleared');

  await atInteraction('forest_gate',-867,1928);await pressE();await choose('Woodland pool for wildlife');
  const opened=await stage(4,'pool-chosen');
  check(opened.water[0].enabled&&opened.water[0].visible&&opened.water[1].enabled&&opened.water[1].visible&&!opened.water[2].enabled,'Gate choice enables the visible common stream and woodland pool while hillside stays closed');

  await page.evaluate(()=>window.__pfs.teleport(-890,1904,0));await advance(8);
  const wet=await sample('pool-immersion');
  check(wet.grounded&&!wet.swimming&&wet.depth>.05&&wet.depth<.24&&wet.wadeMul<1&&wet.shallowWet,'Actual grounded pool entry produces shallow wading without swimming');
  check(wet.ripples.some(r=>r.surface!==null&&Math.abs(r.position[1]-r.surface-.025)<.002),'Natural shallow entry creates a ripple on the actual stream surface');
  const geometry=await page.evaluate(()=>{
    const g=window.__costGame,forest=g.forestWater,feet=g.player.feet,mesh=g.scene.getMeshByName('forest_pool_water');
    const p=mesh.getVerticesData('position'),indices=mesh.getIndices();let visualY=-Infinity;
    for(let i=0;i<indices.length;i+=3){
      const a=indices[i]*3,b=indices[i+1]*3,c=indices[i+2]*3,ax=p[a],az=p[a+2],bx=p[b],bz=p[b+2],cx=p[c],cz=p[c+2];
      const d=(bz-cz)*(ax-cx)+(cx-bx)*(az-cz);if(Math.abs(d)<1e-12)continue;
      const u=((bz-cz)*(feet.x-cx)+(cx-bx)*(feet.z-cz))/d,v=((cz-az)*(feet.x-cx)+(ax-cx)*(feet.z-cz))/d,w=1-u-v;
      if(u>=-1e-8&&v>=-1e-8&&w>=-1e-8)visualY=Math.max(visualY,u*p[a+1]+v*p[b+1]+w*p[c+1]);
    }
    return{queryY:forest.surfaceYAt(feet.x,feet.z),visualY:Number.isFinite(visualY)?visualY:null,
      unselectedOutlet:forest.surfaceYAt(-879,1904.5),outsidePool:forest.surfaceYAt(-888.69,1904)};
  });
  result.geometry=geometry;
  check(geometry.visualY!==null&&Math.abs(geometry.visualY-geometry.queryY)<1e-5,'Immersion query matches the actual rendered Float32 pool triangles');
  check(geometry.unselectedOutlet===null&&geometry.outsidePool===null,'Unselected hillside and points beyond the visual pool edge stay dry');
  await capture('03-pool-wading');

  await page.keyboard.down('Space');try{await advance(6);}finally{await page.keyboard.up('Space');}
  const raised=await sample('jump-feet-above-water');
  check(!raised.grounded&&raised.surface!==null&&raised.feet[1]>raised.surface&&raised.depth===0&&raised.wadeMul===1&&!raised.shallowWet,'Real jump raises feet above the pool and removes wading depth immediately');
  await advance(60);

  await atInteraction('forest_ranger',-895,1900);const beforeReward=await sample('before-report');
  await pressE();await choose('Glad to help');const reward=await stage(6,'rewarded');
  check(reward.rep===beforeReward.rep+3&&reward.money===beforeReward.money,'Reporting the real repair awards exactly3 reputation and no cash');
  await capture('04-repair-complete');
  await pressE();await choose('See you tomorrow');const replay=await sample('completed-dialogue-replay');
  check(replay.stage===6&&replay.rep===reward.rep&&replay.money===reward.money,'Replaying completed ranger dialogue awards no duplicate reputation or money');
  // Fixture advances the calendar only; the outlet is changed through the visible interaction.
  await page.evaluate(()=>{window.__costGame.save.home.day=(window.__costGame.save.home.day??0)+1;});
  await pressE();await choose('Open the hillside trickle');const switched=await stage(7,'next-day-hillside-review');
  check(switched.water[0].enabled&&!switched.water[1].enabled&&switched.water[2].enabled,'Next-day dialogue switches the visible stream to the hillside');
  check(switched.rep===reward.rep&&switched.money===reward.money,'Changing the outlet pays no second reward');
  await capture('05-hillside-review');
  check(result.stages.join(',')==='1,2,3,4,6,7','Mission and next-day review progress through E and visible dialogue choices');
  check(result.samples.every(row=>!row.errors?.length),'No game tick errors during the complete forest mission');
  check(!result.log.some(line=>/^\[(http|error|pageerror)/.test(line))&&!result.external.length,'No browser runtime/HTTP errors or external requests');
  result.manualFrames=manualFrames;result.complete=true;save();progress('complete');
}catch(error){
  result.error=String(error.stack??error);result.manualFrames=manualFrames;
  if(page){result.last=await page.evaluate(()=>window.__pfs?.snapshot()).catch(()=>null);await page.screenshot({path:`${out}/failure.png`,timeout:15000}).catch(()=>{});}
  save();console.error(error);process.exitCode=1;
}finally{
  await page?.keyboard.up('KeyE').catch(()=>{});await page?.keyboard.up('Space').catch(()=>{});
  await browser?.close();save();
}
