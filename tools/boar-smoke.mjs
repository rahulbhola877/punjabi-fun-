import { launch, waitFor, sleep } from './pt-lib.mjs';
const { browser, page, log } = await launch(`${process.argv[2] ?? 'http://127.0.0.1:4173/'}?probe`, { w: 960, h: 540, settings: { quality: 'low' } });
const read = () => page.evaluate(() => ({ boar: window.__pfs.forestBoar(), snap: window.__pfs.snapshot() }));
async function until(predicate, label, timeout = 180000) {
  const end = Date.now() + timeout;
  let current;
  while (Date.now() < end) { current = await read(); if (predicate(current)) return current; await sleep(150); }
  throw Error(`${label}: ${JSON.stringify(current)}`);
}
try {
  await page.waitForFunction(() => window.__pfs?.snapshot().state === 'title', null, { timeout: 240000 });
  await page.locator('#title .menu button').first().click({ timeout: 120000 });
  await page.locator('#title .looks button').first().click({ timeout: 120000 });
  await waitFor(page, s => s.state === 'playing', 240000);
  const home = (await read()).boar.home;
  await page.evaluate(({x,z}) => window.__pfs.teleport(x,z - 2.8,0), home);
  const waiting = await until(o => o.snap.player.grounded && o.snap.prompt === 'Confront the wild boar', 'No reachable prompt');
  await page.screenshot({ path: '/tmp/punjabi-boar.png', timeout: 180000 });
  await page.keyboard.press('KeyE');
  const started = await until(o => o.boar.phase === 'charging', 'Interaction did not start');
  const attacked = await until(o => o.snap.hp < started.snap.hp, 'Boar did not attack');
  const hits = [];
  for (let target = 2; target >= 0; target--) {
    const end = Date.now() + 120000;
    while (Date.now() < end) {
      await page.keyboard.press('KeyQ');
      await sleep(600);
      const current = await read();
      if (current.boar.health <= target) { hits.push(current); break; }
      if (current.boar.phase !== 'charging' || current.snap.playerDown) throw Error(`Fight ended unexpectedly: ${JSON.stringify(current)}`);
    }
    if (hits.length !== 3 - target) throw Error(`Could not hit boar: ${JSON.stringify(await read())}`);
  }
  const completed = await until(o => o.boar.phase === 'done', 'Boar did not retreat');
  const saved = await page.evaluate(() => Object.fromEntries(Object.entries(localStorage).filter(([k,v]) => v.includes('forest_boar_repelled'))));
  if (!Object.keys(saved).length || completed.snap.money < waiting.snap.money + 150 || completed.snap.rep < waiting.snap.rep + 2) throw Error('Reward/persistence missing');
  if (completed.snap.errors.length || page.__external.length || log.some(s => /^\[(error|pageerror|http )/.test(s))) throw Error(JSON.stringify({ errors: completed.snap.errors, external: page.__external, log }));
  console.log(JSON.stringify({ waiting, started, attacked, hits, completed, saved: Object.keys(saved), log }));
} finally { await browser.close(); }
