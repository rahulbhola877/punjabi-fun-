import fs from 'node:fs';
import {launch,waitFor}from './pt-lib.mjs';
const base=process.argv[2]??'http://127.0.0.1:4180/',out=process.env.OUT??'artifacts/profiled-cinematics/opening';fs.mkdirSync(out,{recursive:true});
const {browser,page,log}=await launch(`${base}?probe&hour=9`,{w:1280,h:720,settings:{quality:'high',renderer:'webgl',renderScale:1},seed:0x48192});
const rows=[];
try{
 await waitFor(page,s=>s.state==='title',300000);await page.evaluate(()=>window.__pfs.captureHold(true));
 await page.locator('#title .menu button').first().click();await page.locator('#title .looks button').first().click();
 await page.locator('[data-cinematic-skip]').waitFor({state:'visible',timeout:180000});
 let previous=0;
 for(const time of [0,.8,1.7,2.6,3.4,3.6,4.3,5.2,6.3,6.6,7.2,8.3,9.3]){
  const frames=Math.max(0,Math.round((time-previous)*30));previous=time;
  const row=await page.evaluate(async frames=>{
   const p=window.__pfs,s=p.scene(),e=s.getEngine(),render=s.render;
   // Advance the actual director without paying for hundreds of redundant
   // software-GPU frames, then capture its real full-resolution camera view.
   s.render=()=>{};try{p.tick(frames,null);}finally{s.render=render;}
   for(let i=0;i<3;i++){e.beginFrame();s.render();e.endFrame();await new Promise(resolve=>setTimeout(resolve,0));}e._gl.finish();
   return{shot:document.querySelector('[data-cinematic]')?.dataset.cinematicShot,snapshot:p.snapshot(),target:s.activeCamera.getTarget().asArray(),eye:s.activeCamera.position.asArray()};
  },frames);
  rows.push({time,...row});await page.screenshot({path:`${out}/${time.toFixed(1)}s.png`,timeout:180000});console.log(JSON.stringify({time,shot:row.shot,eye:row.eye,target:row.target}));
 }
 await page.locator('[data-cinematic-skip]').click();await waitFor(page,s=>s.state==='playing',90000);
 if(log.some(s=>/^\[(http|error|pageerror)/.test(s))||page.__external.length)throw Error(JSON.stringify({log,external:page.__external}));
 fs.writeFileSync(`${out}/checks.json`,JSON.stringify({notes:'Actual director path sampled at fixed simulation times; only capture frames rendered. No FPS inference.',rows,skipRestoredPlay:true,log,external:page.__external},null,2));
}finally{await browser.close();}
