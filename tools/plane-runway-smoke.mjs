import { launch, waitFor, sleep } from './pt-lib.mjs';
const { browser, page, log } = await launch(`${process.argv[2] ?? 'http://127.0.0.1:4173/'}?probe`, { w: 640, h: 360, settings: { quality: 'low' } });
const keys = new Set();
const setKey = async (key, down) => {
  if (down && !keys.has(key)) { keys.add(key); await page.keyboard.down(key); }
  if (!down && keys.has(key)) { keys.delete(key); await page.keyboard.up(key); }
};
try {
  await page.waitForFunction(() => window.__pfs?.snapshot().state === 'title', null, { timeout: 240000 });
  await page.locator('#title .menu button').first().click({ timeout: 120000 });
  await page.locator('#title .looks button').first().click({ timeout: 120000 });
  await waitFor(page, s => s.state === 'playing', 240000);
  const id = await page.evaluate(() => window.__pfs.driveAt('plane', 405, 1858, Math.PI / 2));
  if (!id) throw Error('Could not enter plane');
  const placed = await page.evaluate(() => window.__pfs.placePlaneApproach(830, 6, 1891, -Math.PI / 2, 20, -1));
  if (!placed) throw Error('Could not set up the runway approach');
  let ride = await page.evaluate(() => window.__pfs.ride());
  const initial = ride, deadline = Date.now() + 360000;
  let worstSink = 0;
  try {
    while (!(ride.grounded && ride.y < 1)) {
      if (Date.now() > deadline || ride.simTime - initial.simTime > 40) throw Error(`No touchdown: ${JSON.stringify(ride)}`);
      if (ride.up < 0.65 || ride.y < -1) throw Error(`Plane overturned: ${JSON.stringify(ride)}`);
      if (ride.y > 0.4 && ride.y < 1.5) worstSink = Math.max(worstSink, -ride.vy);
      await setKey('KeyW', ride.v < 20);
      await setKey('Space', ride.vy < -2);
      await setKey('ShiftLeft', ride.vy >= -2);
      await sleep(100);
      ride = await page.evaluate(() => window.__pfs.ride());
      if (!ride) throw Error('Left the plane unexpectedly');
    }
  } finally { for (const key of [...keys]) await setKey(key, false); }
  const touchdown = ride;
  if (touchdown.x < 380 || touchdown.x > 840 || touchdown.z < 1872 || touchdown.z > 1910 || worstSink >= 6) throw Error(`Bad runway touchdown: ${JSON.stringify({ touchdown, worstSink })}`);
  await page.keyboard.down('KeyS');
  try {
    const brakeDeadline = Date.now() + 120000;
    while (Math.abs(ride.v) >= 0.5) {
      if (Date.now() > brakeDeadline || ride.simTime - touchdown.simTime > 8) throw Error(`Plane failed to stop: ${JSON.stringify(ride)}`);
      await sleep(100);
      ride = await page.evaluate(() => window.__pfs.ride());
    }
  } finally { await page.keyboard.up('KeyS'); }
  if (!ride.grounded || ride.up < 0.85 || ride.x < 380 || ride.x > 840 || ride.z < 1872 || ride.z > 1910) throw Error(`Bad rollout: ${JSON.stringify(ride)}`);
  await page.screenshot({ path: '/tmp/punjabi-plane-runway.png', timeout: 180000 });
  const errors = await page.evaluate(() => window.__pfs.snapshot().errors);
  if (errors.length || page.__external.length || log.some(s => /^\[(error|pageerror|http )/.test(s))) throw Error(JSON.stringify({ errors, external: page.__external, log }));
  console.log(JSON.stringify({ initial, touchdown, stopped: ride, worstSink, errors, log }));
} finally { for (const key of keys) await page.keyboard.up(key); await browser.close(); }
