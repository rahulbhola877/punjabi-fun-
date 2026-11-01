import fs from 'node:fs';
import { launch,waitFor,sleep } from './pt-lib.mjs';
const base=process.argv[2]??'http://127.0.0.1:4173/';
const out='artifacts/cinematic-controls';fs.mkdirSync(out,{recursive:true});
const {browser,page,log}=await launch(`${base}?probe`,{w:960,h:540,settings:{quality:'medium',post:false},storage:{'pfs.keys.v1':JSON.stringify({forward:['KeyZ','ArrowUp'],interact:['KeyT','KeyF']})},mobile:true});
const checks=[];
try{
 page.on('console',m=>{if(m.type()==='error')console.log('ERROR',m.text());});
 await page.waitForFunction(()=>window.__pfs?.snapshot().state==='title',null,{timeout:300000});
 await page.locator('#title .menu button').first().click();await page.locator('#title .looks button').first().click();
 const skip=page.locator('[data-cinematic-skip]');await skip.waitFor({state:'visible',timeout:180000});await page.evaluate(()=>new Promise(r=>window.__pfs.scene().onAfterRenderObservable.addOnce(()=>r())));await page.screenshot({path:`${out}/opening-drone.png`});await page.keyboard.press('Escape');await waitFor(page,s=>s.state==='playing',180000);checks.push('opening: Escape skip restores gameplay');
 const sceneCount=()=>page.evaluate(()=>window.__pfs.scene().getEngine().scenes.length);const baseline=await sceneCount();
 for(const [name,id,axis]of[['Japan','japan','z'],['China','china','z'],['Neon Quay','neon','z'],['Space','space','z'],['Lantern Valley','pixel','y']]){
  console.log('ENTER',name);await page.getByRole('button',{name:'Worlds: choose a destination'}).click();await page.locator('.menu-panel button').filter({hasText:name}).click();
  const world=page.locator(`[data-${id}-world]`);await world.waitFor({timeout:180000});
  if(id==='space'){await world.locator('[data-space-skip]').click();await page.waitForFunction(()=>document.querySelector('[data-space-world]')?.dataset.spaceReady==='true');}
  await page.waitForFunction(({id,axis})=>document.querySelector(`[data-${id}-world]`)?.getAttribute(`data-${id}-${axis}`)!==null,{id,axis},{timeout:60000});
  const position=async()=>Number(await world.getAttribute(`data-${id}-${axis}`));
  const initial=await position();await page.keyboard.down('KeyZ');await page.waitForFunction(({id,axis,initial})=>Math.abs(Number(document.querySelector(`[data-${id}-world]`)?.getAttribute(`data-${id}-${axis}`))-initial)>0.2,{id,axis,initial},{timeout:30000});await page.keyboard.up('KeyZ');await sleep(300);const moved=await position();if(Math.abs(moved-initial)<0.2)throw Error(`${id} remapped movement did not work: ${initial} -> ${moved}`);
  await page.keyboard.down('KeyW');await sleep(500);await page.keyboard.up('KeyW');if(Math.abs(await position()-moved)>0.15)throw Error(`${id} still hardcodes W`);
  await page.keyboard.press('Escape');const panel=world.locator('[data-district-pause]');await panel.waitFor({state:'visible'});const paused=await position();await sleep(650);if(Math.abs(await position()-paused)>0.01)throw Error(`${id} moved while paused`);await panel.getByRole('button',{name:'Resume',exact:true}).click();
  await page.evaluate(()=>{window.pad={connected:true,axes:[0,-0.75,0,0],buttons:Array.from({length:16},()=>({pressed:false,value:0}))};Object.defineProperty(navigator,'getGamepads',{configurable:true,value:()=>[window.pad]});});
  const prePad=await position();await page.waitForFunction(({id,axis,prePad})=>Math.abs(Number(document.querySelector(`[data-${id}-world]`)?.getAttribute(`data-${id}-${axis}`))-prePad)>0.2,{id,axis,prePad},{timeout:30000});await page.evaluate(()=>window.pad.axes=[0,0,0,0]);await sleep(250);if(Math.abs(await position()-prePad)<0.2)throw Error(`${id} controller stick did not move`);
  const stick=world.locator('[data-district-stick]');const bounds=await stick.boundingBox();if(!bounds)throw Error(`${id} touch stick absent`);
  const preTouch=await position();await page.mouse.move(bounds.x+bounds.width/2,bounds.y+15);await page.mouse.down();await page.waitForFunction(({id,axis,preTouch})=>Math.abs(Number(document.querySelector(`[data-${id}-world]`)?.getAttribute(`data-${id}-${axis}`))-preTouch)>0.15,{id,axis,preTouch},{timeout:30000});await page.mouse.up();await sleep(200);if(Math.abs(await position()-preTouch)<0.1)throw Error(`${id} touch stick did not move`);
  await world.locator(`[data-${id}-return]`).click();await waitFor(page,s=>s.state==='playing',180000);if(await sceneCount()!==baseline)throw Error(`${id} scene leak`);checks.push(`${id}: remap, pause, controller, analog touch, return, scene disposal`);
 }
 console.log('CANADA');await page.getByRole('button',{name:'Worlds: choose a destination'}).click();await page.locator('.menu-panel button').filter({hasText:'Canada'}).click();await waitFor(page,s=>s.state==='playing'&&s.player.x>1000,180000);await page.screenshot({path:`out/canada.png`.replace('out/',`${out}/`)});checks.push('Canada: actual world navigation arrival');
 await page.keyboard.press('Escape');await page.locator('.menu-panel button').filter({hasText:'Replay cinematic introduction'}).click();await skip.waitFor({state:'visible'});await skip.click();await page.getByText('Paused',{exact:true}).waitFor();await page.locator('.menu-panel button').getByText('Resume',{exact:true}).click();await waitFor(page,s=>s.state==='playing',180000);checks.push('pause replay: skip returns to pause and resume');
 await page.keyboard.press('Escape');await page.locator('.menu-panel button').getByText('Save game',{exact:true}).click();await page.locator('.menu-panel button').getByText('Resume',{exact:true}).click();await page.reload();await page.waitForFunction(()=>window.__pfs?.snapshot().state==='title',null,{timeout:300000});await page.locator('#title .menu button').getByText('Continue',{exact:true}).click();await waitFor(page,s=>s.state==='playing',180000);if(await skip.isVisible())throw Error('Opening replayed on save reload');checks.push('save reload: opening flag retained, gameplay restored');
 if(log.some(s=>/^\[(http|error|pageerror)/.test(s))||page.__external.length)throw Error(JSON.stringify({log,external:page.__external}));
 fs.writeFileSync(`${out}/checks.json`,JSON.stringify({checks,log,external:page.__external},null,2));console.log(JSON.stringify({checks}));
}catch(e){await page.screenshot({path:`${out}/failure.png`}).catch(()=>{});fs.writeFileSync(`${out}/failure.json`,JSON.stringify({error:String(e),checks,log,external:page.__external},null,2));throw e;}finally{await browser.close();}
