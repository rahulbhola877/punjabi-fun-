import fs from 'node:fs';
import {launch,waitFor}from './pt-lib.mjs';
const base=process.argv[2]??'http://127.0.0.1:4188/',out='artifacts/graphics-settings';fs.mkdirSync(out,{recursive:true});
const {browser,page,log}=await launch(`${base}?probe`,{mobile:true,w:960,h:540,settings:{quality:'high',renderer:'webgl',renderScale:1}});
const checks=[];
try{
 await waitFor(page,s=>s.state==='title',180000);await page.locator('#title .menu button').first().click();await page.locator('#title .looks button').first().click();
 await page.locator('[data-cinematic-skip]').waitFor({state:'visible',timeout:120000});await page.locator('[data-cinematic-skip]').click();await waitFor(page,s=>s.state==='playing',120000);
 if(await page.locator('.performancebtn').count())throw Error('Performance HUD shortcut remains');
 await page.keyboard.press('Escape');await page.locator('.menu-panel button').getByText('Settings',{exact:true}).click();
 const graphics=page.locator('.settings-row').filter({hasText:/^Graphics/}).locator('select');
 for(const quality of ['medium','ultra','high']){
  await graphics.selectOption(quality);
  await page.waitForFunction(quality=>{const s=JSON.parse(localStorage.getItem('pfs.settings.v1')),e=window.__pfs.scene().getEngine();return s.quality===quality&&s.renderScale===1&&e.getRenderWidth()===960&&e.getRenderHeight()===540;},quality,{timeout:30000});
  checks.push(`${quality}: explicit preference retained at960x540, scale1 on touch device`);
 }
 const scale=page.locator('.settings-row').filter({hasText:'Resolution scale'}).locator('input');
 await scale.evaluate(e=>{e.value='.8';e.dispatchEvent(new Event('input',{bubbles:true}));});
 await page.waitForFunction(()=>window.__pfs.scene().getEngine().getRenderWidth()===768);
 await scale.evaluate(e=>{e.value='1';e.dispatchEvent(new Event('input',{bubbles:true}));});
 await page.waitForFunction(()=>window.__pfs.scene().getEngine().getRenderWidth()===960);
 checks.push('manual resolution preference works and restores to100%; no automatic downgrade');
 await page.screenshot({path:`${out}/full-resolution-settings.png`,timeout:120000});
 await page.locator('.menu-panel button').getByText('Done',{exact:true}).click();await page.locator('.menu-panel button').getByText('Resume',{exact:true}).click();await waitFor(page,s=>s.state==='playing',60000);
 fs.writeFileSync(`${out}/checks.json`,JSON.stringify({checks,log,external:page.__external},null,2));
 if(log.some(s=>/^\[(http|error|pageerror)/.test(s))||page.__external.length)throw Error(JSON.stringify({log,external:page.__external}));
 console.log(JSON.stringify({checks}));
}finally{await browser.close();}
