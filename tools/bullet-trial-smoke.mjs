import fs from 'node:fs';
import { launch, waitFor } from './pt-lib.mjs';
import { instrumentSystems } from './cost-profile-core.mjs';
const base=process.argv[2]??'http://127.0.0.1:4176/',out=process.env.OUT??'artifacts/studio/bullet-trial/browser';fs.mkdirSync(out,{recursive:true});
const result={source:process.env.SOURCE??'unknown',complete:false,method:'New game and intro stage fixture; position owned Bullet at workshop before acceptance. Mission dialogue, mounting, steering, throttle and braking use browser input; simulation ticks accelerated with sparse renders. No checkpoint or reward injection; not ordinary timing or physical device evidence.',checks:[],stages:[],errors:[]};const save=()=>fs.writeFileSync(`${out}/checks.json`,JSON.stringify(result,null,2));let browser,page;
const check=(v,m)=>{if(!v)throw Error(m);result.checks.push(m);save();};
async function tick(n=1){await page.evaluate(n=>{const p=window.__pfs,s=p.scene(),r=s.render;s.render=()=>{};try{p.tick(n,null);}finally{s.render=r;}},n);}
async function press(key='KeyE'){await page.keyboard.down(key);await tick();await page.keyboard.up(key);await tick();}
async function choose(label){const b=page.locator('.dialogue button').filter({hasText:label});await b.waitFor({state:'visible',timeout:20000});await b.click();await tick();}
async function target(id,x,z){for(const [dx,dz,yaw] of [[0,-1.2,0],[-1.2,0,Math.PI/2],[0,1.2,Math.PI],[1.2,0,-Math.PI/2]]){await page.evaluate(p=>window.__pfs.teleport(p.x,p.z,p.yaw),{x:x+dx,z:z+dz,yaw});await tick(10);if((await page.evaluate(()=>window.__pfs.snapshot().interactionId))===id)return;}throw Error(`Cannot select ${id}: ${JSON.stringify(await page.evaluate(()=>window.__pfs.snapshot().player))}`);}
async function release(){for(const k of ['KeyW','KeyS','KeyA','KeyD','Space'])await page.keyboard.up(k);}
async function capture(name){await page.evaluate(()=>{const s=window.__pfs.scene(),e=s.getEngine();e.beginFrame();s.render();e.endFrame();});await page.screenshot({path:`${out}/${name}.png`});}
try{const run=await launch(`${base}?probe&hour=10`,{w:960,h:540,settings:{quality:'medium',post:false,shadows:'off',renderScale:1},seed:0x48192});({browser,page}=run);
 await waitFor(page,s=>s.state==='title',150000);await page.locator('#title .menu button').first().click();await page.locator('#title .looks button').first().click();const skip=page.locator('[data-cinematic-skip]');await skip.waitFor({state:'visible',timeout:90000});await skip.click();await waitFor(page,s=>s.state==='playing',90000);
 await page.evaluate(()=>{window.__pfs.captureHold(true);window.__pfs.stage(999);window.__pfs.weather(false);});const cdp=await page.context().newCDPSession(page);await instrumentSystems(cdp,page);
 // Set up the player's existing bike at the workshop before accepting the test.
 await page.evaluate(()=>{window.__pfs.enterVehicle('bullet_ghar');window.__pfs.placeVehicle(0,40,0);});await tick(60);await press();
 check(!(await page.evaluate(()=>window.__pfs.snapshot().vehicle)),'Setup: Bullet parked and player on foot');
 const g=await page.evaluate(()=>{const r=window.__costGame.crowd.get('gurnam');return{x:r.pos.x,z:r.pos.z};});await target('gurnam',g.x,g.z);await press();await choose("Try Gurnam's Bullet road test");await choose('Steady: slow at both junctions');
 check((await page.evaluate(()=>window.__costGame.save.bulletTrial?.stage))==='preparation','Gurnam offer saves preparation');
 const bp=await page.evaluate(()=>{const v=window.__costGame.vehicles.find(v=>v.id==='bullet_ghar');return{x:v.position.x,z:v.position.z};});await target('veh_bullet_ghar',bp.x,bp.z);await press();await tick(10);
 check((await page.evaluate(()=>window.__costGame.save.bulletTrial?.stage))==='active','Actual interaction mounts Bullet and begins test');
 const points=[[0,80,'pass'],[0,136,'approach'],[20,150,'pass'],[100,150,'brake'],[20,150,'pass'],[0,136,'pass'],[0,80,'approach'],[8.5,24,'stop']];let last=-1,stalled=0,lastPos=null;
 for(let i=0;i<2800;i++){
  const s=await page.evaluate(()=>({snapshot:window.__pfs.snapshot(),trial:window.__costGame.save.bulletTrial,motion:window.__costGame.trialMotion}));
  if(s.trial.stage==='return'){result.stages.push('return');break;}
  if(s.trial.stage!=='active'||!s.snapshot.vehicle)throw Error(`Trial stopped: ${JSON.stringify(s)}`);
  const cp=s.trial.checkpoint;if(cp!==last){last=cp;result.stages.push(cp);save();}
  const v=s.snapshot.vehicle,[x,z,action]=points[cp],dx=x-v.x,dz=z-v.z,d=Math.hypot(dx,dz),err=Math.atan2(Math.sin(Math.atan2(dx,dz)-v.yaw),Math.cos(Math.atan2(dx,dz)-v.yaw));
  if(lastPos&&Math.hypot(v.x-lastPos.x,v.z-lastPos.z)<.015&&d>6)stalled++;else stalled=0;lastPos={x:v.x,z:v.z};
  let targetSpeed=Math.abs(err)>.65?3.2:8;
  if(action==='approach'&&d<15)targetSpeed=3;
  if((action==='brake'||action==='stop')&&d<8)targetSpeed=0;
  if(stalled>45)targetSpeed=-2;
  await release();if(err>.09)await page.keyboard.down('KeyD');else if(err<-.09)await page.keyboard.down('KeyA');
  if(targetSpeed<0)await page.keyboard.down('KeyS');else if(v.speed<targetSpeed-.4)await page.keyboard.down('KeyW');else if(v.speed>targetSpeed+.3)await page.keyboard.down('KeyS');
  await tick(5);
 }
 await release();const trial=await page.evaluate(()=>window.__costGame.save.bulletTrial);check(trial.stage==='return',`Road route completed with actual driving; final ${JSON.stringify(trial)}`);await capture('road-test-complete');
 check(!run.log.some(s=>/^\[(http|error|pageerror)/.test(s))&&!page.__external.length,'No browser runtime or external request errors');result.complete=true;save();
}catch(e){result.errors.push(String(e.stack??e));if(page){result.last=await page.evaluate(()=>({snapshot:window.__pfs?.snapshot(),trial:window.__costGame?.save?.bulletTrial})).catch(()=>null);await page.screenshot({path:`${out}/failure.png`}).catch(()=>{});}save();process.exitCode=1;}finally{await release().catch(()=>{});await browser?.close();}
