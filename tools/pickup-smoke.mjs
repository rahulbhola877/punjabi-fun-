import { launch, waitFor, sleep } from './pt-lib.mjs';
const {browser,page,log}=await launch(`${process.argv[2]??'http://127.0.0.1:5208/'}?probe`,{w:1280,h:720,settings:{quality:'low'}});
try {
  await page.waitForFunction(()=>window.__pfs?.snapshot().state==='title',null,{timeout:180000});
  await page.locator('#title .menu button').first().click();
  await page.locator('#title .looks button').first().click();
  await waitFor(page,s=>s.state==='playing',180000);
  const spawn=await page.evaluate(()=>window.__pfs.snapshot().vehicles.find(v=>v.id==='pickup_orchard'));
  if(!spawn) throw Error('Pickup missing from default spawns');
  await page.evaluate(p=>{window.__pfs.teleport(p.x-7,p.z+6,0);window.__pfs.holdCamera({eye:{x:p.x-7,y:3.5,z:p.z+7},at:{x:p.x,y:1,z:p.z},fov:0.8});},spawn);
  await sleep(5000);
  await page.screenshot({path:'/tmp/punjabi-pickup.png'});
  await page.evaluate(()=>window.__pfs.holdCamera(null));
  const id=await page.evaluate(()=>window.__pfs.driveAt('pickup', -1096, -650, 0));
  if(!id) throw Error('Could not enter pickup');
  const first=await page.evaluate(()=>window.__pfs.ride());
  const deadline=Date.now()+240000;
  let ride=first;
  await page.keyboard.down('KeyW');
  try {
    while(ride.z-first.z<5) {
      if(Date.now()>deadline || ride.simTime-first.simTime>12) throw Error(`Pickup did not drive: ${JSON.stringify(ride)}`);
      if(ride.up<0.7 || ride.y < -1) throw Error(`Pickup overturned: ${JSON.stringify(ride)}`);
      await sleep(250);
      ride=await page.evaluate(()=>window.__pfs.ride());
    }
  } finally {await page.keyboard.up('KeyW');}
  if(!ride.grounded || ride.up<0.85) throw Error(`Pickup is not grounded: ${JSON.stringify(ride)}`);
  // Exercise the new sloped road, not just a flat parking area.
  await page.evaluate(()=>window.__pfs.placeVehicle(-670,1850,-0.9));
  await sleep(1500);
  const hillStart=await page.evaluate(()=>window.__pfs.ride());
  let hill=hillStart;
  const hillDeadline=Date.now()+240000;
  await page.keyboard.down('KeyW');
  try {
    while(Math.hypot(hill.x-hillStart.x,hill.z-hillStart.z)<8) {
      if(Date.now()>hillDeadline || hill.simTime-hillStart.simTime>15) throw Error(`Pickup could not climb ridge: ${JSON.stringify(hill)}`);
      if(hill.up<0.7 || hill.y < -1) throw Error(`Pickup overturned on ridge: ${JSON.stringify(hill)}`);
      await sleep(250);
      hill=await page.evaluate(()=>window.__pfs.ride());
    }
  } finally {await page.keyboard.up('KeyW');}
  if(!hill.grounded || hill.up<0.85 || hill.y<hillStart.y+0.2) throw Error(`Pickup did not remain grounded while climbing: ${JSON.stringify({hillStart,hill})}`);
  const errors=await page.evaluate(()=>window.__pfs.snapshot().errors);
  if(errors.length||page.__external.length||log.some(s=>/^\[(error|pageerror|http )/.test(s))) throw Error(JSON.stringify({errors,external:page.__external,log}));
  console.log(JSON.stringify({spawn,initial:first,final:ride,hillStart,hill,errors,log}));
} finally {await browser.close();}
