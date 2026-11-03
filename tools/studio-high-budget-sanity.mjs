import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { browserOptions } from './browser.mjs';

// Diagnostic only: leave tools/budget.mjs and its acceptance thresholds intact.
// Run once in an exclusive browser slot, under an outer 120-second timeout.
// BROWSER_PATH=/usr/bin/chromium SOFTWARE=1 SOURCE=<served SHA> OUT=<new directory>
//   timeout --kill-after=5s 120s node tools/studio-high-budget-sanity.mjs [base]
// SCREENSHOT=1 optionally captures the final view AFTER saving all counts.
const base = process.argv[2] ?? 'http://127.0.0.1:4176/';
const url = new URL(base);
url.search = '?probe&view=-12,2,-44,-2,1.5,-44';
const out = process.env.OUT ?? `artifacts/studio/high-budget-sanity-${Date.now()}`;
fs.mkdirSync(out, { recursive: true });
const jsonPath = path.join(out, 'checks.json'), framesPath = path.join(out, 'frames.jsonl');
// Refuse to overwrite an earlier run, including an interrupted diagnostic.
fs.writeFileSync(framesPath, '', { flag: 'wx' });
const sha256 = data => createHash('sha256').update(data).digest('hex');
const settings = { quality: 'high', post: true, shadows: 'low', renderScale: 1 };
const result = {
  source: process.env.SOURCE ?? '0401bd4cee3b09e3ccd0680a3745d91eacb7305d',
  sourceVerification: 'Caller-declared production source; served script hashes are recorded, not a source-map attestation.',
  scriptSha256: sha256(fs.readFileSync(fileURLToPath(import.meta.url))),
  browserHelperSha256: sha256(fs.readFileSync(new URL('./browser.mjs', import.meta.url))),
  base, url: url.href, software: process.env.SOFTWARE === '1', settings, viewport: [960, 540],
  startedAt: new Date().toISOString(), complete: false, targetFrames: 24, frames: [],
  originalFourSecondSample: null, scripts: [], log: [], external: [], progress: [],
  limits: [
    'No FPS measurement, performance-gain claim, or automatic budget acceptance.',
    'The original title-plus-four-second sample precedes draw hooks; it has no retrospective draw attribution.',
    'Active candidate inventory is full source geometry, not submitted geometry; selected LOD and pass draws are recorded separately.',
    'Existing effect readiness is observed without scene.isReady, mesh.isReady(true), material readiness calls, or forced compilation. Missing effects mean unobserved/not allocated, not a proven failure.',
    'Engine draw methods and private Babylon fields are diagnostic instrumentation; their availability and counter reconciliation are recorded. GPU execution success is not measured.',
    'Triangle attribution covers TRIANGLES (fillMode 0); other primitive modes and unknown mesh contexts remain explicit.',
    'Population, camera, settings and simulation remain live. Instrumentation and serialization add overhead; counters are not timing evidence.',
    'Only completed frames delivered to Node can be saved; an interrupted in-flight frame may be absent.',
  ],
};
let browser, page, stopping = false, resolveFrames;
const framesDone = new Promise(resolve => { resolveFrames = resolve; });
const scriptReads = [];
const save = () => {
  const temporary = `${jsonPath}.tmp`;
  fs.writeFileSync(temporary, JSON.stringify(result, null, 2));
  fs.renameSync(temporary, jsonPath);
};
const progress = message => {
  result.progress.push({ at: new Date().toISOString(), message }); save(); console.log(message);
};
async function terminate(reason) {
  if (stopping) return;
  stopping = true; result.interrupted = reason; save();
  // The outer timeout is still authoritative if the browser is unresponsive.
  setTimeout(() => process.exit(124), 2000).unref();
  try { await browser?.close(); } finally { process.exit(124); }
}
for (const signal of ['SIGTERM', 'SIGINT']) process.once(signal, () => { void terminate(signal); });
// Leave time for evidence/close before the caller's 120-second outer timeout.
const watchdog = setTimeout(() => { void terminate('115-second internal deadline'); }, 115000);

try {
  progress('Launch one High bazaar diagnostic page');
  browser = await chromium.launch(browserOptions());
  page = await browser.newPage({ viewport: { width: 960, height: 540 }, deviceScaleFactor: 1 });
  await page.addInitScript(value => localStorage.setItem('pfs.settings.v1', JSON.stringify(value)), settings);
  page.on('console', message => {
    if (['warning', 'error'].includes(message.type())) { result.log.push({ type: message.type(), text: message.text() }); save(); }
  });
  page.on('pageerror', error => { result.log.push({ type: 'pageerror', text: String(error.stack ?? error) }); save(); });
  page.on('requestfailed', request => { result.log.push({ type: 'requestfailed', url: request.url(), error: request.failure() }); save(); });
  page.on('request', request => {
    if (/^https?:/.test(request.url()) && new URL(request.url()).origin !== url.origin) {
      result.external.push(request.url()); save();
    }
  });
  page.on('response', response => {
    if (response.status() >= 400) { result.log.push({ type: 'http', status: response.status(), url: response.url() }); save(); }
    if (response.request().resourceType() !== 'script' || new URL(response.url()).origin !== url.origin) return;
    scriptReads.push(response.body().then(body => {
      result.scripts.push({ url: response.url(), sha256: sha256(body), bytes: body.length }); save();
    }, error => { result.scripts.push({ url: response.url(), hashError: String(error) }); save(); }));
  });
  await page.exposeBinding('__studioHighBudgetFrame', (_source, frame) => {
    // One durable JSON line per frame; keep the summary file small enough to
    // rewrite after every delivery, even on a slow software-rendered run.
    fs.appendFileSync(framesPath, `${JSON.stringify(frame)}\n`);
    const { inventory, calls, ...summary } = frame;
    result.frames.push({ ...summary, inventoryMeshes: inventory.length, detailedDrawRecords: calls.length });
    save();
    if (result.frames.length >= result.targetFrames) resolveFrames();
  });
  await page.exposeBinding('__studioHighBudgetFailure', (_source, errors) => {
    result.instrumentationFailure = errors; save(); resolveFrames();
  });
  await page.goto(url.href, { waitUntil: 'load', timeout: 90000 });
  await page.waitForFunction(() => window.__pfs?.snapshot()?.state === 'title', null, { timeout: 90000 });
  result.titleObservedAt = new Date().toISOString(); save();
  const waitStarted = Date.now();
  await page.waitForTimeout(4000);
  const installed = await page.evaluate(({ expected, targetFrames, wallWaitMs }) => {
    const scene = window.__pfs.scene(), engine = scene.getEngine();
    const groupName = name => (name ?? '?').replace(/[_\-:.]?\d+.*$/, '').slice(0, 28);
    const shortName = value => typeof value === 'string' ? value.slice(0, 180) : null;
    const effectState = effect => effect ? {
      name: shortName(effect.name), ready: effect.isReady(), compiledFlag: effect._isReady ?? null,
      compilationError: effect._compilationError || null,
    } : null;
    const observe = () => {
      const camera = scene.activeCamera, snap = window.__pfs.snapshot();
      const active = scene.getActiveMeshes(), inventory = [], groups = new Map();
      const readiness = { existingReady: 0, existingUnready: 0, missingCameraEffects: 0 };
      for (let i = 0; i < active.length; i++) {
        const mesh = active.data[i], group = groupName(mesh.name);
        const candidateTriangles = mesh.getTotalIndices() / 3 * (mesh.thinInstanceCount || 1);
        const bucket = groups.get(group) ?? { name: group, candidateTriangles: 0, meshes: 0 };
        bucket.candidateTriangles += candidateTriangles; bucket.meshes++; groups.set(group, bucket);
        // Reading the LOD selected by the normal frame does not recompute it.
        const lodEntry = mesh._internalAbstractMeshDataInfo?._currentLOD?.get(camera);
        const selected = lodEntry ? lodEntry[0] : mesh;
        const subMeshes = (selected?.subMeshes ?? []).map(sub => {
          const effects = [];
          for (const [pass, wrapper] of Object.entries(sub._drawWrappers ?? {})) {
            if (wrapper) effects.push({ pass: Number(pass), passName: engine._renderPassNames?.[pass] ?? null, effect: effectState(wrapper.effect) });
          }
          if (sub._mainDrawWrapperOverride) effects.push({ pass: 'override', effect: effectState(sub._mainDrawWrapperOverride.effect) });
          const material = sub.getMaterial?.();
          const materialEffect = material?._drawWrapper?.effect;
          if (materialEffect) effects.push({ pass: 'material', effect: effectState(materialEffect) });
          const main = sub._mainDrawWrapperOverride?.effect ?? sub._drawWrappers?.[camera.renderPassId]?.effect ?? materialEffect;
          if (!main) readiness.missingCameraEffects++;
          for (const entry of effects) if (entry.effect) readiness[entry.effect.ready ? 'existingReady' : 'existingUnready']++;
          return { id: sub._id, indices: sub.indexCount, material: material?.name ?? null, effects };
        });
        inventory.push({ id: mesh.uniqueId, name: mesh.name, material: mesh.material?.name ?? null,
          candidateTriangles, thinInstances: mesh.thinInstanceCount || 0,
          selectedLod: selected ? { id: selected.uniqueId, name: selected.name, indices: selected.getTotalIndices?.() ?? 0 } : null,
          lodRecorded: !!lodEntry, subMeshes });
      }
      const stored = JSON.parse(localStorage.getItem('pfs.settings.v1') ?? '{}');
      const resolution = [engine.getRenderWidth(true), engine.getRenderHeight(true)];
      const eye = camera.position.asArray(), target = camera.getTarget?.().asArray() ?? null;
      const coordinates = [-12, 2, -44, -2, 1.5, -44];
      const conditionsMatch = resolution[0] === 960 && resolution[1] === 540 &&
        Object.entries(expected).every(([key, value]) => stored[key] === value) &&
        [...eye, ...(target ?? [])].length === 6 && [...eye, ...(target ?? [])].every((value, i) => Math.abs(value - coordinates[i]) < 0.001);
      return { at: performance.now(), sceneFrame: scene.getFrameId(), state: snap.state,
        activeTriangles: scene.getActiveIndices() / 3, rawDrawCounter: engine._drawCalls.current,
        snapshotDraws: snap.drawCalls, candidateVertices: scene.getTotalVertices(), resolution,
        viewport: [innerWidth, innerHeight], devicePixelRatio, hardwareScaling: engine.getHardwareScalingLevel(),
        camera: { eye, target, fov: camera.fov, pass: camera.renderPassId }, settings: stored, conditionsMatch,
        population: { residents: snap.residents, traffic: snap.traffic, kit: snap.kit },
        pendingData: scene._pendingData?.length ?? null, readiness,
        postEffects: (camera._postProcesses ?? []).filter(Boolean).map(post => ({ name: post.name, effect: effectState(post._effectWrapper?.drawWrapper?.effect) })),
        groups: [...groups.values()].sort((a, b) => b.candidateTriangles - a.candidateTriangles), inventory };
    };

    // Save the guard-equivalent counters before installing any draw wrappers.
    const original = observe();
    original.requestedWallWaitMs = 4000; original.observedWallWaitMs = wallWaitMs;
    original.note = 'Uninstrumented last-completed normal frame after title + four-second wait; inventory/readiness inspection follows counter reads. No retrospective per-draw attribution.';
    const restores = [], wrapped = new WeakSet(), targetIds = new WeakMap(), targetLabels = new WeakMap();
    let nextTargetId = 1, context = null, calls = [], drawStart = 0, completed = 0, recording = false, stopped = false;
    const instrumentationErrors = [];
    const wrapMesh = mesh => {
      if (wrapped.has(mesh) || typeof mesh._draw !== 'function') return;
      wrapped.add(mesh);
      const originalDraw = mesh._draw, hadOwn = Object.hasOwn(mesh, '_draw');
      const wrappedDraw = function(sub, ...args) {
        const previous = context; context = { mesh: this, sub };
        try { return originalDraw.call(this, sub, ...args); } finally { context = previous; }
      };
      mesh._draw = wrappedDraw;
      restores.push(() => { if (mesh._draw === wrappedDraw) { if (hadOwn) mesh._draw = originalDraw; else delete mesh._draw; } });
    };
    for (const mesh of scene.meshes) wrapMesh(mesh);
    const added = scene.onNewMeshAddedObservable.add(wrapMesh);
    const targetInfo = () => {
      const target = engine._currentRenderTarget;
      if (!target) return { id: 'backbuffer', names: [] };
      if (!targetIds.has(target)) targetIds.set(target, nextTargetId++);
      return { id: targetIds.get(target), names: targetLabels.get(target) ?? [],
        label: shortName(target.label ?? target._label), size: [target.width, target.height] };
    };
    const wrappedMethods = [];
    for (const method of ['drawElementsType', 'drawArraysType']) {
      if (typeof engine[method] !== 'function') continue;
      wrappedMethods.push(method);
      const originalDraw = engine[method];
      const wrappedDraw = function(fillMode, start, count, instances, ...args) {
        // Snapshot attribution before the call; record only after it returns.
        const info = recording ? { method, fillMode, start, count, instances: instances || 1,
          triangles: fillMode === 0 ? count * (instances || 1) / 3 : null,
          meshId: context?.mesh.uniqueId ?? null, mesh: context?.mesh.name ?? null,
          subMesh: context?.sub?._id ?? null, material: context?.sub?.getMaterial?.()?.name ?? null,
          pass: engine.currentRenderPassId, passName: engine._renderPassNames?.[engine.currentRenderPassId] ?? null,
          target: targetInfo(), effect: shortName(engine._currentEffect?.name) } : null;
        const before = engine._drawCalls.current;
        const returned = originalDraw.call(this, fillMode, start, count, instances, ...args);
        if (info) { info.counterDelta = engine._drawCalls.current - before; calls.push(info); }
        return returned;
      };
      engine[method] = wrappedDraw;
      restores.push(() => { if (engine[method] === wrappedDraw) engine[method] = originalDraw; });
    }
    const before = scene.onBeforeRenderObservable.add(() => {
      calls = []; context = null; drawStart = engine._drawCalls.current; recording = true;
      for (const texture of scene.textures) {
        const target = texture._renderTarget;
        if (target) targetLabels.set(target, [texture.name]);
      }
    });
    let after;
    const cleanup = () => {
      if (stopped) return;
      stopped = true; recording = false;
      scene.onBeforeRenderObservable.remove(before); scene.onAfterRenderObservable.remove(after);
      scene.onNewMeshAddedObservable.remove(added);
      for (const restore of restores.reverse()) restore();
    };
    after = scene.onAfterRenderObservable.add(() => {
      recording = false;
      try {
        const frame = observe(), passes = new Map();
        for (const call of calls) {
          const key = `${call.pass}:${call.target.id}`, pass = passes.get(key) ?? {
            id: call.pass, name: call.passName, target: call.target, draws: 0, triangles: 0, nonTriangleDraws: 0, unassignedMeshDraws: 0,
          };
          pass.draws += call.counterDelta;
          if (call.triangles === null) pass.nonTriangleDraws++; else pass.triangles += call.triangles;
          if (call.meshId === null) pass.unassignedMeshDraws++;
          passes.set(key, pass);
        }
        frame.frame = ++completed; frame.drawCounterAtBeforeRender = drawStart;
        frame.drawCounterDelta = frame.rawDrawCounter - drawStart;
        frame.attributedDraws = calls.reduce((sum, call) => sum + call.counterDelta, 0);
        frame.drawCountersReconcile = frame.attributedDraws === frame.drawCounterDelta;
        frame.attributedTriangles = calls.reduce((sum, call) => sum + (call.triangles ?? 0), 0);
        frame.meshAttributedTriangles = calls.filter(call => call.meshId !== null).reduce((sum, call) => sum + (call.triangles ?? 0), 0);
        frame.passTotals = [...passes.values()]; frame.calls = calls;
        frame.instrumentationErrors = [...instrumentationErrors];
        // Do not await Node or alter the normal animation/render loop.
        window.__studioHighBudgetFrame(frame).catch(error => instrumentationErrors.push(String(error)));
        if (completed >= targetFrames) cleanup();
      } catch (error) {
        instrumentationErrors.push(String(error.stack ?? error)); cleanup();
        window.__studioHighBudgetFailure([...instrumentationErrors]).catch(() => {});
      }
    });
    window.__studioHighBudgetCleanup = cleanup;
    return { original, renderer: engine.getInfo(), engineClass: engine.getClassName(),
      instrumentation: { wrappedMethods, installedAt: performance.now(), sceneCount: engine.scenes.length,
        readiness: 'Read existing submesh/material/post effect objects only; effect.isReady polls compilation but does not allocate new material variants.' } };
  }, { expected: settings, targetFrames: result.targetFrames, wallWaitMs: Date.now() - waitStarted });
  result.originalFourSecondSample = installed.original;
  result.renderer = installed.renderer; result.engineClass = installed.engineClass;
  result.instrumentation = installed.instrumentation;
  progress('Four-second sample saved; observing 24 normal frames');
  // No polling work or manual scene.render competes with the ordinary loop.
  await framesDone;
  if (result.instrumentationFailure) throw new Error(`Frame instrumentation failed: ${JSON.stringify(result.instrumentationFailure)}`);
  result.frames.sort((a, b) => a.frame - b.frame);
  result.complete = true; result.countsSavedAt = new Date().toISOString();
  progress('All 24 frame records saved; no automatic guard verdict');
  if (process.env.SCREENSHOT === '1') {
    try { await page.screenshot({ path: path.join(out, 'high-bazaar.png'), timeout: 4000 }); result.screenshot = 'high-bazaar.png'; }
    catch (error) { result.screenshotError = String(error); }
    save();
  }
  await Promise.allSettled(scriptReads);
} catch (error) {
  result.error = String(error.stack ?? error); save();
  if (!stopping) process.exitCode = 1;
} finally {
  // Do not wait for a blocked page to execute cleanup: closing this isolated
  // browser releases every hook; successful sampling already restores them.
  save();
  try { await browser?.close(); } finally { clearTimeout(watchdog); }
}
