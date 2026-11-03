import fs from 'node:fs';
import { launch, waitFor } from './pt-lib.mjs';

// Production-build diagnostic, not a wall-time gameplay/performance benchmark.
// Real HUD entry and Playwright keyboard input drive the actual district loop.
// A fixed 30 Hz frame driver draws every 30th step and every capture. The only
// actor-position fixture relocates the real moving NPC beside the real hero.
const base = process.argv[2] ?? 'http://127.0.0.1:4173/';
const out = process.env.OUT ?? 'artifacts/studio/actors';
const source = process.env.SOURCE;
if (!source) throw Error('SOURCE is required; record the exact commit and working-tree manifest.');
fs.mkdirSync(out, { recursive: true });
const result = { source, base, complete: false, software: process.env.SOFTWARE === '1',
  fixtureRevision: 'open-street-walker-v2',
  method: 'Production ?probe scene access; no __game or /src imports. Fixed 1/30 s actual district-loop steps; ordinary held keyboard events; rendering every 30th step and captures. Moving NPC position is an explicit fixture. No FPS or ordinary-timing claim.',
  settings: { quality: 'high', renderer: 'webgl', renderScale: 1 }, viewport: [1280, 720],
  checks: [], worlds: [], log: [], external: [], frames: 0 };
let browser, page;
const save = () => fs.writeFileSync(`${out}/checks.json`, JSON.stringify(result, null, 2));
const check = (ok, message) => { if (!ok) throw Error(message); result.checks.push(message); save(); console.log(message); };
const read = () => page.evaluate(() => window.__studioActors.read());
async function restore() {
  await page?.evaluate(() => {
    const f = window.__studioActors;
    if (!f) return;
    f.scene.render = f.render; f.engine.getDeltaTime = f.delta;
    f.engine.runRenderLoop(f.loop); delete window.__studioActors;
  }).catch(() => {});
}
for (const signal of ['SIGTERM', 'SIGINT']) process.once(signal, async () => {
  result.interrupted = signal; save(); await restore(); await browser?.close(); process.exit(124);
});
async function advance(n, phase) {
  if (result.frames + n > 2400) throw Error('2400-step total diagnostic ceiling exceeded');
  result.frames += n;
  return page.evaluate(async ({ n, phase }) => {
    const f = window.__studioActors;
    f.phase = phase;
    for (let i = 0; i < n; i++) {
      f.scene.render = f.frames % 30 === 0 ? f.render : () => {};
      try { f.engine.beginFrame(); f.loop(); f.engine.endFrame(); }
      finally { f.scene.render = f.render; }
      const row = f.read(); row.phase = phase; row.frame = f.frames++;
      f.samples.push(row);
      if (f.frames % 30 === 0) await new Promise(resolve => setTimeout(resolve, 0));
    }
    return f.read();
  }, { n, phase });
}
async function held(keys, n, phase) {
  for (const key of keys) await page.keyboard.down(key);
  try { return await advance(n, phase); }
  finally { for (const key of [...keys].reverse()) await page.keyboard.up(key); }
}
async function walkAxis(axis, target) {
  for (let attempt = 0; attempt < 20; attempt++) {
    const state = await read(), d = target - state.hero[axis];
    if (Math.abs(d) <= 0.13) return;
    const key = axis === 'x' ? (d > 0 ? 'KeyD' : 'KeyA') : (d > 0 ? 'KeyW' : 'KeyS');
    await held([key], Math.max(1, Math.min(60, Math.floor(Math.abs(d) / 0.12))), `approach-${axis}`);
  }
  throw Error(`Ordinary held-key approach blocked on ${axis}=${target}: ${JSON.stringify(await read())}`);
}
async function capture(name) {
  await page.evaluate(() => {
    const f = window.__studioActors;
    f.engine.beginFrame(); f.render.call(f.scene); f.engine.endFrame(); f.engine._gl?.finish();
  });
  await page.screenshot({ path: `${out}/${name}.png`, timeout: 30000 });
}
try {
  const run = await launch(`${base}?probe`, { w: 1280, h: 720, settings: result.settings, seed: 0x53144 });
  ({ browser, page } = run); result.log = run.log; result.external = page.__external;
  page.setDefaultTimeout(30000);
  await waitFor(page, s => s.state === 'title', 150000);
  check(await page.evaluate(() => !window.__game), 'Production build keeps DEV-only __game unavailable');
  await page.getByRole('button', { name: 'New Game', exact: true }).click();
  await page.locator('#title .looks button').first().click();
  await page.locator('[data-cinematic-skip]').waitFor({ state: 'visible', timeout: 60000 });
  await page.locator('[data-cinematic-skip]').click();
  await waitFor(page, s => s.state === 'playing', 60000);
  const baseline = await page.evaluate(() => window.__pfs.scene().getEngine().scenes.length);
  for (const cfg of [
    { id: 'japan', name: 'Japan', hero: 'japanHero', stationary: 'japanAiko', walker: 'japanPasserby', near: 'shopkeeper', target: { x: -5.2, z: 2 }, side: 1, range: 2.2,
      movingLane: { x: 0, z: 2 }, otherActors: ['japanAiko', 'japanKen', 'japanYuna'] },
    { id: 'china', name: 'China', hero: 'harborHero', stationary: 'harborMei', walker: 'harborWalker', near: 'host', target: { x: 34, z: -43 }, side: -1, range: 2.5,
      movingLane: { x: 41, z: -48 }, otherActors: ['harborMei', 'harborLin', 'harborWen', 'harborShu', 'harborVendor', 'harborCustomer', 'harborMarketWalker'] },
  ]) {
    const row = { id: cfg.id, complete: false, fixtures: [], captures: [] };
    result.worlds.push(row); save();
    await page.getByRole('button', { name: 'Worlds: choose a destination' }).click();
    await page.locator('.menu-panel button').filter({ hasText: cfg.name }).click();
    const world = page.locator(`[data-${cfg.id}-world]`);
    await world.waitFor({ state: 'visible', timeout: 120000 });
    row.entry = await page.evaluate(cfg => {
      const engine = window.__pfs.scene().getEngine(), scene = engine.scenes.at(-1);
      const hero = scene.getTransformNodeByName(cfg.hero), stationary = scene.getTransformNodeByName(cfg.stationary), walker = scene.getTransformNodeByName(cfg.walker);
      if (!hero || !stationary || !walker || engine._activeRenderLoops.length !== 1) throw Error('Expected real district actor nodes and one active loop');
      const others = cfg.otherActors.map(name => scene.getTransformNodeByName(name));
      if (others.some(node => !node)) throw Error('Missing actor node; cannot certify fixture clearance');
      const loop = engine._activeRenderLoops[0], delta = engine.getDeltaTime, render = scene.render;
      engine.stopRenderLoop(loop); engine.getDeltaTime = () => 1000 / 30;
      const xyz = node => ({ x: node.position.x, y: node.position.y, z: node.position.z });
      window.__studioActors = { engine, scene, hero, stationary, walker, others, loop, delta, render, frames: 0, samples: [], read() {
        const h = xyz(hero), s = xyz(stationary), w = xyz(walker);
        return { hero: h, stationary: s, walker: w, otherActors: others.map(node => ({ name: node.name, ...xyz(node) })),
          staticGap: Math.hypot(h.x - s.x, h.z - s.z), walkerGap: Math.hypot(h.x - w.x, h.z - w.z),
          near: document.querySelector(`[data-${cfg.id}-world]`)?.getAttribute(`data-${cfg.id}-near`),
          resolution: [engine.getRenderWidth(), engine.getRenderHeight()] };
      } };
      return { nodes: [hero.name, stationary.name, walker.name], scenes: engine.scenes.length, renderer: engine.getInfo(), ...window.__studioActors.read() };
    }, cfg);
    check(row.entry.scenes === baseline + 1, `${cfg.id}: exactly one district scene created`);
    check(row.entry.resolution[0] === 1280 && row.entry.resolution[1] === 720, `${cfg.id}: High remains full 1280x720`);
    await walkAxis('z', cfg.target.z);
    await walkAxis('x', cfg.target.x + 1.3);
    const pushed = await held(['KeyA', 'ShiftLeft'], 60, 'stationary-push');
    const staticSamples = await page.evaluate(() => window.__studioActors.samples.filter(s => s.phase === 'stationary-push'));
    row.stationary = { minimumGap: Math.min(...staticSamples.map(s => s.staticGap)), after: pushed };
    check(row.stationary.minimumGap >= 0.72 - 0.001, `${cfg.id}: 2 seconds of held run cannot cross stationary actor`);
    check(pushed.staticGap < cfg.range && pushed.near === cfg.near, `${cfg.id}: blocked approach remains in real interaction range`);
    await capture(`${cfg.id}-stationary`); row.captures.push(`${cfg.id}-stationary.png`);
    await held(['KeyE'], 1, 'interact');
    check(Number(await world.getAttribute(`data-${cfg.id}-stage`)) === 1, `${cfg.id}: real E advances named NPC story`);
    const skip = world.locator('[data-cinematic-skip]');
    await skip.waitFor({ state: 'visible' }); await skip.click();
    await advance(2, 'post-skip');
    const beforeRetreat = (await read()).hero.x;
    const retreated = await held(['KeyD'], 12, 'stationary-retreat');
    check(retreated.hero.x > beforeRetreat + 1, `${cfg.id}: player can retreat after contact and cutscene skip`);
    // The first fixture was too close to Aiko: reciprocal NPC collision correctly
    // stopped the staged passerby at her body before it reached the hero. Walk
    // the hero into the authored clear central road before relocating the NPC.
    // Japan's hero z=2 is beyond the passerby's entire [-15,-1] target range;
    // China's z=-48 is below the walker's entire [-45,-25] target range. Thus
    // each normal route always leads toward the hero, independent of its phase.
    await walkAxis('x', cfg.movingLane.x);
    await walkAxis('z', cfg.movingLane.z);
    row.movingLane = await page.evaluate(side => {
      const f = window.__studioActors, hero = f.hero.position;
      // Cover both the 1.4 m staged approach and the full 45-frame walk retreat.
      const a = hero.z + side * 1.4, b = hero.z - side * 5.4;
      const z0 = Math.min(a, b), z1 = Math.max(a, b);
      const clearances = f.others.map(node => {
        const p = node.position, nearestZ = Math.max(z0, Math.min(z1, p.z));
        return { name: node.name, position: p.asArray(), distanceToCorridor: Math.hypot(p.x - hero.x, p.z - nearestZ) };
      });
      return { kind: 'Hero reached open street with ordinary held movement; no hero teleport', hero: hero.asArray(),
        corridor: { x: hero.x, z0, z1 }, clearances, minimumOtherActorClearance: Math.min(...clearances.map(c => c.distanceToCorridor)) };
    }, cfg.side);
    check(row.movingLane.minimumOtherActorClearance > 1.5, `${cfg.id}: other actors are clear of the moving-NPC approach and retreat corridor`);
    save();
    row.fixtures.push(await page.evaluate(side => {
      const f = window.__studioActors, original = f.walker.position.asArray();
      f.walker.position.set(f.hero.position.x, f.hero.position.y, f.hero.position.z + side * 1.4);
      return { kind: 'Real moving NPC repositioned beside hero in the verified open street; normal route logic remains active', node: f.walker.name, original, staged: f.walker.position.asArray() };
    }, cfg.side));
    const staged = await read();
    const stopped = await advance(120, 'walker-approach-idle-hero');
    const movingSamples = await page.evaluate(() => window.__studioActors.samples.filter(s => s.phase === 'walker-approach-idle-hero'));
    row.moving = { minimumGap: Math.min(...movingSamples.map(s => s.walkerGap)), staged, stopped };
    check(Math.abs(stopped.walker.z - staged.walker.z) > 0.25, `${cfg.id}: actual walker advances toward idle hero`);
    check(row.moving.minimumGap >= 0.72 - 0.001 && stopped.walkerGap < 0.85, `${cfg.id}: moving NPC stops at idle hero without overlap`);
    const toward = cfg.side > 0 ? 'KeyW' : 'KeyS', away = cfg.side > 0 ? 'KeyS' : 'KeyW';
    await held([toward, 'ShiftLeft'], 60, 'head-on-push');
    const headSamples = await page.evaluate(() => window.__studioActors.samples.filter(s => s.phase === 'head-on-push'));
    row.moving.headOnMinimumGap = Math.min(...headSamples.map(s => s.walkerGap));
    check(row.moving.headOnMinimumGap >= 0.72 - 0.001, `${cfg.id}: held run and moving NPC remain separated head-on`);
    await capture(`${cfg.id}-moving-contact`); row.captures.push(`${cfg.id}-moving-contact.png`);
    const contact = await read();
    const free = await held([away], 45, 'walker-retreat');
    check(Math.hypot(free.hero.x - contact.hero.x, free.hero.z - contact.hero.z) > 1, `${cfg.id}: retreat from moving NPC remains possible`);
    check(Math.abs(free.walker.z - contact.walker.z) > 0.1, `${cfg.id}: blocked moving NPC resumes when player retreats`);
    row.samples = await page.evaluate(() => window.__studioActors.samples);
    await restore();
    await world.locator(`[data-${cfg.id}-return]`).click();
    await world.waitFor({ state: 'detached' });
    await waitFor(page, s => s.state === 'playing', 60000);
    check(await page.evaluate(() => window.__pfs.scene().getEngine().scenes.length) === baseline, `${cfg.id}: district scene disposed after return`);
    row.complete = true; save();
  }
  const final = await page.evaluate(() => window.__pfs.snapshot());
  check(!final.errors.length, 'No game-loop errors');
  check(!result.external.length, 'No requests outside deployment origin');
  check(!result.log.some(s => /^\[(http|error|pageerror)/.test(s)), 'No HTTP, console or page errors');
  result.complete = true;
} catch (error) {
  result.error = String(error.stack ?? error);
  result.failure = await read().catch(() => null);
  result.failureTrace = await page?.evaluate(() => window.__studioActors?.samples ?? []).catch(() => []);
  if (page) await page.screenshot({ path: `${out}/failure.png`, timeout: 15000 }).catch(() => {});
  process.exitCode = 1;
} finally { await restore(); save(); await browser?.close(); }
