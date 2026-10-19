// Phase 3: robustness and UI paths, keyboard only.
import { launch, snap, waitFor, tap, sleep, release, hold } from "./pt-lib.mjs";
import fs from "node:fs";
const base = process.argv[2] ?? "http://localhost:5173/";
const T0 = Date.now();
const out = [];
const step = (name, data = {}) => { const e = { t: ((Date.now() - T0) / 1000).toFixed(1), name, ...data }; out.push(e); console.log(JSON.stringify(e)); };
const { browser, page, log } = await launch(`${base}?probe&gfx=low`);
try {
  await page.waitForSelector("#title button", { timeout: 180000 });
  await page.keyboard.press("Enter");
  await page.waitForSelector("#title .looks button");
  await page.keyboard.press("ArrowRight"); // no-op; choose second look via Tab
  await page.keyboard.press("Tab");
  await page.keyboard.press("Enter");
  let s = await waitFor(page, (x) => x.state === "playing");
  step("new game (second look)", { audio: s.audioState });

  // Jump.
  await tap(page, "Space");
  let peak = 0;
  for (let i = 0; i < 20; i++) { const x = await snap(page); peak = Math.max(peak, x.player.y); await sleep(60); }
  step("jump", { peakFeetY: peak.toFixed(2) });

  // Focus loss → auto pause; held key cleared.
  await hold(page, ["KeyW"]);
  await sleep(300);
  await page.evaluate(() => window.dispatchEvent(new Event("blur")));
  s = await waitFor(page, (x) => x.state === "paused");
  await release(page);
  step("blur auto-pauses", { state: s.state });
  await page.keyboard.press("Escape");
  s = await waitFor(page, (x) => x.state === "playing");
  const p0 = s.player;
  await sleep(1500);
  s = await snap(page);
  step("resumed, no stuck keys", { moved: Math.hypot(s.player.x - p0.x, s.player.z - p0.z).toFixed(3) });

  // F1 help.
  await page.keyboard.press("F1");
  s = await waitFor(page, (x) => x.modalOpen);
  await page.keyboard.press("Escape");
  s = await waitFor(page, (x) => !x.modalOpen && x.state === "playing");
  step("F1 controls open/close");

  // Settings via pause menu → toggle Mute with the keyboard.
  await page.keyboard.press("Escape");
  await waitFor(page, (x) => x.state === "paused");
  for (let i = 0; i < 3; i++) await page.keyboard.press("Tab"); // Resume → Save → Map → Settings
  await page.keyboard.press("Enter");
  await sleep(500);
  // Focus starts on the first slider; the Mute checkbox is the 5th control.
  for (let i = 0; i < 4; i++) await page.keyboard.press("Tab");
  await page.keyboard.press("Space");
  await sleep(300);
  const settings = await page.evaluate(() => JSON.parse(localStorage.getItem("pfs.settings.v1") ?? "{}"));
  await page.keyboard.press("Escape"); // close settings
  await sleep(300);
  await page.keyboard.press("Escape"); // resume
  await waitFor(page, (x) => x.state === "playing");
  step("settings persisted via keyboard", { muted: settings.muted });

  // Storage failure is reported, not fatal.
  await page.evaluate(() => { Storage.prototype.setItem = () => { throw new Error("QuotaExceededError (simulated)"); }; });
  await page.keyboard.press("Escape");
  await waitFor(page, (x) => x.state === "paused");
  await page.keyboard.press("Tab");
  await page.keyboard.press("Enter");
  await sleep(600);
  s = await snap(page);
  step("storage failure reported", { toasts: s.toasts, state: s.state });
  await page.keyboard.press("Escape");
  await waitFor(page, (x) => x.state === "playing");
  s = await snap(page);
  step("still playable", { state: s.state, errors: s.errors });
} catch (e) {
  step("ERROR", { message: String(e) });
} finally {
  await release(page).catch(() => {});
  fs.writeFileSync("tools/out/playtest3-report.json", JSON.stringify({ steps: out, console: log, external: page.__external }, null, 2));
  await browser.close();
}
