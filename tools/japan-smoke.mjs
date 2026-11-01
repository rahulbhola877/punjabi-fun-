import { launch, sleep, waitFor } from './pt-lib.mjs';

// Enter from the real airfield menu, complete the tea errand, then re-enter.
const { browser, page, log } = await launch(`${process.argv[2] ?? 'http://127.0.0.1:5173/'}?probe`, { settings: { quality: 'low' } });
try {
  const requests = [];
  const isChunk = url => /\/JapanWorld-[^/]+\.js(?:\?|$)/.test(url);
  await page.evaluate(() => performance.setResourceTimingBufferSize(5000));
  page.on('request', request => { if (isChunk(request.url())) requests.push(request.url()); });
  await page.waitForFunction(() => window.__pfs?.snapshot().state === 'title', null, { timeout: 180000 });
  await page.locator('#title .menu button').first().click();
  await page.locator('#title .looks button').first().click();
  await waitFor(page, s => s.state === 'playing', 180000);
  const initial = await page.evaluate(() => performance.getEntriesByType('resource').map(e => e.name).filter(n => /\/JapanWorld-[^/]+\.js(?:\?|$)/.test(n)));
  if (initial.length || requests.length) throw Error('Japan scene loaded before entry');
  const scenes = () => page.evaluate(() => window.__pfs.scene().getEngine().scenes.length);
  const baseline = await scenes();
  const open = async () => {
    await page.evaluate(() => window.__pfs.teleport(635, 1672, 0));
    await waitFor(page, s => s.interactionId === 'airfield_checkin', 180000);
    await page.keyboard.down('KeyE'); await sleep(1600); await page.keyboard.up('KeyE');
    await page.locator('.menu-panel button').filter({ hasText: 'Visit a Japan-inspired neighborhood' }).click({ timeout: 60000 });
    const world = page.locator('[data-japan-world]');
    await world.waitFor({ state: 'visible', timeout: 60000 });
    await page.waitForFunction(() => document.querySelector('[data-japan-world]')?.getAttribute('data-japan-z') != null, null, { timeout: 60000 });
    return world;
  };
  const world = await open();
  if (!requests.length || await scenes() !== baseline + 1) throw Error('Japan did not load a separate scene on demand');
  if (!await page.locator('#hud').evaluate(el => el.classList.contains('hidden'))) throw Error('Main-world HUD remains visible in Japan');
  await page.screenshot({ path: '/tmp/japan-integrated.png', timeout: 180000 });
  const move = async (code, axis, reached) => {
    const until = Date.now() + 120000;
    await page.keyboard.down(code);
    try {
      while (!reached(Number(await world.getAttribute(`data-japan-${axis}`)))) {
        if (Date.now() > until) throw Error(`Japan movement timed out on ${axis}`);
        await sleep(100);
      }
    } finally { await page.keyboard.up(code); }
  };
  const talk = async (stage, person) => {
    await page.waitForFunction(person => document.querySelector('[data-japan-world]')?.getAttribute('data-japan-near') === person, person, { timeout: 30000 });
    await page.keyboard.down('KeyE'); await sleep(900); await page.keyboard.up('KeyE');
    await page.waitForFunction(stage => Number(document.querySelector('[data-japan-world]')?.getAttribute('data-japan-stage')) === stage, stage, { timeout: 60000 });
  };
  await move('KeyW', 'z', n => n >= 1.9);
  await move('KeyA', 'x', n => n <= -3.3);
  await talk(1, 'shopkeeper');
  await page.screenshot({ path: '/tmp/japan-aiko.png', timeout: 180000 });
  await move('KeyD', 'x', n => n >= 3.6);
  await move('KeyW', 'z', n => n >= 15.8);
  await talk(2, 'resident');
  await move('KeyS', 'z', n => n <= 2.1);
  await move('KeyA', 'x', n => n <= -3.3);
  await talk(3, 'shopkeeper');
  await move('KeyD', 'x', n => n >= 0);
  await move('KeyW', 'z', n => n >= 27.1);
  await move('KeyD', 'x', n => n >= 5.9);
  await page.waitForFunction(() => document.querySelector('[data-japan-world]')?.getAttribute('data-japan-near') === 'pond', null, { timeout: 30000 });
  if (Number(await world.getAttribute('data-japan-koi')) < 1) throw Error('Koi did not load');
  await page.keyboard.down('KeyE'); await sleep(900); await page.keyboard.up('KeyE');
  await page.waitForFunction(() => document.querySelector('[data-japan-status]')?.textContent?.includes('scatter a little food'), null, { timeout: 30000 });
  if (Number(await world.getAttribute('data-japan-feeds')) < 1) throw Error('Koi feeding was not registered');
  await page.screenshot({ path: '/tmp/japan-garden.png', timeout: 180000 });
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('pfs.save') || '{}'));
  if (saved.home?.japanTeaStage !== 3) throw Error('Tea errand progress was not saved');
  await world.locator('[data-japan-return]').click();
  await waitFor(page, s => s.state === 'playing' && Math.hypot(s.player.x - 635, s.player.z - 1672) < 8, 180000);
  if (await page.locator('#hud').evaluate(el => el.classList.contains('hidden'))) throw Error('Main-world HUD did not restore');
  if (await scenes() !== baseline || await world.count()) throw Error('Japan scene or overlay leaked');
  await open();
  if (Number(await world.getAttribute('data-japan-stage')) !== 3) throw Error('Japan progress did not restore');
  await world.locator('[data-japan-return]').click();
  await waitFor(page, s => s.state === 'playing', 180000);
  if (await scenes() !== baseline || await world.count()) throw Error('Second visit leaked resources');
  if (log.some(s => /^\[(http|error|pageerror)/.test(s)) || page.__external.length) throw Error(`Browser errors: ${JSON.stringify({ log, external: page.__external })}`);
  console.log(JSON.stringify({ success: true, lazyLoad: true, teaErrand: true, koiFeeding: true, restored: true, scenesAfterReturn: baseline }));
} finally { await browser.close(); }
