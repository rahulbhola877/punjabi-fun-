import fs from 'node:fs';
import {launch,waitFor}from './pt-lib.mjs';

// Run in an exclusive browser slot under an outer <=300 s wall timeout.
// Fixtures relocate real destination POIs and park real vehicles; production
// gather/eligibility/selection/callbacks and keyboard/touch input stay intact.
const base=process.argv[2]??'http://127.0.0.1:4195/',mode=process.env.MODE??'fixed',source=process.env.SOURCE??'unverified';
const out=process.env.OUT??`artifacts/interaction-priority/${mode}-${source.slice(0,7)}`;
fs.mkdirSync(out,{recursive:true});
const result={base,source,mode,software:process.env.SOFTWARE==='1',complete:false,checks:[],samples:[],fixtures:[],log:[],external:[],
 scope:'Actual gatherInteractions/deliveryHere and real E/touch callbacks. Temporary real POIS coordinate relocation and prepared Tiffin batch are fixture setup, not natural mission acquisition or a naturally overlapping map location. No fabricated selector candidates. Passenger bells are absent while driving.'};
let browser,page,cdp,frames=0;
const save=()=>fs.writeFileSync(`${out}/checks.json`,JSON.stringify(result,null,2));
const check=(ok,message)=>{if(!ok)throw Error(message);result.checks.push(message);save();console.log(message);};
const read=()=>page.evaluate(()=>{const g=window.__priorityGame,p=g.playerPos(),snapshot=window.__pfs.snapshot();return{
 snapshot,visit:g.doorbell.state,bellPeople:g.crowd.residents.filter(r=>r.id.startsWith('bell_')).map(r=>r.id),
 eligible:g.gatherInteractions().map(it=>{const dx=it.pos.x-p.x,dz=it.pos.z-p.z,centreDistance=Math.hypot(dx,dz),d=it.dist?it.dist(p):centreDistance,dot=dx*Math.sin(g.player.yaw)+dz*Math.cos(g.player.yaw);return{id:it.id,label:it.label,d,radius:it.radius,centreDistance,facing:centreDistance>.01?dot/centreDistance:1,legacyOutlineFacing:d>.01?dot/d:1};}).filter(it=>Number.isFinite(it.d)&&it.d<=it.radius),
 missionEligible:!!g.missions.deliveryHere(),tiffinEligible:!!g.tiffinRun.deliveryHere(),rideEligible:g.rides.dropHere(p),
 money:g.save.money,rep:g.save.rep,deliveries:g.save.stats.deliveries,tiffins:g.save.stats.tiffins,rides:g.save.stats.rides,
 tiffinDone:[...g.ledger.f.tiffinDone],job:!!g.missions.job,batch:g.tiffinRun.batch?.stops.map(c=>c.id)??null,ride:!!g.rides.ride,
};});
async function sample(label){const row={label,...await read()};result.samples.push(row);save();return row;}
async function advance(n=1){if(frames+n>1200)throw Error('1200 manual-frame ceiling exceeded');frames+=n;await page.evaluate(n=>{const p=window.__pfs,s=p.scene(),render=s.render;s.render=()=>{};try{p.tick(n,null);}finally{s.render=render;}},n);}
async function action(touch=false){
 if(touch){
  await cdp.send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:1});
  if(!await page.evaluate(()=>document.body.classList.contains('touch'))){
   // The desktop prompt is initially pointer-inert. Enter touch mode with a
   // neutral real touch before hit-testing its newly positioned touch prompt;
   // the mode-transfer input clear must not consume the action under test.
   const size=page.viewportSize();await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:size.width/2,y:size.height*.45}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await advance(2);
   const entered=await page.evaluate(()=>document.body.classList.contains('touch'));result.fixtures.push({kind:'neutral real touch enters touch mode before action/input-clear transition',entered});check(entered,'Neutral real touch enters touch mode before the actual action');
  }
  const b=await page.locator('.prompt').boundingBox();if(!b)throw Error('No real touch prompt');await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:b.x+b.width/2,y:b.y+b.height/2}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await advance(2);
 }
 else{await page.keyboard.down('KeyE');try{await advance(1);}finally{await page.keyboard.up('KeyE');}await advance(1);}
}
async function closeCompletion(){for(let i=0;i<6;i++){
 const s=await page.evaluate(()=>window.__pfs.snapshot());if(s.state==='playing')return;
 if(s.dialogueOpen)await page.locator('.dialogue button').first().click();
 else if(s.modalOpen)await page.getByRole('button',{name:'Back to work',exact:true}).click();
 else await page.waitForTimeout(50);
 }await page.waitForFunction(()=>window.__pfs.snapshot().state==='playing',null,{timeout:10000});}
async function capture(name){await page.evaluate(()=>{const g=window.__priorityGame,e=g.engine;g.world.syncVisibilityAt(g.cam.camera.position);g.world.followShadows(g.player.feet);e.beginFrame();g.scene.render();e.endFrame();e._gl?.finish();});await page.screenshot({path:`${out}/${name}.png`,timeout:30000});}

async function expose(fnExpression,expression,invoke){
 await cdp.send('Debugger.enable');const f=await cdp.send('Runtime.evaluate',{expression:fnExpression});
 const b=await cdp.send('Debugger.setBreakpointOnFunctionCall',{objectId:f.result.objectId});
 let timer;const paused=new Promise((resolve,reject)=>{timer=setTimeout(()=>reject(Error('CDP fixture inspection timeout')),10000);cdp.once('Debugger.paused',async e=>{try{const r=await cdp.send('Debugger.evaluateOnCallFrame',{callFrameId:e.callFrames[0].callFrameId,expression,returnByValue:true});if(r.exceptionDetails||!r.result.value)throw Error('Actual closure inspection failed');resolve();}catch(error){reject(error);}finally{await cdp.send('Debugger.removeBreakpoint',{breakpointId:b.breakpointId});await cdp.send('Debugger.resume');}});});
 try{await Promise.all([paused,cdp.send('Runtime.evaluate',{expression:invoke})]);}finally{clearTimeout(timer);await cdp.send('Debugger.disable');}
}
async function atGate(){await page.evaluate(()=>{const g=window.__priorityGame,h=window.__priorityHouse,c=Math.cos(h.rot),s=Math.sin(h.rot);window.__pfs.teleport(h.ox+h.gateU*c+2.2*s,h.oz-h.gateU*s+2.2*c,h.rot+Math.PI);});await advance(8);}
async function movePoi(key){return page.evaluate(key=>{const p=window.__priorityGame.player.feet,q=window.__priorityPois[key];window.__prioritySavedPois??={};window.__prioritySavedPois[key]??={x:q.x,z:q.z};const old={x:q.x,z:q.z};q.x=p.x;q.z=p.z;return{key,original:old,relocated:{x:q.x,z:q.z}};},key);}
async function cleanup(){if(!page)return;try{await page.evaluate(()=>{const g=window.__priorityGame;if(!g)return;for(const[key,p]of Object.entries(window.__prioritySavedPois??{}))Object.assign(window.__priorityPois[key],p);g.rides?.end();g.missions.job=null;g.tiffinRun.batch=null;g.setCarrying(false);for(const saved of window.__priorityVehicles??[]){saved.v.placeAt(saved.position,saved.yaw);}window.__pfs.captureHold(false);});}catch(error){result.cleanupError=String(error);}}
for(const signal of['SIGTERM','SIGINT'])process.once(signal,async()=>{result.interrupted=signal;await cleanup();save();await browser?.close();process.exit(124);});

try{
 const run=await launch(`${base}?probe&hour=12`,{w:1280,h:720,settings:{quality:'high',renderer:'webgl',renderScale:1,shadows:'high'},seed:0x5921});({browser,page}=run);result.log=run.log;result.external=page.__external;
 await waitFor(page,s=>s.state==='title',150000);await page.locator('#title .menu button').first().click();await page.locator('#title .looks button').first().click();await page.locator('[data-cinematic-skip]').waitFor({state:'visible',timeout:45000});await page.locator('[data-cinematic-skip]').click();await waitFor(page,s=>s.state==='playing',45000);
 await page.evaluate(()=>{window.__pfs.captureHold(true);window.__pfs.stage(999);window.__pfs.hour(12);});cdp=await page.context().newCDPSession(page);
 await expose('window.__pfs.tick','window.__priorityGame=this;Boolean(this.world&&this.missions)','window.__pfs.tick(0)');
 const body=await page.evaluate(()=>window.__priorityGame.missions.deliveryHere.toString());const binding=/([A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)?)\[this\.job\.dest\.poi\]/.exec(body)?.[1];if(!binding)throw Error(`Cannot inspect actual destination binding: ${body}`);
 await expose('window.__priorityGame.missions.deliveryHere',`window.__priorityPois=${binding};Boolean(window.__priorityPois.laneHouse)`,`window.__priorityGame.missions.deliveryHere()`);
 await page.evaluate(()=>{window.__priorityHouse=window.__pfs.bells().find(h=>h.id==='santH141')??window.__pfs.bells().find(h=>!h.known);window.__priorityVehicles=[];});await atGate();
 const mission=await page.evaluate(()=>{const g=window.__priorityGame,d=g.missions.pickDest();window.__priorityDest=d;return{id:d.id,poi:d.poi};});result.fixtures.push({kind:'real mission destination relocation',...await movePoi(mission.poi)});
 await page.evaluate(()=>window.__priorityGame.missions.startJob(window.__priorityDest));await advance(2);const before=await sample('mission-bell-conflict-before');
 check(before.missionEligible&&before.eligible.some(it=>it.id==='deliver')&&before.eligible.some(it=>it.id.startsWith('bell_')),'Real mission delivery and real gate bell are simultaneously eligible');
 if(mode==='baseline'){
  check(before.snapshot.interactionId?.startsWith('bell_'),'Baseline reproduces bell winning over eligible delivery');await capture('baseline-delivery-hidden-by-bell');result.expectedRegression=true;
 }else{
  check(before.snapshot.interactionId==='deliver','Eligible mission delivery wins the real gate bell');await capture('mission-delivery-over-bell');await action();const delivered=await sample('mission-after-real-E');
  check(!delivered.job&&delivered.deliveries===before.deliveries+1&&delivered.rep>before.rep,'Real E executes finishJob and awards the delivery');check(delivered.bellPeople.length===before.bellPeople.length&&!delivered.visit,'Delivery E did not ring or spawn a bell visitor');await closeCompletion();
  const customer=await page.evaluate(()=>{const g=window.__priorityGame,c=g.tiffinRun.open()[0];if(!c)throw Error('No real daily Tiffin customer');window.__priorityCustomer=c;return{id:c.id,poi:c.poi};});result.fixtures.push({kind:'prepared one-stop real daily Tiffin batch and relocated target',...await movePoi(customer.poi)});
  await page.evaluate(()=>{const g=window.__priorityGame;g.tiffinRun.batch={day:g.save.home.day??0,stops:[window.__priorityCustomer],condition:100};g.setCarrying(true);});await advance(2);const tb=await sample('tiffin-bell-conflict-before-touch');
  check(tb.tiffinEligible&&tb.eligible.some(it=>it.id.startsWith('bell_'))&&tb.snapshot.interactionId==='deliver','Real Tiffin delivery wins the real gate bell');await action(true);const ta=await sample('tiffin-after-real-touch');check(ta.tiffins===tb.tiffins+1&&ta.tiffinDone.includes(customer.id)&&ta.rep>tb.rep,'Real touch executes Tiffin hand-over and updates stats/ledger/reputation');check(!ta.visit,'Touch delivery did not ring the bell');await closeCompletion();
  await page.evaluate(()=>{const g=window.__priorityGame,h=window.__priorityHouse,v=g.vehicles.find(v=>v.spec.type==='bicycle');if(!v)throw Error('No real bicycle');window.__priorityVehicles.push({v,position:v.node.position.clone(),yaw:v.yaw});const c=Math.cos(h.rot),s=Math.sin(h.rot),u=h.gateU;v.placeAt(g.player.feet.clone().set(h.ox+u*c+1*s,g.player.feet.y+.1,h.oz-u*s+1*c),h.rot);window.__priorityBike=v.id;});await advance(10);const bb=await sample('bell-bicycle-coexistence');const bikeId=await page.evaluate(()=>window.__priorityBike);check(bb.eligible.some(it=>it.id.startsWith('bell_'))&&bb.eligible.some(it=>it.id===`veh_${bikeId}`),'Real bell and actual native bicycle both remain eligible');const frontBike=bb.eligible.find(it=>it.id===`veh_${bikeId}`);check(frontBike.facing>.95&&frontBike.legacyOutlineFacing>1.5,'Actual front bicycle has unit centre-facing but inflated legacy outline-facing');check(bb.snapshot.interactionId?.startsWith('bell_'),'Ordinary bell/bicycle preference is preserved after deliveries');await capture('bell-front-bicycle');await action();await advance(100);const firstBell=await sample('bell-first-answer');await action();const repeat=await sample('bell-repeat');check(repeat.visit?.person===firstBell.visit?.person&&repeat.bellPeople.length===firstBell.bellPeople.length,'Repeated bell keeps one answerer and does not enter the bicycle');check(repeat.snapshot.vehicle===null,'Bell E did not enter the bicycle');check(repeat.snapshot.audio.heard.includes('doorbell'),'Repeated real E rings the bell again');
  // Separate passenger coverage: bells are intentionally not gathered while
  // driving. Use real auto-stand pickup/drop-off, not an invented bell conflict.
  await page.evaluate(()=>{const g=window.__priorityGame,v=g.vehicles.find(v=>v.spec.type==='auto');if(!v)throw Error('No real auto');window.__priorityVehicles.push({v,position:v.node.position.clone(),yaw:v.yaw});v.placeAt(v.position.clone().set(0,.25,-80),0);g.enterVehicle(v);});await advance(8);const rb=await sample('real-auto-stand');check(rb.snapshot.interactionId==='sawari','Real stopped auto exposes passenger pickup');await action();check(await page.evaluate(()=>!!window.__priorityGame.rides.ride),'Real E picks up the passenger');
  const drop=await page.evaluate(()=>{const g=window.__priorityGame,q=window.__priorityPois[g.rides.ride.dropPoi];window.__pfs.placeVehicle(q.x,q.z,0);return{poi:g.rides.ride.dropPoi,x:q.x,z:q.z};});result.fixtures.push({kind:'real auto and actual chosen passenger drop target',...drop});await advance(2);const db=await sample('passenger-drop-before');check(db.rideEligible&&db.snapshot.interactionId==='deliver','Real passenger drop-off is eligible and selected');check(!db.eligible.some(it=>it.id.startsWith('bell_')),'Passenger fixture documents bells absent while driving');await action();const da=await sample('passenger-after-real-E');check(!da.ride&&da.rides===db.rides+1&&da.rep>db.rep,'Real E executes passenger drop-off and rewards');
 }
 const final=await sample('final');check(!final.snapshot.errors.length,'No game errors');check(!result.external.length,'No external requests');check(!result.log.some(s=>s.startsWith('[pageerror]')),'No browser page errors');result.frames=frames;result.complete=true;
}catch(error){result.error=String(error);result.frames=frames;try{result.failure=await read();}catch{}process.exitCode=1;}finally{await cleanup();save();await browser?.close();}
