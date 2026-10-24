// The fields through the year: node tools/seasons.mjs [base] -- a screenshot of the same field in several months
import { launch, sleep } from "./pt-lib.mjs";
const base = process.argv[2] ?? "http://localhost:4173/";
const { browser, page, log } = await launch(`${base}?probe&gfx=low&hour=11`);
const ev = (f, ...a) => page.evaluate(f, ...a);
const out = new URL("./out/", import.meta.url).pathname;
try {
  await page.evaluate(() => localStorage.clear()); await page.reload();
  await page.waitForSelector("#title button", { timeout: 300000 });
  await page.keyboard.press("Enter");
  await page.waitForSelector("#title .looks button"); await page.keyboard.press("Enter");
  await page.waitForFunction(() => window.__pfs?.snapshot().state === "playing", null, { timeout: 300000 });
  await sleep(1500);
  // Farmland east of the village road (see tools/looks.mjs for other spots).
  await ev(() => window.__pfs.teleport(-40, 542, 0));
  for (const [name, day] of [["katak", 0], ["maghar", 4], ["magh", 12], ["chet", 20], ["vaisakh", 26], ["jeth", 28], ["sawan", 36], ["assu", 44]]) {
    await ev((d) => window.__pfs.day(d), day);
    await sleep(6000);
    await page.screenshot({ path: out + `season-${name}.png` });
    console.log(name, "day", day);
  }
} catch (e) { console.log("ERROR", String(e).slice(0, 300)); }
console.log("errors:", JSON.stringify(log.filter((l) => !/WebGPU|wasm|ArrayBuffer/.test(l)).slice(0, 4)));
await browser.close();
