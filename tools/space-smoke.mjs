import { launch, sleep, waitFor } from './pt-lib.mjs';

// Verify the actual airport → lunar outpost → airport round-trip, including
// lazy scene loading, the whole mission and saved progress. Movement waits for
// world coordinates rather than assuming software rendering advances in real time.
const { browser, page, log } = await launch(`${process.argv[2] ?? 'http://127.0.0.1:4173/'}?probe`, { settings: { quality: 'low' } });
try {
  const requests = [];
  page.on('request', r => { if (/\/SpaceWorld-[^/]+\.js(?:\?|$)/.test(r.url())) requests.push(r.url()); });
  await page.waitForFunction(() => window.__pfs?.snapshot().state === 'title', null, { timeout: 180000 });
  await page.locator('#title .menu button').first().click();
  await page.locator('#title .looks button').first().click();
  await page.locator('[data-cinematic-skip]').waitFor({ state: 'visible', timeout: 180000 });
  await page.locator('[data-cinematic-skip]').click();
  await waitFor(page, s => s.state === 'playing', 180000);
  if (requests.length) throw Error('Space scene loaded before entry');
  const scenes = () => page.evaluate(() => window.__pfs.scene().getEngine().scenes.length);
  const baseline = await scenes();
  const open = async (fullFlight = false) => {
    await page.evaluate(() => window.__pfs.teleport(635, 1672, 0));
    await waitFor(page, s => s.interactionId === 'airfield_checkin', 180000);
    await page.keyboard.down('KeyE'); await sleep(1600); await page.keyboard.up('KeyE');
    await page.locator('.menu-panel button').filter({ hasText: 'Visit Chand Outpost' }).click({ timeout: 60000 });
    const world = page.locator('[data-space-world]');
    await world.waitFor({ state: 'visible', timeout: 60000 });
    await world.locator('[data-space-travel]').waitFor({ state: 'visible', timeout: 60000 });
    await sleep(800);
    if (fullFlight) {
      await page.screenshot({ path: '/tmp/gedi-space-launch.png', timeout: 180000 });
      await world.locator('[data-space-travel]').getByText('Crossing space', { exact: false }).waitFor({ timeout: 120000 });
      await page.screenshot({ path: '/tmp/gedi-space-crossing.png', timeout: 180000 });
      await world.locator('[data-space-travel]').getByText('preparing for landing', { exact: false }).waitFor({ timeout: 120000 });
      await page.screenshot({ path: '/tmp/gedi-space-landing.png', timeout: 180000 });
    } else await world.locator('[data-space-skip]').click();
    await page.waitForFunction(() => document.querySelector('[data-space-world]')?.getAttribute('data-space-ready') === 'true', null, { timeout: 120000 });
    return world;
  };
  const world = await open(true);
  if (!requests.length || await scenes() !== baseline + 1) throw Error('Space scene did not load separately on demand');
  if (!await page.locator('#hud').evaluate(el => el.classList.contains('hidden'))) throw Error('Main HUD is visible in space');
  const move = async (code, axis, reached) => {
    const until = Date.now() + 120000;
    await page.keyboard.down(code);
    try {
      while (!reached(Number(await world.getAttribute(`data-space-${axis}`)))) {
        if (Date.now() > until) throw Error(`Space movement timed out on ${axis}`);
        await sleep(100);
      }
    } finally { await page.keyboard.up(code); }
  };
  const use = async stage => {
    await page.keyboard.down('KeyE'); await sleep(900); await page.keyboard.up('KeyE');
    await page.waitForFunction(s => Number(document.querySelector('[data-space-world]')?.getAttribute('data-space-stage')) === s, stage, { timeout: 60000 });
  };
  await move('KeyD', 'x', n => n >= 6.7); await move('KeyW', 'z', n => n >= -28.4); await use(1);
  await move('KeyW', 'z', n => n >= 2.7); await move('KeyA', 'x', n => n <= -21.7); await use(2);
  await move('KeyD', 'x', n => n >= 20.5); await move('KeyW', 'z', n => n >= 26.5); await use(3);
  await page.screenshot({ path: '/tmp/gedi-space-relay.png', timeout: 180000 });
  await move('KeyA', 'x', n => n <= 7.3); await move('KeyS', 'z', n => n <= -27.7); await use(4);
  const save = await page.evaluate(() => JSON.parse(localStorage.getItem('pfs.save') || '{}'));
  if (save.home?.spaceStoryStage !== 4) throw Error('Space mission progress was not saved');
  await world.locator('[data-space-return]').click();
  await waitFor(page, s => s.state === 'playing' && Math.hypot(s.player.x - 635, s.player.z - 1672) < 8, 180000);
  if (await page.locator('#hud').evaluate(el => el.classList.contains('hidden'))) throw Error('Main HUD did not restore');
  if (await scenes() !== baseline || await world.count()) throw Error('Space scene leaked after return');
  await open();
  if (Number(await world.getAttribute('data-space-stage')) !== 4) throw Error('Space progress did not restore');
  await page.keyboard.press('KeyQ');
  await page.waitForFunction(() => Number(document.querySelector('[data-space-world]')?.getAttribute('data-space-z')) > -31, null, { timeout: 60000 });
  await world.locator('[data-space-return]').click();
  await waitFor(page, s => s.state === 'playing', 180000);
  if (await scenes() !== baseline || await world.count()) throw Error('Second space visit leaked resources');
  // Exercise the explicit abort while the flight overlay owns input as well.
  await page.evaluate(() => window.__pfs.teleport(635, 1672, 0));
  await waitFor(page, s => s.interactionId === 'airfield_checkin', 180000);
  await page.keyboard.down('KeyE'); await sleep(1600); await page.keyboard.up('KeyE');
  await page.locator('.menu-panel button').filter({ hasText: 'Visit Chand Outpost' }).click({ timeout: 60000 });
  await world.locator('[data-space-travel]').getByRole('button', { name: 'Return to Ranggarh' }).click({ timeout: 60000 });
  await waitFor(page, s => s.state === 'playing', 180000);
  if (await scenes() !== baseline || await world.count()) throw Error('Flight abort leaked resources');
  if (log.some(s => /^\[(http|error|pageerror)/.test(s)) || page.__external.length) throw Error(`Browser errors: ${JSON.stringify({ log, external: page.__external })}`);
  console.log(JSON.stringify({ success: true, lazyLoad: true, fullFlight: true, flightSkip: true, flightAbort: true, lunarBurst: true, relayMission: true, restored: true, scenesAfterReturn: baseline }));
} finally { await browser.close(); }
