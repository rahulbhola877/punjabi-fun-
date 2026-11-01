import fs from 'node:fs';
import {launch,waitFor,sleep,clearDialogues}from'./pt-lib.mjs';
const out='artifacts/mission-cinematics';fs.mkdirSync(out,{recursive:true});
const {browser,page,log}=await launch(`${process.argv[2]??'http://127.0.0.1:4173/'}?probe`,{w:960,h:540,settings:{quality:'medium',post:false,shadows:'off'}});
const checks=[];
try{
 await page.waitForFunction(()=>window.__pfs?.snapshot().state==='title',null,{timeout:300000});await page.locator('#title .menu button').first().click();await page.locator('#title .looks button').first().click();
 await page.locator('[data-cinematic-skip]').waitFor({state:'visible',timeout:180000});await page.locator('[data-cinematic-skip]').click();await waitFor(page,s=>s.state==='playing',180000);
 await page.evaluate(()=>{window.__pfs.stage(999);window.__pfs.teleport(10.5,21.6,Math.PI/2);});await waitFor(page,s=>s.interactionId==='gurnam',90000);await page.keyboard.press('KeyE');
 await page.locator('.dialogue button').filter({hasText:'Hear about the bus-stand crew'}).click();await page.locator('.dialogue button').filter({hasText:"I'll deal with them"}).click();
 const skip=page.locator('[data-cinematic-skip]');await skip.waitFor({state:'visible',timeout:60000});
 const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('pfs.save')));if(!saved.flags.crime_active||!saved.flags.pistol_owned)throw Error('Accepted mission was not saved before cinematic');
 await page.screenshot({path:`${out}/gurnam-handoff.png`});await page.keyboard.press('Space');await waitFor(page,s=>s.state==='playing',90000);checks.push('Gurnam mission acceptance persisted before film; Space skip restores control');
 await page.evaluate(()=>window.__pfs.driveAt('car',-227,-165.5,Math.PI/2));await waitFor(page,s=>s.dialogueOpen,90000);await clearDialogues(page);
 await page.evaluate(()=>window.__pfs.placeVehicle(-252,-165.5,Math.PI/2));await page.keyboard.down('KeyW');
 await page.waitForFunction(()=>window.__pfs.snapshot().chasing&&document.querySelector('[data-cinematic]')?.hidden===false,null,{timeout:120000});await page.keyboard.up('KeyW');
 const before=await page.evaluate(()=>window.__pfs.snapshot());if(!before.wanted||!before.chasing)throw Error('Cinematic is not attached to real police pursuit');
 await page.screenshot({path:`${out}/police-pursuit.png`});await skip.click();await waitFor(page,s=>s.state==='playing',90000);const after=await page.evaluate(()=>window.__pfs.snapshot());if(after.wanted!==before.wanted)throw Error('Skipping cinematic changed wanted state');checks.push('Actual checkpoint pursuit during active mission; skip retains wanted state and resumes');
 if(log.some(s=>/^\[(http|error|pageerror)/.test(s))||page.__external.length)throw Error(JSON.stringify({log,external:page.__external}));
 fs.writeFileSync(`${out}/checks.json`,JSON.stringify({checks,log,external:page.__external},null,2));console.log(JSON.stringify({checks}));
}catch(e){await page.screenshot({path:`${out}/failure.png`}).catch(()=>{});fs.writeFileSync(`${out}/failure.json`,JSON.stringify({error:String(e),checks,log},null,2));throw e;}finally{await browser.close();}
