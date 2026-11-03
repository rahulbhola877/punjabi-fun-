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
  note: 'CDP touch events; actual DistrictControls/Input/CSS; no 3D world or hardware claim.', checks: [], errors: [] };
const browser = await chromium.launch(browserOptions());
try {
  for (const viewport of [{ width: 667, height: 375 }, { width: 390, height: 844 }]) {
    const context = await browser.newContext({ viewport, isMobile: true, hasTouch: true });
    const page = await context.newPage();
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
      window.fixture={controls,frames:0,last:null,distance:0,events:[]};
      for(const type of ['pointerdown','pointerup','pointercancel','click'])document.addEventListener(type,e=>window.fixture.events.push({type,id:e.pointerId,primary:e.isPrimary,pointer:e.pointerType,x:e.clientX,y:e.clientY,target:e.target.className}),true);
      function frame(){const f=window.fixture;f.last=controls.read(1/60);f.distance+=Math.hypot(f.last.dx,f.last.dz)/60;f.frames++;requestAnimationFrame(frame)}
      requestAnimationFrame(frame);
      </script></head><body><canvas id="game"></canvas><div id="fixture" data-japan-world data-japan-x="0" data-japan-z="0"></div></body></html>` }));
    await page.goto(new URL('studio-controls-fixture', base).href);
    await page.waitForFunction(() => window.fixture?.frames > 3);
    const cdp = await context.newCDPSession(page);
    const box = await page.locator('[data-district-stick]').boundingBox();
    const pause = await page.getByRole('button', { name: 'Pause journey', exact: true }).boundingBox();
    if (!box || !pause) throw Error('Visible touch controls missing');
    const stick = { id: 1, x: box.x + box.width / 2, y: box.y + box.height / 2 - 35 };
    const second = { id: 2, x: pause.x + pause.width / 2, y: pause.y + pause.height / 2 };
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [stick] });
    await page.waitForFunction(() => window.fixture.distance > 0.1);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [stick, second] });
    // CDP touchEnd lists the points being released, unlike touchMove's active
    // list. Release the secondary Pause finger while retaining the joystick.
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [second] });
    await page.waitForTimeout(120);
    const paused = await page.evaluate(() => window.fixture.controls.isPaused);
    await page.screenshot({ path: `${out}/${viewport.width}-held-stick-pause.png` });
    result.checks.push({ viewport, action: 'Pause with second finger while joystick held', passed: paused, events: await page.evaluate(() => window.fixture.events) });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    if (paused) {
      await page.getByRole('button', { name: 'Resume', exact: true }).tap();
      const idle = await page.evaluate(() => ({ paused: window.fixture.controls.isPaused, dx: window.fixture.last.dx, dz: window.fixture.last.dz }));
      await page.waitForTimeout(100);
      const after = await page.evaluate(() => ({ paused: window.fixture.controls.isPaused, dx: window.fixture.last.dx, dz: window.fixture.last.dz }));
      result.checks.push({ viewport, action: 'Touch resume releases held movement', passed: !after.paused && after.dx === 0 && after.dz === 0, immediate: idle, after });
    }
    await context.close();
  }
} catch (error) {
  result.error = String(error.stack ?? error);
} finally {
  await browser.close();
  result.passed = !result.error && !result.errors.length && result.checks.length === 4 && result.checks.every(check => check.passed);
  fs.writeFileSync(`${out}/checks.json`, JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result));
  if (!result.passed) process.exitCode = 1;
}
