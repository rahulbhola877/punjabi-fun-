import fs from 'node:fs';
import { launch, waitFor } from './pt-lib.mjs';
import { instrumentSystems } from './cost-profile-core.mjs';
const base=process.argv[2]??'http://127.0.0.1:4176/';
const out=process.env.OUT??'artifacts/studio/gang-investigation';fs.mkdirSync(out,{recursive:true});
const result={source:process.env.SOURCE??'unknown',complete:false,method:'New game; skip opening; fixture intro stage 999 and teleport near NPCs. Mission choices and progress use keyboard E and visible dialogue; accelerated manual ticks. Not a normal travel or device performance test.',checks:[],errors:[]};
const save=()=>fs.writeFileSync(`${out}/checks.json`,JSON.stringify(result,null,2));
let browser,page;
const check=(v,m)=>{if(!v)throw Error(m);result.checks.push(m);save();};
async function tick(n=1){await page.evaluate(n=>{const p=window.__pfs,s=p.scene(),r=s.render;s.render=()=>{};try{p.tick(n,null);}finally{s.render=r;}},n);}
async function locate(id,npc){
 const areas={conductor:{x:475,z:-88.5},balwant:{x:223.5,z:23.5}};
 if(areas[npc]){await page.evaluate(p=>window.__pfs.teleport(p.x,p.z,0),areas[npc]);}
 let p;
 for(let i=0;i<12;i++) { await tick(30); p=await page.evaluate(id=>{const r=window.__costGame.crowd.get(id);return r&&{x:r.pos.x,z:r.pos.z};},npc); if(p) break; }
 if(!p)throw Error(`Missing NPC ${npc}`);
 for(const [dx,dz,yaw] of [[0,-1.2,0],[-1.2,0,Math.PI/2],[0,1.2,Math.PI],[1.2,0,-Math.PI/2]]){
  await page.evaluate(p=>window.__pfs.teleport(p.x,p.z,p.yaw),{x:p.x+dx,z:p.z+dz,yaw});await tick(8);
  if((await page.evaluate(()=>window.__pfs.snapshot().interactionId))===id)return;
 }
 throw Error(`Cannot select ${id}: ${JSON.stringify(await page.evaluate(()=>window.__pfs.reach()))}`);
}
async function press(){await page.keyboard.down('KeyE');await tick();await page.keyboard.up('KeyE');await tick();}
async function choose(label){const b=page.locator('.dialogue button').filter({hasText:label});await b.waitFor({state:'visible',timeout:20000});await b.click();}
async function stage(value){await page.waitForFunction(s=>window.__pfs.crime().stage===s,value,{timeout:20000});const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('pfs.save')));check(!!saved?.flags?.crime_active || value==='done',`${value}: checkpoint persisted`);}
async function snap(name){await page.evaluate(()=>{const s=window.__pfs.scene(),e=s.getEngine();e.beginFrame();s.render();e.endFrame();});await page.screenshot({path:`${out}/${name}.png`});}
try{
 const run=await launch(`${base}?probe&hour=10`,{w:960,h:540,settings:{quality:'medium',post:false,shadows:'off',renderScale:1},seed:0x48192});({browser,page}=run);
 await waitFor(page,s=>s.state==='title',150000);await page.locator('#title .menu button').first().click();await page.locator('#title .looks button').first().click();
 const skip=page.locator('[data-cinematic-skip]');await skip.waitFor({state:'visible',timeout:90000});await skip.click();await waitFor(page,s=>s.state==='playing',90000);
 await page.evaluate(()=>{window.__pfs.captureHold(true);window.__pfs.stage(999);window.__pfs.weather(false);});
 const cdp=await page.context().newCDPSession(page);await instrumentSystems(cdp,page);
 await locate('gurnam','gurnam');await press();await choose('Hear about the bus-stand crew');await choose('Ask Bittu and Balwant');
 await skip.waitFor({state:'visible',timeout:30000});await skip.click();await waitFor(page,s=>s.state==='playing',30000);await stage('witness');
 await locate('gang_witness','conductor');await press();await choose("I'll tell Balwant");await stage('police');
 await locate('gang_police','balwant');await press();await choose('Thank you');await stage('return');
 const before=await page.evaluate(()=>window.__costGame.save.rep);await locate('gurnam','gurnam');await press();await choose('Shukriya');await stage('done');
 const after=await page.evaluate(()=>({rep:window.__costGame.save.rep,flags:window.__costGame.save.flags}));check(after.rep===before+15,'Gurnam pays the completion reputation once');check(after.flags.crime_complete&&after.flags.crime_peaceful,'Noncombat resolution saved');await snap('investigation-complete');
 check(!run.log.some(s=>/^\[(http|error|pageerror)/.test(s))&&!page.__external.length,'No browser runtime or external request errors');result.complete=true;save();
}catch(e){result.errors.push(String(e.stack??e));if(page)await page.screenshot({path:`${out}/failure.png`}).catch(()=>{});save();process.exitCode=1;}finally{await page?.keyboard.up('KeyE').catch(()=>{});await browser?.close();}
