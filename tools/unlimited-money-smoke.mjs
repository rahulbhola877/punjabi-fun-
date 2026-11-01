// Verify an existing empty-wallet save can buy, travel and refill without
// serialising Infinity or reducing its finite balance. Uses real UI actions.
import { launch, sleep, waitFor } from './pt-lib.mjs';

const oldSave = {
  version: 3, savedAt: '2025-01-01T00:00:00.000Z',
  player: { look: 'jaggi', x: 0, y: 0.2, z: 0, yaw: 0 },
  money: 0, rep: 0, introStage: 999, flags: { purse20k: true },
  unlockedVehicles: ['scooter', 'auto'], upgrades: [], paints: [], vehicles: [],
  medals: {}, bests: {}, stats: {}, outfit: {}, bag: {}, home: {}, people: {}, fuel: {}, bank: 0,
};
const { browser, page, log } = await launch(`${process.argv[2] ?? 'http://127.0.0.1:4173/'}?probe`, {
  w: 960, h: 540, settings: { quality: 'low', freePlay: false }, storage: { 'pfs.save': JSON.stringify(oldSave) },
});
try {
  await page.waitForFunction(() => window.__pfs?.snapshot().state === 'title', null, { timeout: 240000 });
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await waitFor(page, s => s.state === 'playing' && s.money === 0, 180000);
  if ((await page.locator('[aria-label="Money"]').innerText()).trim() !== '₹∞') throw Error('HUD does not display unlimited funds');

  await page.evaluate(() => window.__pfs.teleport(1130, 1837, 0));
  await waitFor(page, s => s.interactionId === 'cshop_canadaCafe' && s.people.some(p => p.id === 'keeper_canadaCafe'), 180000);
  await page.keyboard.press('KeyE');
  const shop = page.locator('.menu-panel').filter({ has: page.getByRole('heading', { name: 'Main Street Café' }) });
  await shop.waitFor({ state: 'visible', timeout: 60000 });
  if (!(await shop.innerText()).includes('₹∞')) throw Error('Shop does not show unlimited funds');
  const biscuit = shop.locator('.shop-item').filter({ hasText: 'Maple biscuit packet' }).locator('button');
  if (await biscuit.isDisabled()) throw Error('Zero-balance save cannot buy the biscuit');
  await biscuit.click();
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('pfs.save') || '{}').bag?.canada_biscuit === 1, null, { timeout: 60000 });
  await shop.getByRole('button', { name: 'Done' }).click();
  await waitFor(page, s => s.state === 'playing', 60000);

  await page.evaluate(() => window.__pfs.teleport(22, -160, 0));
  await sleep(500);
  await page.getByRole('button', { name: 'Bus and auto stand: travel to a famous place' }).click();
  const travel = page.locator('.menu-panel').filter({ has: page.getByRole('heading', { name: 'Bus & auto stand' }) });
  await travel.waitFor({ state: 'visible', timeout: 60000 });
  const destinations = travel.locator('button').filter({ hasNotText: 'Rehn de' });
  if (!await destinations.count() || await destinations.first().isDisabled()) throw Error('Zero-balance save cannot travel');
  await destinations.first().click();
  await waitFor(page, s => s.state === 'playing', 120000);

  const vehicle = await page.evaluate(() => window.__pfs.driveAt('car', 142, -176, 0));
  if (!vehicle) throw Error('Could not enter car at the fuel pump');
  await page.evaluate(() => window.__pfs.fuel(0.1));
  await waitFor(page, s => s.interactionId === 'pump', 120000);
  await page.keyboard.press('KeyE');
  await page.waitForFunction(() => window.__pfs.fuel() > 0.97, null, { timeout: 60000 });
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('pfs.save')));
  if (saved.money !== 0 || saved.bag.canada_biscuit !== 1) throw Error(`Balance or purchase not preserved: ${JSON.stringify({money:saved.money, bag:saved.bag})}`);
  const errors = await page.evaluate(() => window.__pfs.snapshot().errors);
  if (errors.length || page.__external.length || log.some(s => /^\[(error|pageerror|http )/.test(s))) throw Error(JSON.stringify({ errors, external: page.__external, log }));
  console.log(JSON.stringify({ wallet: '₹∞', savedMoney: saved.money, biscuit: saved.bag.canada_biscuit, travel: 'passed', fuel: await page.evaluate(() => window.__pfs.fuel()) }));
} finally { await browser.close(); }
