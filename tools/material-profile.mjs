import { launch } from './pt-lib.mjs';
const {browser,page}=await launch(`${process.argv[2]??'http://127.0.0.1:4173/'}?probe`,{settings:{quality:'high'}});
try {
  await page.waitForFunction(()=>window.__pfs?.snapshot().state==='title',null,{timeout:180000});
  await page.locator('#title .menu button').first().click();
  await page.locator('#title .looks button').first().click();
  await page.waitForTimeout(10000);
  console.log(await page.evaluate(async()=>{
    const s=window.__pfs.scene(), counts={}, stacks={};
    const wrap=(obj,key)=>{const old=obj[key]; if(!old)return; obj[key]=function(...args){counts[key]=(counts[key]??0)+1;if(counts[key]<=3) (stacks[key]??=[]).push(new Error().stack);return old.apply(this,args);};};
    const m=s.meshes.find(m=>m.name.startsWith('world_paint')&&m.subMeshes?.[0]?.materialDefines);
    const d=Object.getPrototypeOf(m.subMeshes[0].materialDefines);
    for(const k of ['markAllAsDirty','markAsLightDirty','markAsAttributesDirty','markAsPrePassDirty','markAsTexturesDirty']) wrap(d,k);
    wrap(s.prePassRenderer,'markAsDirty');
    await new Promise(r=>setTimeout(r,2500));
    return {counts,stacks};
  }));
} finally {await browser.close();}
