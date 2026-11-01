import { launch, sleep, waitFor } from './pt-lib.mjs';

// Exercise the actual keyboard interaction, aim, scoring and saved best.
const { browser, page, log } = await launch(`${process.argv[2] ?? 'http://127.0.0.1:5173/'}?probe`, { settings: { quality: 'low' } });
try {
  await page.waitForFunction(() => window.__pfs?.snapshot().state === 'title', null, { timeout: 180000 });
  await page.locator('#title .menu button').first().click();
  await page.locator('#title .looks button').first().click();
  await waitFor(page, s => s.state === 'playing', 180000);
  if ((await page.evaluate(() => window.__pfs.outerRegions())).active !== 0) throw Error('Experimental outer regions loaded in normal play');
  await page.evaluate(() => window.__pfs.teleport(1390, 1704, 0));
  await waitFor(page, s => s.interactionId === 'snow_range', 180000);
  await page.keyboard.down('KeyE'); await sleep(1400); await page.keyboard.up('KeyE');
  await page.waitForFunction(() => window.__pfs.snowball().active, null, { timeout: 60000 });
  await page.screenshot({ path: '/tmp/snowball-range.png', timeout: 180000 });
  const result = await page.evaluate(() => {
    const p = window.__pfs.snapshot().player;
    const target = window.__pfs.scene().getTransformNodeByName('snow_target_1').position;
    window.__pfs.holdCamera({ eye: { x: p.x, y: 1.6, z: p.z }, at: { x: target.x, y: 1.6, z: target.z }, fov: 1 });
    return { player: p, target: { x: target.x, z: target.z } };
  });
  await sleep(500);
  await page.keyboard.down('KeyQ'); await sleep(1400); await page.keyboard.up('KeyQ');
  await page.waitForFunction(() => window.__pfs.snowball().throws > 0, null, { timeout: 60000 });
  const round = await page.evaluate(() => window.__pfs.snowball());
  if (round.score < 1) throw Error(`Aimed shot missed: ${JSON.stringify({ result, round })}`);
  await page.evaluate(() => window.__pfs.holdCamera(null));
  await page.keyboard.down('KeyE'); await sleep(1400); await page.keyboard.up('KeyE');
  await page.waitForFunction(() => !window.__pfs.snowball().active, null, { timeout: 60000 });
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('pfs.save') || '{}').bests?.snowballRange);
  if (!(saved >= 1)) throw Error(`Best score was not saved: ${saved}`);
  if (log.some(x => x.includes('[pageerror]'))) throw Error(log.join('\n'));
  console.log('Snowball range: interaction, aimed hit and persistent best passed.', JSON.stringify({ round, saved }));
} finally { await browser.close(); }
