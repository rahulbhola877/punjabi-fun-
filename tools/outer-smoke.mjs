import { launch, sleep, waitFor } from './pt-lib.mjs';
const { browser, page, log } = await launch(`${process.argv[2] ?? 'http://127.0.0.1:5173/'}?probe&outer=1`, { settings: { quality: 'low' } });
const places = [
  { x: -2250, z: 150, id: 'outer_forestCamp' },
  { x: 150, z: -1650, id: 'outer_duneOasis' },
  { x: 2250, z: 450, id: 'outer_highlandLookout' },
  { x: 150, z: 3150, id: 'outer_northCamp' },
];
try {
  await page.waitForFunction(() => window.__pfs?.snapshot().state === 'title', null, { timeout: 180000 });
  await page.locator('#title .menu button').first().click();
  await page.locator('#title .looks button').first().click();
  await waitFor(page, s => s.state === 'playing', 180000);
  console.log('Initial regions', await page.evaluate(() => window.__pfs.outerRegions()));
  for (const p of places) {
    await page.evaluate(p => window.__pfs.teleport(p.x, p.z, 0), p);
    const snapshot = await waitFor(page, s => Math.hypot(s.player.x - p.x, s.player.z - p.z) < 8 && (!p.id.endsWith('Camp') || s.interactionId === p.id), 180000);
    const details = await page.evaluate(p => ({ regions: window.__pfs.outerRegions(), ray: window.__pfs.ray(p.x, 100, p.z, p.x, -5, p.z) }), p);
    if (!details.ray || Math.abs(details.ray.p[1] - snapshot.player.y) > 4) throw Error(`No ground under ${p.id}: ${JSON.stringify({ snapshot, details })}`);
    console.log(p.id, JSON.stringify(details));
    if (p.id === 'outer_forestCamp') await page.screenshot({ path: '/tmp/outer-forest.png', timeout: 180000 });
  }
  await page.evaluate(() => window.__pfs.teleport(1390, 1704, 0));
  await waitFor(page, s => s.interactionId === 'snow_range', 180000);
  await page.keyboard.down('KeyE'); await sleep(1400); await page.keyboard.up('KeyE');
  await page.waitForFunction(() => window.__pfs.snowball().active, null, { timeout: 60000 });
  await page.screenshot({ path: '/tmp/snowball-range-polished.png', timeout: 180000 });
  if (log.some(x => x.includes('[pageerror]'))) throw Error(log.join('\n'));
  console.log('All four outer destinations have ground; both camps have reachable rest prompts.');
} finally { await browser.close(); }
