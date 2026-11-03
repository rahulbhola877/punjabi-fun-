import fs from 'node:fs';
import { launch,waitFor,sleep } from './pt-lib.mjs';
const base=process.argv[2]??'http://127.0.0.1:4173/';
const out=process.env.OUT??'artifacts/controls-reviewed';fs.mkdirSync(out,{recursive:true});
const metadata={source:process.env.SOURCE??'unrecorded',base,viewport:{width:960,height:540},renderScale:1,software:process.env.SOFTWARE==='1',scope:'Rendered-world input checks; CDP touch and injected standard gamepad state, not physical-device validation.'};
const {browser,page,log}=await launch(`${base}?probe`,{w:960,h:540,settings:{quality:'medium',post:false,renderScale:1},storage:{'pfs.keys.v1':JSON.stringify({forward:['KeyZ','ArrowUp'],interact:['KeyT','KeyF'],map:['KeyO']})},mobile:true});
const checks=[],controlSamples=[];
try{
 page.on('console',m=>{if(m.type()==='error')console.log('ERROR',m.text());});
 await page.waitForFunction(()=>window.__pfs?.snapshot().state==='title',null,{timeout:300000});
 await page.locator('#title .menu button').first().click();await page.locator('#title .looks button').first().click();
 const skip=page.locator('[data-cinematic-skip]');await skip.waitFor({state:'visible',timeout:180000});await page.evaluate(()=>new Promise(r=>window.__pfs.scene().onAfterRenderObservable.addOnce(()=>r())));await page.screenshot({path:`${out}/opening-drone.png`});await page.keyboard.press('Escape');await waitFor(page,s=>s.state==='playing',180000);checks.push('opening: Escape skip restores gameplay');
 const cdp=await page.context().newCDPSession(page);
 const frames=async(count=3)=>page.evaluate(count=>new Promise((resolve,reject)=>{
  const timeout=setTimeout(()=>reject(Error('Input frame wait exceeded 20 seconds')),20000);
  const tick=()=>{if(--count<=0){clearTimeout(timeout);resolve();}else requestAnimationFrame(tick);};requestAnimationFrame(tick);
 }),count);
 const districtPoint=async(id,axis)=>page.evaluate(({id,axis})=>{
  const world=document.querySelector(`[data-${id}-world]`);
  return{x:Number(world.getAttribute(`data-${id}-x`)),z:Number(world.getAttribute(`data-${id}-${axis}`))};
 },{id,axis});
 const movedFrom=async(id,axis,before)=>page.waitForFunction(({id,axis,before})=>{
  const world=document.querySelector(`[data-${id}-world]`);
  return Math.hypot(Number(world.getAttribute(`data-${id}-x`))-before.x,Number(world.getAttribute(`data-${id}-${axis}`))-before.z)>.05;
 },{id,axis,before},{timeout:30000});
 const heldThumbPause=async(world,id,axis)=>{
  const sample={world:id,kind:'secondary-touch pause/resume with stationary primary movement contact',points:{}};controlSamples.push(sample);
  await page.evaluate(id=>{
   window.__controlsTouchTrace=[];window.__controlsTouchAbort=new AbortController();
   const world=document.querySelector(`[data-${id}-world]`);
   for(const type of ['pointerdown','pointerup','pointercancel'])world.addEventListener(type,e=>window.__controlsTouchTrace.push({type,id:e.pointerId,primary:e.isPrimary,pointer:e.pointerType,target:e.target.className}),{capture:true,signal:window.__controlsTouchAbort.signal});
  },id);
  try{
   const bounds=await world.locator('[data-district-stick]').boundingBox();
   const pause=await world.getByRole('button',{name:'Pause journey',exact:true}).boundingBox();
   if(!bounds||!pause)throw Error(`${id} held-thumb controls missing`);
   // Move back along the recently walked path, so a distant forward boundary
   // cannot make a stuck movement input look neutral after resume.
   const stick={id:11,x:bounds.x+bounds.width/2,y:bounds.y+bounds.height/2+32};
   const second={id:12,x:pause.x+pause.width/2,y:pause.y+pause.height/2};
   sample.points.before=await districtPoint(id,axis);
   await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[stick]});
   await movedFrom(id,axis,sample.points.before);
   sample.points.moving=await districtPoint(id,axis);
   await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[stick,second]});
   // CDP touchEnd names the released points. End the Pause finger itself;
   // sending [stick] here would leave Pause held and invalidate this check.
   await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[second]});
   const panel=world.locator('[data-district-pause]');await panel.waitFor({state:'visible',timeout:15000});
   sample.points.paused=await districtPoint(id,axis);await frames();
   sample.points.afterPause=await districtPoint(id,axis);
   if(Math.hypot(sample.points.afterPause.x-sample.points.paused.x,sample.points.afterPause.z-sample.points.paused.z)>.01)throw Error(`${id} moved behind secondary-touch pause`);
   await page.screenshot({path:`${out}/${id}-held-stick-paused.png`});
   const resume=await panel.getByRole('button',{name:'Resume',exact:true}).boundingBox();if(!resume)throw Error(`${id} Resume missing`);
   const resumeFinger={id:13,x:resume.x+resume.width/2,y:resume.y+resume.height/2};
   await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[stick,resumeFinger]});
   await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[resumeFinger]});
   await panel.waitFor({state:'hidden',timeout:15000});await frames(5);
   sample.points.resumedHeld=await districtPoint(id,axis);
   if(Math.hypot(sample.points.resumedHeld.x-sample.points.paused.x,sample.points.resumedHeld.z-sample.points.paused.z)>.01)throw Error(`${id} resumed moving from the stationary held thumb`);
   sample.events=await page.evaluate(()=>window.__controlsTouchTrace);
   const down=sample.events.find(e=>e.type==='pointerdown'&&!e.primary&&e.target==='district-pause-button');
   if(!down||!sample.events.some(e=>e.type==='pointerup'&&e.id===down.id&&e.target==='district-pause-button'))throw Error(`${id} secondary Pause touch did not complete on its own pointer`);
   await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await frames(2);
   sample.points.released=await districtPoint(id,axis);
   if(Math.hypot(sample.points.released.x-sample.points.paused.x,sample.points.released.z-sample.points.paused.z)>.01)throw Error(`${id} movement drift after releasing the old thumb`);
   await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[stick]});
   await movedFrom(id,axis,sample.points.released);sample.points.freshGesture=await districtPoint(id,axis);
   sample.passed=true;checks.push(`${id}: real secondary-touch Pause/Resume while movement thumb stays held; no paused/resumed drift; fresh gesture moves again`);
  }finally{
   await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]}).catch(()=>{});
   sample.events=await page.evaluate(()=>{window.__controlsTouchAbort?.abort();return window.__controlsTouchTrace;}).catch(()=>sample.events);await frames(2);
  }
 };
 const controllerResume=async(world,id)=>{
  const panel=world.locator('[data-district-pause]');
  const button=async(index,pressed)=>page.evaluate(({index,pressed})=>{window.pad.buttons[index]={pressed,value:pressed?1:0};},{index,pressed});
  for(const resumeButton of [9,0]){
   try{
    await button(9,true);await panel.waitFor({state:'visible',timeout:15000});await button(9,false);await frames(2);
    await button(resumeButton,true);await panel.waitFor({state:'hidden',timeout:15000});await frames(3);
    if(await panel.isVisible())throw Error(`${id} controller ${resumeButton===9?'Start':'A'} re-paused while held`);
    checks.push(`${id}: controller ${resumeButton===9?'Start':'A'} resumes and stays resumed while held`);
   }finally{await button(9,false);await button(0,false);await frames(2);}
  }
 };
 const twoThumb=async(selector,position,id)=>{
  const bounds=await page.locator(selector).boundingBox();if(!bounds)throw Error(`${id} movement zone missing`);
  const x=bounds.x+bounds.width/2,y=bounds.y+bounds.height/2,right={x:760,y:280,id:2};
  const direction=()=>page.evaluate(()=>{const c=window.__pfs.scene().getEngine().scenes.at(-1)?.activeCamera;if(!c)return null;const d=c.getDirection(new c.position.constructor(0,0,1));return{x:d.x,z:d.z};});
  const before=await position(),look=await direction();
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y,id:1}]});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y,id:1},right]});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x,y:y-42,id:1},{...right,x:right.x+45}]});
  await page.waitForTimeout(1400);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await sleep(250);
  const after=await position(),turned=await direction();if(Math.abs(after-before)<0.1)throw Error(`${id} two-thumb movement failed`);
  if(id!=='pixel'&&look&&turned&&Math.hypot(turned.x-look.x,turned.z-look.z)<0.015)throw Error(`${id} right-thumb look failed`);
 };
 const mainControls=async(name)=>{
  const position=()=>page.evaluate(()=>window.__pfs.snapshot().player.z);
  const before=await position();await page.keyboard.down('KeyZ');await page.waitForFunction(z=>Math.abs(window.__pfs.snapshot().player.z-z)>0.2,before,{timeout:30000});await page.keyboard.up('KeyZ');
  await page.keyboard.press('KeyO');await page.locator('.mapwrap canvas').waitFor({state:'visible'});await page.locator('.mapwrap').getByRole('button',{name:'Close',exact:true}).click();await waitFor(page,s=>s.state==='playing',90000);
  await page.evaluate(()=>{window.pad={connected:true,axes:[0,-0.75,0,0],buttons:Array.from({length:16},()=>({pressed:false,value:0}))};Object.defineProperty(navigator,'getGamepads',{configurable:true,value:()=>[window.pad]});});
  const beforePad=await position();await page.waitForFunction(z=>Math.abs(window.__pfs.snapshot().player.z-z)>0.15,beforePad,{timeout:30000});await page.evaluate(()=>{window.pad.axes=[0,0,0,0];window.pad.buttons[8]={pressed:true,value:1};});await page.locator('.mapwrap canvas').waitFor({state:'visible'});await page.evaluate(()=>window.pad.buttons[8]={pressed:false,value:0});await page.locator('.mapwrap').getByRole('button',{name:'Close',exact:true}).click();await waitFor(page,s=>s.state==='playing',90000);
  await page.touchscreen.tap(750,350);await page.locator('.tzone.stick').waitFor({state:'visible',timeout:30000});await twoThumb('.tzone.stick',position,name);
  checks.push(`${name}: saved movement/map binding, controller movement/Back map, simultaneous two-thumb movement/look`);
 };
 await mainControls('Punjab');
 const sceneCount=()=>page.evaluate(()=>window.__pfs.scene().getEngine().scenes.length);const baseline=await sceneCount();
 for(const [name,id,axis]of[['Japan','japan','z'],['China','china','z'],['Neon Quay','neon','z'],['Space','space','z'],['Lantern Valley','pixel','y']]){
  console.log('ENTER',name);await page.getByRole('button',{name:'Worlds: choose a destination'}).click();await page.locator('.menu-panel button').filter({hasText:name}).click();
  const world=page.locator(`[data-${id}-world]`);await world.waitFor({timeout:180000});
  if(id==='space'){await world.locator('[data-space-skip]').click();await page.waitForFunction(()=>document.querySelector('[data-space-world]')?.dataset.spaceReady==='true');}
  await page.waitForFunction(({id,axis})=>document.querySelector(`[data-${id}-world]`)?.getAttribute(`data-${id}-${axis}`)!==null,{id,axis},{timeout:60000});
  const position=async()=>Number(await world.getAttribute(`data-${id}-${axis}`));
  if(id!=='pixel')await page.evaluate(()=>new Promise(r=>window.__pfs.scene().getEngine().scenes.at(-1).onAfterRenderObservable.addOnce(()=>r())));await page.screenshot({path:`${out}/${id}-playing.png`});
  const initial=await position();await page.keyboard.down('KeyZ');await page.waitForFunction(({id,axis,initial})=>Math.abs(Number(document.querySelector(`[data-${id}-world]`)?.getAttribute(`data-${id}-${axis}`))-initial)>0.2,{id,axis,initial},{timeout:30000});await page.keyboard.up('KeyZ');await sleep(300);const moved=await position();if(Math.abs(moved-initial)<0.2)throw Error(`${id} remapped movement did not work: ${initial} -> ${moved}`);
  await page.keyboard.down('KeyW');await sleep(500);await page.keyboard.up('KeyW');if(Math.abs(await position()-moved)>0.15)throw Error(`${id} still hardcodes W`);
  const help=await world.locator('[data-district-bindings]').textContent();if(!help.includes('Z')||!help.includes('T')||!help.includes('O'))throw Error(`${id} stale binding hints: ${help}`);
  await page.keyboard.press('KeyO');const localMap=world.locator('[data-district-map]');await localMap.waitFor({state:'visible'});const mapPosition=await position();await sleep(500);if(Math.abs(await position()-mapPosition)>0.01)throw Error(`${id} moves behind map`);await page.screenshot({path:`${out}/${id}-map.png`});await page.keyboard.press('KeyO');await localMap.waitFor({state:'hidden'});
  await page.keyboard.press('Escape');const panel=world.locator('[data-district-pause]');await panel.waitFor({state:'visible'});const paused=await position();await sleep(650);if(Math.abs(await position()-paused)>0.01)throw Error(`${id} moved while paused`);await panel.getByRole('button',{name:'Resume',exact:true}).click();
  await page.evaluate(()=>{window.pad={connected:true,axes:[0,-0.75,0,0],buttons:Array.from({length:16},()=>({pressed:false,value:0}))};Object.defineProperty(navigator,'getGamepads',{configurable:true,value:()=>[window.pad]});});
  await page.evaluate(()=>window.pad.buttons[8]={pressed:true,value:1});await world.locator('[data-district-map]').waitFor({state:'visible'});await page.evaluate(()=>window.pad.buttons[8]={pressed:false,value:0});await world.locator('[data-district-map]').getByRole('button',{name:'Close map',exact:true}).click();
  const prePad=await position();await page.waitForFunction(({id,axis,prePad})=>Math.abs(Number(document.querySelector(`[data-${id}-world]`)?.getAttribute(`data-${id}-${axis}`))-prePad)>0.2,{id,axis,prePad},{timeout:30000});await page.evaluate(()=>window.pad.axes=[0,0,0,0]);await sleep(250);if(Math.abs(await position()-prePad)<0.2)throw Error(`${id} controller stick did not move`);
  const stick=world.locator('[data-district-stick]');const bounds=await stick.boundingBox();if(!bounds)throw Error(`${id} touch stick absent`);
  const preTouch=await position();await page.mouse.move(bounds.x+bounds.width/2,bounds.y+15);await page.mouse.down();await page.waitForFunction(({id,axis,preTouch})=>Math.abs(Number(document.querySelector(`[data-${id}-world]`)?.getAttribute(`data-${id}-${axis}`))-preTouch)>0.15,{id,axis,preTouch},{timeout:30000});await page.mouse.up();await sleep(200);if(Math.abs(await position()-preTouch)<0.1)throw Error(`${id} touch stick did not move`);
  await twoThumb('[data-district-stick]',position,id);
  await heldThumbPause(world,id,axis);
  await controllerResume(world,id);
  await world.locator(`[data-${id}-return]`).click();await waitFor(page,s=>s.state==='playing',180000);if(await sceneCount()!==baseline)throw Error(`${id} scene leak`);checks.push(`${id}: remap hints, keyboard/controller map, pause, controller movement, analog and two-thumb touch, return, scene disposal`);
 }
 console.log('CANADA');await page.getByRole('button',{name:'Worlds: choose a destination'}).click();await page.locator('.menu-panel button').filter({hasText:'Canada'}).click();await waitFor(page,s=>s.state==='playing'&&s.player.x>1000,180000);await page.screenshot({path:`out/canada.png`.replace('out/',`${out}/`)});checks.push('Canada: actual world navigation arrival');await mainControls('Canada');
 await page.keyboard.press('Escape');await page.locator('.menu-panel button').filter({hasText:'Replay cinematic introduction'}).click();await skip.waitFor({state:'visible'});await skip.click();await page.getByText('Paused',{exact:true}).waitFor();await page.locator('.menu-panel button').getByText('Resume',{exact:true}).click();await waitFor(page,s=>s.state==='playing',180000);checks.push('pause replay: skip returns to pause and resume');
 await page.keyboard.press('Escape');await page.locator('.menu-panel button').getByText('Save game',{exact:true}).click();await page.locator('.menu-panel button').getByText('Resume',{exact:true}).click();await page.reload();await page.waitForFunction(()=>window.__pfs?.snapshot().state==='title',null,{timeout:300000});await page.locator('#title .menu button').getByText('Continue',{exact:true}).click();await waitFor(page,s=>s.state==='playing',180000);if(await skip.isVisible())throw Error('Opening replayed on save reload');checks.push('save reload: opening flag retained, gameplay restored');
 if(log.some(s=>/^\[(http|error|pageerror)/.test(s))||page.__external.length)throw Error(JSON.stringify({log,external:page.__external}));
 fs.writeFileSync(`${out}/checks.json`,JSON.stringify({...metadata,checks,controlSamples,log,external:page.__external},null,2));console.log(JSON.stringify({checks}));
}catch(e){await page.screenshot({path:`${out}/failure.png`}).catch(()=>{});fs.writeFileSync(`${out}/failure.json`,JSON.stringify({...metadata,error:String(e),checks,controlSamples,log,external:page.__external},null,2));throw e;}finally{await browser.close();}
