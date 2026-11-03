import fs from 'node:fs';
import { launch, waitFor } from './pt-lib.mjs';

// Queue only after the exact production build is frozen. Example:
// SOURCE='<commit + working-tree manifest>' SOFTWARE=1 BROWSER_PATH=/usr/bin/chromium \
//   timeout 600s node tools/studio-roof-smoke.mjs http://127.0.0.1:4173/
// No DEV __game, source-module imports, actor movement/brain writes, or spawned
// replacement flyers. Position/weather/event fixtures are recorded explicitly.
const base = process.argv[2] ?? 'http://127.0.0.1:4173/';
const source = process.env.SOURCE;
if (!source) throw Error('SOURCE is required: identify the exact production build and working-tree manifest.');
const out = process.env.OUT ?? 'artifacts/studio/roofs';
fs.mkdirSync(out, { recursive: true });
const result = {
  source, base, complete: false, status: 'RUNNING', software: process.env.SOFTWARE === '1',
  method: 'Real New Game and opening Skip; production __pfs; actual Kites.manage flyers; explicit supported player teleports and clear-noon weather fixture; fixed 30 Hz simulation with rendering at captures. No ordinary travel, FPS, or all-airborne-causes claim.',
  settings: { quality: 'high', renderer: 'webgl', renderScale: 1, shadows: 'low', post: true }, viewport: [1280, 720],
  limits: { manualSteps: 3000, wallSeconds: 600, houseAttempts: 4 }, frames: 0,
  checks: [], fixtures: [], samples: [], captures: [], attempts: [], log: [], external: [],
  coverage: {
    roofSupport: 'NOT RUN', belowRoofPlayer: 'NOT RUN', nearbyQuarrel: 'NOT RUN',
    horn: { status: 'NOT RUN', reason: 'No safe ordinary vehicle entry/horn sequence is established by this bounded roof harness; no vehicle is spawned or teleported.' },
    vehicleContact: { status: 'NOT RUN', reason: 'The selected roof is above an occupied house. This harness does not force a road vehicle through its walls or fabricate a threat.' },
  },
};
let browser, page, target, reference, shuttingDown = false;
const save = () => fs.writeFileSync(`${out}/checks.json`, JSON.stringify(result, null, 2));
const check = (ok, message) => { if (!ok) throw Error(message); result.checks.push(message); save(); console.log(message); };
const precondition = (ok, message) => { if (!ok) { const e = new Error(message); e.name = 'Precondition'; throw e; } };
async function restore() {
  await page?.evaluate(() => { window.__pfs?.tick(0, null); window.__pfs?.captureHold(false); window.__pfs?.holdCamera(null); }).catch(() => {});
}
async function interrupt(reason) {
  if (shuttingDown) return;
  shuttingDown = true; result.status = 'TIMEOUT'; result.error = reason; save();
  // A stalled page must not prevent the outer bound from terminating Node.
  const hardStop = setTimeout(() => process.exit(124), 5000);
  try { await browser?.close(); } finally { clearTimeout(hardStop); process.exit(124); }
}
const deadline = setTimeout(() => { void interrupt('595-second watchdog; forced termination by 600 seconds'); }, 595000);
for (const signal of ['SIGTERM', 'SIGINT']) process.once(signal, () => { void interrupt(signal); });

async function advance(n, phase, camera = null, render = false) {
  precondition(Number.isInteger(n) && n > 0 && result.frames + n <= 3000, '3000 manual-step ceiling reached');
  for (let left = n; left > 0;) {
    const count = Math.min(left, 15); left -= count; result.frames += count;
    await page.evaluate(({ count, camera, render }) => {
      const p = window.__pfs, scene = p.scene(), original = scene.render;
      if (!render) scene.render = () => {};
      try { p.tick(count, camera); } finally { scene.render = original; }
    }, { count, camera, render });
  }
  result.phase = phase;
  const errors = await page.evaluate(() => window.__pfs.snapshot().errors);
  check(!errors.length, `${phase}: no game-loop errors after ${result.frames} manual steps`);
}

async function read(label, support = true) {
  const row = await page.evaluate(({ id, support }) => {
    const p = window.__pfs, s = p.snapshot(), scene = p.scene(), engine = scene.getEngine();
    const actor = id ? s.people.find(r => r.id === id) ?? null : null;
    const flyer = id ? p.kites().find(r => r.id === id) ?? null : null;
    const root = id ? scene.getTransformNodeByName(`${id}_root`) : null;
    return {
      state: s.state, time: s.time, player: s.player, actor, flyer, resident: id ? p.resident(id) : null,
      actorRoot: root ? { enabled: root.isEnabled(), position: root.position.asArray(), children: root.getChildMeshes().map(m => ({ name: m.name, enabled: m.isEnabled(), isVisible: m.isVisible, visibility: m.visibility })) } : null,
      // Existing ray probe uses STATIC | PROP; record actual hit point/normal.
      roofHit: support && actor ? p.ray(actor.x, actor.y + 0.6, actor.z, actor.x, actor.y - 0.8, actor.z) : null,
      playerHit: support && s.player ? p.ray(s.player.x, s.player.y + 0.35, s.player.z, s.player.x, s.player.y - 0.8, s.player.z) : null,
      people: s.people.map(r => ({ ...r, brain: p.resident(r.id)?.brain ?? null })),
      vehicles: s.vehicles, weather: s.weather, hour: p.hour(), bubbles: s.bubbles,
      resolution: [engine.getRenderWidth(), engine.getRenderHeight()], renderer: engine.getInfo(), errors: s.errors,
    };
  }, { id: target?.id ?? null, support });
  row.label = label; row.frame = result.frames; result.samples.push(row); save(); return row;
}
function supported(row, phase, player = false) {
  check(row.state === 'playing' && !!row.actor && !!row.flyer && !!row.resident, `${phase}: same real flyer remains in the live 30 m resident snapshot`);
  check(!row.resident.brain && !row.resident.away && !row.resident.trip, `${phase}: flyer remains outside street/shift ownership`);
  check(row.actorRoot?.enabled && row.actorRoot.children.some(m => m.enabled && m.isVisible && m.visibility > 0), `${phase}: actual flyer geometry remains enabled and visible`);
  check(row.roofHit && row.roofHit.n[1] > 0.65 && Math.abs(row.actor.y - row.roofHit.p[1]) < 0.18,
    `${phase}: feet match a real upward roof support ray within 0.18 m`);
  check(Math.hypot(row.actor.x - reference.x, row.actor.z - reference.z) < 0.03 && Math.abs(row.actor.y - reference.y) < 0.03,
    `${phase}: flyer stays at its observed initial XYZ (0.03 m tolerance)`);
  check(row.resolution[0] === 1280 && row.resolution[1] === 720, `${phase}: full 1280x720 retained`);
  if (player) check(row.player.grounded && row.playerHit && row.playerHit.n[1] > 0.65 && Math.abs(row.player.y - row.playerHit.p[1]) < 0.18,
    `${phase}: ordinary player feet are grounded on actual floor/ground support`);
}
async function capture(name, camera = null) {
  await advance(1, `capture-${name}`, camera, true);
  await page.evaluate(() => window.__pfs.scene().getEngine()._gl?.finish());
  await page.screenshot({ path: `${out}/${name}.png`, timeout: 20000 });
  result.captures.push({ file: `${name}.png`, camera: camera ? 'Explicit roof-view camera fixture' : 'Ordinary gameplay camera' }); save();
}
async function teleport(label, x, z, yaw) {
  result.fixtures.push({ kind: 'Public player teleport only; actual placement is verified afterward', label, requested: { x, z, yaw } });
  await page.evaluate(({ x, z, yaw }) => { window.__pfs.teleport(x, z, yaw); window.__pfs.face(yaw); }, { x, z, yaw });
  await advance(45, label);
}

try {
  const url = new URL(base); url.searchParams.set('probe', '');
  const run = await launch(url.href, { w: 1280, h: 720, settings: result.settings, seed: 0x53144 });
  ({ browser, page } = run); result.log = run.log; result.external = page.__external;
  page.setDefaultTimeout(30000);
  await waitFor(page, s => s.state === 'title', 150000);
  check(await page.evaluate(() => !window.__game), 'Production DEV-only __game is unavailable');
  const required = ['kites', 'snapshot', 'resident', 'ray', 'openHouses', 'teleport', 'face', 'event', 'tick', 'captureHold', 'weather', 'hour'];
  const missing = await page.evaluate(names => names.filter(name => typeof window.__pfs?.[name] !== 'function'), required);
  precondition(!missing.length, `Missing existing production probes: ${missing.join(', ')}`);
  await page.getByRole('button', { name: 'New Game', exact: true }).click();
  await page.locator('#title .looks button').first().click();
  const openingSkip = page.locator('[data-cinematic-skip]');
  await openingSkip.waitFor({ state: 'visible', timeout: 60000 }); await openingSkip.click();
  await waitFor(page, s => s.state === 'playing', 60000);
  await page.evaluate(() => window.__pfs.captureHold(true));
  const houses = await page.evaluate(() => window.__pfs.openHouses());
  // Match Kites' deterministic eligibility; this only chooses an observation
  // location. The actual flyer still has to be spawned by Kites.manage.
  const hash = s => { let h = 2166136261; for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; };
  const anchors = houses.filter(h => hash(h.id) % 4 === 0)
    .sort((a, b) => Math.hypot(a.gate.x + 167, a.gate.z) - Math.hypot(b.gate.x + 167, b.gate.z)).slice(0, 4);
  precondition(anchors.length, 'No walk-in house matches actual Kites eligibility; below-roof player fixture cannot be supported.');
  for (const house of anchors) {
    result.fixtures.push({ kind: 'Weather/time acquisition fixture', house: house.id, explanation: 'Brief real rain clears prior distance-managed flyers; clear noon then allows normal Kites.manage to spawn at this observation location.' });
    await page.evaluate(() => { window.__pfs.weather(true, true); window.__pfs.hour(12); });
    await advance(46, 'clear-prior-flyers');
    const x = house.gate.x + Math.sin(house.rot) * 1.4 + Math.cos(house.rot) * 12;
    const z = house.gate.z + Math.cos(house.rot) * 1.4 - Math.sin(house.rot) * 12;
    await teleport(`acquire-${house.id}`, x, z, house.rot);
    await page.evaluate(() => window.__pfs.weather(false, true));
    await advance(90, 'normal-kite-spawn');
    const flyers = await page.evaluate(() => window.__pfs.kites());
    result.attempts.push({ house: house.id, flyers }); save();
    const live = flyers.find(k => k.id === `patang_${house.id}`) ?? flyers.find(k => houses.some(h => k.id === `patang_${h.id}`));
    if (live) { target = { ...live, house: houses.find(h => live.id === `patang_${h.id}`) }; break; }
  }
  precondition(target, 'No actual walk-in-house patang flyer acquired in four bounded attempts; no replacement actor fabricated.');
  result.target = target;
  const h = target.house, roof = target.roof;
  await teleport('street-before-roof-approach', h.gate.x + Math.sin(h.rot) * 1.4, h.gate.z + Math.cos(h.rot) * 1.4, h.rot + Math.PI);
  const before = await read('before');
  precondition(before.actor && before.flyer, 'Selected actual flyer is missing from the 30 m snapshot after street placement.');
  reference = { x: before.actor.x, y: before.actor.y, z: before.actor.z };
  check(Math.hypot(reference.x - roof[0], reference.z - roof[2]) < 0.08 && Math.abs(reference.y - roof[1]) < 0.03, 'Actual flyer starts at its Kites roof post (rounded probe coordinates)');
  supported(before, 'before', true); result.coverage.roofSupport = 'PASS';
  await capture('ordinary-ground-before');
  const roofCamera = { eye: [reference.x + Math.sin(h.rot) * 10 + Math.cos(h.rot) * 5, reference.y + 4, reference.z + Math.cos(h.rot) * 10 - Math.sin(h.rot) * 5], at: [reference.x, reference.y + 1, reference.z], fov: 0.72 };
  await capture('supported-roof-before', roofCamera);
  await teleport('below-roof-player', reference.x - 0.35, reference.z, h.rot);
  let below = await read('below-roof-start');
  precondition(Math.hypot(below.player.x - reference.x, below.player.z - reference.z) < 0.8 && reference.y - below.player.y > 2.2,
    'Public teleport did not reach supported floor directly below the flyer; below-roof acceptance NOT RUN.');
  for (let i = 0; i < 4; i++) { await advance(30, 'below-roof-player-exposure'); below = await read(`below-roof-${i + 1}`); supported(below, `below-roof-${i + 1}`, true); }
  result.coverage.belowRoofPlayer = 'PASS';
  await capture('ordinary-player-below-roof'); await capture('supported-roof-after-player', roofCamera);

  // Public event creates ordinary street participants; never hand it a flyer.
  // Walk-in plots were already reserved by the old openPlotAt guard. This is a
  // real coexistence check; the unit regression remains the causal borrowing repro.
  result.eventScope = 'Actual nearby aunty quarrel, if observed within 16 m in 3D. Walk-in roof has existing plot reservation; this does not independently reproduce the historical closed-roof borrowing path.';
  const tx = Math.cos(h.rot), tz = -Math.sin(h.rot);
  await teleport('street-event-staging', h.gate.x + Math.sin(h.rot) * 1.4 - tx * 9, h.gate.z + Math.cos(h.rot) * 1.4 - tz * 9, h.rot + Math.PI / 2);
  const prior = await read('before-public-event');
  const priorIds = prior.people.map(r => r.id);
  const at = await page.evaluate(() => window.__pfs.event('aunty'));
  result.fixtures.push({ kind: 'Existing public event trigger', event: 'aunty', returnedSpot: at, actorOwnershipForced: false });
  await advance(30, 'event-start');
  let eventRow = await read('event-start');
  const participants = eventRow.people.filter(r => /^aunty\d+$/.test(r.id) && !priorIds.includes(r.id) && r.brain);
  const distance = at ? Math.hypot(at.x - reference.x, at.z - reference.z, reference.y - (participants[0]?.y ?? 0)) : Infinity;
  result.event = { at, participants, distanceToRoofActor: Number.isFinite(distance) ? distance : null };
  if (at && participants.length >= 2 && distance < 16) {
    for (let i = 0; i < 10; i++) { await advance(30, 'nearby-real-quarrel'); eventRow = await read(`quarrel-${i + 1}`); supported(eventRow, `quarrel-${i + 1}`, true); }
    result.coverage.nearbyQuarrel = 'PASS';
    result.event.groundBrains = eventRow.people.filter(r => r.id !== target.id && r.brain).map(r => ({ id: r.id, role: r.role, y: r.y }));
    await capture('supported-roof-after-quarrel', roofCamera);
  } else result.event.notRunReason = 'Public event did not expose two new real arguing participants within the 16 m gather range; no event location or ownership was forced.';
  check(!result.external.length, 'No requests outside deployment origin');
  check(!result.log.some(line => /^\[(http|error|pageerror)/.test(line)), 'No HTTP, console, or page errors');
  result.complete = true; result.status = result.coverage.nearbyQuarrel === 'PASS' ? 'PASS' : 'PARTIAL';
  if (result.status === 'PARTIAL') process.exitCode = 2;
} catch (error) {
  result.status = error.name === 'Precondition' ? 'BLOCKED' : 'FAIL'; result.error = String(error.stack ?? error);
  if (page) {
    result.failure = await read('failure').catch(() => null);
    await page.screenshot({ path: `${out}/failure.png`, timeout: 10000 }).catch(() => {});
  }
  process.exitCode = result.status === 'BLOCKED' ? 2 : 1;
} finally {
  save(); await restore(); await browser?.close(); clearTimeout(deadline);
}
