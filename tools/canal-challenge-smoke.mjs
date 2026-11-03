import fs from 'node:fs';
import { launch, waitFor } from './pt-lib.mjs';
import { instrumentSystems } from './cost-profile-core.mjs';
const base=process.argv[2]??'http://127.0.0.1:4176/',out=process.env.OUT??'artifacts/studio/canal-challenge';fs.mkdirSync(out,{recursive:true});
const result={source:process.env.SOURCE??'unknown',complete:false,method:'New game, opening skipped; teleport near ghat and Amar, actual E/dialogue and simulated throws. Camera held for repeatable aim; simulation advanced with manual ticks. No challenge state or reward injection; not an ordinary walking or hardware test.',checks:[],errors:[]};
const save=()=>fs.writeFileSync(`${out}/checks.json`,JSON.stringify(result,null,2));let browser,page;
const check=(v,m)=>{if(!v)throw Error(m);result.checks.push(m);save();};
async function tick(n=1){await page.evaluate(n=>{const p=window.__pfs,s=p.scene(),r=s.render;s.render=()=>{};try{p.tick(n,null);}finally{s.render=r;}},n);}
async function press(){await page.keyboard.down('KeyE');await tick();await page.keyboard.up('KeyE');await tick();}
async function choose(label){const b=page.locator('.dialogue button').filter({hasText:label});await b.waitFor({state:'visible',timeout:20000});await b.click();await tick();}
async function amar(){await page.evaluate(()=>window.__pfs.teleport(41,184.5,0));let p;for(let i=0;i<12;i++){await tick(30);p=await page.evaluate(()=>{const r=window.__costGame.crowd.get('canalAmar');return r&&{x:r.pos.x,z:r.pos.z};});if(p)break;}if(!p)throw Error('Amar did not stream');
 for(const [dx,dz,yaw] of [[0,-1.2,0],[-1.2,0,Math.PI/2],[0,1.2,Math.PI],[1.2,0,-Math.PI/2]]){await page.evaluate(p=>window.__pfs.teleport(p.x,p.z,p.yaw),{x:p.x+dx,z:p.z+dz,yaw});await tick(8);if((await page.evaluate(()=>window.__pfs.snapshot().interactionId))==='canal_challenge')return;}throw Error(`Amar prompt unavailable: ${JSON.stringify(await page.evaluate(()=>window.__pfs.reach()))}`);}
async function capture(name){await page.evaluate(()=>{const s=window.__pfs.scene(),e=s.getEngine();e.beginFrame();s.render();e.endFrame();});await page.screenshot({path:`${out}/${name}.png`});}
try{const run=await launch(`${base}?probe&hour=10`,{w:960,h:540,settings:{quality:'medium',post:false,shadows:'off',renderScale:1},seed:0x48192});({browser,page}=run);
 await waitFor(page,s=>s.state==='title',150000);await page.locator('#title .menu button').first().click();await page.locator('#title .looks button').first().click();const skip=page.locator('[data-cinematic-skip]');await skip.waitFor({state:'visible',timeout:90000});await skip.click();await waitFor(page,s=>s.state==='playing',90000);
 await page.evaluate(()=>{window.__pfs.captureHold(true);window.__pfs.weather(false);});const cdp=await page.context().newCDPSession(page);await instrumentSystems(cdp,page);
 await amar();await press();await choose('Three skips');let saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('pfs.save')));check(saved.home.canalChallengeTarget===3&&saved.home.canalChallengeStage===1,'Amar offer starts and saves selected target');
 await page.evaluate(()=>window.__pfs.teleport(45,185.5,Math.PI));await tick(20);
 for(let i=0;i<150;i++){
  const s=await page.evaluate(()=>window.__pfs.snapshot()),dx=45-s.player.x,dz=180.5-s.player.z;
  if(Math.hypot(dx,dz)<1)break;
  const rel=Math.atan2(Math.sin(Math.atan2(dx,dz)-s.camYaw),Math.cos(Math.atan2(dx,dz)-s.camYaw)),oct=Math.round(rel/(Math.PI/4));
  const map={0:['KeyW'],1:['KeyW','KeyD'],2:['KeyD'],3:['KeyS','KeyD'],4:['KeyS'],'-4':['KeyS'],'-3':['KeyS','KeyA'],'-2':['KeyA'],'-1':['KeyW','KeyA']},keys=map[oct]??['KeyW'];
  for(const key of keys)await page.keyboard.down(key);await tick(4);for(const key of keys)await page.keyboard.up(key);await tick(1);
 }
 await page.evaluate(()=>window.__pfs.holdCamera({eye:{x:45,y:4,z:188.5},at:{x:37.2,y:.5,z:170.3},fov:.82}));await tick(20);
 for(let i=1;i<=3;i++){
  const s=await page.evaluate(()=>window.__pfs.snapshot());check(s.player.grounded!==false,`Throw ${i}: supported landing`);
  if(s.interactionId!=='canal_skip')throw Error(`Throw ${i}: ghat prompt unavailable; selected ${s.interactionId}, player ${JSON.stringify(s.player)}`);
  check(true,`Throw ${i}: real ghat prompt available`);await press();
  check(await page.evaluate(()=>window.__pfs.canalSkipping().active),`Throw ${i}: real stone animation started`);
  for(let j=0;j<18&&await page.evaluate(()=>window.__pfs.canalSkipping().active);j++)await tick(20);
  check(!(await page.evaluate(()=>window.__pfs.canalSkipping().active)),`Throw ${i}: completed`);
  saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('pfs.save')));check(saved.home.canalChallengeThrows===i,`Throw ${i}: result checkpointed`);
 }
 await page.evaluate(()=>window.__pfs.holdCamera(null));await amar();await press();await choose('Shukriya');saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('pfs.save')));
 check(saved.home.canalChallengeStage===0&&saved.home.canalChallengeRelationship===1,'Successful result and relationship receipt saved');check(saved.people.canalAmar?.rep===1,'Amar relationship increased once');await capture('amar-challenge-complete');
 check(!run.log.some(s=>/^\[(http|error|pageerror)/.test(s))&&!page.__external.length,'No browser runtime or external request errors');result.complete=true;save();
}catch(e){result.errors.push(String(e.stack??e));if(page)await page.screenshot({path:`${out}/failure.png`}).catch(()=>{});save();process.exitCode=1;}finally{await page?.keyboard.up('KeyE').catch(()=>{});await browser?.close();}
