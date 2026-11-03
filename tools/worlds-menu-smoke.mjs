import fs from 'node:fs';
import { launch, waitFor } from './pt-lib.mjs';

// Discover every destination from a fresh game's HUD, without teleporting to
// the airfield. Check round-trips, including the rocket launch and Canada.
const base = process.argv[2] ?? 'http://127.0.0.1:5173/';
const out = process.env.OUT ?? 'artifacts/worlds-menu';
const quality = process.env.QUALITY ?? 'low';
fs.mkdirSync(out, { recursive: true });
const result = { base, source: process.env.SOURCE ?? null, complete: false, software: process.env.SOFTWARE === '1',
  settings: { quality, renderScale: 1 },
  note: 'Real HUD navigation at explicit recorded test settings; no FPS claim. Space flight is observed before clicking its destination, with no flight skip or jump/attack input.',
  rows: [], progress: [], space: null, log: [], external: [] };
let browser, page;
const save = () => fs.writeFileSync(`${out}/checks.json`, JSON.stringify(result, null, 2));
const progress = message => { result.progress.push({ at: new Date().toISOString(), message }); save(); console.log(new Date().toISOString(), message); };
for (const signal of ['SIGTERM', 'SIGINT']) process.once(signal, async () => {
  result.interrupted = signal; save(); await browser?.close(); process.exit(124);
});

async function watchSpaceFlight() {
  await page.evaluate(() => {
    const state = { installedAt: performance.now(), worldCreated: false, flightAdded: false, flightRemoved: false,
      readyObserved: false, skipClicks: 0, flightKeys: [], events: [], frames: {}, phaseCounts: {}, capturedFrame: {} };
    let scene, frameObserver;
    const observeFrames = () => {
      if (frameObserver) return;
      scene = window.__pfs.scene().getEngine().scenes.at(-1);
      frameObserver = scene.onAfterRenderObservable.add(() => {
        const text = document.querySelector('[data-space-travel]')?.textContent ?? '';
        const phase = text.includes('Launch confirmed') ? 'launch' : text.includes('Crossing space') ? 'crossing' : text.includes('preparing for landing') ? 'descent' : null;
        if (!phase) return;
        state.phaseCounts[phase] = (state.phaseCounts[phase] ?? 0) + 1;
        // Keep the first actual frame if shader startup leaves fewer than three
        // frames in a phase; replace it with frame three when available.
        if (state.phaseCounts[phase] === 1 || state.phaseCounts[phase] === 3) {
          state.frames[phase] = scene.getEngine().getRenderingCanvas().toDataURL('image/png');
          state.capturedFrame[phase] = state.phaseCounts[phase];
        }
      });
    };
    const record = (kind, node) => {
      if (!(node instanceof Element)) return;
      const matches = selector => [node, ...node.querySelectorAll(selector)].filter(n => n.matches(selector));
      for (const world of matches('[data-space-world]')) if (kind === 'added') {
        state.worldCreated = true; state.events.push({ kind: 'world-added', at: performance.now() });
        observeFrames();
      }
      for (const travel of matches('[data-space-travel]')) {
        if (kind === 'added') state.flightAdded = true;
        else state.flightRemoved = true;
        state.events.push({ kind: `flight-${kind}`, at: performance.now(), text: travel.textContent?.slice(0, 200), connected: travel.isConnected });
      }
    };
    const observer = new MutationObserver(records => {
      for (const mutation of records) {
        if (mutation.type === 'childList') {
          // Inspect added-node records themselves: the flight can be removed
          // again before Playwright's next visibility poll or this delivery.
          for (const node of mutation.addedNodes) record('added', node);
          for (const node of mutation.removedNodes) record('removed', node);
        } else if (mutation.target.matches('[data-space-world]') && mutation.target.dataset.spaceReady === 'true') {
          state.readyObserved = true; state.events.push({ kind: 'ready', at: performance.now() });
        }
      }
    });
    observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-space-ready'] });
    const click = event => { if (event.target instanceof Element && event.target.closest('[data-space-skip]')) state.skipClicks++; };
    const key = event => { if (['Space', 'KeyQ'].includes(event.code)) state.flightKeys.push(event.code); };
    document.addEventListener('click', click, true); window.addEventListener('keydown', key, true);
    window.__worldsSpaceWatch = { state, cleanup() { observer.disconnect(); if (frameObserver) scene.onAfterRenderObservable.remove(frameObserver); document.removeEventListener('click', click, true); window.removeEventListener('keydown', key, true); } };
  });
}

async function sampleCachedShadows() {
  return page.evaluate(() => new Promise(resolve => {
    const scene = window.__pfs.scene().getEngine().scenes.at(-1), engine = scene.getEngine();
    const maps = scene.lights.map(l => l.getShadowGenerator?.()?.getShadowMap()).filter(Boolean);
    const draws = maps.map(() => 0), subscriptions = maps.map((m, i) => m.onAfterRenderObservable.add(() => draws[i]++));
    const rows = [];
    let drawStart = engine._drawCalls.current;
    const before = scene.onBeforeRenderObservable.add(() => { drawStart = engine._drawCalls.current; });
    const observer = scene.onAfterRenderObservable.add(() => {
      rows.push({ frame: rows.length + 1, draws: engine._drawCalls.current - drawStart, rawDrawCounter:engine._drawCalls.current, triangles: scene.getActiveIndices()/3,
        cachedMapPasses: [...draws] });
      if (rows.length < 48) return;
      scene.onAfterRenderObservable.remove(observer);
      scene.onBeforeRenderObservable.remove(before);
      maps.forEach((m,i)=>m.onAfterRenderObservable.remove(subscriptions[i]));
      resolve({ note:'48 ordinary rendered frames after world entry/readiness, stationary camera. Shader-startup passes may occur early; no FPS claim.',
        resolution:[engine.getRenderWidth(),engine.getRenderHeight()], work:scene.metadata?.districtShadowWork,
        maps:maps.map(m=>({name:m.name,refreshRate:m.refreshRate})),rows,
        settledPasses:draws.map((v,i)=>v-rows[23].cachedMapPasses[i]) });
    });
  }));
}

try {
  progress('launch');
  const run = await launch(`${base}?probe`, { settings: result.settings, w: 960, h: 540 });
  ({ browser, page } = run); result.log = run.log; result.external = page.__external;
  await page.waitForFunction(() => window.__pfs?.snapshot().state === 'title', null, { timeout: 180000 });
  await page.locator('#title .menu button').getByText('New Game', { exact: true }).click();
  await page.locator('#title .looks button').first().click();
  await page.locator('[data-cinematic-skip]').waitFor({ state: 'visible', timeout: 180000 });
  await page.locator('[data-cinematic-skip]').click();
  const initial = await waitFor(page, s => s.state === 'playing', 180000);
  result.initial = initial.player; progress('fresh game playing');
  const worlds = page.getByRole('button', { name: 'Worlds: choose a destination' });
  const openMenu = async () => {
    await worlds.click();
    await page.getByText('Explore the worlds', { exact: true }).waitFor({ timeout: 30000 });
  };
  const mainPosition = () => page.evaluate(() => window.__pfs.snapshot().player);
  for (const [name, selector, returnSelector] of [
    ['Lantern Valley', '[data-pixel-world]', '[data-pixel-return]'],
    ['Japan', '[data-japan-world]', '[data-japan-return]'],
    ['China', '[data-china-world]', '[data-china-return]'],
    ['Neon Quay', '[data-neon-world]', '[data-neon-return]'],
    ['Space', '[data-space-world]', '[data-space-return]'],
  ]) {
    progress(`open ${name}`);
    await openMenu();
    // Install before the click, not after an ephemeral launch card is visible.
    if (name === 'Space') await watchSpaceFlight();
    await page.locator('.menu-panel button').filter({ hasText: name }).click();
    const world = page.locator(selector);
    await world.waitFor({ state: 'visible', timeout: 180000 });
    const row = { name, entered: true, returned: false, dataset: await world.evaluate(node => ({ ...node.dataset })) };
    result.rows.push(row); progress(`entered ${name}`);
    if (name === 'Space') {
      await page.waitForFunction(() => window.__worldsSpaceWatch?.state.flightAdded, null, { timeout: 30000 });
      // Let the real rocket flight finish. Skip/replay has its own control
      // regression coverage; that does not prove this natural path works.
      await page.waitForFunction(() => document.querySelector('[data-space-world]')?.dataset.spaceReady === 'true', null, { timeout: 120000 });
      result.space = await page.evaluate(() => {
        const watch = window.__worldsSpaceWatch, state = { ...watch.state, readyNow: document.querySelector('[data-space-world]')?.dataset.spaceReady === 'true' };
        watch.cleanup(); return state;
      });
      for (const [phase, data] of Object.entries(result.space.frames)) fs.writeFileSync(`${out}/space-${phase}.png`, Buffer.from(data.split(',')[1], 'base64'));
      result.space.capturedPhases = Object.keys(result.space.frames); delete result.space.frames;
      if (!result.space.worldCreated || !result.space.flightAdded || !result.space.flightRemoved || !result.space.readyObserved || !result.space.readyNow || result.space.skipClicks || result.space.flightKeys.length) throw Error(`Natural Space flight proof failed: ${JSON.stringify(result.space)}`);
      progress('Space flight creation/removal and natural readiness observed; no Skip flight click or jump/attack input');
    }
    if (name === 'Neon Quay' || name === 'Space') {
      row.shadowSample = await sampleCachedShadows();
      if (!row.shadowSample.maps.length || row.shadowSample.maps.some(m=>m.refreshRate!==0) || row.shadowSample.settledPasses.some(n=>n!==0)) throw Error(`${name}: static shadow map did not settle: ${JSON.stringify(row.shadowSample)}`);
    }
    await page.screenshot({ path: `${out}/${name.toLowerCase().replaceAll(' ', '-')}.png`, timeout: 30000 });
    await world.locator(returnSelector).click();
    await world.waitFor({ state: 'detached', timeout: 30000 });
    await waitFor(page, s => s.state === 'playing', 180000);
    const p = await mainPosition();
    if (Math.hypot(p.x - initial.player.x, p.z - initial.player.z) > 4) throw Error(`${name} returned player to unexpected location: ${JSON.stringify(p)}`);
    row.returned = true; row.returnPosition = p; progress(`round-trip passed ${name}`);
  }
  progress('open Canada');
  await openMenu();
  await page.locator('.menu-panel button').filter({ hasText: 'Canada' }).click();
  const canada = await waitFor(page, s => s.state === 'playing' && Math.hypot(s.player.x - 1108, s.player.z - 1748) < 10, 180000);
  result.rows.push({ name: 'Canada', arrived: true, position: canada.player }); progress('Canada arrival passed');
  await openMenu();
  await page.locator('.menu-panel button').filter({ hasText: 'North Airfield' }).click();
  const airfield = await waitFor(page, s => s.state === 'playing' && Math.hypot(s.player.x - 630, s.player.z - 1665) < 10, 180000);
  result.rows.push({ name: 'North Airfield', arrived: true, position: airfield.player }); progress('North Airfield arrival passed');
  const errors = result.log.filter(s => /^\[(http|error|pageerror)/.test(s));
  if (errors.length || page.__external.length) throw Error(JSON.stringify({ errors, external: page.__external }));
  result.complete = true; progress('Fresh-game Worlds shortcut: five round-trips, natural rocket launch, Canada and airfield passed.');
} catch (error) {
  result.error = String(error.stack ?? error);
  if (page) {
    result.last = await page.evaluate(() => window.__pfs?.snapshot()).catch(() => null);
    result.space = await page.evaluate(() => window.__worldsSpaceWatch?.state ?? null).catch(() => result.space);
    await page.screenshot({ path: `${out}/failure.png`, timeout: 15000 }).catch(() => {});
  }
  save(); console.error(error); process.exitCode = 1;
} finally {
  await page?.evaluate(() => window.__worldsSpaceWatch?.cleanup()).catch(() => {});
  await browser?.close(); save();
}
