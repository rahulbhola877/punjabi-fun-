// Start a game, teleport to AT=x,z,yaw, wait, log traffic and people, take a screenshot: node tools/at.mjs [base] (NAME=shot WAIT=ms)
import { launch, snap, waitFor, sleep } from "./pt-lib.mjs";
const base = process.argv[2] ?? "http://localhost:4173/";
const { browser, page, log } = await launch(`${base}?probe&gfx=${process.env.GFX ?? "low"}`);
const focused = (sel) => page.waitForFunction((q) => !!document.activeElement?.closest(q), sel, { timeout: 60000 });
try {
  await page.waitForSelector("#title button", { timeout: 300000 });
  await focused("#title .menu"); await page.keyboard.press("Enter");
  await page.waitForSelector("#title .looks button"); await focused("#title .looks"); await page.keyboard.press("Enter");
  await waitFor(page, (x) => x.state === "playing", 300000);
  await sleep(2000);
  await page.evaluate((a) => window.__pfs.teleport(...a.split(",").map(Number)), process.env.AT ?? "0,0,0");
  if (process.env.PRE) await page.evaluate(process.env.PRE);
  for (let i = 0; i < Number(process.env.N ?? 3); i++) {
    await sleep(Number(process.env.WAIT ?? 8000));
    const s = await snap(page);
    console.log(i, JSON.stringify({ p: s.player && [s.player.x.toFixed(1), s.player.z.toFixed(1)], fps: s.fps?.toFixed(1), draws: s.drawCalls, res: s.residents, types: s.trafficTypes, wedged: s.trafficWedged, toasts: s.toasts, errors: s.errors }));
  }
  await page.screenshot({ path: `tools/out/${process.env.NAME ?? "at"}.png`, timeout: 180000 });
} catch (e) { console.log("ERROR", String(e)); }
console.log(log.filter((l) => !l.includes("WebGPU")).slice(0, 8).join("\n"));
await browser.close();
