import { launch, sleep, waitFor } from './pt-lib.mjs';

// Exercises the real keyboard prompts and persistent progress. Use a local
// development server and SOFTWARE=1 where no hardware renderer is present.
const { browser, page, log } = await launch(`${process.argv[2] ?? 'http://127.0.0.1:5173/'}?probe`, { settings: { quality: 'low' } });
const baskets = [{ x: 303, z: 1298 }, { x: 402, z: 1375 }, { x: 493, z: 1358 }];
const stand = { x: 368, z: 1348 };
const litter = [{ x: 190, z: 1560 }, { x: 200, z: 1573 }, { x: 211, z: 1585 }];
const bin = { x: 208, z: 1596 };
try {
  await page.waitForFunction(() => window.__pfs?.snapshot().state === 'title', null, { timeout: 180000 });
  await page.locator('#title .menu button').first().click();
  await page.locator('#title .looks button').first().click();
  await waitFor(page, s => s.state === 'playing', 180000);
  console.log('Game started; testing orchard round.');
  const state = () => page.evaluate(() => JSON.parse(localStorage.getItem('pfs.save') || '{}').home || {});
  const moveAndInteract = async (p, id, expected) => {
    await page.evaluate(p => window.__pfs.teleport(p.x, p.z, 0), p);
    await waitFor(page, s => s.interactionId === id, 180000);
    const until = Date.now() + 90000;
    for (;;) {
      // Software rendering can take over a second per frame; keep the key
      // down long enough for the game loop to observe the press.
      await page.keyboard.down('KeyE'); await sleep(1600); await page.keyboard.up('KeyE');
      if (!expected || (await state())[expected.key] === expected.value) break;
      if (Date.now() > until) throw Error(`Expected ${expected.key}=${expected.value}; got ${JSON.stringify(await state())}`);
      await sleep(500);
    }
  };
  await moveAndInteract(stand, 'orchard_stand', { key: 'orchardRoundStep', value: 1 });
  for (let i = 0; i < baskets.length; i++) await moveAndInteract(baskets[i], `orchard_basket_${i}`, { key: 'orchardRoundStep', value: i + 2 });
  await moveAndInteract(stand, 'orchard_stand', { key: 'orchardRoundPaidDay', value: 1 });
  const after = await state();
  if (after.orchardRoundStep !== 0) throw Error(`Round did not finish: ${JSON.stringify(after)}`);
  console.log('Orchard completed; testing wayside cleanup.');
  await moveAndInteract(bin, 'wayside_bin', { key: 'waysideCleanupStep', value: 1 });
  for (let i = 0; i < litter.length; i++) await moveAndInteract(litter[i], `wayside_litter_${i}`, { key: 'waysideCleanupStep', value: i + 2 });
  await moveAndInteract(bin, 'wayside_bin', { key: 'waysideCleanupDay', value: 1 });
  const cleaned = await state();
  if (cleaned.waysideCleanupStep !== 0) throw Error(`Cleanup did not finish: ${JSON.stringify(cleaned)}`);
  console.log('Wayside completed; testing Lantern Valley.');
  // The pixel world is independent; movement is rendered on its own canvas,
  // and return must restore the main game at the same airfield location.
  await moveAndInteract({ x: 635, z: 1672 }, 'airfield_checkin');
  await page.locator('.menu-panel button').filter({ hasText: 'Visit Lantern Valley' }).click();
  const pixel = page.locator('[data-pixel-world]');
  await pixel.waitFor({ state: 'visible', timeout: 30000 });
  if (!await page.locator('#hud').evaluate(el => el.classList.contains('hidden'))) throw Error('Main-world HUD remains visible in Lantern Valley');
  const before = await pixel.locator('canvas').screenshot();
  const movePixel = async (code, axis, reached) => {
    const until = Date.now() + 90000;
    await page.keyboard.down(code);
    try {
      while (!reached(Number(await pixel.getAttribute(`data-pixel-${axis}`)))) {
        if (Date.now() > until) throw Error(`Pixel player did not reach ${axis} target`);
        await sleep(100);
      }
    } finally { await page.keyboard.up(code); }
  };
  await movePixel('KeyD', 'x', n => n >= 15.35);
  await movePixel('KeyW', 'y', n => n <= 22.65);
  const afterMove = await pixel.locator('canvas').screenshot();
  if (before.equals(afterMove)) throw Error('Pixel world did not render a response to movement');
  if (Number(await pixel.getAttribute('data-pixel-lanterns')) < 1) throw Error('Pixel lantern was not collected');
  if (!((await state()).pixelLanternMask & 2)) throw Error('Collected pixel lantern was not saved');
  await pixel.locator('[data-pixel-return]').click();
  await waitFor(page, s => s.state === 'playing' && Math.hypot(s.player.x - 635, s.player.z - 1672) < 8, 180000);
  if (await page.locator('#hud').evaluate(el => el.classList.contains('hidden'))) throw Error('Main-world HUD did not restore');
  if (await pixel.count()) throw Error('Pixel world overlay remained after return');
  await moveAndInteract({ x: 635, z: 1672 }, 'airfield_checkin');
  await page.locator('.menu-panel button').filter({ hasText: 'Visit Lantern Valley' }).click();
  await pixel.waitFor({ state: 'visible', timeout: 30000 });
  if (Number(await pixel.getAttribute('data-pixel-lanterns')) < 1) throw Error('Pixel lantern progress was not restored');
  await pixel.locator('[data-pixel-return]').click();
  await waitFor(page, s => s.state === 'playing', 180000);
  console.log('Lantern Valley progress restored; testing Neon Quay.');
  const sceneCount = await page.evaluate(() => window.__pfs.scene().getEngine().scenes.length);
  await moveAndInteract({ x: 635, z: 1672 }, 'airfield_checkin');
  await page.locator('.menu-panel button').filter({ hasText: 'Visit Neon Quay' }).click();
  const neon = page.locator('[data-neon-world]');
  await neon.waitFor({ state: 'visible', timeout: 30000 });
  await page.waitForFunction(() => document.querySelector('[data-neon-world]')?.getAttribute('data-neon-z') !== null, null, { timeout: 60000 });
  const moveNeon = async (code, axis, reached) => {
    const until = Date.now() + 120000;
    await page.keyboard.down(code);
    try {
      while (!reached(Number(await neon.getAttribute(`data-neon-${axis}`)))) {
        if (Date.now() > until) throw Error(`Neon player did not reach ${axis} target`);
        await sleep(100);
      }
    } finally { await page.keyboard.up(code); }
  };
  await moveNeon('KeyW', 'z', n => n >= -7.1);
  await moveNeon('KeyA', 'x', n => n <= -18.65);
  if (Number(await neon.getAttribute('data-neon-signals')) < 1) throw Error('Neon signal was not collected');
  if (!((await state()).neonSignalMask & 1)) throw Error('Collected Neon signal was not saved');
  await neon.locator('[data-neon-return]').click();
  await waitFor(page, s => s.state === 'playing' && Math.hypot(s.player.x - 635, s.player.z - 1672) < 8, 180000);
  if (await neon.count()) throw Error('Neon overlay remained after return');
  if (await page.evaluate(() => window.__pfs.scene().getEngine().scenes.length) !== sceneCount) throw Error('Neon scene remained allocated after return');
  await moveAndInteract({ x: 635, z: 1672 }, 'airfield_checkin');
  await page.locator('.menu-panel button').filter({ hasText: 'Visit Neon Quay' }).click();
  await neon.waitFor({ state: 'visible', timeout: 30000 });
  if (Number(await neon.getAttribute('data-neon-signals')) < 1) throw Error('Neon signal progress was not restored');
  await neon.locator('[data-neon-return]').click();
  await waitFor(page, s => s.state === 'playing', 180000);
  if (await page.evaluate(() => window.__pfs.scene().getEngine().scenes.length) !== sceneCount) throw Error('Repeated Neon visit leaked a scene');
  console.log('Neon Quay progress restored; testing airfield transfer.');
  // This is an explicitly labelled quick transfer within the same map, not
  // a simulated flight or a different scene. Verify the round trip and save.
  await moveAndInteract({ x: 635, z: 1672 }, 'airfield_checkin');
  await page.locator('.menu-panel button').filter({ hasText: 'Quick transfer to Canada-inspired set' }).click();
  await waitFor(page, s => s.state === 'playing' && Math.hypot(s.player.x - 1108, s.player.z - 1748) < 8, 180000);
  await moveAndInteract({ x: 1120, z: 1750 }, 'set_checkin');
  await page.locator('.menu-panel button').filter({ hasText: 'Quick transfer to North Airfield' }).click();
  const arrived = await waitFor(page, s => s.state === 'playing' && Math.hypot(s.player.x - 630, s.player.z - 1665) < 8, 180000);
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('pfs.save')));
  if (Math.hypot(saved.player.x - 630, saved.player.z - 1665) > 8) throw Error(`Arrival not saved: ${JSON.stringify(saved.player)}`);
  if (log.some(s => /^\[(http|error|pageerror)/.test(s)) || page.__external.length) throw Error(`Browser errors ${JSON.stringify({ log, external: page.__external })}`);
  console.log(JSON.stringify({ success: true, home: cleaned, returned: arrived.player }));
} finally { await browser.close(); }
