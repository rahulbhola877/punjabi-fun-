// The neighbour's wife at her gate in the evening: node tools/gate.mjs [base]
import { launch, sleep } from "./pt-lib.mjs";
const base = process.argv[2] ?? "http://localhost:4173/";
const { browser, page, log } = await launch(`${base}?probe&gfx=low&hour=15`);
const ev = (f, ...a) => page.evaluate(f, ...a);
const out = new URL("./out/", import.meta.url).pathname;
try {
  await page.evaluate(() => localStorage.clear()); await page.reload();
  await page.waitForSelector("#title button", { timeout: 300000 });
  await page.keyboard.press("Enter");
  await page.waitForSelector("#title .looks button"); await page.keyboard.press("Enter");
  await page.waitForFunction(() => window.__pfs?.snapshot().state === "playing", null, { timeout: 300000 });
  await sleep(1500);
  await ev(() => window.__pfs.teleport(112, -32, 0));
  await sleep(6000);
  console.log("15:00", JSON.stringify(await ev(() => window.__pfs.resident("gate_santH170"))));
  await ev(() => window.__pfs.hour(17.8));
  await sleep(8000);
  console.log("17:48", JSON.stringify(await ev(() => window.__pfs.resident("gate_santH170"))));
  await ev(() => { window.__pfs.teleport(67, -32.8, Math.PI / 2); window.__pfs.face(Math.PI / 2); });
  await sleep(4000);
  console.log("at gate", JSON.stringify(await ev(() => window.__pfs.resident("gate_santH170"))));
  await page.screenshot({ path: out + "gate.png" });
  await ev(() => window.__pfs.hour(20.45));
  await sleep(40000);
  console.log("20:45", JSON.stringify(await ev(() => window.__pfs.resident("gate_santH170"))));
} catch (e) { console.log("ERROR", String(e).slice(0, 300)); }
console.log("errors:", JSON.stringify(log.filter((l) => !/WebGPU|wasm|ArrayBuffer/.test(l)).slice(0, 4)));
await browser.close();
