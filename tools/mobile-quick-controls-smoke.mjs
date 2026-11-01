import { launch, waitFor } from './pt-lib.mjs';

// Verify real touch-mode hit testing and labels at a compact landscape size.
const base = process.argv[2] ?? 'http://127.0.0.1:5173/';
const { browser, page, log } = await launch(`${base}?probe`, { settings: { quality: 'low' }, mobile: true, w: 667, h: 375 });
try {
  await page.waitForFunction(() => window.__pfs?.snapshot().state === 'title', null, { timeout: 180000 });
  await page.locator('#title .menu button').getByText('New Game', { exact: true }).tap();
  await page.locator('#title .looks button').first().tap();
  await waitFor(page, s => s.state === 'playing', 180000);
  const worlds = page.getByRole('button', { name: 'Worlds: choose a destination' });
  const performance = page.getByRole('button', { name: 'Turn on Performance mode' });
  for (const button of [worlds, performance]) {
    const info = await button.evaluate(e => { const box=e.getBoundingClientRect(), label=e.querySelector('span'); return { x:box.x, y:box.y, width:box.width, height:box.height, display:label && getComputedStyle(label).display, top:document.elementFromPoint(box.x+box.width/2,box.y+box.height/2)?.closest('button')?.getAttribute('aria-label') }; });
    if (info.display === 'none' || info.height < 40 || info.x < 0 || info.y < 0 || info.x + info.width > 667 || info.y + info.height > 375 || info.top !== await button.getAttribute('aria-label')) throw Error('Touch control unavailable: '+JSON.stringify(info));
  }
  await worlds.tap();
  await page.getByText('Explore the worlds', { exact: true }).waitFor({ timeout: 30000 });
  await page.locator('.menu-panel button').getByText('Stay here', { exact: true }).tap();
  await waitFor(page, s => s.state === 'playing', 30000);
  await performance.tap();
  await page.getByText('Performance mode is on at 50% resolution', { exact: false }).waitFor({ timeout: 10000 });
  const errors = log.filter(s => /^\[(http|error|pageerror)/.test(s));
  if (errors.length || page.__external.length) throw Error(JSON.stringify({ errors, external: page.__external }));
  console.log('Touch HUD labels, hit targets, Worlds menu and Performance control passed.');
} finally { await browser.close(); }
