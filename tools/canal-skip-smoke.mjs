import { launch, waitFor, walkTo, tap, sleep } from './pt-lib.mjs';

const { browser, page, log } = await launch(`${process.argv[2] ?? 'http://127.0.0.1:5207/'}?probe`, { w: 1100, h: 700, settings: { quality: 'low' } });
try {
  await page.waitForFunction(() => window.__pfs?.snapshot().state === 'title', null, { timeout: 180000 });
  await page.locator('#title .menu button').getByText('New Game', { exact: true }).click();
  await page.locator('#title .looks button').first().click();
  await waitFor(page, s => s.state === 'playing', 180000);
  // Place on the north-bank road, then walk the last stretch to the landing.
  await page.evaluate(() => window.__pfs.teleport(45, 185.5, Math.PI));
  await walkTo(page, [{ x: 45, z: 181.4 }], { tol: 0.8, timeout: 90000 });
  await waitFor(page, s => s.interactionId === 'canal_skip', 30000);
  const point = await page.evaluate(() => window.__pfs.snapshot().player);
  await page.evaluate(p => window.__pfs.holdCamera({ eye: { x: p.x, y: 4.3, z: p.z + 8 }, at: { x: p.x, y: 0.5, z: p.z - 12 }, fov: 0.82 }), point);
  await sleep(1200); await page.screenshot({ path: '/tmp/canal-landing.png', timeout: 120000 });
  await tap(page, 'KeyE', 180);
  await page.waitForFunction(() => window.__pfs.canalSkipping().active, null, { timeout: 15000 });
  // A second bounce is farther out on the water, clear of the player model.
  await page.waitForFunction(() => window.__pfs.canalSkipping().impacts >= 2, null, { timeout: 30000 });
  await page.screenshot({ path: '/tmp/canal-skipping.png', timeout: 120000 });
  await page.waitForFunction(() => !window.__pfs.canalSkipping().active && window.__pfs.canalSkipping().best > 0, null, { timeout: 60000 });
  // The local is streamed in near the landing, not a prompt detached from an NPC.
  await page.waitForFunction(() => !!window.__pfs.resident('canalAmar'), null, { timeout: 30000 });
  const result = await page.evaluate(() => ({ state: window.__pfs.canalSkipping(), errors: window.__pfs.snapshot().errors }));
  const errors = log.filter(s => s.startsWith('[pageerror]') || s.startsWith('[http '));
  if (result.errors.length || errors.length || page.__external.length) throw Error(JSON.stringify({ result, errors, external: page.__external }));
  console.log('Canal landing approached on foot, stone bounced, and personal best saved:', JSON.stringify(result.state));
} finally { await browser.close(); }
