import fs from 'node:fs';
import { launch, waitFor } from './pt-lib.mjs';

// Discover every destination from a fresh game's HUD, without teleporting to
// the airfield. Check round-trips, including the rocket launch and Canada.
const base = process.argv[2] ?? 'http://127.0.0.1:5173/';
const out = process.env.OUT ?? 'artifacts/worlds-menu';
fs.mkdirSync(out, { recursive: true });
const result = { base, source: process.env.SOURCE ?? null, complete: false, software: process.env.SOFTWARE === '1',
  note: 'Real HUD navigation at explicit low test settings; no automatic quality or FPS claim. Space flight is observed before clicking its destination, with no flight skip or jump/attack input.',
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
      readyObserved: false, skipClicks: 0, flightKeys: [], events: [] };
    const record = (kind, node) => {
      if (!(node instanceof Element)) return;
      const matches = selector => [node, ...node.querySelectorAll(selector)].filter(n => n.matches(selector));
      for (const world of matches('[data-space-world]')) if (kind === 'added') {
        state.worldCreated = true; state.events.push({ kind: 'world-added', at: performance.now() });
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
    window.__worldsSpaceWatch = { state, cleanup() { observer.disconnect(); document.removeEventListener('click', click, true); window.removeEventListener('keydown', key, true); } };
  });
}

try {
  progress('launch');
  const run = await launch(`${base}?probe`, { settings: { quality: 'low' }, w: 960, h: 540 });
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
      if (!result.space.worldCreated || !result.space.flightAdded || !result.space.flightRemoved || !result.space.readyObserved || !result.space.readyNow || result.space.skipClicks || result.space.flightKeys.length) throw Error(`Natural Space flight proof failed: ${JSON.stringify(result.space)}`);
      progress('Space flight creation/removal and natural readiness observed; no Skip flight click or jump/attack input');
    }
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
