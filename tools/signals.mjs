// Signals: node tools/signals.mjs [base]  -- watch the junction at (400, 0); cars must wait at red
import { launch, snap, sleep } from "./pt-lib.mjs";
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
  await ev(() => { window.__pfs.teleport(409, -22, 0); window.__pfs.face(0); });
  let shots = 0, ranRed = 0, samples = 0;
  const t0 = Date.now();
  while (Date.now() - t0 < 100000) {
    await sleep(1500);
    const s = await snap(page);
    const lamps = await ev(() => window.__pfs.signals());
    // Cars in the northbound approach (x 395..400, z -35..-10) that are moving fast while class-0 is red for ns: report
    const cars = s.vehicles.filter((v) => v.x > 393 && v.x < 403 && v.z > -40 && v.z < -9);
    samples++;
    console.log(`t=${Math.round((Date.now() - t0) / 1000)} lamps ${lamps} cars-in-approach ${cars.map((c) => `${c.id}@z${c.z.toFixed(0)}`).join(' ')}`);
    if (shots < 3 && /red|green|amber/.test(lamps) && (!shots || lamps !== globalThis.last)) { await page.screenshot({ path: out + `signals-${shots}.png` }); shots++; globalThis.last = lamps; }
  }
} catch (e) { console.log("ERROR", String(e).slice(0, 300)); }
console.log("errors:", JSON.stringify(log.filter((l) => !/WebGPU|wasm|ArrayBuffer/.test(l)).slice(0, 4)));
await browser.close();
