import { launch, sleep, waitFor } from './pt-lib.mjs';

// Enter through the actual airport menu, walk both river banks, complete the
// local story, and verify that returning/re-entering retains the saved stage.
const { browser, page, log } = await launch(`${process.argv[2] ?? 'http://127.0.0.1:4173/'}?probe`, { settings: { quality: 'low' } });
try {
  const requests = [];
  const isChunk = url => /\/ChinaWorld-[^/]+\.js(?:\?|$)/.test(url);
  page.on('request', request => { if (isChunk(request.url())) requests.push(request.url()); });
  await page.waitForFunction(() => window.__pfs?.snapshot().state === 'title', null, { timeout: 180000 });
  await page.locator('#title .menu button').first().click();
  await page.locator('#title .looks button').first().click();
  await page.locator('[data-cinematic-skip]:visible').waitFor({ state: 'visible', timeout: 180000 });
  await page.locator('[data-cinematic-skip]:visible').click();
  await waitFor(page, s => s.state === 'playing', 180000);
  if (requests.length) throw Error('Harbor scene loaded before entry');
  const scenes = () => page.evaluate(() => window.__pfs.scene().getEngine().scenes.length);
  const baseline = await scenes();
  const open = async () => {
    await page.evaluate(() => window.__pfs.teleport(635, 1672, 0));
    await waitFor(page, s => s.interactionId === 'airfield_checkin', 180000);
    await page.keyboard.down('KeyE'); await sleep(1400); await page.keyboard.up('KeyE');
    await page.locator('.menu-panel button').filter({ hasText: 'Lantern Harbor' }).click({ timeout: 60000 });
    const world = page.locator('[data-china-world]');
    await world.waitFor({ state: 'visible', timeout: 90000 });
    await page.waitForFunction(() => document.querySelector('[data-china-world]')?.getAttribute('data-china-z') != null, null, { timeout: 90000 });
    return world;
  };
  const world = await open();
  if (!requests.length || await scenes() !== baseline + 1) throw Error('Harbor did not load a separate scene on demand');
  if (!await page.locator('#hud').evaluate(el => el.classList.contains('hidden'))) throw Error('Main-world HUD remains visible');
  await page.screenshot({ path: '/tmp/china-street.png', timeout: 180000 });
  const move = async (code, axis, reached) => {
    console.log('WALK',code,await world.getAttribute('data-china-x'),await world.getAttribute('data-china-z'));
    const until = Date.now() + 180000;
    await page.keyboard.down(code);
    try {
      while (!reached(Number(await world.getAttribute(`data-china-${axis}`)))) {
        if (Date.now() > until) throw Error(`Harbor movement timed out on ${axis}: ${await world.getAttribute('data-china-x')},${await world.getAttribute('data-china-z')}`);
        await sleep(120);
      }
    } finally { await page.keyboard.up(code); }
  };
  const talk = async (stage, person) => {
    console.log('TALK',person,stage);
    await page.waitForFunction(person => document.querySelector('[data-china-world]')?.getAttribute('data-china-near') === person, person, { timeout: 30000 });
    await page.keyboard.down('KeyE'); await sleep(900); await page.keyboard.up('KeyE');
    await page.waitForFunction(stage => Number(document.querySelector('[data-china-world]')?.getAttribute('data-china-stage')) === stage, stage, { timeout: 60000 });
    const skip = page.locator('[data-cinematic-skip]:visible'); if (await skip.isVisible()) await skip.click();
  };
  await move('KeyW', 'z', n => n >= -43.2);
  await move('KeyA', 'x', n => n <= 35.8);
  await talk(1, 'host');
  await move('KeyW', 'z', n => n >= -8.2);
  await talk(2, 'artisan');
  await move('KeyW', 'z', n => n >= 2);
  // Approach the market along its open eastern aisle; the lantern posts and
  // stall footprints are solid and the straight centre line would hit them.
  await move('KeyA', 'x', n => n <= -25);
  await move('KeyW', 'z', n => n >= 28.8);
  await move('KeyA', 'x', n => n <= -26);
  await talk(3, 'musician');
  await page.screenshot({ path: '/tmp/china-market.png', timeout: 180000 });
  // Stay at the musician's x≈-26 on the return. Polling a lateral threshold
  // could overshoot into the table at (-23,20), blocking the southward leg.
  await move('KeyS', 'z', n => n <= 2.1);
  await move('KeyD', 'x', n => n >= 34);
  await move('KeyS', 'z', n => n <= -42.8);
  await talk(4, 'host');
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('pfs.save') || '{}'));
  if (saved.home?.chinaStoryStage !== 4) throw Error('Harbor story was not saved');
  await world.locator('[data-china-return]').click();
  await waitFor(page, s => s.state === 'playing' && Math.hypot(s.player.x - 635, s.player.z - 1672) < 8, 180000);
  if (await page.locator('#hud').evaluate(el => el.classList.contains('hidden'))) throw Error('Main-world HUD did not restore');
  if (await scenes() !== baseline || await world.count()) throw Error('Harbor scene leaked');
  await open();
  if (Number(await world.getAttribute('data-china-stage')) !== 4) throw Error('Harbor progress did not restore');
  const evening = await page.evaluate(() => window.__pfs.scene().getEngine().scenes.at(-1).clearColor);
  if (evening.r <= evening.b) throw Error('Saved harbor evening lighting did not restore');
  await world.locator('[data-china-return]').click();
  await waitFor(page, s => s.state === 'playing', 180000);
  if (await scenes() !== baseline || await world.count()) throw Error('Second visit leaked resources');
  if (log.some(s => /^\[(http|error|pageerror)/.test(s)) || page.__external.length) throw Error(`Browser errors: ${JSON.stringify({ log, external: page.__external })}`);
  console.log(JSON.stringify({ success: true, lazyLoad: true, story: true, restored: true, scenesAfterReturn: baseline }));
} finally { await browser.close(); }
