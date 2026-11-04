import fs from 'node:fs';
import path from 'node:path';
import { launch, waitFor } from './pt-lib.mjs';
import { instrumentSystems } from './cost-profile-core.mjs';
const base=process.argv[2]??'http://127.0.0.1:4176/';
const seed=fs.readFileSync(process.env.SEED_SAVE,'utf8');
const out=path.join(process.env.OUT??'artifacts/studio/kotli-tractor',new Date().toISOString().replaceAll(':','-'));fs.mkdirSync(out,{recursive:true});
const report={source:process.env.SOURCE,method:'Continue from earned team-kit save; teleport between interaction areas, use mobile CDP touch to enter and accelerate, then use debug raceRun to simulate the remainder of the lap. This is not a physical device or manually driven full race.',checks:[],errors:[]};
const save=()=>fs.writeFileSync(path.join(out,'checks.json'),JSON.stringify(report,null,2));
const check=(condition,label)=>{if(!condition)throw Error(label);report.checks.push(label);save()};
let run,page,browser,cdp;
async function tick(n=1){await page.evaluate(n=>{const p=window.__pfs,s=p.scene(),r=s.render;s.render=()=>{};try{p.tick(n,null)}finally{s.render=r}},n)}
async function press(){const b=await page.getByRole('button',{name:'Interact',exact:true}).boundingBox();if(!b)throw Error('Touch Interact unavailable');await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{id:77,x:b.x+b.width/2,y:b.y+b.height/2}]});await tick();await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await tick()}
async function choose(label){const b=page.locator('.dialogue button').filter({hasText:label});await b.waitFor({state:'visible',timeout:20000});await b.click();await tick()}
async function capture(name){await page.evaluate(()=>{const s=window.__pfs.scene(),e=s.getEngine();e.beginFrame();s.render();e.endFrame()});await page.screenshot({path:path.join(out,name+'.png')})}
async function approach(id,x,z){for(const [dx,dz,yaw] of [[0,-1.2,0],[-1.2,0,Math.PI/2],[0,1.2,Math.PI],[1.2,0,-Math.PI/2],[0,2,Math.PI]]){await page.evaluate(p=>window.__pfs.teleport(p.x,p.z,p.yaw),{x:x+dx,z:z+dz,yaw});await tick(30);if(await page.evaluate(()=>window.__pfs.snapshot().interactionId)===id)return}throw Error('Cannot reach '+id+': '+JSON.stringify(await page.evaluate(()=>window.__pfs.reach())))}
async function walkTo(x,z){
 for(let i=0;i<300;i++){
  const snap=await page.evaluate(()=>window.__pfs.snapshot()),p=snap.player,dx=x-p.x,dz=z-p.z;
  if(Math.hypot(dx,dz)<1.2)return;
  const angle=Math.atan2(dx,dz)-snap.camYaw,oct=Math.round(Math.atan2(Math.sin(angle),Math.cos(angle))/(Math.PI/4));
  const keys={0:['KeyW'],1:['KeyW','KeyD'],2:['KeyD'],3:['KeyS','KeyD'],4:['KeyS'],'-4':['KeyS'],'-3':['KeyS','KeyA'],'-2':['KeyA'],'-1':['KeyW','KeyA']}[oct]??['KeyW'];
  for(const k of keys)await page.keyboard.down(k);await tick(3);for(const k of keys)await page.keyboard.up(k);
 }
 throw Error('Could not walk through dispensary gate: '+JSON.stringify(await page.evaluate(()=>window.__pfs.snapshot().player)));
}
async function state(){return page.evaluate(()=>({home:window.__costGame.save.home,money:window.__costGame.save.money,rep:window.__costGame.save.rep,save:JSON.parse(localStorage.getItem('pfs.save')),hour:window.__costGame.dayNight.hour,objective:window.__costGame.currentObjective()}))}
try{
 run=await launch(base+'?probe&hour=10',{w:960,h:540,mobile:true,settings:{quality:'medium',post:false,shadows:'off',renderScale:1},storage:{'pfs.save':seed},seed:0x48192});({page,browser}=run);await waitFor(page,s=>s.state==='title',150000);await page.getByRole('button',{name:'Continue',exact:true}).click();await waitFor(page,s=>s.state==='playing',90000);await page.touchscreen.tap(900,100);await page.evaluate(()=>{window.__pfs.captureHold(true);window.__pfs.weather(false)});cdp=await page.context().newCDPSession(page);await instrumentSystems(cdp,page);await tick(30);
 let q=await state();check(q.save.kotliSelection?.stage==='done'&&q.home.kotliSuppliesStep===4,'Earned selection and team-kit receipt restored');
 await approach('kotli_sarpanch',-12,318);await press();const choice=process.env.CHOICE==='purse'?'Purse:':'Kotli:';await choose(choice);q=await state();check(q.save.tractorSponsorship?.stage==='ready','Sponsorship choice saved');
 await approach('tractorRace',-607,-412);await press();await choose('Sponsored race');q=await state();check(q.save.tractorSponsorship?.stage==='racing','Sponsored start saved after grid admission');
 let objective=await page.evaluate(()=>window.__costGame.currentObjective());check(objective?.title?.includes('Tractor race'),'Race objective exposes next gate');await capture('race-start');
 await tick(210);const gas=await page.getByRole('button',{name:'Accelerate',exact:true}).boundingBox();check(!!gas,'Mobile accelerator visible');const before=await page.evaluate(()=>window.__pfs.snapshot().vehicle);await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{id:79,x:gas.x+gas.width/2,y:gas.y+gas.height/2}]});await tick(120);await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await tick();const after=await page.evaluate(()=>window.__pfs.snapshot().vehicle);report.drive={before,after};check(Math.hypot(after.x-before.x,after.z-before.z)>1,'Visible mobile accelerator moves tractor');await capture('race-driving');
 await page.evaluate(()=>window.__pfs.raceRun(240,11));await tick(2);q=await state();check(q.home&&q.save.tractorSponsorship?.stage==='report','Assisted simulated lap records qualifying result');const result=page.getByRole('button',{name:'Shabaash',exact:true});await result.waitFor({state:'visible',timeout:15000});await result.click();await tick();const brake=await page.getByRole('button',{name:'Brake and reverse',exact:true}).boundingBox();await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{id:80,x:brake.x+brake.width/2,y:brake.y+brake.height/2}]});await tick(180);await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await tick(45);await press();await tick(20);check(!(await page.evaluate(()=>window.__pfs.snapshot().vehicle)),'Player exits tractor before reporting');
 await approach('kotli_sarpanch',-12,318);const prior=await state();await press();await choose('Shukriya ji');q=await state();const village=process.env.CHOICE!=='purse';check(q.save.tractorSponsorship?.stage==='done'&&q.money===prior.money+(village?100:300)&&q.rep===prior.rep+(village?8:2),'Visible report records correct choice reward');await press();await choose('Later');const repeated=await state();check(repeated.money===q.money&&repeated.rep===q.rep,'Repeat conversation grants no duplicate reward');check(!run.log.some(s=>/^\[(http|error|pageerror)/.test(s))&&!page.__external.length,'No browser runtime or request errors');fs.writeFileSync(path.join(out,'earned-save.json'),await page.evaluate(()=>localStorage.getItem('pfs.save')));report.complete=true;save();
}catch(e){report.errors.push(String(e.stack??e));save();try{await capture('failure')}catch{}process.exitCode=1}finally{await browser?.close()}
