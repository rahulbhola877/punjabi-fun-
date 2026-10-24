// Does the street thin out at night? node tools/night.mjs [base]
// Counts the street folk (walkers, kids, chatters) alive near the bazaar at several hours.
import { launch, sleep } from "./pt-lib.mjs";
const base = process.argv[2] ?? "http://localhost:4173/";
const { browser, page, log } = await launch(`${base}?probe&gfx=low&hour=15`);
const ev = (f, ...a) => page.evaluate(f, ...a);
try {
  await page.evaluate(() => localStorage.clear()); await page.reload();
  await page.waitForSelector("#title button", { timeout: 300000 });
  await page.keyboard.press("Enter");
  await page.waitForSelector("#title .looks button"); await page.keyboard.press("Enter");
  await page.waitForFunction(() => window.__pfs?.snapshot().state === "playing", null, { timeout: 300000 });
  await sleep(1500);
  await ev(() => window.__pfs.teleport(0, -60, 0));
  for (const h of [15, 19, 22.5, 23.8, 4.5, 7.5, 10]) {
    await ev((x) => window.__pfs.hour(x), h);
    await sleep(25000);
    const c = await ev(() => window.__pfs.crowd?.() ?? null);
    console.log(`hour ${h}:`, JSON.stringify(c));
  }
} catch (e) { console.log("ERROR", String(e).slice(0, 300)); }
console.log("errors:", JSON.stringify(log.filter((l) => !/WebGPU|wasm|ArrayBuffer/.test(l)).slice(0, 4)));
await browser.close();
