import { launch, waitFor } from './pt-lib.mjs';

// Discover every destination from a fresh game's HUD, without teleporting to
// the airfield. Check round-trips, including the rocket launch and Canada.
const base = process.argv[2] ?? 'http://127.0.0.1:5173/';
const { browser, page, log } = await launch(`${base}?probe`, { settings: { quality: 'low' }, w: 960, h: 540 });
try {
  await page.waitForFunction(() => window.__pfs?.snapshot().state === 'title', null, { timeout: 180000 });
  await page.locator('#title .menu button').getByText('New Game', { exact: true }).click();
  await page.locator('#title .looks button').first().click();
  await page.locator('[data-cinematic-skip]').waitFor({ state: 'visible', timeout: 180000 });
  await page.locator('[data-cinematic-skip]').click();
  const initial = await waitFor(page, s => s.state === 'playing', 180000);
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
    await openMenu();
    await page.locator('.menu-panel button').filter({ hasText: name }).click();
    const world = page.locator(selector);
    await world.waitFor({ state: 'visible', timeout: 180000 });
    if (name === 'Space') {
      await world.locator('[data-space-travel]').waitFor({ state: 'visible', timeout: 60000 });
      await world.locator('[data-space-skip]').click();
      await page.waitForFunction(() => document.querySelector('[data-space-world]')?.dataset.spaceReady === 'true', null, { timeout: 120000 });
    }
    await world.locator(returnSelector).click();
    await world.waitFor({ state: 'detached', timeout: 30000 });
    await waitFor(page, s => s.state === 'playing', 180000);
    const p = await mainPosition();
    if (Math.hypot(p.x - initial.player.x, p.z - initial.player.z) > 4) throw Error(`${name} returned player to unexpected location: ${JSON.stringify(p)}`);
  }
  await openMenu();
  await page.locator('.menu-panel button').filter({ hasText: 'Canada' }).click();
  await waitFor(page, s => s.state === 'playing' && Math.hypot(s.player.x - 1108, s.player.z - 1748) < 10, 180000);
  await openMenu();
  await page.locator('.menu-panel button').filter({ hasText: 'North Airfield' }).click();
  await waitFor(page, s => s.state === 'playing' && Math.hypot(s.player.x - 630, s.player.z - 1665) < 10, 180000);
  const errors = log.filter(s => /^\[(http|error|pageerror)/.test(s));
  if (errors.length || page.__external.length) throw Error(JSON.stringify({ errors, external: page.__external }));
  console.log('Fresh-game Worlds shortcut: five round-trips, rocket launch, Canada and airfield passed.');
} finally { await browser.close(); }
