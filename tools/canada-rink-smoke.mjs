import { launch, sleep, waitFor, walkTo, release } from './pt-lib.mjs';

// Exercise the real rink prompt, puck shot, goal and persistent scoreboard.
const { browser, page, log } = await launch(`${process.argv[2] ?? 'http://127.0.0.1:5173/'}?probe`, { settings: { quality: 'low' } });
try {
  await page.waitForFunction(() => window.__pfs?.snapshot().state === 'title', null, { timeout: 180000 });
  await page.locator('#title .menu button').first().click();
  await page.locator('#title .looks button').first().click();
  await waitFor(page, s => s.state === 'playing', 180000);
  // Enter and leave through the actual gap in the east boards, using walking
  // controls rather than relying only on a geometry or raycast assertion.
  if (process.env.RINK_PROMPT_ONLY !== '1') {
    await page.evaluate(() => window.__pfs.teleport(1262, 1740, 0));
    await walkTo(page, [{ x: 1255, z: 1740 }, { x: 1262, z: 1740 }], { tol: 1.2, timeout: 180000 });
    await release(page);
  }
  await page.evaluate(() => window.__pfs.teleport(1245, 1738.5, 0));
  await waitFor(page, s => s.interactionId === 'canada_rink_puck', 180000);
  const prompt = page.locator('.prompt:not(.hidden)');
  if ((await prompt.locator('kbd').textContent())?.trim() !== 'Q') throw Error(`Rink prompt shows wrong key: ${await prompt.innerText()}`);
  await page.keyboard.down('KeyE'); await sleep(350); await page.keyboard.up('KeyE');
  const afterE = await page.evaluate(() => window.__pfs.scene().getMeshByName('rinkPuck').position.clone().asArray());
  await sleep(600);
  const still = await page.evaluate(() => window.__pfs.scene().getMeshByName('rinkPuck').position.clone().asArray());
  if (Math.hypot(afterE[0] - still[0], afterE[2] - still[2]) > 0.01) throw Error('E unexpectedly moved the puck');
  await sleep(1200); await page.screenshot({ path: '/tmp/canada-rink.png', timeout: 180000 });
  await page.evaluate(() => {
    const p = window.__pfs.snapshot().player;
    window.__pfs.holdCamera({ eye: { x: p.x, y: 2, z: p.z }, at: { x: 1245, y: 1, z: 1758 }, fov: 1 });
  });
  await sleep(500);
  await page.keyboard.down('KeyQ'); await sleep(700); await page.keyboard.up('KeyQ');
  await page.waitForFunction(() => (JSON.parse(localStorage.getItem('pfs.save') || '{}').home?.canadaRinkGoals ?? 0) >= 1, null, { timeout: 120000 });
  const goal = await page.evaluate(() => JSON.parse(localStorage.getItem('pfs.save') || '{}').home.canadaRinkGoals);
  await page.evaluate(() => window.__pfs.holdCamera(null));
  const errors = log.filter(line => line.startsWith('[pageerror]'));
  if (errors.length || page.__external.length) throw Error(JSON.stringify({ errors, external: page.__external }));
  console.log('Ice rink: prompt, aimed puck, goal and save passed.', JSON.stringify({ goal }));
} finally { await browser.close(); }
