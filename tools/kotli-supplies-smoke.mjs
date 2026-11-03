import fs from 'node:fs';
import path from 'node:path';
import { launch, waitFor } from './pt-lib.mjs';
import { instrumentSystems } from './cost-profile-core.mjs';
const base=process.argv[2]??'http://127.0.0.1:4176/';
const seed=fs.readFileSync(process.env.SEED_SAVE,'utf8');
const out=path.join(process.env.OUT??'artifacts/studio/kotli-supplies',new Date().toISOString().replaceAll(':','-'));fs.mkdirSync(out,{recursive:true});
const report={source:process.env.SOURCE,method:'Continue from an earned selection save; teleport to interaction approach points between conversations, use visible interaction and dialogue controls. Mobile viewport emulated, CDP touch on the visible Interact button and pointer dialogue; no uninterrupted journey or device test.',checks:[],errors:[]};
const save=()=>fs.writeFileSync(path.join(out,'checks.json'),JSON.stringify(report,null,2));
const check=(condition,label)=>{if(!condition)throw Error(label);report.checks.push(label);save()};
let run,page,browser,cdp;
async function tick(n=1){await page.evaluate(n=>{const p=window.__pfs,s=p.scene(),r=s.render;s.render=()=>{};try{p.tick(n,null)}finally{s.render=r}},n)}
async function press(){const b=await page.getByRole('button',{name:'Interact',exact:true}).boundingBox();if(!b)throw Error('Touch Interact unavailable');await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{id:77,x:b.x+b.width/2,y:b.y+b.height/2}]});await tick();await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await tick()}
async function choose(label){const b=page.locator('.dialogue button').filter({hasText:label});await b.waitFor({state:'visible',timeout:20000});await b.click();await tick()}
async function capture(name){await page.evaluate(()=>{const s=window.__pfs.scene(),e=s.getEngine();e.beginFrame();s.render();e.endFrame()});await page.screenshot({path:path.join(out,name+'.png')})}
async function approach(id,x,z){for(const [dx,dz,yaw] of [[0,-1.2,0],[-1.2,0,Math.PI/2],[0,1.2,Math.PI],[1.2,0,-Math.PI/2],[0,2,Math.PI]]){await page.evaluate(p=>window.__pfs.teleport(p.x,p.z,p.yaw),{x:x+dx,z:z+dz,yaw});await tick(30);if(await page.evaluate(()=>window.__pfs.snapshot().interactionId)===id)return}throw Error('Cannot reach '+id+': '+JSON.stringify(await page.evaluate(()=>window.__pfs.reach())))}
async function state(){return page.evaluate(()=>({home:window.__costGame.save.home,money:window.__costGame.save.money,rep:window.__costGame.save.rep,save:JSON.parse(localStorage.getItem('pfs.save')),hour:window.__costGame.dayNight.hour,objective:window.__pfs.snapshot().objective}))}
try{
 run=await launch(base+'?probe&hour=10',{w:960,h:540,mobile:true,settings:{quality:'medium',post:false,shadows:'off',renderScale:1},storage:{'pfs.save':seed},seed:0x48192});({page,browser}=run);await waitFor(page,s=>s.state==='title',150000);await page.getByRole('button',{name:'Continue',exact:true}).click();await waitFor(page,s=>s.state==='playing',90000);await page.touchscreen.tap(900,100);await page.evaluate(()=>{window.__pfs.captureHold(true);window.__pfs.weather(false)});cdp=await page.context().newCDPSession(page);await instrumentSystems(cdp,page);await tick(30);
 let q=await state();check(q.save.kotliSelection?.stage==='done','Earned selection receipt restored');
 await approach('kotli_sarpanch',-12,318);await press();await capture('sarpanch-offer');await choose("I'll help");q=await state();check(q.home.kotliSuppliesStep===1&&q.save.home.kotliSuppliesStep===1,'Sarpanch offer accepted and saved');
 await approach('dispensary',22,308.9);await capture('dispensary-approach');await press();await choose("Collect the team's kit");q=await state();check(q.home.kotliSuppliesStep===2&&q.save.home.kotliSuppliesStep===2,'Doctor kit collected and saved');
 const coach=await page.evaluate(()=>({x:window.__costGame.jhagde.ustad.pos.x,z:window.__costGame.jhagde.ustad.pos.z}));await approach('kotli_coach',coach.x,coach.z);await press();await capture('ustad-handoff');await choose('Give Ustad');await choose("I'll tell him");q=await state();check(q.home.kotliSuppliesStep===3&&q.save.home.kotliSuppliesStep===3,'Ustad handoff saved');
 await approach('kotli_sarpanch',-12,318);const before=await state();await press();await choose('Khushi naal');q=await state();check(q.home.kotliSuppliesStep===4&&q.save.home.kotliSuppliesStep===4&&q.money===before.money+60&&q.rep===before.rep+2,'Report and correct reward saved');await press();await choose('Theek hai');const after=await state();check(after.money===q.money&&after.rep===q.rep,'Repeated conversation grants no second reward');check(!run.log.some(s=>/^\[(http|error|pageerror)/.test(s))&&!page.__external.length,'No browser runtime or request errors');report.complete=true;save();
}catch(e){report.errors.push(String(e.stack??e));save();try{await capture('failure')}catch{}process.exitCode=1}finally{await browser?.close()}
