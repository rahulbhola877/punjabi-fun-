import fs from 'node:fs';
import path from 'node:path';
import { launch, waitFor } from './pt-lib.mjs';
import { instrumentSystems } from './cost-profile-core.mjs';

// Location fixtures are permitted only outside active matches. Raid movement uses
// keyboard input and attacks use native touch (mobile) or keyboard (desktop).
const base = process.argv[2] ?? 'http://127.0.0.1:4176/';
const root = process.env.OUT ?? 'artifacts/studio/kotli-selection';
const out = path.join(root, new Date().toISOString().replaceAll(':', '-'));
fs.mkdirSync(out, { recursive: true });
const mobile = process.env.MOBILE !== '0';
const seedSave = process.env.SEED_SAVE ? fs.readFileSync(process.env.SEED_SAVE, 'utf8') : null;
const selectionRequested = !!seedSave || process.env.SELECTION === '1';
const width = Number(process.env.VIEW_W ?? 960), height = Number(process.env.VIEW_H ?? 540);
const report = { source: process.env.SOURCE ?? 'unrecorded', base, out, mobile, seedSave: process.env.SEED_SAVE ?? null, selectionRequested, complete: false,
  method: 'Optional Continue from an earned practice save, otherwise new-game intro-stage fixture. NPC location fixtures only between matches; visible Sarpanch/Ustad dialogues. After kabaddi starts: keyboard movement; MOBILE=1 attacks use native CDP touch on the visible Touch button, MOBILE=0 uses keyboard attack; live defender positions read for navigation, captureHold/tick at 30 Hz with sparse renders. No mission/raid-state injection or actor relocation; no teleports during either match. Mobile is browser emulation with keyboard movement and native CDP touch attacks, not a complete touch-only journey or physical-device acceptance. Crowd physics remains active. Delayed raid transitions use real wall time.',
  checks: [], frames: [], attacks: [], errors: [] };
let browser, page, run, cdp, matchStarted = false;
const save = () => fs.writeFileSync(path.join(out, 'checks.json'), JSON.stringify(report, null, 2));
const check = (ok, message) => { if (!ok) throw Error(message); report.checks.push(message); save(); };
const deadline = setTimeout(() => { report.errors.push('600-second diagnostic deadline exceeded'); save(); void browser?.close(); process.exitCode = 1; }, 600000);
console.log(`Kotli evidence: ${out}`);
async function tick(n = 1) { await page.evaluate(n => { const p = window.__pfs, scene = p.scene(), render = scene.render; scene.render = () => {}; try { p.tick(n, null); } finally { scene.render = render; } }, n); }
async function release() { for (const key of ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ShiftLeft', 'KeyQ', 'KeyE']) await page?.keyboard.up(key); }
async function press(key = 'KeyE') { await page.keyboard.down(key); await tick(); await page.keyboard.up(key); await tick(); }
async function attack() {
  if (!mobile) { await press('KeyQ'); return; }
  const control = page.getByRole('button', { name: 'Kabaddi: touch a defender', exact: true });
  if (!(await control.isVisible())) throw Error('Actual mobile Touch control is unavailable');
  const box = await control.boundingBox();
  if (!box) throw Error('Actual mobile Touch control has no hit rectangle');
  const point = { id: 71, x: box.x + box.width / 2, y: box.y + box.height / 2 };
  const before = await sample();
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point] });
  try { await tick(); }
  finally { await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); }
  await tick();
  const after = await sample();
  report.attacks.push({ method: 'native CDP touch on visible Kabaddi Touch control', point, roundKind: before.story?.roundKind, raid: before.raid, touchedBefore: before.touched, touchedAfter: after.touched, phaseAfter: after.phase });
  save();
}
async function choose(label) { const button = page.locator('.dialogue button').filter({ hasText: label }); await button.waitFor({ state: 'visible', timeout: 20000 }); await button.click(); await tick(); }
async function capture(name) { await release(); await page.evaluate(() => { const scene = window.__pfs.scene(), engine = scene.getEngine(); engine.beginFrame(); scene.render(); engine.endFrame(); }); await page.screenshot({ path: path.join(out, `${name}.png`) }); }
async function sample() {
  return page.evaluate(() => {
    const g = window.__costGame, k = g.kabaddi, s = window.__pfs.snapshot();
    return { snapshot: s, story: g.save.kotliSelection, active: k.active, phase: k.phase, raid: k.raid, touched: k.touched, breath: k.breath, busy: k.busy,
      defenders: k.defs.map(d => ({ id: d.r.id, x: d.r.pos.x, z: d.r.pos.z, out: d.out })),
      errors: s.errors, rep: g.save.rep, relationship: g.save.people.sarpanch?.rep ?? 0, saved: JSON.parse(localStorage.getItem('pfs.save') ?? 'null')?.kotliSelection };
  });
}
async function fixtureAt(id, resident) {
  if (matchStarted || (await sample()).active) throw Error('Refusing location fixture during active match');
  await page.evaluate(({ x, z }) => window.__pfs.teleport(x, z, 0), { x: resident.x, z: resident.z - 1.2 });
  await tick(30);
  for (const [dx, dz, yaw] of [[0, -1.2, 0], [-1.2, 0, Math.PI / 2], [0, 1.2, Math.PI], [1.2, 0, -Math.PI / 2]]) {
    await page.evaluate(p => window.__pfs.teleport(p.x, p.z, p.yaw), { x: resident.x + dx, z: resident.z + dz, yaw }); await tick(6);
    if ((await page.evaluate(() => window.__pfs.snapshot().interactionId)) === id) return;
  }
  throw Error(`NPC fixture could not select ${id}: ${JSON.stringify(await page.evaluate(() => window.__pfs.reach()))}`);
}
async function moveInput(state, target) {
  const p = state.snapshot.player, dx = target.x - p.x, dz = target.z - p.z;
  const angle = Math.atan2(dx, dz) - state.snapshot.camYaw;
  const oct = Math.round(Math.atan2(Math.sin(angle), Math.cos(angle)) / (Math.PI / 4));
  const keys = { 0: ['KeyW'], 1: ['KeyW', 'KeyD'], 2: ['KeyD'], 3: ['KeyS', 'KeyD'], 4: ['KeyS'], '-4': ['KeyS'], '-3': ['KeyS', 'KeyA'], '-2': ['KeyA'], '-1': ['KeyW', 'KeyA'] }[oct] ?? ['KeyW'];
  await release(); for (const key of keys) await page.keyboard.down(key);
  if (Math.hypot(dx, dz) > 2) await page.keyboard.down('ShiftLeft');
  await tick(2); await release();
}
async function playMatch(requiredTouches, label) {
  let targetId = null, lastRaid = 0, scored = false, state;
  for (let i = 0; i < 1800; i++) {
    state = await sample();
    if (i % 15 === 0 || state.raid !== lastRaid) { report.frames.push({ match: label, iteration: i, player: state.snapshot.player, phase: state.phase, raid: state.raid, touched: state.touched, breath: state.breath, story: state.story, defenders: state.defenders }); save(); }
    const earned = label === 'practice' ? state.saved?.practiceComplete : state.saved?.bestTouches >= requiredTouches;
    if (earned && !scored) { scored = true; check(true, `${label}: genuine scoring return recorded and persisted`); await capture(`${label}-first-scoring-return`); }
    if (!state.active) break;
    if (state.busy || state.phase === 'after') { await release(); await page.waitForTimeout(3500); await tick(2); continue; }
    if (state.raid !== lastRaid) { lastRaid = state.raid; targetId = state.defenders.filter(d => !d.out).sort((a, b) => a.z - b.z)[0]?.id ?? null; }
    const p = state.snapshot.player;
    if (state.touched >= requiredTouches) await moveInput(state, { x: -123.5, z: p.z });
    else {
      const defender = state.defenders.find(d => d.id === targetId && !d.out) ?? state.defenders.filter(d => !d.out).sort((a,b) => Math.hypot(a.x-p.x,a.z-p.z)-Math.hypot(b.x-p.x,b.z-p.z))[0];
      if (!defender) throw Error(`${label}: no live defender available`);
      targetId = defender.id;
      if (Math.hypot(defender.x - p.x, defender.z - p.z) < 1.4 && state.phase === 'raid') await attack();
      else await moveInput(state, defender);
    }
  }
  await release(); state = await sample(); report.last = state;
  check(!state.active, `${label}: match completed within bounded input navigator`);
  const resultButton = page.getByRole('button', { name: 'Shabaash', exact: true });
  await resultButton.waitFor({ state: 'visible', timeout: 15000 });
  await capture(`${label}-match-results`); await resultButton.click(); await tick(2);
  state = await sample();
  check(state.snapshot.state === 'playing', `${label}: visible match result dismissed before next interaction`);
  if (mobile) check(report.attacks.some(a => a.roundKind === label && a.touchedAfter > a.touchedBefore), `${label}: native CDP Touch tags a live defender`);
  matchStarted = false;
  return state;
}
try {
  run = await launch(`${base}?probe&hour=10`, { w: width, h: height, mobile, settings: { quality: 'medium', post: false, shadows: 'off', renderScale: 1 }, storage: seedSave ? { 'pfs.save': seedSave } : undefined, seed: 0x48192 });
  ({ browser, page } = run); await waitFor(page, s => s.state === 'title', 150000);
  if (seedSave) await page.getByRole('button', { name: 'Continue', exact: true }).click();
  else {
    await page.locator('#title .menu button').first().click(); await page.locator('#title .looks button').first().click();
    const skip = page.locator('[data-cinematic-skip]'); await skip.waitFor({ state: 'visible', timeout: 90000 }); await skip.click();
  }
  await waitFor(page, s => s.state === 'playing', 90000);
  if (mobile) await page.touchscreen.tap(width - 60, 100);
  await page.evaluate(seeded => { window.__pfs.captureHold(true); if (!seeded) window.__pfs.stage(999); window.__pfs.weather(false); }, !!seedSave);
  cdp = await page.context().newCDPSession(page); await instrumentSystems(cdp, page);
  if (!seedSave) {
  await page.evaluate(() => window.__pfs.teleport(-12, 316.8, 0)); await tick(90);
  const sarpanch = await page.evaluate(() => { const r = window.__costGame.crowd.get('sarpanch'); return r && { x: r.pos.x, z: r.pos.z }; });
  check(!!sarpanch, 'Existing Sarpanch streamed'); await fixtureAt('kotli_sarpanch', sarpanch); await press(); await choose("I'll try");
  check((await sample()).story?.stage === 'practice', 'Visible Sarpanch invitation starts practice'); await capture('sarpanch-invitation');
  const coach = await page.evaluate(() => { const r = window.__costGame.jhagde.ustad; return r && { x: r.pos.x, z: r.pos.z }; });
  check(!!coach, 'Existing Ustad present'); await fixtureAt('kotli_coach', coach); await press(); await choose('Kabaddi selection');
  await capture('ustad-practice-instructions'); await choose('Start the match'); matchStarted = true;
  let state = await sample(); check(state.active && state.story?.stage === 'playing', 'Visible Ustad admission starts actual practice match');
  if (mobile) {
    const button = page.getByRole('button', { name: 'Kabaddi: touch a defender', exact: true });
    report.touchLabel = { count: await button.count(), visible: await button.isVisible().catch(() => false), text: await button.textContent().catch(() => null) };
    check(report.touchLabel.visible && /Touch/i.test(report.touchLabel.text ?? ''), 'Mobile emulation displays visible Touch attack control');
    report.hudOverlap = await page.evaluate(() => { const panel=document.querySelector('#hud .match').getBoundingClientRect(); return [...document.querySelectorAll('#hud .wallet .chip')].filter(el=>{const s=getComputedStyle(el),r=el.getBoundingClientRect();return s.display!=='none'&&s.visibility!=='hidden'&&r.width>0&&r.height>0&&r.left<panel.right&&r.right>panel.left&&r.top<panel.bottom&&r.bottom>panel.top;}).map(el=>el.textContent); });
    check(report.hudOverlap.length===0, `Visible wallet elements do not overlap match instructions: ${JSON.stringify(report.hudOverlap)}`); await capture('mobile-touch-control');
    const overlap = await page.evaluate(() => { const a=document.querySelector('#hud .match').getBoundingClientRect(),b=document.querySelector('#touch [aria-label="Kabaddi: touch a defender"]').getBoundingClientRect();return a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top; });
    check(!overlap, 'Match instructions do not overlap the Touch control');
  }
  const practice = await playMatch(1, 'practice');
  check(practice.saved?.practiceComplete, 'At least one genuine scoring practice raid completed');
  check(practice.story?.stage === 'choose' && practice.saved?.stage === 'choose', 'Four real practice raids complete and role-choice checkpoint saves');
  if (mobile) check(await page.evaluate(()=>[...document.querySelectorAll('#hud .wallet .travelbtn')].every(el=>getComputedStyle(el).display!=='none')), 'Story and travel shortcuts return after the match');
  await capture('practice-complete');
  fs.writeFileSync(path.join(out, 'practice-earned-save.json'), await page.evaluate(() => localStorage.getItem('pfs.save')));
  } else {
    const restored = await sample();
    check(restored.story?.stage === 'choose' && restored.story?.practiceComplete, 'Continue restores earned practice completion without injecting story progress');
  }
  if (selectionRequested) {
    await page.evaluate(() => window.__pfs.teleport(-12, 316.8, 0)); await tick(60);
    const sarpanch = await page.evaluate(() => { const r = window.__costGame.crowd.get('sarpanch'); return r && { x: r.pos.x, z: r.pos.z }; });
    check(!!sarpanch, 'Selection: actual Sarpanch present'); await fixtureAt('kotli_sarpanch', sarpanch); await press();
    await capture('sarpanch-role-choice'); await choose('Attacking raider');
    check((await sample()).saved?.role === 'raider' && (await sample()).story?.stage === 'ready', 'Visible Sarpanch choice persists attacking-raider role');
    const coach = await page.evaluate(() => { const r = window.__costGame.jhagde.ustad; return r && { x: r.pos.x, z: r.pos.z }; });
    check(!!coach, 'Selection: actual Ustad present'); await fixtureAt('kotli_coach', coach); await press(); await choose('Kabaddi selection');
    await capture('ustad-selection-instructions'); await choose('Start the match'); matchStarted = true;
    check((await sample()).story?.roundKind === 'selection', 'Visible Ustad admission starts the actual selection match');
    const selected = await playMatch(2, 'selection');
    check(selected.saved?.bestTouches >= 2 && selected.story?.stage === 'report' && selected.saved?.stage === 'report', 'Two live-defender touches safely returned and selection result persisted');
    fs.writeFileSync(path.join(out, 'selection-earned-save.json'), await page.evaluate(() => localStorage.getItem('pfs.save')));
    await capture('selection-complete');
    const before = await sample(); await fixtureAt('kotli_sarpanch', sarpanch); await press(); await choose('Shukriya');
    const after = await sample();
    check(after.saved?.receipt === true && after.story?.stage === 'done' && after.story?.role === 'raider', 'Visible Sarpanch turn-in saves attacking-raider receipt');
    check(after.rep === before.rep + 5 && after.relationship === before.relationship + 1, 'Attacking-raider turn-in grants five reputation and one Sarpanch relationship');
    await capture('sarpanch-selection-reward'); await press(); await choose('Theek hai');
    const repeated = await sample(); check(repeated.rep === after.rep && repeated.relationship === after.relationship, 'Repeated visible Sarpanch conversation grants no duplicate consequence');
  }
  fs.writeFileSync(path.join(out, 'earned-save.json'), await page.evaluate(() => localStorage.getItem('pfs.save')));
  check(!run.log.some(s => /^\[(http|error|pageerror)/.test(s)) && !page.__external.length, 'No browser runtime, HTTP or external request errors');
  report.complete = true; save();
} catch (error) {
  report.errors.push(String(error.stack ?? error));
  if (page) { report.last = await sample().catch(() => null); await capture('failure').catch(() => {}); const earned = await page.evaluate(() => localStorage.getItem('pfs.save')).catch(() => null); if (earned) fs.writeFileSync(path.join(out, 'earned-save.json'), earned); }
  process.exitCode = 1;
} finally {
  report.browserLog = run?.log ?? []; save(); clearTimeout(deadline); await cdp?.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }).catch(() => {}); await release().catch(() => {}); await browser?.close();
}
