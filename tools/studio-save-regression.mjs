import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { launch, waitFor } from './pt-lib.mjs';

// Fixture-assisted production integration, not ordinary job acquisition/travel.
// Seeds only persisted JSON based on a genuine New Game/manual save. Uses real
// Continue and E input, existing probe teleport to real POIs, and bounded ticks.
// No private mission methods, reward dispatch, DEV __game or /src browser imports.
const base = process.argv[2] ?? 'http://127.0.0.1:4173/';
const source = process.env.SOURCE;
if (!source) throw Error('SOURCE is required; supply the exact build/working-tree manifest identity.');
const out = process.env.OUT ?? 'artifacts/studio/saves';
const compat = process.env.COMPAT === '1';
fs.mkdirSync(out, { recursive: true });
const layout = fs.readFileSync(new URL('../src/world/layout.ts', import.meta.url), 'utf8');
function poi(id) {
  const match = new RegExp(`^\\s*${id}:\\s*\\{[^\\n]*?x:\\s*(-?[\\d.]+),\\s*z:\\s*(-?[\\d.]+)`, 'm').exec(layout);
  if (!match) throw Error(`Cannot resolve authored POIS.${id}; update the harness explicitly.`);
  return { id, x: Number(match[1]), z: Number(match[2]) };
}
const targets = { tailor: poi('tailor'), fruit: poi('fruit') };
const result = { source, base, complete: false, software: process.env.SOFTWARE === '1', compatRequested: compat,
  method: 'Actual New Game/manual-save baseline, explicit activeJob JSON fixtures, real reload/Continue and same-page Save & quit/Continue, ordinary E dispatch after probe teleport to actual destination or saved-owned vehicle. Frozen render loop plus bounded 30 Hz probe ticks; full-resolution rendered captures. No ordinary acquisition/journey or FPS claim.',
  settings: { quality: 'high', renderer: 'webgl', renderScale: 1, freePlay: false }, viewport: [1280, 720],
  layoutSha256: createHash('sha256').update(layout).digest('hex'), targets,
  checks: [], samples: [], fixtures: [], screenshots: [], frames: 0, reloads: 0, log: [], external: [] };
let browser, page;
const saveReport = () => fs.writeFileSync(`${out}/checks.json`, JSON.stringify(result, null, 2));
const check = (ok, message) => { if (!ok) throw Error(message); result.checks.push(message); saveReport(); console.log(message); };
const read = () => page.evaluate(() => {
  const p = window.__pfs, s = p.snapshot(), objective = document.querySelector('#hud .objective'), job = document.querySelector('#hud .job');
  const carry = p.scene().getMeshByName('tiffin');
  return { state: s.state, player: s.player, vehicle: s.vehicle, vehicles: s.vehicles, job: s.job, objective: s.objective,
    money: s.money, rep: s.rep, stats: s.stats, introStage: s.introStage,
    interactionId: s.interactionId, prompt: s.prompt, dialogueOpen: s.dialogueOpen, modalOpen: s.modalOpen,
    objectiveText: objective?.textContent ?? '', objectiveVisible: !!objective && !objective.classList.contains('hidden') && getComputedStyle(objective).display !== 'none',
    jobText: job?.textContent ?? '', jobVisible: !!job && !job.classList.contains('hidden'),
    econ: p.econ(), clock: p.hour(), saved: JSON.parse(localStorage.getItem('pfs.save') ?? 'null'),
    carryMesh: carry ? { uniqueId: carry.uniqueId, disposed: carry.isDisposed(), enabled: carry.isEnabled(), vertices: carry.getTotalVertices(), parent: carry.parent?.name ?? null } : null,
    resolution: [p.scene().getEngine().getRenderWidth(), p.scene().getEngine().getRenderHeight()], errors: s.errors };
});
async function sample(label) {
  const row = { label, ...await read() }; result.samples.push(row); saveReport(); return row;
}
async function advance(n = 1) {
  if (result.frames + n > 360) throw Error('360 manual-step ceiling exceeded');
  result.frames += n;
  await page.evaluate(n => {
    const p = window.__pfs, s = p.scene(), render = s.render;
    s.render = () => {};
    try { p.tick(n, null); } finally { s.render = render; }
  }, n);
}
async function key(code) {
  await page.keyboard.down(code);
  try { await advance(); } finally { await page.keyboard.up(code); }
  await advance();
}
async function capture(name) {
  await page.evaluate(() => {
    const s = window.__pfs.scene(), e = s.getEngine();
    e.beginFrame(); s.render(); e.endFrame(); e._gl?.finish();
  });
  await page.screenshot({ path: `${out}/${name}.png`, timeout: 30000 });
  result.screenshots.push(`${name}.png`); saveReport();
}
async function reloadContinue(label) {
  if (++result.reloads > (compat ? 7 : 5)) throw Error('Reload ceiling exceeded');
  await page.reload({ waitUntil: 'load', timeout: 150000 });
  await waitFor(page, s => s.state === 'title', 150000);
  check(await page.evaluate(() => !window.__game), `${label}: production __game remains unavailable`);
  await page.evaluate(() => window.__pfs.captureHold(true));
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await waitFor(page, s => s.state === 'playing', 60000);
  await advance(6);
  const state = await sample(label);
  check(state.resolution[0] === 1280 && state.resolution[1] === 720, `${label}: full 1280x720 retained`);
  check(!state.errors.length, `${label}: no game-loop errors`);
  return state;
}
async function seed(label, data) {
  fs.writeFileSync(`${out}/${label}-fixture.json`, JSON.stringify(data, null, 2));
  result.fixtures.push({ label, kind: 'Persisted JSON fixture based on actual New Game/manual save', activeJob: data.activeJob ?? '(missing)', introStage: data.introStage, day: data.home.day });
  await page.evaluate(data => localStorage.setItem('pfs.save', JSON.stringify(data)), data);
  saveReport(); return reloadContinue(`${label}-restored`);
}
async function atDestination(id, label) {
  const target = targets[id];
  result.fixtures.push({ label, kind: 'Probe teleport to actual authored destination; no POI movement', ...target });
  await page.evaluate(p => window.__pfs.teleport(p.x, p.z, 0), target);
  await advance(10);
  const state = await sample(`${label}-at-destination`);
  check(state.interactionId === 'deliver', `${label}: real delivery interaction selected at ${id}`);
  return state;
}
function sameReceipt(a, b) {
  return a.money === b.money && a.rep === b.rep && a.stats.deliveries === b.stats.deliveries && a.stats.tiffins === b.stats.tiffins
    && JSON.stringify(a.econ.tiffinDone) === JSON.stringify(b.econ.tiffinDone);
}
function savedMatchesLive(s) {
  return s.saved.money === s.money && s.saved.rep === s.rep
    && s.saved.stats.deliveries === s.stats.deliveries && s.saved.stats.tiffins === s.stats.tiffins;
}
async function receipt(label) {
  await key('KeyE');
  await page.locator('.dialogue').waitFor({ state: 'visible', timeout: 15000 });
  const state = await sample(`${label}-thankyou-open`);
  check(state.dialogueOpen, `${label}: reload checkpoint is the still-open thank-you dialogue`);
  check(savedMatchesLive(state), `${label}: wallet, reputation and receipt counters persisted before dialogue dismissal`);
  fs.writeFileSync(`${out}/${label}-receipt-save.json`, JSON.stringify(state.saved, null, 2));
  await capture(`${label}-thankyou`);
  return state;
}
async function samePageQuitContinue(label) {
  const before = await sample(`${label}-before-quit`);
  check(before.player.carrying && before.carryMesh?.enabled && !before.carryMesh.disposed && before.carryMesh.vertices > 0 && before.carryMesh.parent,
    `${label}: actual carry mesh is enabled, attached and has geometry before quitting`);
  await page.evaluate(() => {
    const scene = window.__pfs.scene(), mesh = scene.getMeshByName('tiffin');
    window.__studioSaveLifecycle = { scene, mesh, parent: mesh.parent, timeOrigin: performance.timeOrigin };
  });
  await capture(`${label}-before-quit`);
  await key('Escape');
  await page.locator('.menu-panel button').getByText('Save & quit to title', { exact: true }).click();
  await waitFor(page, s => s.state === 'title', 30000);
  const title = await sample(`${label}-saved-at-title`);
  check(title.saved.activeJob?.kind === 'delivery' && title.saved.activeJob.destId === before.job.dest,
    `${label}: actual Save & quit records the carried delivery`);
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await waitFor(page, s => s.state === 'playing', 60000);
  await advance(6);
  const after = await sample(`${label}-same-page-continued`);
  const lifecycle = await page.evaluate(() => {
    const old = window.__studioSaveLifecycle, scene = window.__pfs.scene(), mesh = scene.getMeshByName('tiffin');
    return { samePage: old.timeOrigin === performance.timeOrigin, sameScene: old.scene === scene,
      sameMesh: old.mesh === mesh, oldMeshDisposed: old.mesh.isDisposed(), attachedToNewParent: !!mesh?.parent && mesh.parent !== old.parent,
      parentBefore: old.parent?.name ?? null, parentAfter: mesh?.parent?.name ?? null,
      meshesWithCarryName: scene.meshes.filter(m => m.name === 'tiffin').length };
  });
  result.samples.push({ label: `${label}-lifecycle`, ...lifecycle }); saveReport();
  check(lifecycle.samePage && lifecycle.sameScene && lifecycle.sameMesh && !lifecycle.oldMeshDisposed
    && lifecycle.attachedToNewParent && lifecycle.meshesWithCarryName === 1, `${label}: same runtime preserves the reusable carry mesh and attaches it to the new player`);
  check(after.player.carrying && !after.vehicle && after.carryMesh?.enabled && after.carryMesh.vertices > 0
    && after.job?.dest === before.job.dest && after.job.condition === before.job.condition
    && after.job.elapsed >= before.job.elapsed && after.job.elapsed < before.job.elapsed + 1
    && sameReceipt(before, after), `${label}: Continue restores carried job on foot without resetting timer or awarding a receipt`);
  await capture(`${label}-continued`);
  return after;
}
async function vehicleQuitContinue() {
  const state = await read();
  const owned = state.saved.vehicles.filter(v => ['motorcycle', 'scooter', 'bicycle', 'car'].includes(v.type))
    .sort((a, b) => Number(b.id === 'bullet_ghar') - Number(a.id === 'bullet_ghar')).slice(0, 3);
  const attempts = [];
  for (const savedVehicle of owned) {
    for (const [side, front] of [[1.1, 0], [-1.1, 0], [0, 2.2], [0, -2.2]]) {
      const current = (await read()).vehicles.find(v => v.id === savedVehicle.id);
      if (!current) break;
      const x = current.x + Math.cos(current.yaw) * side + Math.sin(current.yaw) * front;
      const z = current.z - Math.sin(current.yaw) * side + Math.cos(current.yaw) * front;
      const yaw = Math.atan2(current.x - x, current.z - z);
      result.fixtures.push({ kind: 'Probe approach beside existing saved-owned vehicle; real E only if its actual prompt wins', id: current.id, x, z, yaw });
      await page.evaluate(p => window.__pfs.teleport(p.x, p.z, p.yaw), { x, z, yaw });
      await advance(6);
      const approach = await sample(`owned-vehicle-${current.id}-approach-${attempts.length}`);
      attempts.push({ id: current.id, interactionId: approach.interactionId, prompt: approach.prompt, player: approach.player });
      if (approach.interactionId !== `veh_${current.id}`) continue;
      await key('KeyE');
      const entered = await sample('owned-vehicle-entered-by-real-E');
      check(entered.vehicle?.id === current.id && entered.player.carrying,
        'Real E enters the selected saved-owned vehicle while the delivery remains carried');
      check(entered.carryMesh?.parent === `${current.id}_vis`, 'Actual carry mesh is attached to the selected vehicle before Save & quit');
      await samePageQuitContinue('delivery-vehicle');
      result.vehicleRuntime = { status: 'PASS', id: current.id, attempts }; saveReport(); return;
    }
  }
  result.vehicleRuntime = { status: 'NOT RUN', reason: 'No saved-owned vehicle produced its own selected interaction within three vehicles/four authored approach offsets; no entry callback was forced.', attempts };
  saveReport();
}
for (const signal of ['SIGTERM', 'SIGINT']) process.once(signal, async () => {
  result.interrupted = signal; saveReport(); await browser?.close(); process.exit(124);
});
try {
  const run = await launch(`${base}?probe&hour=9`, { w: 1280, h: 720, settings: result.settings, seed: 0x53415645 });
  ({ browser, page } = run); result.log = run.log; result.external = page.__external;
  page.setDefaultTimeout(30000);
  await waitFor(page, s => s.state === 'title', 150000);
  await page.getByRole('button', { name: 'New Game', exact: true }).click();
  await page.locator('#title .looks button').first().click();
  await page.locator('[data-cinematic-skip]').waitFor({ state: 'visible', timeout: 60000 });
  await page.locator('[data-cinematic-skip]').click();
  await waitFor(page, s => s.state === 'playing', 60000);
  await page.keyboard.press('Escape');
  await page.locator('.menu-panel button').getByText('Save game', { exact: true }).click();
  await page.locator('.menu-panel button').getByText('Resume', { exact: true }).click();
  await waitFor(page, s => s.state === 'playing', 30000);
  await page.evaluate(() => window.__pfs.captureHold(true));
  const baseline = (await sample('actual-newgame-manual-save')).saved;
  check(baseline?.version === 3 && baseline.flags.opening_seen, 'Fixture baseline comes from an actual v3 New Game and manual Save');
  fs.writeFileSync(`${out}/actual-newgame-save.json`, JSON.stringify(baseline, null, 2));
  const prepared = () => {
    const s = structuredClone(baseline);
    s.introStage = 999; s.flags.opening_seen = true; s.home.day = 0;
    s.econ.today.day = 0; s.econ.tiffinDay = 0; s.econ.tiffinDone = [];
    return s;
  };

  const delivery = prepared();
  delivery.activeJob = { kind: 'delivery', destId: 'tailor', elapsed: 12.75, par: 60, limit: 132, condition: 82, routeLen: 100 };
  const restoredDelivery = await seed('delivery', delivery);
  check(restoredDelivery.job?.dest === 'tailor' && restoredDelivery.job.elapsed >= 12.75 && restoredDelivery.job.elapsed < 13.25
    && restoredDelivery.job.par === 60 && restoredDelivery.job.condition === 82, 'Delivery destination, elapsed timer, par and condition restore');
  check(restoredDelivery.player.carrying && restoredDelivery.objectiveVisible && restoredDelivery.objectiveText.includes('Masterji')
    && restoredDelivery.jobVisible && restoredDelivery.jobText.includes('82%') && restoredDelivery.jobText.includes('Food warmth'), 'Delivery carrying, visible objective, warmth timer and condition HUD restore');
  check(restoredDelivery.money === delivery.money && restoredDelivery.stats.deliveries === delivery.stats.deliveries, 'Delivery restore awards no money or completed delivery');
  const elapsed = restoredDelivery.job.elapsed;
  await advance(30);
  check((await read()).job.elapsed > elapsed + 0.8, 'Restored delivery timer advances through actual fixed updates');
  await capture('delivery-restored');
  await samePageQuitContinue('delivery-on-foot');
  await vehicleQuitContinue();
  const deliveryBefore = await atDestination('tailor', 'delivery');
  const deliveryReceipt = await receipt('delivery');
  check(!deliveryReceipt.job && !deliveryReceipt.player.carrying && deliveryReceipt.saved.activeJob === null
    && deliveryReceipt.stats.deliveries === deliveryBefore.stats.deliveries + 1 && deliveryReceipt.money > deliveryBefore.money
    && deliveryReceipt.saved.medals.delivery_tailor && Number.isFinite(deliveryReceipt.saved.bests.delivery_tailor), 'Delivery receipt clears ownership and persists one reward, medal and best');
  const deliveredReload = await reloadContinue('delivery-reloaded-during-thankyou');
  check(sameReceipt(deliveryReceipt, deliveredReload) && !deliveredReload.job && !deliveredReload.player.carrying, 'Reload during delivery thank-you retains exactly one reward and no active job');
  await key('KeyE');
  check(sameReceipt(deliveryReceipt, await sample('delivery-second-E')), 'Another real E after receipt reload cannot repeat delivery payment');

  const tiffin = prepared();
  tiffin.activeJob = { kind: 'tiffin', day: 0, hour: 12.4, stops: ['tailor', 'fruit'], condition: 73 };
  const restoredTiffin = await seed('tiffin', tiffin);
  check(!restoredTiffin.job && restoredTiffin.player.carrying && JSON.stringify(restoredTiffin.econ.batch?.stops) === JSON.stringify(['tailor', 'fruit'])
    && restoredTiffin.econ.batch.cond === 73 && restoredTiffin.clock === '12:24', 'Tiffin day/hour, remaining prepaid stops, condition and carrying restore');
  check(restoredTiffin.objectiveVisible && restoredTiffin.objectiveText.includes('Tiffin') && restoredTiffin.objectiveText.includes('Masterji')
    && restoredTiffin.objectiveText.includes('2 left'), 'Tiffin visible objective restores first customer and remaining-stop count');
  check(restoredTiffin.money === tiffin.money && restoredTiffin.stats.tiffins === tiffin.stats.tiffins, 'Tiffin restore does not charge ingredients or award payment again');
  await capture('tiffin-restored');
  const tiffinBefore = await atDestination('tailor', 'tiffin-first');
  const firstReceipt = await receipt('tiffin-first');
  check(firstReceipt.stats.tiffins === tiffinBefore.stats.tiffins + 1 && firstReceipt.money > tiffinBefore.money
    && firstReceipt.saved.econ.tiffinDone.filter(id => id === 'tailor').length === 1
    && JSON.stringify(firstReceipt.saved.activeJob?.stops) === JSON.stringify(['fruit']) && firstReceipt.player.carrying,
  'Partial Tiffin receipt persists one served customer and only the remaining fruit stop');
  const partialReload = await reloadContinue('tiffin-partial-reloaded-during-thankyou');
  check(sameReceipt(firstReceipt, partialReload) && partialReload.player.carrying
    && JSON.stringify(partialReload.econ.batch?.stops) === JSON.stringify(['fruit'])
    && partialReload.objectiveText.includes('Pammi') && partialReload.objectiveText.includes('1 left'), 'Partial Tiffin reload retains exactly one payment and resumes only Pammi');
  check(partialReload.interactionId !== 'deliver', 'Served Masterji has no repeat-delivery prompt after reload');
  await capture('tiffin-partial-restored');
  const finalBefore = await atDestination('fruit', 'tiffin-final');
  const finalReceipt = await receipt('tiffin-final');
  check(finalReceipt.stats.tiffins === finalBefore.stats.tiffins + 1 && finalReceipt.saved.activeJob === null
    && !finalReceipt.econ.batch && !finalReceipt.player.carrying
    && ['tailor', 'fruit'].every(id => finalReceipt.saved.econ.tiffinDone.filter(q => q === id).length === 1), 'Final Tiffin receipt persists both served stops once and clears carrying/job');
  const finalReload = await reloadContinue('tiffin-final-reloaded-during-thankyou');
  check(sameReceipt(finalReceipt, finalReload) && !finalReload.econ.batch && !finalReload.player.carrying, 'Final Tiffin reload cannot resurrect the batch or duplicate payment');
  await key('KeyE');
  check(sameReceipt(finalReceipt, await sample('tiffin-second-E')), 'Another real E after final Tiffin reload cannot repeat payment');

  if (compat) {
    for (const [name, active] of [['legacy-no-job', undefined], ['corrupt-optional-job', { kind: 'delivery', destId: 'tailor', elapsed: 'damaged', condition: 82 }]]) {
      const data = prepared();
      if (active === undefined) delete data.activeJob; else data.activeJob = active;
      const state = await seed(name, data);
      check(!state.job && !state.econ.batch && !state.player.carrying && state.money === data.money
        && state.rep === data.rep && state.stats.deliveries === data.stats.deliveries, `${name}: existing progress loads safely without an active job`);
    }
  } else result.compatStatus = 'NOT RUN: optional legacy/corrupt browser cases require COMPAT=1; schema tests remain a separate gate';
  const final = await sample('final');
  check(!final.errors.length && !result.log.some(s => /^\[(http|error|pageerror)/.test(s)), 'No game, HTTP, console or page errors');
  check(!result.external.length, 'No requests outside the tested deployment origin');
  result.complete = true;
} catch (error) {
  result.error = String(error.stack ?? error);
  result.failure = await read().catch(() => null);
  if (page) await page.screenshot({ path: `${out}/failure.png`, timeout: 15000 }).catch(() => {});
  process.exitCode = 1;
} finally { saveReport(); await browser?.close(); }
