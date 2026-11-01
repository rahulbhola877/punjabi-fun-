import { launch, sleep, waitFor } from './pt-lib.mjs';
const { browser, page, log } = await launch(`${process.argv[2] ?? 'http://127.0.0.1:5173/'}?probe&outer=1`, { settings: { quality: 'low' } });
try {
  await page.waitForFunction(() => window.__pfs?.snapshot().state === 'title', null, { timeout: 180000 });
  await page.locator('#title .menu button').first().click();
  await page.locator('#title .looks button').first().click();
  await waitFor(page, s => s.state === 'playing', 180000);
  const sample = () => page.evaluate(() => ({ regions: window.__pfs.outerRegions(), fps: window.__pfs.snapshot().fps, meshes: window.__pfs.scene().meshes.length, vertices: window.__pfs.scene().meshes.reduce((n, m) => n + m.getTotalVertices(), 0), outerMeshes: window.__pfs.scene().meshes.filter(m => m.metadata?.outerTile).length, outerVertices: window.__pfs.scene().meshes.filter(m => m.metadata?.outerTile).reduce((n, m) => n + m.getTotalVertices(), 0) }));
  await sleep(8000); console.log('settled start', JSON.stringify(await sample()));
  await page.evaluate(() => window.__pfs.teleport(-2250, 150, Math.PI / 2));
  await waitFor(page, s => s.interactionId === 'outer_forestCamp', 180000);
  await sleep(8000); console.log('settled forest', JSON.stringify(await sample()));
  await page.screenshot({ path: '/tmp/outer-forest-grove.png', timeout: 180000 });
  await page.evaluate(() => window.__pfs.teleport(150, 3150, Math.PI / 2));
  await waitFor(page, s => s.interactionId === 'outer_northCamp', 180000);
  await sleep(8000); console.log('settled north', JSON.stringify(await sample()));
  await page.screenshot({ path: '/tmp/outer-north-grove.png', timeout: 180000 });
  if (log.some(x => x.includes('[pageerror]'))) throw Error(log.join('\n'));
} finally { await browser.close(); }
