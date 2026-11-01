import fs from'node:fs';import{launch,waitFor}from'./pt-lib.mjs';
const base=process.argv[2]??'http://127.0.0.1:4173/',label=process.env.LABEL??'after',out=`artifacts/travel-visual/${label}`;fs.mkdirSync(out,{recursive:true});
const{browser,page,log}=await launch(`${base}?probe`,{w:1280,h:720,settings:{quality:'high'}});
try{
 await page.waitForFunction(()=>window.__pfs?.snapshot().state==='title',null,{timeout:300000});await page.locator('#title .menu button').first().click();await page.locator('#title .looks button').first().click();
 const skip=page.locator('[data-cinematic-skip]');if(await skip.isVisible())await skip.click();await waitFor(page,s=>s.state==='playing',180000);
 await page.getByRole('button',{name:'Worlds: choose a destination'}).click();await page.locator('.menu-panel button').filter({hasText:'Canada'}).click();await waitFor(page,s=>s.state==='playing'&&s.player.x>1000,180000);
 const data=await page.evaluate(()=>{const s=window.__pfs.scene(),e=s.getEngine();const snow=s.meshes.filter(m=>m.material?.name==='m_snow'&&m.isEnabled());return{snowEnabled:snow.length,resolution:[e.getRenderWidth(),e.getRenderHeight()],renderer:e.getInfo(),ready:s.isReady(),snowReady:snow.every(m=>m.isReady(true)),player:window.__pfs.snapshot().player};});
 if(label==='after'&&(!data.snowEnabled||!data.snowReady))throw Error('Canada exposed before its scenery was enabled/ready');
 // Capture as soon as travel completes, without a wait to hide culling delays.
 await page.screenshot({path:`${out}/canada-arrival.png`});await page.evaluate(()=>window.__pfs.teleport(1190,1820,0));await page.waitForTimeout(1200);await page.screenshot({path:`${out}/canada-street.png`});
 if(log.some(s=>/^\[(http|error|pageerror)/.test(s))||page.__external.length)throw Error(JSON.stringify({log,external:page.__external}));fs.writeFileSync(`${out}/checks.json`,JSON.stringify({data,log,external:page.__external},null,2));console.log(JSON.stringify(data));
}catch(e){await page.screenshot({path:`${out}/failure.png`}).catch(()=>{});throw e;}finally{await browser.close();}
