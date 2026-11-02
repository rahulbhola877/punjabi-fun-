import fs from 'node:fs';
import {launch,waitFor}from './pt-lib.mjs';
const base=process.argv[2]??'http://127.0.0.1:4180/',label=process.env.LABEL??'profiled-final',out=`artifacts/production-district/${label}`;fs.mkdirSync(out,{recursive:true});
const {browser,page,log}=await launch(`${base}?probe&hour=9`,{w:1280,h:720,settings:{quality:'high',renderer:'webgl',renderScale:1},seed:0x48192});
const rows=[];
try{
 await waitFor(page,s=>s.state==='title',300000);await page.locator('#title .menu button').first().click();await page.locator('#title .looks button').first().click();
 const skip=page.locator('[data-cinematic-skip]');await skip.waitFor({state:'visible',timeout:180000});await skip.click();await waitFor(page,s=>s.state==='playing',180000);
 for(const [name,id,views]of[
  ['Japan','japan',[['street',[1.5,4.3,-27.5],[0,1.35,-17.8]],['pond',[6.5,3.2,22],[10.5,.15,27.5]]]],
  ['China','china',[['street',[43,6,-74],[41,1.35,-59]],['river',[5,5,10],[-1,0,35]]]],
 ]){
  await page.getByRole('button',{name:'Worlds: choose a destination'}).click();await page.locator('.menu-panel button').filter({hasText:name}).click();const world=page.locator(`[data-${id}-world]`);await world.waitFor({timeout:180000});
  for(const [view,eye,target]of views){
   await page.evaluate(async({eye,target})=>{
    const e=window.__pfs.scene().getEngine(),s=e.scenes.at(-1);window.__captureCamera=s.onBeforeRenderObservable.add(()=>{s.activeCamera.position.set(...eye);s.activeCamera.setTarget(new s.activeCamera.position.constructor(...target));s.updateTransformMatrix(true);});
    for(let i=0;i<6;i++)await new Promise(resolve=>s.onAfterRenderObservable.addOnce(()=>resolve()));e._gl.finish();
   },{eye,target});
   const row=await page.evaluate(()=>{const e=window.__pfs.scene().getEngine(),s=e.scenes.at(-1);return{renderer:e.getInfo(),resolution:[e.getRenderWidth(),e.getRenderHeight()],meshes:s.meshes.length,materials:s.materials.map(m=>({name:m.name,diffuse:m.diffuseColor?.asArray(),albedo:m.albedoColor?.asArray()})),eye:s.activeCamera.position.asArray(),target:s.activeCamera.getTarget().asArray()};});
   await page.screenshot({path:`${out}/${id}-${view}.png`,timeout:180000});await page.evaluate(()=>{const e=window.__pfs.scene().getEngine(),s=e.scenes.at(-1);s.onBeforeRenderObservable.remove(window.__captureCamera);});rows.push({id,view,...row});console.log('CAPTURE',id,view);
  }
  await world.locator(`[data-${id}-return]`).click();await waitFor(page,s=>s.state==='playing',180000);
 }
 fs.writeFileSync(`${out}/checks.json`,JSON.stringify({rows,log,external:page.__external},null,2));
 if(log.some(s=>/^\[(http|error|pageerror)/.test(s))||page.__external.length)throw Error(JSON.stringify({log,external:page.__external}));
}finally{await browser.close();}
