// Actual throttle/steer inputs, two road turns and camera rotation. The probe
// supplies fixed 30 Hz simulation; RENDER_EVERY>1 is a diagnostic capture
// cadence only, explicitly recorded and never presented as game FPS.
import fs from 'node:fs';
import {launch,waitFor}from './pt-lib.mjs';
const base=process.argv[2]??'http://127.0.0.1:4178/',label=process.env.LABEL??'sustained-drive',every=Number(process.env.RENDER_EVERY??1),out=`artifacts/system-profiles/${label}`;
fs.mkdirSync(out,{recursive:true});
const {browser,page,log}=await launch(`${base}?probe&hour=9`,{w:1280,h:720,settings:{quality:'high',renderer:'webgl',renderScale:1},seed:0x48192});
const route=[[20,-160],[8,-158],[0,-150],[0,-110],[0,-76],[0,-42],[0,-16],[-3,-8],[-14,-8],[-29,-8]];
try{
 await waitFor(page,s=>s.state==='title',300000);await page.locator('#title .menu button').first().click();await page.locator('#title .looks button').first().click();
 const skip=page.locator('[data-cinematic-skip]');if(await skip.count()){await skip.waitFor({state:'visible',timeout:180000});await skip.click();}
 await waitFor(page,s=>s.state==='playing',180000);
 await page.evaluate(()=>{const p=window.__pfs;p.captureHold(true);p.stage(999);if(!p.driveAt('car',100,-160,-Math.PI/2))throw Error('drive setup');});
 await page.evaluate(({route,every})=>{window.__route={route,every,index:0,frames:0,rows:[],samples:[],held:[],distance:0,last:null,done:false};},{route,every});
 for(let batch=0;batch<150;batch++){
  const result=await page.evaluate(async()=>{
   const p=window.__pfs,s=p.scene(),e=s.getEngine(),r=window.__route,render=s.render;
   const keys=next=>{for(const code of r.held)if(!next.includes(code))window.dispatchEvent(new KeyboardEvent('keyup',{code,bubbles:true}));for(const code of next)if(!r.held.includes(code))window.dispatchEvent(new KeyboardEvent('keydown',{code,bubbles:true}));r.held=next;};
   let reached=false;
   try{for(let n=0;n<15&&!r.done;n++){
    let q=p.snapshot(),v=q.vehicle;if(!v)throw Error('lost driven car');
    const target=r.route[r.index],dx=target[0]-v.x,dz=target[1]-v.z,d=Math.hypot(dx,dz);
    if(d<2.8){r.index++;reached=true;if(r.index>=r.route.length){r.done=true;keys([]);break;}continue;}
    const error=Math.atan2(Math.sin(Math.atan2(dx,dz)-v.yaw),Math.cos(Math.atan2(dx,dz)-v.yaw));
    const cruise=Math.min(9,d*.7+1.5),speed=Math.abs(error)>.5?3.5:cruise,next=[];
    if(error>.055)next.push('KeyD');else if(error<-.055)next.push('KeyA');
    if(v.speed<speed-.25)next.push('KeyW');else if(v.speed>speed+.7)next.push('KeyS');
    if(r.frames>=180&&r.frames<200)next.push('KeyJ');if(r.frames>=210&&r.frames<230)next.push('KeyL');
    keys(next);const draw=r.frames%r.every===0;
    s.render=draw?render:()=>{};const start=performance.now();e.beginFrame();p.tick(1,null);e.endFrame();const ms=performance.now()-start;
    q=p.snapshot();if(r.last)r.distance+=Math.hypot(q.vehicle.x-r.last.x,q.vehicle.z-r.last.z);r.last=q.vehicle;
    r.samples.push({rendered:draw,ms});r.frames++;
    if(r.frames%30===0)r.rows.push({frame:r.frames,simSeconds:r.frames/30,index:r.index,vehicle:q.vehicle,traffic:q.traffic,residents:q.residents,camera:q.cameraPos,camYaw:q.camYaw,draws:draw?q.drawCalls:null});
    if(draw)await new Promise(resolve=>setTimeout(resolve,0));
   }}finally{s.render=render;}
   return{frame:r.frames,index:r.index,done:r.done,reached,distance:r.distance,state:p.snapshot()};
  });
  if(result.reached||batch%20===0||batch===12||batch===14){console.log(JSON.stringify(result));await page.screenshot({path:`${out}/route-${String(result.frame).padStart(4,'0')}.png`,timeout:180000});}
  if(result.done)break;
 }
 const data=await page.evaluate(()=>{const r=window.__route,p=window.__pfs;for(const code of r.held)window.dispatchEvent(new KeyboardEvent('keyup',{code,bubbles:true}));return{...r,last:p.snapshot(),settings:{renderCadence:r.every,simulationHz:30,resolution:[p.scene().getEngine().getRenderWidth(),p.scene().getEngine().getRenderHeight()]}};});
 fs.writeFileSync(`${out}/measurements.json`,JSON.stringify({base,label,notes:'Natural population and traffic; fixed simulation clock, full-resolution images. Reduced capture cadence is a harness diagnostic, not runtime performance evidence or a game setting.',data,log,external:page.__external},null,2));
 if(!data.done||data.distance<200||log.some(x=>/^\[(http|error|pageerror)/.test(x))||page.__external.length)throw Error(`Route incomplete or console errors: ${data.index}, ${data.distance}m`);
}finally{await browser.close();}
