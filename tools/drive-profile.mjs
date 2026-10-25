import { launch, waitFor, sleep } from './pt-lib.mjs';
import fs from 'node:fs';
const label=process.env.LABEL??'drive';
const mobile=process.env.MOBILE==='1';
const {browser,page,log}=await launch(`${process.argv[2]??'http://127.0.0.1:4173/'}?probe`,{w:mobile?844:1280,h:mobile?390:720,mobile,settings:{quality:process.env.GFX??(mobile?'low':'high'),renderer:process.env.BACKEND??'webgl'}});
const results=[];
fs.mkdirSync('artifacts/profiles',{recursive:true});
try {
  await page.waitForFunction(()=>window.__pfs?.snapshot().state==='title',null,{timeout:180000});
  await page.locator('#title .menu button').first().click();
  await page.locator('#title .looks button').first().click();
  await waitFor(page,s=>s.state==='playing');
  await page.evaluate(()=>window.__pfs.driveAt('car',1097,-950,0));
  const cdp=await page.context().newCDPSession(page); await cdp.send('Profiler.enable');
  const throttle=async down=>{
    if(!mobile) return down?page.keyboard.down('KeyW'):page.keyboard.up('KeyW');
    if(!down) return cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    const gas=await page.locator('#touch .gas').boundingBox();
    if(!gas) throw Error('Accelerator pedal is not visible');
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:gas.x+gas.width/2,y:gas.y+gas.height/2,id:1}]});
  };
  for(const [name,x,z,yaw,seconds] of [['bypass',1097,-950,0,40],['highway',100,-165.5,Math.PI/2,25]]) {
    await page.evaluate(([x,z,yaw])=>{window.__pfs.placeVehicle(x,z,yaw);window.__pfs.fuel(1);},[x,z,yaw]);
    await sleep(3000); await throttle(true); await sleep(4000);
    await cdp.send('Profiler.start');
    const rows=await page.evaluate(async seconds=>{
      const scene=window.__pfs.scene(), rows=[];
      const start=performance.now(); let last=start;
      const o=scene.onAfterRenderObservable.add(()=>{
        const now=performance.now(); rows.push({t:now-start,ms:now-last,...window.__pfs.ride()});last=now;
      });
      await new Promise(r=>setTimeout(r,seconds*1000));scene.onAfterRenderObservable.remove(o);return rows;
    },seconds);
    const {profile}=await cdp.send('Profiler.stop'); await throttle(false);
    fs.writeFileSync(`artifacts/profiles/${label}-${name}.cpuprofile`,JSON.stringify(profile));
    results.push({name,rows,snapshot:await page.evaluate(()=>window.__pfs.snapshot())});
    if(rows.filter(r=>r.throttle>.95 && r.state==='playing').length < rows.length*.95) throw Error('Sustained throttle was interrupted; this is not a valid driving measurement');
    await page.screenshot({path:`artifacts/profiles/${label}-${name}.png`});
    const ms=rows.map(r=>r.ms).sort((a,b)=>a-b), drops=rows.slice(1).filter((r,i)=>r.v<rows[i].v-.5);
    console.log(JSON.stringify({name,frames:rows.length,median:ms[Math.floor(ms.length*.5)],p95:ms[Math.floor(ms.length*.95)],over100:ms.filter(x=>x>100).length,speedDrops:drops.length,first:rows[0],last:rows.at(-1)}));
  }
  if(log.some(s=>/^\[(error|pageerror|http )/.test(s))) throw Error('Browser errors during driving; inspect the saved log');
} finally {fs.writeFileSync(`artifacts/profiles/${label}.json`,JSON.stringify({mobile,results,log}));await browser.close();}
