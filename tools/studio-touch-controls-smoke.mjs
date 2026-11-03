import fs from 'node:fs';
import { chromium } from 'playwright';
import { browserOptions } from './browser.mjs';

// Actual touch events against the real DistrictControls class and stylesheet.
// This is a component fixture, not a rendered-world or physical-phone playtest.
const base = process.argv[2] ?? 'http://127.0.0.1:5176/';
const out = process.env.OUT ?? 'artifacts/studio-touch-controls';
fs.mkdirSync(out, { recursive: true });
const result = { source: process.env.SOURCE ?? 'working tree', fixture: true,
  secondaryHelper: process.env.SECONDARY_HELPER === 'off' ? 'disabled for click-only regression comparison' : 'enabled',
  note: 'Native CDP touch events against actual DistrictControls/Input/CSS. consumeMouse is observed through a pass-through wrapper; no replacement gesture logic. No 3D world, physical-device or performance claim. SECONDARY_HELPER=off only compares secondary menu clicks, not the pointer-ownership baseline.',
  expectedChecks: 14, completedViewports: [], checks: [], traces: [], errors: [], passed: false };
let activePage;
const save = () => fs.writeFileSync(`${out}/checks.json`, JSON.stringify(result, null, 2));
const browser = await chromium.launch(browserOptions());
for (const signal of ['SIGTERM', 'SIGINT']) process.once(signal, async () => {
  result.interrupted = signal; save(); await browser.close(); process.exit(124);
});
try {
  for (const viewport of [{ width: 667, height: 375 }, { width: 390, height: 844 }]) {
    const context = await browser.newContext({ viewport, isMobile: true, hasTouch: true });
    const page = activePage = await context.newPage();
    page.setDefaultTimeout(15000);
    if (process.env.SECONDARY_HELPER === 'off') await page.route('**/src/ui/secondaryTouchClick.ts', route => route.fulfill({ contentType: 'application/javascript', body: 'export function secondaryTouchClick() {}' }));
    page.on('pageerror', error => result.errors.push(String(error)));
    await page.route('**/studio-controls-fixture', route => route.fulfill({ contentType: 'text/html', body: `
      <!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1">
      <style>body{margin:0}#fixture{position:fixed;inset:0;background:#233a39}#game{position:fixed;inset:0}</style>
      <script type="module">
      import '/src/ui/styles.css';
      import { DistrictControls } from '/src/alternate/DistrictControls.ts';
      const root=document.querySelector('#fixture');
      const controls=new DistrictControls(root,document.querySelector('#game'),new Set(),()=>{},()=>{});
      window.fixture={controls,frames:0,last:null,distance:0,events:[],lookTotal:{dx:0,dy:0},lookReads:[]};
      const consume=controls.input.consumeMouse.bind(controls.input);
      controls.input.consumeMouse=()=>{const value=consume(),f=window.fixture;f.lookTotal.dx+=value.dx;f.lookTotal.dy+=value.dy;if(value.dx||value.dy||value.wheel)f.lookReads.push({frame:f.frames,...value});return value};
      for(const type of ['pointerdown','pointermove','pointerup','pointercancel','gotpointercapture','lostpointercapture','click'])document.addEventListener(type,e=>window.fixture.events.push({type,id:e.pointerId,primary:e.isPrimary,pointer:e.pointerType,x:e.clientX,y:e.clientY,target:e.target.className||e.target.id,at:performance.now()}),true);
      function frame(){const f=window.fixture;f.last=controls.read(1/60);f.distance+=Math.hypot(f.last.dx,f.last.dz)/60;f.frames++;requestAnimationFrame(frame)}
      requestAnimationFrame(frame);
      </script></head><body><canvas id="game"></canvas><div id="fixture" data-japan-world data-japan-x="0" data-japan-z="0"></div></body></html>` }));
    await page.goto(new URL('studio-controls-fixture', base).href, { timeout: 60000 });
    await page.waitForFunction(() => window.fixture?.frames > 3, null, { timeout: 60000 });
    const cdp = await context.newCDPSession(page);
    const sent = [];
    const touch = async (type, touchPoints) => {
      sent.push({ type, touchPoints });
      await cdp.send('Input.dispatchTouchEvent', { type, touchPoints });
    };
    const frames = async (n = 3) => {
      const start = await page.evaluate(() => window.fixture.frames);
      await page.waitForFunction(({ start, n }) => window.fixture.frames >= start + n, { start, n });
    };
    const state = () => page.evaluate(() => {
      const f = window.fixture, input = f.controls.input;
      return { paused: f.controls.isPaused, frame: f.frames, dx: f.last.dx, dz: f.last.dz,
        stickX: input.axis('left', 'right'), stickZ: input.axis('back', 'forward'), distance: f.distance, look: { ...f.lookTotal } };
    });
    let eventStart = 0, sentStart = 0;
    const record = async (action, passed, detail = {}) => {
      const events = await page.evaluate(() => window.fixture.events);
      result.checks.push({ viewport, action, passed, ...detail, sent: sent.slice(sentStart), events: events.slice(eventStart) });
      eventStart = events.length; sentStart = sent.length; save();
    };
    const box = await page.locator('[data-district-stick]').boundingBox();
    const pause = await page.getByRole('button', { name: 'Pause journey', exact: true }).boundingBox();
    if (!box || !pause) throw Error('Visible touch controls missing');
    const center = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    const stick = { id: 1, x: box.x + box.width / 2, y: box.y + box.height / 2 - 35 };
    const second = { id: 2, x: pause.x + pause.width / 2, y: pause.y + pause.height / 2 };
    await touch('touchStart', [stick]);
    await page.waitForFunction(() => window.fixture.distance > 0.1);
    await touch('touchStart', [stick, second]);
    // CDP touchEnd lists the points being released, unlike touchMove's active
    // list. Release the secondary Pause finger while retaining the joystick.
    await touch('touchEnd', [second]);
    await frames();
    const paused = await page.evaluate(() => window.fixture.controls.isPaused);
    await page.screenshot({ path: `${out}/${viewport.width}-held-stick-pause.png` });
    await record('Pause with second finger while joystick held', paused);
    await touch('touchEnd', []);
    if (paused) {
      await page.getByRole('button', { name: 'Resume', exact: true }).tap();
      const idle = await page.evaluate(() => ({ paused: window.fixture.controls.isPaused, dx: window.fixture.last.dx, dz: window.fixture.last.dz }));
      await frames();
      const after = await page.evaluate(() => ({ paused: window.fixture.controls.isPaused, dx: window.fixture.last.dx, dz: window.fixture.last.dz }));
      await record('Touch resume releases held movement', !after.paused && after.dx === 0 && after.dz === 0, { immediate: idle, after });

      // Keep the original thumb physically down through both Pause and Resume.
      // Releasing the button contact must not be mistaken for releasing the thumb.
      const oldThumb = { id: 31, x: center.x, y: center.y - 35 };
      const pauseThumb = { ...second, id: 32 };
      await touch('touchStart', [oldThumb]); await frames();
      const beforePause = await state();
      await touch('touchStart', [oldThumb, pauseThumb]);
      await touch('touchEnd', [pauseThumb]); await frames();
      const duringPause = await state();
      if (!duringPause.paused) throw Error('Held-thumb ownership case could not open the actual pause panel');
      const resumeBox = await page.getByRole('button', { name: 'Resume', exact: true }).boundingBox();
      if (!resumeBox) throw Error('Resume touch target missing');
      const resumeThumb = { id: 33, x: resumeBox.x + resumeBox.width / 2, y: resumeBox.y + resumeBox.height / 2 };
      await touch('touchStart', [oldThumb, resumeThumb]);
      await touch('touchEnd', [resumeThumb]); await frames();
      const resumed = await state();
      const staleMove = { ...oldThumb, y: center.y - 22 };
      await touch('touchMove', [staleMove]); await frames();
      const stale = await state();
      await touch('touchEnd', [staleMove]);
      const freshThumb = { id: 34, x: center.x, y: center.y - 35 };
      await touch('touchStart', [freshThumb]); await frames();
      const fresh = await state();
      await touch('touchEnd', [freshThumb]); await frames();
      await record('Pause/resume ignores an old held thumb move until a fresh gesture', beforePause.stickZ > 0.5
        && duringPause.paused && !resumed.paused && stale.stickX === 0 && stale.stickZ === 0 && stale.dx === 0 && stale.dz === 0
        && fresh.stickZ > 0.5, { beforePause, duringPause, resumed, stale, fresh });

      const left = { id: 11, x: center.x, y: center.y - 35 };
      const right = { id: 12, x: viewport.width * 0.68, y: viewport.height * 0.44 };
      const lookTarget = await page.evaluate(p => document.elementFromPoint(p.x, p.y)?.id, right);
      if (lookTarget !== 'fixture') throw Error(`Look point must hit real overlay background, hit ${lookTarget}`);
      await touch('touchStart', [left]);
      await touch('touchStart', [left, right]);
      const firstLook = { ...right, x: right.x + 18 };
      const beforeLook = await state();
      await touch('touchMove', [left, firstLook]); await frames();
      const both = await state();
      await touch('touchEnd', [left]); await frames();
      const afterLeftRelease = await state();
      const remainingRight = { ...right, x: right.x + 43 };
      await touch('touchMove', [remainingRight]); await frames();
      const afterRightMove = await state();
      await touch('touchEnd', [remainingRight]); await frames();
      await record('Releasing primary left thumb preserves the held right-look owner', both.look.dx - beforeLook.look.dx > 10
        && afterLeftRelease.stickX === 0 && afterLeftRelease.stickZ === 0
        && afterRightMove.look.dx - afterLeftRelease.look.dx > 10,
      { beforeLook, both, afterLeftRelease, afterRightMove, consumedRightDelta: afterRightMove.look.dx - afterLeftRelease.look.dx });

      const owner = { id: 21, x: center.x, y: center.y - 35 };
      const intruder = { id: 22, x: center.x, y: center.y + 25 };
      await touch('touchStart', [owner]); await frames();
      const original = await state();
      await touch('touchStart', [owner, intruder]);
      const intruderMove = { ...intruder, y: center.y + 35 };
      await touch('touchMove', [owner, intruderMove]); await frames();
      const withIntruder = await state();
      await record('A second stick contact cannot steal or reverse the original gesture', original.stickZ > 0.5
        && Math.abs(withIntruder.stickZ - original.stickZ) < 0.00001 && withIntruder.stickX === original.stickX, { original, withIntruder });
      await touch('touchEnd', [intruderMove]); await frames();
      const afterIntruderRelease = await state();
      await record('Releasing an unrelated stick contact preserves original movement', afterIntruderRelease.stickZ > 0.5
        && Math.abs(afterIntruderRelease.stickZ - original.stickZ) < 0.00001, { original, afterIntruderRelease });
      const ownerMove = { ...owner, y: center.y - 17 };
      await touch('touchMove', [ownerMove]); await frames();
      const originalMoves = await state();
      await touch('touchEnd', [ownerMove]); await frames();
      const ownerReleased = await state();
      await record('Original stick owner remains responsive and its release clears movement', originalMoves.stickZ > 0.2
        && originalMoves.stickZ < original.stickZ - 0.1 && ownerReleased.stickX === 0 && ownerReleased.stickZ === 0,
      { originalMoves, ownerReleased });
      await page.screenshot({ path: `${out}/${viewport.width}-pointer-ownership-complete.png` });
    }
    result.traces.push({ viewport, sent, ...await page.evaluate(() => ({ events: window.fixture.events, lookReads: window.fixture.lookReads })) });
    result.completedViewports.push(viewport);
    save();
    await context.close();
  }
} catch (error) {
  result.error = String(error.stack ?? error);
  result.failure = await activePage?.evaluate(() => ({ events: window.fixture?.events, lookReads: window.fixture?.lookReads, last: window.fixture?.last })).catch(() => null);
  await activePage?.screenshot({ path: `${out}/failure.png`, timeout: 15000 }).catch(() => {});
} finally {
  await browser.close();
  result.passed = !result.error && !result.errors.length && result.completedViewports.length === 2
    && result.checks.length === result.expectedChecks && result.checks.every(check => check.passed);
  save();
  console.log(JSON.stringify({ passed: result.passed, checks: result.checks.length, expected: result.expectedChecks, error: result.error, artifact: `${out}/checks.json` }));
  if (!result.passed) process.exitCode = 1;
}
