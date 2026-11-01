import { launch, sleep, waitFor } from './pt-lib.mjs';

// Exercise real nearby-crowd spawning and the ordinary E-to-chat interaction.
const { browser, page, log } = await launch(`${process.argv[2] ?? 'http://127.0.0.1:4173/'}?probe`, {
  w: 1280, h: 720, settings: { quality: 'low' },
});
try {
  await page.waitForFunction(() => window.__pfs?.snapshot().state === 'title', null, { timeout: 240000 });
  await page.locator('#title .menu button').first().click();
  await page.locator('#title .looks button').first().click();
  await waitFor(page, s => s.state === 'playing', 180000);
  await page.evaluate(() => window.__pfs.teleport(1116, 1738.6, 0));
  const arrival = await waitFor(page, s => s.people.some(p => p.id === 'canada_guide') && s.interactionId === 'chat_canada_guide', 180000);
  const guide = arrival.people.find(p => p.id === 'canada_guide');
  if (Math.abs(guide.y) > 0.3) throw Error(`Guide is not grounded: ${JSON.stringify(guide)}`);
  await page.keyboard.down('KeyE');
  await sleep(900);
  await page.keyboard.up('KeyE');
  const chat = await waitFor(page, s => s.bubbles.some(t => t.includes('Main Street') || t.includes('airfield counter')), 30000);

  await page.evaluate(() => window.__pfs.teleport(1160, 1815, 0));
  const street = await waitFor(page, s => s.people.filter(p => p.id.startsWith('canada_') && p.role === 'roamer').length >= 2, 180000);
  const residents = street.people.filter(p => p.id.startsWith('canada_') && p.role === 'roamer');
  if (residents.some(p => Math.abs(p.y) > 0.3 || !((p.z > 1807 && p.z < 1811) || (p.z > 1829 && p.z < 1833)))) {
    throw Error(`Residents are off the sidewalks or ground: ${JSON.stringify(residents)}`);
  }
  const initial = Object.fromEntries(residents.map(p => [p.id, { x: p.x, z: p.z }]));
  const moved = await waitFor(page, s => s.people.some(p => initial[p.id] && Math.hypot(p.x - initial[p.id].x, p.z - initial[p.id].z) > 0.2), 120000);
  const parked = ['car_canada', 'pickup_canada'].map(id => street.vehicles.find(v => v.id === id));
  if (parked.some(v => !v || v.y < -0.5)) throw Error(`Canada parked vehicles missing or below ground: ${JSON.stringify(parked)}`);
  await page.evaluate(() => window.__pfs.holdCamera({ eye: { x: 1090, y: 3.5, z: 1800 }, at: { x: 1130, y: 3, z: 1848 }, fov: 0.85 }));
  await sleep(2000);
  await page.screenshot({ path: '/tmp/canada-mainstreet.png', timeout: 180000 });
  await page.evaluate(() => { window.__pfs.holdCamera(null); window.__pfs.teleport(1130, 1837, 0); });
  const beforeShop = await waitFor(page, s => s.interactionId === 'cshop_canadaCafe' && s.people.some(p => p.id === 'keeper_canadaCafe'), 180000);
  await page.keyboard.down('KeyE'); await sleep(1200); await page.keyboard.up('KeyE');
  const menu = page.locator('.menu-panel').filter({ has: page.getByRole('heading', { name: 'Main Street Café' }) });
  await menu.waitFor({ state: 'visible', timeout: 60000 });
  await menu.locator('.shop-item').filter({ hasText: 'Maple biscuit packet' }).locator('button').click();
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('pfs.save') || '{}').bag?.canada_biscuit === 1, null, { timeout: 60000 });
  const afterShop = await page.evaluate(() => window.__pfs.snapshot());
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('pfs.save')));
  if (saved.bag.canada_biscuit !== 1 || saved.money !== beforeShop.money || afterShop.money !== beforeShop.money) throw Error('Café purchase or unlimited balance was not preserved');
  const errors = await page.evaluate(() => window.__pfs.snapshot().errors);
  if (errors.length || page.__external.length || log.some(s => /^\[(error|pageerror|http )/.test(s))) {
    throw Error(JSON.stringify({ errors, external: page.__external, log }));
  }
  console.log(JSON.stringify({ guide, reply: chat.bubbles, residents, moved: moved.people.filter(p => initial[p.id]), parked, purchase: { before: beforeShop.money, after: afterShop.money, bag: saved.bag.canada_biscuit }, errors }));
} finally {
  await browser.close();
}
