// Do cars stop at red? node tools/redlight.mjs [base] [seconds]  -- counts frames where a traffic car crossed a junction on a red
import { launch, sleep } from "./pt-lib.mjs";
const base = process.argv.find((a) => a.startsWith("http")) ?? "http://localhost:4173/";
const secs = Number(process.argv.find((a, i) => i > 1 && /^\d+$/.test(a)) ?? 240);
const { browser, page, log } = await launch(`${base}?probe&gfx=low&hour=11`);
const ev = (f, ...a) => page.evaluate(f, ...a);
try {
  await page.evaluate(() => localStorage.clear()); await page.reload();
  await page.waitForSelector("#title button", { timeout: 300000 });
  await page.keyboard.press("Enter");
  await page.waitForSelector("#title .looks button"); await page.keyboard.press("Enter");
  await page.waitForFunction(() => window.__pfs?.snapshot().state === "playing", null, { timeout: 300000 });
  await sleep(1500);
  const spots = [[409, -60], [350, 40], [409, 20], [310, -40]];
  const t0 = Date.now();
  let i = 0;
  while ((Date.now() - t0) / 1000 < secs) {
    const [x, z] = spots[i++ % spots.length];
    await ev(([x, z]) => window.__pfs.teleport(x, z, 0), [x, z]);
    await sleep(30000);
    console.log(`t=${Math.round((Date.now() - t0) / 1000)}s`, JSON.stringify(await ev(() => window.__pfs.signalWatch())));
  }
} catch (e) { console.log("ERROR", String(e).slice(0, 300)); }
console.log("errors:", JSON.stringify(log.filter((l) => !/WebGPU|wasm|ArrayBuffer/.test(l)).slice(0, 4)));
await browser.close();
