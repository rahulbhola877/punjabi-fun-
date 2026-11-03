import fs from 'node:fs';
import {launch,waitFor}from './pt-lib.mjs';
const base=process.argv[2]??'http://127.0.0.1:4188/',out=process.env.OUT??'artifacts/graphics-settings';fs.mkdirSync(out,{recursive:true});
const {browser,page,log}=await launch(`${base}?probe`,{mobile:true,w:960,h:540,settings:{quality:'high',renderer:'webgl',renderScale:1,post:true}});
const checks=[],ao=[];
try{
 await waitFor(page,s=>s.state==='title',180000);await page.locator('#title .menu button').first().click();await page.locator('#title .looks button').first().click();
 await page.locator('[data-cinematic-skip]').waitFor({state:'visible',timeout:120000});await page.locator('[data-cinematic-skip]').click();await waitFor(page,s=>s.state==='playing',120000);
 if(await page.locator('.performancebtn').count())throw Error('Performance HUD shortcut remains');
 await page.keyboard.press('Escape');await page.locator('.menu-panel button').getByText('Settings',{exact:true}).click();
 const graphics=page.locator('.settings-row').filter({hasText:/^Graphics/}).locator('select');
 for(const quality of ['medium','ultra','high','ultra']){
  await graphics.selectOption(quality);
  await page.waitForFunction(quality=>{const s=JSON.parse(localStorage.getItem('pfs.settings.v1')),e=window.__pfs.scene().getEngine();return s.quality===quality&&s.renderScale===1&&e.getRenderWidth()===960&&e.getRenderHeight()===540;},quality,{timeout:30000});
  checks.push(`${quality}: explicit preference retained at960x540, scale1 on touch device`);
  // Read the real allocated Babylon pipeline; this does not call Game internals
  // or replace its render passes with mocks. Medium deliberately has no AO.
  const actual=await page.evaluate(()=>{
   const p=window.__pfs.scene().postProcessRenderPipelineManager.supportedPipelines.find(p=>p.name==='ssao');
   return p?{ratio:p._ratio,samples:p.samples,expensiveBlur:p.expensiveBlur,bilateralSamples:p.bilateralSamples}:null;
  });
  ao.push({quality,actual});
  if(quality==='medium'&&actual)throw Error('Medium retained the SSAO pipeline');
  if(quality!=='medium'){
   const ultra=quality==='ultra',ratio=ultra?.75:.5;
   if(!actual||actual.ratio?.ssaoRatio!==ratio||actual.ratio?.blurRatio!==ratio||actual.samples!==(ultra?16:8)||actual.expensiveBlur!==ultra||actual.bilateralSamples!==(ultra?12:6))throw Error(`Wrong ${quality} AO targets: ${JSON.stringify(actual)}`);
   checks.push(`${quality}: actual SSAO allocation and sample counts match selected quality`);
  }
 }
 const scale=page.locator('.settings-row').filter({hasText:'Resolution scale'}).locator('input');
 await scale.evaluate(e=>{e.value='.8';e.dispatchEvent(new Event('input',{bubbles:true}));});
 await page.waitForFunction(()=>window.__pfs.scene().getEngine().getRenderWidth()===768);
 await scale.evaluate(e=>{e.value='1';e.dispatchEvent(new Event('input',{bubbles:true}));});
 await page.waitForFunction(()=>window.__pfs.scene().getEngine().getRenderWidth()===960);
 checks.push('manual resolution preference works and restores to100%; no automatic downgrade');
 await page.screenshot({path:`${out}/full-resolution-settings.png`,timeout:120000});
 await page.locator('.menu-panel button').getByText('Done',{exact:true}).click();await page.locator('.menu-panel button').getByText('Resume',{exact:true}).click();await waitFor(page,s=>s.state==='playing',60000);
 fs.writeFileSync(`${out}/checks.json`,JSON.stringify({source:process.env.SOURCE??'unrecorded',checks,ao,log,external:page.__external},null,2));
 if(log.some(s=>/^\[(http|error|pageerror)/.test(s))||page.__external.length)throw Error(JSON.stringify({log,external:page.__external}));
 console.log(JSON.stringify({checks}));
}catch(e){fs.writeFileSync(`${out}/failure.json`,JSON.stringify({source:process.env.SOURCE??'unrecorded',error:String(e),checks,ao,log,external:page.__external},null,2));throw e;}finally{await browser.close();}
