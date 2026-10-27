// Shared pieces for the trailer: start the game in capture mode, step frames, save them.
import { chromium } from "playwright";
import fs from "node:fs";

export const W = 1280, H = 720;
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function open(base, extra = "", size = { width: W, height: H }) {
  const browser = await chromium.launch({
    executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
    args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--autoplay-policy=no-user-gesture-required"],
  });
  const ctx = await browser.newContext({ viewport: size });
  const page = await ctx.newPage();
  const log = [];
  page.on("pageerror", (e) => log.push(e.message));
  await page.route("**/*", (route) => (/^https?:\/\/(localhost|127\.0\.0\.1)/.test(route.request().url()) || route.request().url().startsWith("data:") || route.request().url().startsWith("blob:") ? route.continue() : route.abort()));
  // High quality, shadows on, no FPS counter: the look of the game on a good machine.
  await page.addInitScript(() => localStorage.setItem("pfs.settings.v1", JSON.stringify({ quality: "high", shadows: "high", post: true, renderScale: 1, showFps: false, subtitles: "bubbles" })));
  await page.goto(`${base}?probe&capture${extra}`, { waitUntil: "load", timeout: 300000 });
  await page.waitForSelector("#title button", { timeout: 600000 });
  // New game, then the default look. A busy machine can drop a key press before the menu has focus,
  // so keep pressing Enter until the game is running.
  const t0 = Date.now();
  while (!(await page.evaluate(() => window.__pfs?.snapshot().state === "playing").catch(() => false))) {
    if (Date.now() - t0 > 1200000) throw new Error("game never started");
    const focused = await page.evaluate(() => !!document.activeElement?.closest("#title .menu, #title .looks")).catch(() => false);
    if (focused) await page.keyboard.press("Enter");
    await sleep(4000);
  }
  await sleep(2000);
  // Nothing on screen but the world and the speech bubbles.
  await page.addStyleTag({ content: "#touch, .hints, .rotate-hint, .dialogue, .results, .modal-back { display: none !important; }" });
  // The HUD too, unless a shot asks for it (showHud) to look like play.
  await page.evaluate(() => { const st = document.createElement("style"); st.id = "capHideHud"; st.textContent = "#hud { display: none !important; }"; document.head.append(st); });
  const ev = (f, ...a) => page.evaluate(f, ...a);
  await ev(() => window.__pfs.captureHold(true));
  return { browser, page, ev, log };
}

/** Step `n` frames with an optional camera (null = the game's own), returning nothing. */
export async function tick(ev, n, cam, dismiss = true) {
  await ev(([n, cam, dismiss]) => {
    window.__pfs.tick(n, cam);
    if (!dismiss) return;
    // The day's book or any other dialogue: wave it away ("Theek ae") so the scene goes on.
    for (const d of document.querySelectorAll(".dialogue, .results")) {
      const bs = [...d.querySelectorAll("button")];
      (bs.find((b) => /Theek ae/.test(b.textContent)) ?? bs[bs.length - 1])?.click();
    }
  }, [n, cam === undefined ? undefined : cam, dismiss]);
}

export function framesDir(name) {
  const d = new URL(`../out/trailer/${name}/`, import.meta.url).pathname;
  fs.rmSync(d, { recursive: true, force: true });
  fs.mkdirSync(d, { recursive: true });
  return d;
}

/** Shoot one frame to file. */
export async function shoot(page, dir, i) {
  // A busy machine can miss a compositor frame: try again rather than lose the shot.
  for (let k = 0; ; k++) {
    try { await page.screenshot({ path: `${dir}${String(i).padStart(4, "0")}.jpg`, type: "jpeg", quality: 92, timeout: 120000 }); return; }
    catch (e) { if (k === 2) throw e; await sleep(2000); }
  }
}

/** Show the game's HUD from here on (gameplay-looking shots). */
export async function showHud(page) {
  await page.evaluate(() => document.getElementById("capHideHud")?.remove());
}

export const lerp = (a, b, t) => a + (b - a) * t;
export const lerp3 = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
/** Ease in and out. */
export const ease = (t) => t * t * (3 - 2 * t);
