import { launch, waitFor } from './pt-lib.mjs';

// First launch: select Low before the scene is built, then enable it from
// a running High session and verify the saved game and setting survive reload.
const base = process.argv[2] ?? 'http://127.0.0.1:5173/';
const { browser, page, log } = await launch(`${base}?probe`, { w: 960, h: 540 });
try {
  const chooser = page.locator('.quality-pick');
  await chooser.waitFor({ state: 'visible', timeout: 30000 });
  if (await page.evaluate(() => !!window.__pfs)) throw Error('Quality was offered after the world had already loaded');
  await chooser.getByRole('button', { name: /^Low —/ }).click();
  await page.waitForFunction(() => window.__pfs?.snapshot().state === 'title', null, { timeout: 180000 });
  await page.locator('#title .menu button').getByText('New Game', { exact: true }).click();
  await page.locator('#title .looks button').first().click();
  const initial = await waitFor(page, s => s.state === 'playing', 180000);
  await page.waitForFunction(() => !!window.__game, null, { timeout: 30000 });
  const low = await page.evaluate(() => ({ quality: window.__game.settings.quality, lean: window.__game.worldBuiltLow, setting: JSON.parse(localStorage.getItem('pfs.settings.v1') || '{}').quality }));
  if (low.quality !== 'low' || !low.lean || low.setting !== 'low') throw Error('Low was not used to build the first-run world: ' + JSON.stringify(low));
  const worlds = page.getByRole('button', { name: 'Worlds: choose a destination' });
  const performance = page.getByRole('button', { name: 'Turn on Performance mode' });
  await page.setViewportSize({ width: 667, height: 375 });
  for (const button of [worlds, performance]) {
    const s = await button.locator('span').evaluate(e => getComputedStyle(e).display);
    const box = await button.boundingBox();
    if (s === 'none' || !box || box.x < 0 || box.y < 0 || box.x + box.width > 667 || box.y + box.height > 375) throw Error('A named HUD button is hidden/offscreen at mobile size');
  }
  await page.setViewportSize({ width: 960, height: 540 });
  await performance.click();
  await page.getByText('Performance mode is on at 50% resolution', { exact: false }).waitFor({ timeout: 10000 });
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('pfs.save') || '{}'));
  if (!saved.player || Math.hypot(saved.player.x - initial.player.x, saved.player.z - initial.player.z) > 5) throw Error('Performance shortcut did not save current progress');
  // Simulate a previously chosen High preset: it must be respected on load.
  await page.evaluate(() => { const s=JSON.parse(localStorage.getItem('pfs.settings.v1')); s.quality='high'; s.renderScale=1; s.post=true; s.shadows='low'; localStorage.setItem('pfs.settings.v1',JSON.stringify(s)); });
  await page.reload({ waitUntil: 'load', timeout: 180000 });
  await page.waitForFunction(() => window.__pfs?.snapshot().state === 'title', null, { timeout: 180000 });
  if (await chooser.count()) throw Error('Existing settings unexpectedly prompted for quality again');
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await waitFor(page, s => s.state === 'playing', 180000);
  await page.waitForFunction(() => !!window.__game, null, { timeout: 30000 });
  const high = await page.evaluate(() => ({ quality: window.__game.settings.quality, lean: window.__game.worldBuiltLow }));
  if (high.quality !== 'high' || high.lean) throw Error('Existing High settings not preserved: '+JSON.stringify(high));
  await performance.click();
  await page.getByText('Reload after saving for the full improvement.', { exact: false }).waitFor({ timeout: 10000 });
  const next = await page.evaluate(() => JSON.parse(localStorage.getItem('pfs.settings.v1') || '{}'));
  if (next.quality !== 'low' || next.renderScale !== 0.5 || next.shadows !== 'off') throw Error('Performance shortcut did not apply and store Low at 50% resolution: '+JSON.stringify(next));
  await page.reload({ waitUntil: 'load', timeout: 180000 });
  await page.waitForFunction(() => window.__pfs?.snapshot().state === 'title', null, { timeout: 180000 });
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  const resumed = await waitFor(page, s => s.state === 'playing', 180000);
  await page.waitForFunction(() => !!window.__game, null, { timeout: 30000 });
  const rebuilt = await page.evaluate(() => ({ quality: window.__game.settings.quality, lean: window.__game.worldBuiltLow, antialias: window.__pfs.scene().getEngine()._gl?.getContextAttributes()?.antialias }));
  if (rebuilt.quality !== 'low' || !rebuilt.lean || rebuilt.antialias !== false) throw Error('Reload did not apply all Performance settings: '+JSON.stringify(rebuilt));
  if (Math.hypot(resumed.player.x - initial.player.x, resumed.player.z - initial.player.z) > 5) throw Error('Reload did not restore saved progress');
  const errors = log.filter(s => /^\[(http|error|pageerror)/.test(s));
  if (errors.length || page.__external.length) throw Error(JSON.stringify({ errors, external: page.__external }));
  console.log('First-run Low builds lean, saved High is preserved, and Performance mode survives reload with progress.');
} finally { await browser.close(); }
