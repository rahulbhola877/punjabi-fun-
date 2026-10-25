import { launch, waitFor, sleep } from './pt-lib.mjs';
import fs from 'node:fs';
const {browser,page,log}=await launch(`${process.argv[2]??'http://127.0.0.1:4173/'}?probe`,{w:1280,h:720,settings:{quality:'high'}});
fs.mkdirSync('artifacts/review',{recursive:true});
const report={};
try {
  await page.waitForFunction(()=>window.__pfs?.snapshot().state==='title',null,{timeout:180000});
  await page.locator('#title .menu button').first().click();
  await page.locator('#title .looks button').first().click();
  await waitFor(page,s=>s.state==='playing');
  report.ground=await page.evaluate(()=>[-1100,1100].flatMap(x=>[-1100,-600,170,1050].map(z=>({x,z,hit:window.__pfs.ray(x,8,z,x,-5,z)}))));
  if(report.ground.some(q=>!q.hit||q.hit.p[1]<-1)) throw Error('Expanded road or bridge has no floor');
  await page.evaluate(()=>{window.__pfs.teleport(-890,-1090,0);window.__pfs.parkAll(-900,-1100);});
  await sleep(3000);
  for(const type of ['bus','truck','car','tractor']) {
    const p=await page.evaluate(type=>window.__pfs.snapshot().vehicles.find(v=>v.id===`show_${type}`),type);
    await page.evaluate(p=>window.__pfs.teleport(p.x-8,p.z+9,0),p);
    await sleep(1500);
    await page.evaluate(p=>{
      const scene=window.__pfs.scene(), cam=scene.activeCamera;
      const target=cam.position.clone().set(p.x,p.y+1.5,p.z);
      window.__reviewObs=scene.onBeforeRenderObservable.add(()=>{cam.position.set(p.x-10,p.y+5,p.z+11);cam.setTarget(target);});
      document.getElementById('ui').style.visibility='hidden';
    },p);
    await sleep(500);
    await page.screenshot({path:`artifacts/review/${type}.png`});
    await page.evaluate(()=>{window.__pfs.scene().onBeforeRenderObservable.remove(window.__reviewObs);document.getElementById('ui').style.visibility='';});
  }
  await page.evaluate(()=>window.__pfs.driveAt('bus',-1100,-650,0));
  await page.keyboard.down('KeyW'); await sleep(3500); await page.keyboard.up('KeyW');
  report.bus=await page.evaluate(()=>window.__pfs.ride());
  if(report.bus.z<=-645||report.bus.up<0.85||report.bus.y < -1) throw Error('Bus failed to drive on expanded road');
  await page.keyboard.down('Space'); await sleep(3000); await page.keyboard.up('Space');
  await page.keyboard.press('KeyE');
  await waitFor(page,s=>!s.vehicle);
  await page.evaluate(()=>window.__pfs.driveAt('truck',1100,-650,0));
  await page.keyboard.down('KeyW'); await sleep(3500); await page.keyboard.up('KeyW');
  report.truck=await page.evaluate(()=>window.__pfs.ride());
  if(report.truck.z<=-645||report.truck.up<0.85||report.truck.y < -1) throw Error('Truck failed to drive on expanded road');
  report.errors=await page.evaluate(()=>window.__pfs.snapshot().errors);
  report.external=page.__external;
  report.log=log;
  if(report.errors.length||report.external.length||log.some(s=>/^\[(error|pageerror)\]/.test(s))) throw Error('Runtime or external request errors');
  console.log(JSON.stringify(report));
} catch(e) {report.failure=String(e);process.exitCode=1;console.error(e);}
finally {fs.writeFileSync('artifacts/review/smoke.json',JSON.stringify(report,null,2));await browser.close();}
