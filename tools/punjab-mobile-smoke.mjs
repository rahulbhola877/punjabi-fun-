import fs from 'node:fs';
import { launch, waitFor, snap, sleep } from './pt-lib.mjs';

// Diagnostic only: actual CDP touch/menu input, with captureHold/tick accelerating
// simulation and scene rendering suppressed between full-resolution captures.
const base = process.argv[2] ?? 'http://127.0.0.1:4176/';
const out = process.env.OUT ?? 'artifacts/studio/punjab-mobile';
fs.mkdirSync(out, { recursive: true });
const report = { source: process.env.SOURCE ?? 'unrecorded', base, seed: process.env.SEED_SAVE ?? null,
  method: 'Earned save Continue; native CDP touch inputs; diagnostic captureHold/tick at 30 Hz with rendering suppressed between captures. Not ordinary timing, physical-device performance, or a complete gameplay acceptance.',
  settings: { quality: 'medium', renderScale: 1, post: false }, complete: false, orientations: [], errors: [] };
const save = () => fs.writeFileSync(`${out}/checks.json`, JSON.stringify(report, null, 2));
const deadline = setTimeout(() => { report.errors.push('600-second deadline exceeded'); save(); process.exit(1); }, 600000);
let browser, page, cdp, log = [], current;
const assert = (condition, message) => { if (!condition) throw Error(message); current.checks.push(message); save(); };
const sample = () => page.evaluate(() => ({ snapshot: window.__pfs.snapshot(), cricket: window.__pfs.cricket() }));
async function step(n = 1) {
  current.frames += n;
  if (current.frames > 18000) throw Error('18000 diagnostic frame ceiling');
  await page.evaluate(n => { const p = window.__pfs, s = p.scene(), render = s.render; s.render = () => {}; try { p.tick(n, null); } finally { s.render = render; } }, n);
}
async function touch(type, points) {
  current.events.push({ type, points, at: Date.now() }); save();
  await cdp.send('Input.dispatchTouchEvent', { type, touchPoints: points });
}
async function box(locator) { const b = await locator.boundingBox(); if (!b) throw Error(`Missing visible control: ${locator}`); return b; }
const center = (b, id) => ({ id, x: b.x + b.width / 2, y: b.y + b.height / 2 });
async function tap(locator, id = 20) { const p = center(await box(locator), id); await touch('touchStart', [p]); await touch('touchEnd', [p]); }
async function capture(name) {
  await page.evaluate(() => { const s = window.__pfs.scene(), e = s.getEngine(); e.beginFrame(); s.render(); e.endFrame(); });
  await page.screenshot({ path: `${out}/${name}.png`, timeout: 30000 }); current.captures.push(`${name}.png`); save();
}
async function gesture(dx, dy, frames) {
  const b = await box(page.locator('.tzone.stick'));
  const start = center(b, 1), moved = { ...start, x: start.x + dx, y: start.y + dy };
  await touch('touchStart', [start]); await touch('touchMove', [moved]); await step(frames); await touch('touchEnd', [moved]); await step(2);
}
async function walkToBoard() {
  let s = await snap(page), d = Math.hypot(120.8 - s.player.x, -24 - s.player.z);
  assert(d <= 30, `Earned save starts within 30m of park board (${d.toFixed(1)}m)`);
  let stuck = 0, last = s.player;
  for (let i = 0; i < 500; i++) {
    s = await snap(page); const dx = 120.8 - s.player.x, dz = -24 - s.player.z; d = Math.hypot(dx, dz);
    if (s.prompt?.includes('Gali da Cup')) return;
    if (Math.hypot(s.player.x - last.x, s.player.z - last.z) < .015) stuck++; else stuck = 0;
    if (stuck > 18) throw Error(`Touch route blocked at ${JSON.stringify(s.player)}`);
    last = s.player;
    const a = Math.atan2(dx, dz) - s.camYaw;
    await gesture(Math.sin(a) * 42, -Math.cos(a) * 42, d < 2 ? 2 : 7);
  }
  throw Error('Touch route failed to reach board prompt');
}
async function verifyControls(name) {
  const details = await page.evaluate(() => {
    const names = ['Cricket action: swing, catch or return', 'Jump', 'Kick', 'Pause'];
    return Object.fromEntries(names.map(name => { const el = document.querySelector(`#touch [aria-label="${name}"]`); const b = el?.getBoundingClientRect(); const style = el && getComputedStyle(el); const visible = !!b && b.width > 0 && b.height > 0 && style.visibility !== 'hidden' && style.display !== 'none'; const hit = visible && document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2); return [name, { visible, text: el?.textContent, rect: b && { x: b.x, y: b.y, width: b.width, height: b.height }, hit: !!hit && (hit === el || el.contains(hit)) }]; }));
  });
  current.controls = details; save();
  const play = details['Cricket action: swing, catch or return'];
  assert(play.visible && play.hit && play.text.includes('Play'), `${name}: Play is visible, labelled and hit-testable`);
  assert(!details.Jump.visible && !details.Kick.visible, `${name}: Jump and Kick hidden during cricket`);
  for (const [key, v] of Object.entries(details)) if (v.visible) assert(v.rect.x >= 0 && v.rect.y >= 0 && v.rect.x + v.rect.width <= current.viewport[0] && v.rect.y + v.rect.height <= current.viewport[1], `${name}: ${key} inside viewport`);
}
async function runOrientation(name, width, height, seed) {
  current = { name, viewport: [width, height], frames: 0, checks: [], captures: [], events: [] }; report.orientations.push(current); save();
  ({ browser, page, log } = await launch(`${base}?probe`, { w: width, h: height, mobile: true, settings: report.settings, storage: { 'pfs.save': seed } }));
  cdp = await page.context().newCDPSession(page);
  await waitFor(page, s => s.state === 'title', 180000);
  await tap(page.getByRole('button', { name: 'Continue', exact: true }));
  await waitFor(page, s => s.state === 'playing', 120000);
  assert(!!(await page.evaluate(() => window.__pfs.galiCup())).receipt, `${name}: Continue restores earned cup receipt`);
  await page.evaluate(() => window.__pfs.captureHold(true)); await step(3);
  // Actual touch wakes the on-screen controls, then all movement uses its stick.
  await touch('touchStart', [{ id: 9, x: width * .7, y: height * .5 }]); await touch('touchEnd', [{ id: 9, x: width * .7, y: height * .5 }]); await step(2);
  await walkToBoard(); await capture(`${name}-invitation`);
  await tap(page.locator('#touch [aria-label="Interact"]')); await step(3);
  const panel = page.locator('.menu-panel').filter({ hasText: 'Gali da Cup' }); await panel.waitFor({ state: 'visible', timeout: 10000 });
  await capture(`${name}-menu`);
  const practice = panel.getByRole('button', { name: 'Focused practice', exact: false });
  // Scroll by a real touch gesture, including the short landscape viewport.
  for (let i = 0; i < 4; i++) {
    const target = await practice.boundingBox(), bounds = await panel.boundingBox();
    if (target && bounds && target.y >= bounds.y && target.y + target.height <= Math.min(height, bounds.y + bounds.height)) break;
    const scroll = center(bounds, 31), end = { ...scroll, y: Math.max(bounds.y + 20, scroll.y - 110) };
    await touch('touchStart', [scroll]); await touch('touchMove', [end]); await touch('touchEnd', [end]); await sleep(120);
  }
  await tap(practice); await step(3);
  assert((await sample()).cricket.active, `${name}: actual menu starts Focused practice`);
  await verifyControls(name); await capture(`${name}-practice`);
  // Exercise the visible Play button early, then let remaining balls miss.
  let played = false;
  for (let i = 0; i < 1200; i++) {
    const c = (await sample()).cricket;
    if (c.phase === 'field') break;
    if (!c.active) throw Error('Practice ended before field phase');
    if (!played && c.phase === 'flight') { await tap(page.locator('#touch [aria-label="Cricket action: swing, catch or return"]')); played = true; }
    await step(3); if (i === 1199) throw Error('Field phase ceiling');
  }
  assert(played, `${name}: actual Play touch used during batting`);
  const b = await box(page.locator('.tzone.stick')), origin = center(b, 11), held = { ...origin, x: origin.x + 42 };
  await touch('touchStart', [origin]); await touch('touchMove', [held]); await step(5);
  const moving = await sample();
  const pause = center(await box(page.locator('#touch [aria-label="Pause"]')), 12);
  await touch('touchStart', [held, pause]); await touch('touchEnd', [pause]); await step(2);
  await page.locator('.menu-panel').filter({ hasText: 'Paused' }).waitFor({ state: 'visible', timeout: 10000 });
  const paused = await sample(); await step(15); const afterPause = await sample();
  assert(paused.snapshot.state === 'paused' && paused.cricket.t === afterPause.cricket.t && Math.hypot(paused.snapshot.player.x - afterPause.snapshot.player.x, paused.snapshot.player.z - afterPause.snapshot.player.z) < .01, `${name}: cricket clock and player freeze while paused`);
  await capture(`${name}-paused`);
  const resume = center(await box(page.locator('.menu-panel').filter({ hasText: 'Paused' }).getByRole('button', { name: 'Resume', exact: true })), 13);
  await touch('touchStart', [held, resume]); await touch('touchEnd', [resume]); await sleep(50); await step(5);
  const resumed = await sample();
  assert(resumed.snapshot.state === 'playing' && Math.hypot(resumed.snapshot.player.x - paused.snapshot.player.x, resumed.snapshot.player.z - paused.snapshot.player.z) < .01, `${name}: held thumb does not drift after Resume`);
  await touch('touchEnd', [held]); await step(1);
  const beforeFresh = await sample(); await gesture(42, 0, 5); const fresh = await sample();
  assert(Math.abs(fresh.snapshot.player.z - beforeFresh.snapshot.player.z) > .05, `${name}: fresh joystick gesture moves fielder`);
  current.samples = { moving, paused, afterPause, resumed, beforeFresh, fresh }; save();
  await capture(`${name}-field`);
  current.log = log; current.externalRequests = page.__external;
  assert(!log.some(x => /^\[(error|pageerror|http)/.test(x)) && !page.__external.length, `${name}: no browser errors or external requests`);
  await page.evaluate(() => window.__pfs.captureHold(false)); await browser.close(); browser = page = cdp = null;
}
try {
  if (!process.env.SEED_SAVE) throw Error('SEED_SAVE is required and must be a real earned cup save; no fabricated fallback');
  const seed = fs.readFileSync(process.env.SEED_SAVE, 'utf8');
  const parsed = JSON.parse(seed); if (!parsed.galiCup?.receipt) throw Error('SEED_SAVE has no earned cup receipt');
  await runOrientation('portrait', 390, 844, seed);
  await runOrientation('landscape', 844, 390, seed);
  report.complete = true; save();
} catch (e) {
  report.errors.push(String(e)); if (page) { current.final = await sample().catch(() => null); await capture(`${current.name}-failure`).catch(() => {}); }
  console.error(e); process.exitCode = 1;
} finally {
  if (cdp) await touch('touchEnd', []).catch(() => {});
  if (page) { current.log = log; current.externalRequests = page.__external; await page.evaluate(() => window.__pfs?.captureHold(false)).catch(() => {}); }
  await browser?.close().catch(() => {}); clearTimeout(deadline); save();
}
