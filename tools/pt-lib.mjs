// Playtest helpers: drive the real game with keyboard input only.
// The page exposes a READ-ONLY snapshot (window.__pfs.snapshot) when loaded with ?probe.
import { chromium } from "playwright";
import fs from "node:fs";

export async function launch(url, { w = 960, h = 540 } = {}) {
  const browser = await chromium.launch({
    executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
    args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--autoplay-policy=no-user-gesture-required"],
  });
  const ctx = await browser.newContext({ viewport: { width: w, height: h } });
  const page = await ctx.newPage();
  const log = [];
  page.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") log.push(`[${m.type()}] ${m.text()}`); });
  page.on("pageerror", (e) => log.push(`[pageerror] ${e.message}`));
  await page.goto(url, { waitUntil: "load", timeout: 180000 });
  return { browser, ctx, page, log };
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function snap(page) {
  return page.evaluate(() => (window.__pfs ? window.__pfs.snapshot() : null));
}

export async function waitFor(page, pred, timeout = 120000, every = 250) {
  const t0 = Date.now();
  for (;;) {
    const s = await snap(page);
    if (s && pred(s)) return s;
    if (Date.now() - t0 > timeout) throw new Error("waitFor timeout; last=" + JSON.stringify(s)?.slice(0, 400));
    await sleep(every);
  }
}

export async function shot(page, name) {
  fs.mkdirSync("docs/screenshots", { recursive: true });
  await page.screenshot({ path: `docs/screenshots/${name}.png`, timeout: 180000 });
}

const held = new Set();
export async function hold(page, keys) {
  const want = new Set(keys);
  for (const k of [...held]) if (!want.has(k)) { await page.keyboard.up(k); held.delete(k); }
  for (const k of want) if (!held.has(k)) { await page.keyboard.down(k); held.add(k); }
}
export async function release(page) { await hold(page, []); }
export async function tap(page, key, ms = 120) { await page.keyboard.down(key); await sleep(ms); await page.keyboard.up(key); }

const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

/** Walk through waypoints using camera-relative WASD (8 directions). */
export async function walkTo(page, pts, { tol = 0.6, timeout = 180000, sprint = false } = {}) {
  const t0 = Date.now();
  for (const p of pts) {
    let stuck = 0, last = null;
    for (;;) {
      const s = await snap(page);
      const dx = p.x - s.player.x, dz = p.z - s.player.z;
      const d = Math.hypot(dx, dz);
      if (d < tol) break;
      if (Date.now() - t0 > timeout) { await release(page); throw new Error(`walkTo timeout at ${JSON.stringify(s.player)} → ${JSON.stringify(p)}`); }
      const rel = wrap(Math.atan2(dx, dz) - s.camYaw);
      const oct = Math.round(rel / (Math.PI / 4));
      const map = { 0: ["w"], 1: ["w", "d"], 2: ["d"], 3: ["s", "d"], 4: ["s"], "-4": ["s"], "-3": ["s", "a"], "-2": ["a"], "-1": ["w", "a"] };
      const keys = (map[oct] ?? ["w"]).map((k) => `Key${k.toUpperCase()}`);
      if (sprint && d > 4) keys.push("ShiftLeft");
      await hold(page, keys);
      if (last && Math.hypot(s.player.x - last.x, s.player.z - last.z) < 0.02) stuck++; else stuck = 0;
      if (stuck > 40) { await tap(page, "Space"); stuck = 0; }
      last = s.player;
      await sleep(80);
    }
  }
  await release(page);
}

/** Drive through waypoints with throttle/steer keys (closed loop on heading). */
export async function driveTo(page, pts, { cruise = 8, tol = 2.0, timeout = 300000, finalStop = true } = {}) {
  const t0 = Date.now();
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    const last = i === pts.length - 1;
    for (;;) {
      const s = await snap(page);
      if (!s.vehicle) throw new Error("not in a vehicle");
      const v = s.vehicle;
      const dx = p.x - v.x, dz = p.z - v.z;
      const d = Math.hypot(dx, dz);
      if (d < tol) break;
      if (Date.now() - t0 > timeout) { await release(page); throw new Error(`driveTo timeout at ${JSON.stringify(v)} → ${JSON.stringify(p)}`); }
      const err = wrap(Math.atan2(dx, dz) - v.yaw);
      const keys = [];
      if (err > 0.06) keys.push("KeyD"); else if (err < -0.06) keys.push("KeyA");
      let target = Math.abs(err) > 0.6 ? 3.5 : cruise;
      if (last && finalStop) target = Math.min(target, Math.max(1.2, d * 0.7));
      if (v.speed < target - 0.5) keys.push("KeyW");
      else if (v.speed > target + 1.2) keys.push("KeyS");
      if (v.upY < 0.5) { await release(page); await tap(page, "KeyR"); }
      await hold(page, keys);
      await sleep(70);
    }
  }
  // Brake to a stop.
  if (finalStop) {
    for (let k = 0; k < 200; k++) {
      const s = await snap(page);
      if (Math.abs(s.vehicle.speed) < 0.4) break;
      await hold(page, s.vehicle.speed > 0 ? ["KeyS"] : ["KeyW"]);
      await sleep(60);
    }
  }
  await release(page);
}

/** Advance dialogues by pressing 1 (first option) until none is open. */
export async function clearDialogues(page, choose = {}) {
  for (let i = 0; i < 40; i++) {
    const s = await snap(page);
    if (!s.dialogueOpen && !s.modalOpen) return;
    if (s.modalOpen) {
      await page.keyboard.press("Enter");
    } else {
      const txt = await page.evaluate(() => document.querySelector(".dialogue .txt")?.textContent ?? "");
      const key = Object.entries(choose).find(([k]) => txt.includes(k))?.[1] ?? "1";
      await page.keyboard.press(key);
    }
    await sleep(500);
  }
}
