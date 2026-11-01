import fs from 'node:fs';
import {launch,waitFor,clearDialogues}from './pt-lib.mjs';
const out='artifacts/reviewed-cinematics';fs.mkdirSync(out,{recursive:true});
const {browser,page,log}=await launch(`${process.argv[2]??'http://127.0.0.1:4173/'}?probe`,{w:960,h:540,settings:{quality:'medium',post:false,shadows:'off'}});
const checks=[],samples=[];let moved=null;
const render=()=>page.evaluate(()=>new Promise(resolve=>window.__pfs.scene().onAfterRenderObservable.addOnce(()=>resolve())));
const capture=async name=>{await render();samples.push({name,snapshot:await page.evaluate(()=>window.__pfs.snapshot())});await page.screenshot({path:`${out}/${name}.png`});console.log('CAPTURE',name);};
const skip=page.locator('[data-cinematic-skip]');
try {
 await page.waitForFunction(()=>window.__pfs?.snapshot().state==='title',null,{timeout:300000});await page.locator('#title .menu button').first().click();await page.locator('#title .looks button').first().click();
 await skip.waitFor({state:'visible',timeout:180000});await capture('opening-bazaar');await skip.click();await waitFor(page,s=>s.state==='playing',180000);
 await page.evaluate(()=>{window.__pfs.stage(999);window.__pfs.teleport(10.5,21.6,Math.PI/2);});await waitFor(page,s=>s.interactionId==='gurnam',90000);await page.keyboard.press('KeyE');
 await page.locator('.dialogue button').filter({hasText:'Hear about the bus-stand crew'}).click();await page.locator('.dialogue button').filter({hasText:"I'll deal with them"}).click();await skip.waitFor({state:'visible',timeout:60000});
 const accepted=await page.evaluate(()=>JSON.parse(localStorage.getItem('pfs.save')).flags);if(!accepted.crime_active||!accepted.pistol_owned)throw Error('Mission not persisted before film');
 await capture('gurnam-actual-handoff');await skip.click();await waitFor(page,s=>s.state==='playing',90000);checks.push('Real mission acceptance persisted before film; skip restores play');
 for(const [i,x,z]of [[1,9.7,22.5],[2,12.5,24.2],[3,14.0,22.3]]) {
  await page.evaluate(({x,z})=>window.__pfs.teleport(x,z,0),{x,z});
  if(!await page.evaluate(()=>window.__pfs.conversationView('gurnam')))throw Error('Conversation replay setup failed');
  await skip.waitFor({state:'visible'});await capture(`gurnam-position-${i}-start`);
  for(let frame=0;frame<6;frame++)await render();await capture(`gurnam-position-${i}-moving-camera`);
  await skip.click();await waitFor(page,s=>s.state==='playing',90000);
 }
 checks.push('Actual speaker camera at three additional player positions, start and moving-camera captures');
 if(!process.env.GURNAM_ONLY){
 await page.evaluate(()=>window.__pfs.driveAt('car',-227,-165.5,Math.PI/2));await waitFor(page,s=>s.dialogueOpen,90000);await clearDialogues(page);
 await page.evaluate(()=>window.__pfs.placeVehicle(-255,-165.5,Math.PI/2));await waitFor(page,s=>s.state==='playing'&&s.vehicle&&Math.abs(s.vehicle.speed)<0.4,30000);for(let i=0;i<3;i++)await render();
 await page.keyboard.down('KeyW');await page.waitForFunction(()=>window.__pfs.snapshot().chasing,null,{timeout:120000});await page.keyboard.up('KeyW');await page.waitForFunction(()=>document.querySelector('[data-cinematic]')?.hidden===false,null,{timeout:120000});
 const begin=await page.evaluate(()=>window.__pfs.snapshot());
 await page.evaluate(()=>{
  const chunks=[],stream=document.querySelector('canvas').captureStream(12);window.clipRecorder=new MediaRecorder(stream,{mimeType:'video/webm'});window.clipChunks=chunks;
  window.clipRecorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};window.clipRecorder.start();
 });
 await capture('pursuit-shot-0-start');
 await page.evaluate(()=>window.dispatchEvent(new Event('blur')));const frozen=await page.evaluate(()=>window.__pfs.snapshot());await page.waitForTimeout(900);const still=await page.evaluate(()=>window.__pfs.snapshot());
 if(Math.hypot(frozen.vehicle.x-still.vehicle.x,frozen.vehicle.z-still.vehicle.z)>0.02)throw Error('Pursuit advances while unfocused');await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
 for(let i=0;i<6;i++)await render();await capture('pursuit-shot-0-motion');
 await page.waitForFunction(()=>document.querySelector('[data-cinematic]')?.dataset.cinematicShot==='1',null,{timeout:120000});await capture('pursuit-shot-1-relationship');
 await waitFor(page,s=>s.state==='playing',180000);const natural=await page.evaluate(()=>window.__pfs.snapshot());
 moved={player:Math.hypot(natural.vehicle.x-begin.vehicle.x,natural.vehicle.z-begin.vehicle.z),patrol:Math.hypot(natural.pursuer.x-begin.pursuer.x,natural.pursuer.z-begin.pursuer.z)};
 if(moved.player<0.5||moved.patrol<0.5)throw Error(`Pursuit actors did not both move: ${JSON.stringify(moved)}`);
 if(natural.wanted!==begin.wanted||natural.money!==begin.money)throw Error('Film changed wanted/money');
 const clip=await page.evaluate(()=>new Promise(resolve=>{window.clipRecorder.onstop=async()=>{const blob=new Blob(window.clipChunks,{type:'video/webm'}),reader=new FileReader();reader.onload=()=>resolve(reader.result.split(',')[1]);reader.readAsDataURL(blob);};window.clipRecorder.stop();}));fs.writeFileSync(`${out}/moving-pursuit.webm`,Buffer.from(clip,'base64'));
 checks.push(`Actual triggered pursuit: both actors move (${moved.player.toFixed(2)}m / ${moved.patrol.toFixed(2)}m), two live-focus shots, focus pause and natural completion`);
 for(const shot of [0,1]) {
  if(!await page.evaluate(()=>window.__pfs.pursuitView()))throw Error('Active pursuit replay setup failed');
  await skip.waitFor({state:'visible'});if(shot===1)await page.waitForFunction(()=>document.querySelector('[data-cinematic]')?.dataset.cinematicShot==='1',null,{timeout:120000});
  await capture(`pursuit-repeat-skip-${shot}`);await skip.click();await waitFor(page,s=>s.state==='playing',90000);const after=await page.evaluate(()=>window.__pfs.snapshot());if(after.wanted!==begin.wanted||after.money!==begin.money)throw Error('Replay skip changed wanted/money');
 }
 checks.push('Repeated active-pursuit replay safely skipped from either shot; wanted/money retained');
 }
 if(log.some(s=>/^\[(http|error|pageerror)/.test(s))||page.__external.length)throw Error(JSON.stringify({log,external:page.__external}));
 fs.writeFileSync(`${out}/${process.env.GURNAM_ONLY?'gurnam-checks':'checks'}.json`,JSON.stringify({checks,samples,moved,recording:'Unedited canvas capture from software-rendered game; wall-time cadence is not device FPS.',log,external:page.__external},null,2));console.log(JSON.stringify({checks,moved}));
}catch(error){await page.screenshot({path:`${out}/failure.png`}).catch(()=>{});fs.writeFileSync(`${out}/failure.json`,JSON.stringify({error:String(error),checks,samples,last:await page.evaluate(()=>window.__pfs?.snapshot()),log},null,2));throw error;}finally{await browser.close();}
