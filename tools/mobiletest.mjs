// Mobile/tablet check: real touch events (CDP) on the joystick, look zone and buttons.
import { chromium } from "playwright";
import fs from "node:fs";
const base = process.argv[2] ?? "http://localhost:5173/";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const results = [];
const log = (m, d = {}) => { const e = { m, ...d }; results.push(e); console.log(JSON.stringify(e)); };

async function device(name, w, h) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  await page.goto(`${base}?probe&gfx=low`, { waitUntil: "load", timeout: 180000 });
  await page.waitForSelector("#title button", { timeout: 180000 });
  const cdp = await ctx.newCDPSession(page);
  const touch = (type, pts) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints: pts });
  const snap = () => page.evaluate(() => window.__pfs.snapshot());
  const tapEl = async (sel) => { const b = await page.locator(sel).first().boundingBox(); await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2); };
  return { name, ctx, page, touch, snap, tapEl, errors, w, h };
}

const shot = (page, n) => page.screenshot({ path: `docs/screenshots/${n}.png`, timeout: 180000 });

try {
  // ---- Phone, landscape
  const d = await device("phone-landscape", 844, 390);
  await shot(d.page, "m-01-title-phone");
  await d.tapEl("#title button");
  await d.page.waitForSelector("#title .looks button");
  await d.tapEl("#title .looks button");
  let s = await (async () => { for (;;) { const x = await d.snap(); if (x.state === "playing") return x; await sleep(250); } })();
  await sleep(800);
  const touchVisible = await d.page.evaluate(() => !document.getElementById("touch").classList.contains("hidden") && document.body.classList.contains("touch"));
  log("phone: playing, touch UI visible", { touchVisible });
  await sleep(1200);
  await shot(d.page, "m-02-hud-phone");
  // Joystick: press in the left zone and push "up" (forward) for 2.5 s.
  const p0 = s.player;
  const sx = 110, sy = d.h - 110;
  await d.touch("touchStart", [{ x: sx, y: sy, id: 1 }]);
  await d.touch("touchMove", [{ x: sx, y: sy - 60, id: 1 }]);
  await sleep(2500);
  s = await d.snap();
  await shot(d.page, "m-03-joystick-phone");
  await d.touch("touchEnd", [{ x: sx, y: sy - 60, id: 1 }]);
  log("joystick moves player", { moved: Math.hypot(s.player.x - p0.x, s.player.z - p0.z).toFixed(2), speed: s.player.speed.toFixed(2) });
  // Look drag on the right side.
  const yaw0 = (await d.snap()).camYaw;
  await d.touch("touchStart", [{ x: d.w * 0.7, y: d.h * 0.4, id: 2 }]);
  for (let i = 1; i <= 8; i++) { await d.touch("touchMove", [{ x: d.w * 0.7 + i * 15, y: d.h * 0.4, id: 2 }]); await sleep(40); }
  await d.touch("touchEnd", [{ x: d.w * 0.7 + 120, y: d.h * 0.4, id: 2 }]);
  await sleep(300);
  const yaw1 = (await d.snap()).camYaw;
  log("drag to look rotates camera", { dYaw: (yaw1 - yaw0).toFixed(2) });
  // Two thumbs at once: move + look simultaneously.
  await d.touch("touchStart", [{ x: sx, y: sy, id: 3 }, { x: d.w * 0.75, y: d.h * 0.5, id: 4 }]);
  await d.touch("touchMove", [{ x: sx + 40, y: sy - 40, id: 3 }, { x: d.w * 0.75 - 80, y: d.h * 0.5, id: 4 }]);
  await sleep(800);
  const both = await d.snap();
  await d.touch("touchEnd", []);
  log("multi-touch (move + look) works", { speed: both.player.speed.toFixed(2), camYaw: both.camYaw.toFixed(2) });
  log("after multi", { at: both.player });
  // Jump button.
  await d.tapEl(".tbtn.jump");
  let peak = 0;
  for (let i = 0; i < 12; i++) { peak = Math.max(peak, (await d.snap()).player.y); await sleep(50); }
  log("jump button", { peak: peak.toFixed(2) });
  // Pause button → pause menu; tap Resume.
  await d.tapEl(".ttop .tbtn:nth-child(1)");
  await sleep(500);
  log("pause button", { state: (await d.snap()).state });
  await shot(d.page, "m-04-pause-phone");
  await d.tapEl(".modal-back button");
  await sleep(500);
  log("resume via tap", { state: (await d.snap()).state });
  // Map button.
  await d.tapEl(".minimap");
  await sleep(600);
  await shot(d.page, "m-05-map-phone");
  await d.tapEl(".modal-back .btn.close");
  await sleep(400);
  log("under joystick after map", { el: await d.page.evaluate(([x, y]) => { const e = document.elementFromPoint(x, y); return `${e?.tagName}.${e?.className} #${e?.id}`; }, [sx, sy]), state: (await d.snap()).state, modal: (await d.snap()).modalOpen });
  // Walk to Bhola using the joystick (closed loop) and tap the prompt.
  const target = [{ x: -5.4, z: -40.5 }, { x: -7.9, z: -39.7 }];
  for (const t of target) {
    for (let k = 0; k < 400; k++) {
      const x = await d.snap();
      const dx = t.x - x.player.x, dz = t.z - x.player.z;
      if (Math.hypot(dx, dz) < 0.6) break;
      const a = Math.atan2(dx, dz) - x.camYaw;
      if (k === 0) await d.touch("touchStart", [{ x: sx, y: sy, id: 5 }]);
      await d.touch("touchMove", [{ x: sx + Math.sin(a) * 55, y: sy - Math.cos(a) * 55, id: 5 }]);
      await sleep(80);
    }
    await d.touch("touchEnd", []);
    const x = await d.snap();
    log("waypoint", { t, at: { x: x.player.x.toFixed(2), z: x.player.z.toFixed(2) }, camYaw: x.camYaw.toFixed(2) });
  }
  s = await d.snap();
  log("reached Bhola", { prompt: s.prompt });
  const btnLabel = await d.page.locator(".tbtn.interact").innerText();
  await d.tapEl(".tbtn.interact");
  await sleep(800);
  s = await d.snap();
  log("interact button opens dialogue", { dialogueOpen: s.dialogueOpen, btnLabel });
  await shot(d.page, "m-06-dialogue-phone");
  for (let i = 0; i < 3; i++) { await d.tapEl(".dialogue .btn"); await sleep(500); }
  s = await d.snap();
  log("dialogue advanced by tapping", { stage: s.introStage });
  // Walk to the auto-rickshaw with the stick and drive it with the pedals.
  const auto = s.vehicles.find((v) => v.id === "auto_1");
  log("auto before", { auto });
  for (const t0 of [{ x: -5.4, z: -42 }, null]) {
    for (let k = 0; k < 400; k++) {
      const x = await d.snap();
      const av = x.vehicles.find((v) => v.id === "auto_1");
      const t = t0 ?? { x: av.x + 1.5, z: av.z + 0.3 };
      const dx = t.x - x.player.x, dz = t.z - x.player.z;
      if (Math.hypot(dx, dz) < 0.6) break;
      const a = Math.atan2(dx, dz) - x.camYaw;
      if (k === 0) await d.touch("touchStart", [{ x: sx, y: sy, id: 6 }]);
      await d.touch("touchMove", [{ x: sx + Math.sin(a) * 55, y: sy - Math.cos(a) * 55, id: 6 }]);
      await sleep(80);
    }
    await d.touch("touchEnd", []);
  }
  s = await d.snap();
  log("auto after", { auto: s.vehicles.find((v) => v.id === "auto_1"), at: s.player });
  log("at auto", { prompt: s.prompt, label: await d.page.locator(".tbtn.interact").innerText() });
  for (let i = 0; i < 4; i++) {
    const lbl = await d.page.locator(".tbtn.interact").innerText();
    await d.tapEl(".tbtn.interact");
    await sleep(900);
    s = await d.snap();
    log("tap interact", { lbl, vehicle: s.vehicle?.type ?? null, prompt: s.prompt, counters: s.counters, at: s.player, state: s.state });
    if (s.vehicle) break;
  }
  const pedals = await d.page.locator(".tbtn.gas").isVisible();
  log("in auto, pedals visible", { vehicle: s.vehicle?.type, pedals });
  const gas = await d.page.locator(".tbtn.gas").boundingBox();
  const brake = await d.page.locator(".tbtn.brake").boundingBox();
  await d.touch("touchStart", [{ x: gas.x + gas.width / 2, y: gas.y + gas.height / 2, id: 7 }]);
  await sleep(2500);
  // Steer right with the stick while holding gas (multi-touch).
  await d.touch("touchStart", [{ x: gas.x + gas.width / 2, y: gas.y + gas.height / 2, id: 7 }, { x: sx, y: sy, id: 8 }]);
  await d.touch("touchMove", [{ x: gas.x + gas.width / 2, y: gas.y + gas.height / 2, id: 7 }, { x: sx + 50, y: sy, id: 8 }]);
  const yawA = (await d.snap()).vehicle.yaw;
  await sleep(1200);
  s = await d.snap();
  await shot(d.page, "m-10-driving-pedals");
  await d.touch("touchEnd", []);
  log("gas + steer", { speed: s.vehicle.speed.toFixed(2), dYaw: (s.vehicle.yaw - yawA).toFixed(2) });
  await d.touch("touchStart", [{ x: brake.x + brake.width / 2, y: brake.y + brake.height / 2, id: 9 }]);
  let minV = 99;
  for (let i = 0; i < 50; i++) { minV = Math.min(minV, (await d.snap()).vehicle.speed); await sleep(100); }
  await d.touch("touchEnd", []);
  log("brake pedal → stop → reverse", { minSpeed: minV.toFixed(2) });
  log("phone errors", { errors: d.errors });
  await d.ctx.close();

  // ---- Phone, portrait (layout only)
  const p = await device("phone-portrait", 390, 844);
  await shot(p.page, "m-07-title-portrait");
  await p.tapEl("#title button");
  await p.page.waitForSelector("#title .looks button");
  await p.tapEl("#title .looks button");
  for (;;) { const x = await p.snap(); if (x.state === "playing") break; await sleep(250); }
  await sleep(1500);
  await shot(p.page, "m-08-hud-portrait");
  log("portrait errors", { errors: p.errors });
  await p.ctx.close();

  // ---- Tablet, landscape
  const t = await device("tablet", 1180, 820);
  await t.tapEl("#title button");
  await t.page.waitForSelector("#title .looks button");
  await t.tapEl("#title .looks button");
  for (;;) { const x = await t.snap(); if (x.state === "playing") break; await sleep(250); }
  await sleep(1500);
  await shot(t.page, "m-09-hud-tablet");
  log("tablet errors", { errors: t.errors });
  await t.ctx.close();
} catch (e) {
  log("ERROR", { e: String(e) });
} finally {
  fs.writeFileSync("tools/out/mobile-report.json", JSON.stringify(results, null, 2));
  await browser.close();
}
