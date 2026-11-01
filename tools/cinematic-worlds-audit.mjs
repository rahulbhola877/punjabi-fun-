import fs from 'node:fs';
import { launch, waitFor } from './pt-lib.mjs';

const base = process.argv[2] ?? 'http://127.0.0.1:5173/';
const label = process.env.LABEL ?? 'after';
const out = `artifacts/cinematic-worlds/${label}`;
fs.mkdirSync(out, { recursive: true });
const { browser, page, log } = await launch(`${base}?probe&gfx=high`, {
  w: 1280, h: 720, settings: { quality: 'high', renderer: 'webgl' }, blockWebSockets: true,
});
const rows = [];
try {
  await page.waitForFunction(() => window.__pfs?.snapshot().state === 'title', null, { timeout: 300000 });
  await page.locator('#title .menu button').first().click();
  await page.locator('#title .looks button').first().click();
  await page.locator('[data-cinematic-skip]:visible').click({ timeout: 15000 }).catch(() => {});
  await waitFor(page, s => s.state === 'playing', 180000);
  const capture = async name => {
    await page.waitForTimeout(2200);
    const row = await page.evaluate(async () => {
      const e = window.__pfs.scene().getEngine();
      const scene = e.scenes.findLast(s => !s.isDisposed && s.activeCamera) ?? window.__pfs.scene();
      const frames = [], cpu = [], draws = [], triangles = []; let before = 0, previous = 0;
      const a = scene.onBeforeRenderObservable.add(() => { before = performance.now(); });
      const b = scene.onAfterRenderObservable.add(() => {
        const t = performance.now(); cpu.push(t - before); if (previous) frames.push(t - previous); previous = t;
        draws.push(e._drawCalls.current); triangles.push(scene.getActiveIndices() / 3);
      });
      await new Promise(r => setTimeout(r, 4000));
      scene.onBeforeRenderObservable.remove(a); scene.onAfterRenderObservable.remove(b);
      const stats = a => { a.sort((a,b) => a-b); return { median: a[Math.floor(a.length/2)] ?? null, p95: a[Math.floor(a.length*.95)] ?? null }; };
      return { renderer: e.getInfo(), resolution: [e.getRenderWidth(),e.getRenderHeight()], samples: cpu.length,
        renderCpuMs: stats(cpu), frameIntervalMs: stats(frames), draws: stats(draws), triangles: stats(triangles),
        meshes: scene.meshes.length, materials: scene.materials.length, scenes: e.scenes.length };
    });
    await page.screenshot({ path: `${out}/${name}.png`, timeout: 180000 });
    rows.push({ name, ...row }); console.log(JSON.stringify(rows.at(-1)));
    fs.writeFileSync(`${out}/measurements.json`, JSON.stringify({ label, software: process.env.SOFTWARE === '1', rows, log, external: page.__external },null,2));
  };
  await page.evaluate(() => window.__pfs.teleport(0,-42,0)); await capture('punjab');
  const menu = async name => {
    await page.getByRole('button', { name: 'Worlds: choose a destination' }).click();
    await page.locator('.menu-panel button').filter({ hasText: name }).click();
  };
  for (const [name,id] of [['Japan','japan'],['China','china'],['Neon Quay','neon'],['Space','space'],['Lantern Valley','pixel']]) {
    await menu(name); const world = page.locator(`[data-${id}-world]`);
    await world.waitFor({ timeout: 180000 });
    if (id === 'space') await world.locator('[data-space-skip]').click();
    await page.locator('[data-cinematic-skip]:visible').click({ timeout: 1000 }).catch(() => {});
    if (id !== 'pixel') await capture(id);
    else await page.screenshot({path:`${out}/${id}.png`});
    await world.locator(`[data-${id}-return]`).click();
    await waitFor(page,s=>s.state === 'playing',180000);
  }
  await menu('Canada');
  await waitFor(page,s=>s.state === 'playing' && s.player.x > 1000,180000); await capture('canada');
  if (log.some(s=>/^\[(error|pageerror|http)/.test(s)) || page.__external.length) throw Error(JSON.stringify({log,external:page.__external}));
} finally { await browser.close(); }
