import fs from 'node:fs';
import { launch,waitFor,sleep } from './pt-lib.mjs';
const base=process.argv[2]??'http://127.0.0.1:4173/';
const out=process.env.OUT??'artifacts/controls-reviewed';fs.mkdirSync(out,{recursive:true});
const {browser,page,log}=await launch(`${base}?probe`,{w:960,h:540,settings:{quality:'medium',post:false},storage:{'pfs.keys.v1':JSON.stringify({forward:['KeyZ','ArrowUp'],interact:['KeyT','KeyF'],map:['KeyO']})},mobile:true});
const checks=[];
try{
 page.on('console',m=>{if(m.type()==='error')console.log('ERROR',m.text());});
 await page.waitForFunction(()=>window.__pfs?.snapshot().state==='title',null,{timeout:300000});
 await page.locator('#title .menu button').first().click();await page.locator('#title .looks button').first().click();
 const skip=page.locator('[data-cinematic-skip]');await skip.waitFor({state:'visible',timeout:180000});await page.evaluate(()=>new Promise(r=>window.__pfs.scene().onAfterRenderObservable.addOnce(()=>r())));await page.screenshot({path:`${out}/opening-drone.png`});await page.keyboard.press('Escape');await waitFor(page,s=>s.state==='playing',180000);checks.push('opening: Escape skip restores gameplay');
 const cdp=await page.context().newCDPSession(page);
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
  await world.locator(`[data-${id}-return]`).click();await waitFor(page,s=>s.state==='playing',180000);if(await sceneCount()!==baseline)throw Error(`${id} scene leak`);checks.push(`${id}: remap hints, keyboard/controller map, pause, controller movement, analog and two-thumb touch, return, scene disposal`);
 }
 console.log('CANADA');await page.getByRole('button',{name:'Worlds: choose a destination'}).click();await page.locator('.menu-panel button').filter({hasText:'Canada'}).click();await waitFor(page,s=>s.state==='playing'&&s.player.x>1000,180000);await page.screenshot({path:`out/canada.png`.replace('out/',`${out}/`)});checks.push('Canada: actual world navigation arrival');await mainControls('Canada');
 await page.keyboard.press('Escape');await page.locator('.menu-panel button').filter({hasText:'Replay cinematic introduction'}).click();await skip.waitFor({state:'visible'});await skip.click();await page.getByText('Paused',{exact:true}).waitFor();await page.locator('.menu-panel button').getByText('Resume',{exact:true}).click();await waitFor(page,s=>s.state==='playing',180000);checks.push('pause replay: skip returns to pause and resume');
 await page.keyboard.press('Escape');await page.locator('.menu-panel button').getByText('Save game',{exact:true}).click();await page.locator('.menu-panel button').getByText('Resume',{exact:true}).click();await page.reload();await page.waitForFunction(()=>window.__pfs?.snapshot().state==='title',null,{timeout:300000});await page.locator('#title .menu button').getByText('Continue',{exact:true}).click();await waitFor(page,s=>s.state==='playing',180000);if(await skip.isVisible())throw Error('Opening replayed on save reload');checks.push('save reload: opening flag retained, gameplay restored');
 if(log.some(s=>/^\[(http|error|pageerror)/.test(s))||page.__external.length)throw Error(JSON.stringify({log,external:page.__external}));
 fs.writeFileSync(`${out}/checks.json`,JSON.stringify({checks,log,external:page.__external},null,2));console.log(JSON.stringify({checks}));
}catch(e){await page.screenshot({path:`${out}/failure.png`}).catch(()=>{});fs.writeFileSync(`${out}/failure.json`,JSON.stringify({error:String(e),checks,log,external:page.__external},null,2));throw e;}finally{await browser.close();}
