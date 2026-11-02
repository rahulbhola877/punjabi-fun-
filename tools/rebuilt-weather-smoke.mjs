import fs from 'node:fs';
import {launch,waitFor}from './pt-lib.mjs';
import {instrumentSystems,geometryInventory}from './cost-profile-core.mjs';
const base=process.argv[2]??'http://127.0.0.1:4186/',out='artifacts/rebuilt-weather';fs.mkdirSync(out,{recursive:true});
const {browser,page,log}=await launch(`${base}?probe&hour=9`,{w:1280,h:720,settings:{quality:'high',renderer:'webgl',renderScale:1},seed:0x48192});
try{
 await waitFor(page,s=>s.state==='title',180000);await page.locator('#title .menu button').first().click();await page.locator('#title .looks button').first().click();
 await page.locator('[data-cinematic-skip]').waitFor({state:'visible',timeout:90000});await page.locator('[data-cinematic-skip]').click();await waitFor(page,s=>s.state==='playing',90000);
 await page.evaluate(()=>window.__pfs.captureHold(true));const cdp=await page.context().newCDPSession(page);await instrumentSystems(cdp,page);
 const result=await page.evaluate(async()=>{
  const p=window.__pfs,g=window.__costGame,s=p.scene(),e=s.getEngine(),V=g.cam.camera.position.constructor;
  p.teleport(-12,-34,Math.PI/2);g.weather.auto=false;g.weather.setRain(true,true);
  const camera=s.onBeforeRenderObservable.add(()=>{s.activeCamera.position.set(-12,1.8,-34);s.activeCamera.setTarget(new V(-2,1.8,-34));s.updateTransformMatrix(true);});
  window.__weatherCamera=camera;
  const samples=[];
  for(let i=0;i<18;i++){
   // These are actual game/particle frames. No reduced-resolution setting.
   e.beginFrame();p.tick(1,null);e.endFrame();await new Promise(r=>setTimeout(r,0));
   const particles=g.weather.rainPs.particles,live=particles.filter(x=>x.color.a>0&&x.age<x.lifeTime);
   const leaking=live.filter(x=>x.position.y-.39<g.world.rainShelter.heightAt(x.position.x,x.position.z));
   samples.push({frame:i,live:live.length,leaking:leaking.length,coveredColumns:live.filter(x=>g.world.rainShelter.heightAt(x.position.x,x.position.z)>2).length});
  }
  e._gl.finish();
  return{samples,roofY:g.world.rainShelter.heightAt(-12,-34),streetRoofY:g.world.rainShelter.heightAt(0,-34),resolution:[e.getRenderWidth(),e.getRenderHeight()],renderer:e.getInfo()};
 });
 const geometry=await page.evaluate(geometryInventory);
 await page.screenshot({path:`${out}/rain-under-dhaba-roof.png`,timeout:90000});
 await page.evaluate(()=>{const s=window.__pfs.scene();s.onBeforeRenderObservable.remove(window.__weatherCamera);});
 await page.locator('.performancebtn').click();
 const balanced=await page.evaluate(()=>{const e=window.__pfs.scene().getEngine();return{resolution:[e.getRenderWidth(),e.getRenderHeight()],scale:e.getHardwareScalingLevel()};});
 fs.writeFileSync(`${out}/checks.json`,JSON.stringify({result,geometry,balanced,log,external:page.__external},null,2));
 if(result.roofY<2||result.streetRoofY>2||!result.samples.some(s=>s.live>100&&s.coveredColumns>0)||result.samples.some(s=>s.leaking)||log.some(s=>/^\[(http|error|pageerror)/.test(s))||page.__external.length)throw Error(JSON.stringify({result,log,external:page.__external}));
 if(balanced.resolution[0]!==1280||balanced.resolution[1]!==720||balanced.scale!==1)throw Error('Balanced graphics changed full resolution: '+JSON.stringify(balanced));
 console.log(JSON.stringify({result,geometry,balanced}));
}finally{await browser.close();}
