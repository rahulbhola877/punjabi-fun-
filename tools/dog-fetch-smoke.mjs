import { launch, waitFor, walkTo, tap } from './pt-lib.mjs';

// Exercise the dog beside a fresh-save starting house without teleporting.
const { browser, page, log } = await launch(`${process.argv[2] ?? 'http://127.0.0.1:5173/'}?probe`, { settings: { quality: 'low' } });
try {
  await page.waitForFunction(() => window.__pfs?.snapshot().state === 'title', null, { timeout: 180000 });
  await page.locator('#title .menu button').getByText('New Game', { exact: true }).click();
  await page.locator('#title .looks button').first().click();
  await waitFor(page, s => s.state === 'playing', 180000);
  const before = await page.evaluate(() => ({ player: window.__pfs.snapshot().player, dog: window.__pfs.dogFetch().dog }));
  if (Math.hypot(before.player.x-before.dog.x, before.player.z-before.dog.z)>8) throw Error('Dog is not near fresh spawn: '+JSON.stringify(before));
  await walkTo(page, [{ x: before.dog.x, z: before.dog.z+0.4 }], { tol: 0.7, timeout: 90000 });
  try { await waitFor(page, s => s.interactionId === 'sheru_fetch', 15000); } catch (error) { console.error('nearby', JSON.stringify(await page.evaluate(() => ({ player: window.__pfs.snapshot().player, prompt: window.__pfs.snapshot().prompt, interactionId: window.__pfs.snapshot().interactionId, dog: window.__pfs.dogFetch() })))); throw error; }
  await page.screenshot({ path: '/tmp/sheru-fetch.png', timeout: 120000 });
  await tap(page, 'KeyE', 300);
  await page.waitForFunction(() => window.__pfs.dogFetch().phase !== 'idle', null, { timeout: 15000 });
  await page.waitForFunction(() => window.__pfs.dogFetch().phase === 'return', null, { timeout: 90000 });
  await page.waitForFunction(() => window.__pfs.dogFetch().phase === 'idle', null, { timeout: 90000 });
  if ((await page.evaluate(() => window.__pfs.dogFetch().completed)) !== 1) throw Error('Dog did not finish the return to the player');
  const errors = log.filter(line => line.startsWith('[pageerror]'));
  if (errors.length || page.__external.length) throw Error(JSON.stringify({ errors, external: page.__external }));
  console.log('Sheru reachable from fresh start; throw, pickup and return passed.');
} finally { await browser.close(); }
