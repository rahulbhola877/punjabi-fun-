import fs from 'node:fs';
import { launch, sleep, waitFor } from './pt-lib.mjs';

// Exercise actual input in each district. Native dialogue must retain its
// English subtitle, and those inputs must not restart Ranggarh's audio bus.
const base = process.argv[2] ?? 'http://127.0.0.1:5173/';
const { browser, page, log } = await launch(`${base}?probe&gfx=low`, { settings: { quality: 'low' } });
try {
  await page.waitForFunction(() => window.__pfs?.snapshot().state === 'title', null, { timeout: 180000 });
  await page.locator('#title .menu button').getByText('New Game', { exact: true }).click();
  await page.locator('#title .looks button').first().click();
  await waitFor(page, s => s.state === 'playing', 180000);
  fs.mkdirSync('artifacts/regional-identity', { recursive: true });
  for (const entry of [
    { country: 'Japan', name: 'japan', z: 1.8, x: -4.0, native: /[\u3040-\u30ff]/, subtitle: 'Could you take this tea parcel to Ken?' },
    { country: 'China', name: 'china', z: -43.2, x: 35.2, native: /[\u3400-\u9fff]/, subtitle: 'The riverside music evening needs a lantern shade and a tune.' },
  ]) {
    await page.getByRole('button', { name: 'Worlds: choose a destination' }).click();
    await page.locator('.menu-panel button').filter({ hasText: entry.country }).click();
    const world = page.locator(`[data-${entry.name}-world]`);
    await world.waitFor({ state: 'visible', timeout: 120000 });
    const coordinate = axis => world.getAttribute(`data-${entry.name}-${axis}`).then(Number);
    const move = async (code, axis, reached, run = false) => {
      if (run) await page.keyboard.down('ShiftLeft');
      await page.keyboard.down(code);
      try {
        const deadline = Date.now() + 120000;
        while (!reached(await coordinate(axis))) {
          if (Date.now() > deadline) throw Error(`${entry.name}: movement timed out (${await coordinate('x')}, ${await coordinate('z')})`);
          await sleep(100);
        }
        if (run && await world.getAttribute(`data-${entry.name}-locomotion`) !== 'run') throw Error(`${entry.name}: Shift did not run`);
      } finally { await page.keyboard.up(code); if (run) await page.keyboard.up('ShiftLeft'); }
    };
    // Approach on the open roadway, not through the shop footprints.
    await move('KeyW', 'z', n => n >= entry.z - 3, true);
    await move('KeyW', 'z', n => n >= entry.z);
    await move('KeyA', 'x', n => n <= entry.x);
    await page.keyboard.press('KeyE');
    const status = page.locator(`[data-${entry.name}-status]`);
    await page.waitForFunction(({ name, text }) => document.querySelector(`[data-${name}-status]`)?.textContent?.includes(text), { name: entry.name, text: entry.subtitle }, { timeout: 30000 });
    if (!entry.native.test(await status.textContent())) throw Error(`${entry.name}: missing native dialogue`);
    await sleep(250);
    const state = await page.evaluate(() => window.__pfs.snapshot().audioState);
    if (state !== 'suspended') throw Error(`${entry.name}: main-world audio resumed on local input (${state})`);
    if (!await page.getByRole('button', { name: 'Hold to run' }).isVisible()) throw Error(`${entry.name}: missing touch Run control`);
    await page.screenshot({ path: `artifacts/regional-identity/${entry.name}.png`, timeout: 180000 });
    await page.locator(`[data-${entry.name}-return]`).click();
    await waitFor(page, s => s.state === 'playing', 180000);
  }
  const errors = log.filter(s => /^\[(http|error|pageerror)/.test(s));
  if (errors.length || page.__external.length) throw Error(JSON.stringify({ errors, external: page.__external }));
  console.log('Japan and China: native dialogue + English subtitles, keyboard running, touch Run controls, and paused main-world audio passed.');
} finally { await browser.close(); }
