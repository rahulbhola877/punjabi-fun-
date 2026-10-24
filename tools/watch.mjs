// Nobody is lifted across the street in front of you: node tools/watch.mjs [base] [seconds]
// Walks the player (by teleport) around the bazaar, a colony and the road while the clock runs fast, and
// prints how many residents were moved more than a metre while within 38 m of the player (it must be 0).
import { launch, sleep } from "./pt-lib.mjs";
const base = process.argv[2]?.startsWith("http") ? process.argv[2] : "http://localhost:4173/";
const secs = Number(process.argv.find((a, i) => i > 1 && /^\d+$/.test(a)) ?? 240);
const { browser, page, log } = await launch(`${base}?probe&gfx=low&hour=8`);
const ev = (f, ...a) => page.evaluate(f, ...a);
try {
  await page.evaluate(() => localStorage.clear()); await page.reload();
  await page.waitForSelector("#title button", { timeout: 300000 });
  await page.keyboard.press("Enter");
  await page.waitForSelector("#title .looks button"); await page.keyboard.press("Enter");
  await page.waitForFunction(() => window.__pfs?.snapshot().state === "playing", null, { timeout: 300000 });
  const spots = [[0, -60], [0, -20], [52, -30], [60, -10], [-5, -90], [0, -140]];
  const t0 = Date.now();
  let i = 0;
  while ((Date.now() - t0) / 1000 < secs) {
    const [x, z] = spots[i++ % spots.length];
    await ev(([x, z]) => window.__pfs.teleport(x, z, 0), [x, z]);
    await sleep(15000);
    console.log(`t=${Math.round((Date.now() - t0) / 1000)}s at ${x},${z}`, JSON.stringify(await ev(() => window.__pfs.crowd())));
  }
} catch (e) { console.log("ERROR", String(e).slice(0, 300)); }
console.log("errors:", JSON.stringify(log.filter((l) => !/WebGPU|wasm|ArrayBuffer/.test(l)).slice(0, 4)));
await browser.close();
