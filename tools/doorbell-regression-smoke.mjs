import fs from 'node:fs';
import {launch,waitFor}from './pt-lib.mjs';
const base=process.argv[2]??'http://127.0.0.1:4191/',out='artifacts/doorbell-regression';
fs.mkdirSync(out,{recursive:true});
const result={base,source:process.env.SOURCE??'1e0ee8100e333398d765d5bd5247d0ed68644b88',software:process.env.SOFTWARE==='1',complete:false,checks:[],rows:[],log:[],external:[],note:'Real E and touch input at gate-centre approaches; manual bounded 30 Hz frames; high quality 1280x720, render scale 1. No device FPS claim.'};
let browser,page,frames=0;
const save=()=>fs.writeFileSync(`${out}/checks.json`,JSON.stringify(result,null,2));
const check=(ok,message)=>{if(!ok)throw Error(message);result.checks.push(message);save();console.log(message);};
for(const signal of['SIGTERM','SIGINT'])process.once(signal,async()=>{result.interrupted=signal;save();await browser?.close();process.exit(124);});
async function advance(n){if(frames+n>1200)throw Error('1200-frame budget exceeded');frames+=n;await page.evaluate(n=>{const p=window.__pfs,s=p.scene(),render=s.render;s.render=()=>{};try{p.tick(n,null);}finally{s.render=render;}},n);}
async function at(h){await page.evaluate(h=>{const c=Math.cos(h.rot),s=Math.sin(h.rot);window.__pfs.teleport(h.ox+h.gateU*c+2.2*s,h.oz-h.gateU*s+2.2*c,h.rot+Math.PI);},h);await advance(8);const row=await page.evaluate(()=>({snapshot:window.__pfs.snapshot(),visit:window.__pfs.visit(),cooling:window.__pfs.bellCooling()}));result.rows.push({house:h.id,phase:'approach',...row});check(row.snapshot.interactionId===`bell_${h.id}`,`${h.id}: real gate-centre prompt wins`);return row;}
async function ring(h,touch=false){if(touch){await page.locator('.prompt').tap();await advance(2);}else{await page.keyboard.down('KeyE');await advance(1);await page.keyboard.up('KeyE');await advance(1);}const row=await page.evaluate(()=>({snapshot:window.__pfs.snapshot(),visit:window.__pfs.visit()}));result.rows.push({house:h.id,phase:touch?'touch-ring':'keyboard-ring',...row});check(row.visit?.house===h.id,`${h.id}: ${touch?'touch':'E'} rings the intended house`);check(row.snapshot.audio.heard.includes('doorbell'),`${h.id}: actual doorbell chime`);return row;}
try{
 const run=await launch(`${base}?probe&hour=9`,{w:1280,h:720,mobile:true,settings:{quality:'high',renderer:'webgl',renderScale:1,shadows:'high'},seed:0x48194});({browser,page}=run);result.log=run.log;result.external=page.__external;
 await waitFor(page,s=>s.state==='title',150000);await page.locator('#title .menu button').first().click();await page.locator('#title .looks button').first().click();
 await page.locator('[data-cinematic-skip]').waitFor({state:'visible',timeout:45000});await page.locator('[data-cinematic-skip]').click();await waitFor(page,s=>s.state==='playing',45000);
 await page.evaluate(()=>{window.__pfs.captureHold(true);window.__pfs.stage(999);});
 const houses=await page.evaluate(()=>window.__pfs.bells()),plain=houses.filter(h=>!h.known&&h.id.startsWith('sant')&&!h.walkIn);
 const approach=h=>({x:h.ox+h.gateU*Math.cos(h.rot)+2.2*Math.sin(h.rot),z:h.oz-h.gateU*Math.sin(h.rot)+2.2*Math.cos(h.rot)});
 let first,second;for(const h of plain){const next=plain.find(q=>q.id!==h.id&&Math.hypot(approach(q).x-h.bell.x,approach(q).z-h.bell.z)<14);if(next){first=h;second=next;break;}}
 check(!!first&&!!second,'Two adjacent unfamiliar homes available');
 await at(first);await ring(first);await advance(65);check(await page.evaluate(()=>window.__pfs.visit()?.stage==='declined'),'First neighbour keeps contextual stranger response');
 const before=await at(second);check(before.cooling.busy,'Second bell remains available while the first visit is busy');await ring(second,true);await advance(100);
 const person=await page.evaluate(()=>window.__pfs.visit()?.person);await ring(second);check((await page.evaluate(()=>window.__pfs.visit()?.person))===person,'Repeated bell keeps one answerer');
 check((await page.evaluate(()=>window.__pfs.bellFolk().length))===1,'Switching bells leaves one owned answerer');
 const known=houses.find(h=>h.known&&h.walkIn&&!h.alwaysOpen);check(!!known,'Known visitable neighbour available');await at(known);await ring(known);
 // The host first rings/opens for 3 s, then walks the real door-to-gate
 // distance at 1.2 m/s. Permit the existing 25 s coming bound, not 6.67 s.
 for(let i=0;i<43;i++){await advance(20);if(await page.evaluate(()=>window.__pfs.snapshot().dialogueOpen))break;}
 check(await page.evaluate(()=>window.__pfs.snapshot().dialogueOpen),'Known neighbour still offers invitation');
 result.invitation=await page.locator('.dialogue').innerText();await page.locator('.dialogue button').last().click();await page.waitForFunction(()=>window.__pfs.snapshot().state==='playing',null,{timeout:10000});
 await page.evaluate(()=>window.__pfs.hour(23));await at(first);await ring(first);await advance(65);check(await page.evaluate(()=>window.__pfs.visit()?.stage==='night'),'Night-time neighbour response remains');
 await page.evaluate(()=>{const p=window.__pfs,e=p.scene().getEngine();e.beginFrame();p.scene().render();e.endFrame();e._gl?.finish();});await page.screenshot({path:`${out}/gate-bell.png`,timeout:30000});
 const final=await page.evaluate(()=>window.__pfs.snapshot());result.final=final;check(!final.errors?.length,'No game errors');check(!result.external.length,'No external requests');check(!result.log.some(s=>s.startsWith('[pageerror]')),'No browser page errors');result.frames=frames;result.complete=true;save();
}catch(e){result.error=String(e);result.frames=frames;try{result.failureState=await page?.evaluate(()=>({snapshot:window.__pfs?.snapshot(),visit:window.__pfs?.visit(),bellFolk:window.__pfs?.bellFolk()}));}catch{}save();process.exitCode=1;}finally{await browser?.close();}
