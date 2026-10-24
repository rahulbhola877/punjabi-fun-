// The railway: node tools/rail.mjs [base]  -- stand at the Kotli road crossing; shots with the gates open, down, and the train passing
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
  await sleep(1000);
  await ev(() => { window.__pfs.teleport(-2.5, 543, 0); window.__pfs.face(0); });
  let shot = { open: false, down: false, train: false };
  const t0 = Date.now();
  while (Date.now() - t0 < 200000) {
    await sleep(1000);
    const r = await ev(() => window.__pfs.rail());
    if (Math.floor((Date.now() - t0) / 1000) % 5 === 0) console.log(JSON.stringify(r));
    if (!shot.open && !r.closed && r.open === 1) { shot.open = true; await page.screenshot({ path: out + "rail-open.png" }); }
    if (!shot.down && r.closed && r.open === 0) { shot.down = true; await page.screenshot({ path: out + "rail-down.png" }); }
    if (!shot.train && r.trainX !== null && Math.abs(r.trainX) < 40) { shot.train = true; await page.screenshot({ path: out + "rail-train.png" }); }
    if (shot.open && shot.down && shot.train) break;
  }
  console.log("shots", JSON.stringify(shot), JSON.stringify((await snap(page)).audio?.heard));
} catch (e) { console.log("ERROR", String(e).slice(0, 300)); }
console.log("errors:", JSON.stringify(log.filter((l) => !/WebGPU|wasm|ArrayBuffer/.test(l)).slice(0, 4)));
await browser.close();
