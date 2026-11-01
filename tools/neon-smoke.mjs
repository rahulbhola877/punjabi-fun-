import { launch, sleep, waitFor } from './pt-lib.mjs';

// Real airfield entry, alternate-scene movement/persistence and repeat return.
const { browser, page, log } = await launch(`${process.argv[2] ?? 'http://127.0.0.1:5173/'}?probe`, { settings: { quality: 'low' } });
try {
  const neonChunkRequests = [];
  const isNeonChunk = url => /\/NeonWorld-[^/]+\.js(?:\?|$)/.test(url);
  // The main world loads hundreds of resources, which can fill the default
  // resource-timing buffer before the lazy scene is requested.
  await page.evaluate(() => performance.setResourceTimingBufferSize(5000));
  page.on('request', request => { if (isNeonChunk(request.url())) neonChunkRequests.push(request.url()); });
  await page.waitForFunction(() => window.__pfs?.snapshot().state === 'title', null, { timeout: 180000 });
  await page.locator('#title .menu button').first().click();
  await page.locator('#title .looks button').first().click();
  await page.locator('[data-cinematic-skip]').waitFor({ state: 'visible', timeout: 180000 });
  await page.locator('[data-cinematic-skip]').click();
  await waitFor(page, s => s.state === 'playing', 180000);
  const initialNeonRequests = await page.evaluate(() => performance.getEntriesByType('resource').map(e => e.name).filter(n => /\/NeonWorld-[^/]+\.js(?:\?|$)/.test(n)));
  if (initialNeonRequests.length || neonChunkRequests.length) throw Error('Neon scene chunk loaded before the visit');
  const countScenes = () => page.evaluate(() => window.__pfs.scene().getEngine().scenes.length);
  const baseline = await countScenes();
  const open = async () => {
    await page.evaluate(() => window.__pfs.teleport(635, 1672, 0));
    await waitFor(page, s => s.interactionId === 'airfield_checkin', 180000);
    await page.keyboard.down('KeyE'); await sleep(1600); await page.keyboard.up('KeyE');
    await page.locator('.menu-panel button').filter({ hasText: 'Visit Neon Quay' }).click({ timeout: 60000 });
    const neon = page.locator('[data-neon-world]');
    await neon.waitFor({ state: 'visible', timeout: 60000 });
    await page.waitForFunction(() => document.querySelector('[data-neon-world]')?.getAttribute('data-neon-z') != null, null, { timeout: 60000 });
    return neon;
  };
  const neon = await open();
  if (!neonChunkRequests.length) throw Error('Neon scene chunk was not requested on entry');
  if (!await page.locator('#hud').evaluate(el => el.classList.contains('hidden'))) throw Error('Main-world HUD remains visible in Neon Quay');
  if (await countScenes() !== baseline + 1) throw Error('Expected an independent Neon scene');
  const move = async (code, axis, reached) => {
    const until = Date.now() + 120000;
    await page.keyboard.down(code);
    try {
      while (!reached(Number(await neon.getAttribute(`data-neon-${axis}`)))) {
        if (Date.now() > until) throw Error(`Neon movement timed out on ${axis}`);
        await sleep(100);
      }
    } finally { await page.keyboard.up(code); }
  };
  await move('KeyW', 'z', n => n >= -7.1);
  await move('KeyA', 'x', n => n <= -18.65);
  if (Number(await neon.getAttribute('data-neon-signals')) < 1) throw Error('Signal not collected');
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('pfs.save') || '{}'));
  if (!(saved.home?.neonSignalMask & 1)) throw Error('Signal progress was not saved');
  await move('KeyD', 'x', n => n >= 6.8);
  await move('KeyW', 'z', n => n >= 9.4);
  await page.keyboard.down('KeyE'); await sleep(1200); await page.keyboard.up('KeyE');
  await page.waitForFunction(() => document.querySelector('[data-neon-status]')?.textContent?.includes('Fox:'), null, { timeout: 60000 });
  await neon.locator('[data-neon-return]').click();
  await waitFor(page, s => s.state === 'playing' && Math.hypot(s.player.x - 635, s.player.z - 1672) < 8, 180000);
  if (await page.locator('#hud').evaluate(el => el.classList.contains('hidden'))) throw Error('Main-world HUD did not restore');
  if (await countScenes() !== baseline || await neon.count()) throw Error('Neon scene or overlay leaked on return');
  await open();
  if (Number(await neon.getAttribute('data-neon-signals')) < 1) throw Error('Signal progress not restored');
  await neon.locator('[data-neon-return]').click();
  await waitFor(page, s => s.state === 'playing', 180000);
  if (await countScenes() !== baseline || await neon.count()) throw Error('Repeated Neon visit leaked resources');
  if (log.some(s => /^\[(http|error|pageerror)/.test(s)) || page.__external.length) throw Error(`Browser errors: ${JSON.stringify({ log, external: page.__external })}`);
  console.log(JSON.stringify({ success: true, lazyLoad: true, foxHint: true, signalsRestored: true, scenesAfterReturn: baseline }));
} finally { await browser.close(); }
