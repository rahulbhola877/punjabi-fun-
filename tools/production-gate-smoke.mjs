import { launch, waitFor } from './pt-lib.mjs';

// Even an explicit probe query must not expose unfinished outer terrain in a
// production build. A save from an experimental build must remain playable.
const oldSave = {
  version: 3, savedAt: '2025-01-01T00:00:00.000Z',
  player: { look: 'jaggi', x: 3000, y: 25, z: 900, yaw: 0 },
  money: 200, rep: 12, introStage: 999, flags: { purse20k: true },
  unlockedVehicles: ['scooter', 'auto'], upgrades: [], paints: [], vehicles: [
    { id: 'old_one', type: 'car', x: 3000, y: 20, z: 900, yaw: 0, paint: 'mint' },
    { id: 'old_two', type: 'car', x: 3000, y: 20, z: 900, yaw: 0, paint: 'mint' },
  ],
  medals: {}, bests: {}, stats: {}, outfit: {}, bag: {}, home: {}, people: {}, fuel: {}, bank: 0,
};
const { browser, page, log } = await launch(`${process.argv[2] ?? 'http://127.0.0.1:4173/'}?probe&outer=1`, { settings: { quality: 'low' }, storage: { 'pfs.save': JSON.stringify(oldSave) } });
try {
  await page.waitForFunction(() => window.__pfs?.snapshot().state === 'title', null, { timeout: 180000 });
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  const s = await waitFor(page, s => s.state === 'playing', 180000);
  const actors = [s.player, ...s.vehicles.filter(v => v.id === 'old_one' || v.id === 'old_two')];
  if (actors.length !== 3 || s.rep !== 12) throw Error(`Save progress or actors lost: ${JSON.stringify(s)}`);
  if (actors.some(p => p.x <= -1199 || p.x >= 1499 || p.z <= -1199 || p.z >= 2099 || p.y < 0)) throw Error(`Actor not recovered inside core: ${JSON.stringify(actors)}`);
  for (let i = 0; i < actors.length; i++) for (let j = i + 1; j < actors.length; j++) if (Math.hypot(actors[i].x - actors[j].x, actors[i].z - actors[j].z) < 7) throw Error(`Recovered actors overlap: ${JSON.stringify(actors)}`);
  if ((await page.evaluate(() => window.__pfs.outerRegions())).active !== 0) throw Error('Production enabled experimental terrain');
  await page.evaluate(() => window.__pfs.teleport(-2250, 150, 0));
  const bounded = await waitFor(page, s => s.player.x > -1201, 60000);
  if (bounded.player.x < -1200) throw Error('Production teleport escaped the core');
  if (log.some(x => x.includes('[pageerror]'))) throw Error(log.join('\n'));
  console.log('Production gate and recovered multi-vehicle save passed.');
} finally { await browser.close(); }
