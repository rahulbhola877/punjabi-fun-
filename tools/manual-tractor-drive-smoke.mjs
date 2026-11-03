import fs from 'node:fs';
import path from 'node:path';
import { launch, waitFor } from './pt-lib.mjs';
import { instrumentSystems } from './cost-profile-core.mjs';

const base = process.argv[2] ?? 'http://127.0.0.1:4176/';
const seed = fs.readFileSync(process.env.SEED_SAVE ?? 'artifacts/studio/punjab-candidate/gameplay/earned-save.json', 'utf8');
const out = path.join('artifacts/studio/manual-tractor', new Date().toISOString().replaceAll(':', '-'));
fs.mkdirSync(out, { recursive: true });
const report = { source: process.env.SOURCE ?? 'unspecified', method: 'Earned save; teleport to sponsorship and start before race. During race only keyboard throttle/steering and fixed-step game ticks; read-only position and objective guide the driver. No raceRun or placement during race.', checks: [], samples: [], errors: [] };
const save = () => fs.writeFileSync(path.join(out, 'checks.json'), JSON.stringify(report, null, 2));
const check = (ok, label) => { if (!ok) throw Error(label); report.checks.push(label); save(); };
let run, page, browser;
const tick = n => page.evaluate(n => { const p = window.__pfs, s = p.scene(), render = s.render; s.render = () => {}; try { p.tick(n, null); } finally { s.render = render; } }, n);
const snapshot = () => page.evaluate(() => ({ ...window.__pfs.snapshot(), objective: (() => { const o = window.__costGame.currentObjective(); return o ? { ...o, target: o.target ? {x:o.target.x,z:o.target.z} : null } : null; })(), race: window.__pfs.race(), sponsorship: window.__costGame.save.tractorSponsorship }));
async function capture(name) { await page.evaluate(() => { const s = window.__pfs.scene(), e = s.getEngine(); e.beginFrame(); s.render(); e.endFrame(); }); await page.screenshot({ path: path.join(out, `${name}.png`) }); }
async function approach(id, x, z) {
  for (const [dx, dz, yaw] of [[0,-1.2,0],[-1.2,0,Math.PI/2],[0,1.2,Math.PI],[1.2,0,-Math.PI/2],[0,2,Math.PI]]) {
    await page.evaluate(p => window.__pfs.teleport(p.x,p.z,p.yaw), { x:x+dx,z:z+dz,yaw }); await tick(30);
    if ((await snapshot()).interactionId === id) return;
  }
  throw Error(`Cannot approach ${id}`);
}
async function interact() { await page.keyboard.press('KeyE'); await tick(2); }
async function choose(label) { const b = page.locator('.dialogue button').filter({hasText:label}); await b.waitFor({state:'visible',timeout:20000}); await b.click(); await tick(2); }
let held = new Set();
async function keys(want) { const next = new Set(want); for (const k of held) if (!next.has(k)) await page.keyboard.up(k); for (const k of next) if (!held.has(k)) await page.keyboard.down(k); held = next; }
try {
  run = await launch(base+'?probe&hour=10', {w:960,h:540,settings:{quality:'medium',post:false,shadows:'off',renderScale:1},storage:{'pfs.save':seed},seed:0x48192}); ({page,browser}=run);
  await waitFor(page,s=>s.state==='title',150000); await page.getByRole('button',{name:'Continue',exact:true}).click(); await waitFor(page,s=>s.state==='playing',90000);
  await page.evaluate(()=>{window.__pfs.captureHold(true);window.__pfs.weather(false)}); await instrumentSystems(await page.context().newCDPSession(page), page); await tick(30);
  await approach('kotli_sarpanch',-12,318); await interact(); await choose('Kotli:');
  check((await snapshot()).sponsorship?.stage==='ready','Sponsorship ready from earned save');
  await approach('tractorRace',-607,-412); await interact(); await choose('Sponsored race');
  check((await snapshot()).sponsorship?.stage==='racing','Sponsored race started'); await capture('start'); await tick(210);
  let lastGate = 0, previous = null, stuck = 0, recoveries = 0;
  for (let step=0; step<1600; step++) {
    const s = await snapshot();
    if (!s.race.active) break;
    const v = s.vehicle, target = s.objective?.target;
    if (!v || !target) throw Error('Vehicle or gate objective unavailable');
    const gates=[{x:-300,z:-400},{x:-300,z:-760},{x:-600,z:-760},{x:-600,z:-400}];
    const gate = gates.findIndex(g=>Math.hypot(g.x-target.x,g.z-target.z)<1);
    if (gate<0) throw Error('Unexpected objective '+JSON.stringify(target));
    if (gate>lastGate) { report.checks.push(`Passed gate ${lastGate+1}`); lastGate=gate; await capture(`gate-${gate}`); save(); }
    const dist=Math.hypot(target.x-v.x,target.z-v.z);
    // Aim ahead along the center of the current straight, clamped at the gate.
    const aim = gate===0 ? {x:Math.min(-300,v.x+25),z:-400}
      : gate===1 ? {x:-300,z:Math.max(-760,v.z-25)}
      : gate===2 ? {x:Math.max(-600,v.x-25),z:-760}
      : {x:-600,z:Math.min(-400,v.z+25)};
    const dx=aim.x-v.x,dz=aim.z-v.z, err=Math.atan2(Math.sin(Math.atan2(dx,dz)-v.yaw),Math.cos(Math.atan2(dx,dz)-v.yaw));
    if (step%20===0) { report.samples.push({step,gate:gate+1,dist:Math.round(dist*10)/10,err:Math.round(err*100)/100,vehicle:v}); save(); }
    stuck = previous && Math.hypot(v.x-previous.x,v.z-previous.z)<0.08 ? stuck+1 : 0; previous=v;
    if (stuck>20) {
      if (recoveries>=2) throw Error('Tractor still stuck after two reverse attempts: '+JSON.stringify(v));
      recoveries++; report.checks.push(`Reverse recovery ${recoveries} at gate ${gate+1}: ${JSON.stringify(v)}`); save(); await capture(`stuck-${recoveries}`);
      await keys(['KeyS']); await tick(120); await keys([]); await tick(10); stuck=0; previous=null; continue;
    }
    const targetSpeed=Math.abs(err)>0.65?4:Math.abs(err)>0.25?7:10.5;
    const k=[]; if(err>0.055) k.push('KeyD'); else if(err< -0.055) k.push('KeyA');
    if(v.speed<targetSpeed-0.4) k.push('KeyW'); else if(v.speed>targetSpeed+1) k.push('KeyS');
    await keys(k); await tick(12);
  }
  await keys([]); await tick(2); const s=await snapshot(); report.final=s;
  check(!s.race.active,'Race ended'); check(s.sponsorship?.stage==='report','Finished lap qualified for report');
  const result=page.getByRole('button',{name:'Shabaash',exact:true}); await result.waitFor({state:'visible',timeout:15000});
  report.results=await page.locator('body').innerText(); check(!report.results.includes('Waqt khatam'),'Results show a completed lap before time limit');
  await capture('finish'); check(!run.log.some(s=>/^\[(http|error|pageerror)/.test(s))&&!page.__external.length,'No browser runtime or request errors'); report.complete=true; save();
} catch(e) { report.errors.push(String(e.stack??e)); save(); try { await keys([]); await capture('failure'); } catch {} process.exitCode=1; }
finally { await browser?.close(); }
