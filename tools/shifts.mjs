// Shops open and close: node tools/shifts.mjs [base]
// Starts at 20:57, watches Lali uncle (shop closes at 21:00) walk out and vanish, then sets the clock to
// morning and watches him walk back in once nobody can see the way in. Prints his position over time.
import { launch, snap, sleep } from "./pt-lib.mjs";
const base = process.argv[2] ?? "http://localhost:4173/";
const { browser, page, log } = await launch(`${base}?probe&gfx=low&hour=20.95`);
const focused = (sel) => page.waitForFunction((q) => !!document.activeElement?.closest(q), sel, { timeout: 60000 });
const ev = (f, ...a) => page.evaluate(f, ...a);
const where = async (id) => { const r = await ev((i) => window.__pfs.resident(i), id); return r ? `${r.away ? "AWAY" : `(${r.pos[0]}, ${r.pos[1]})`} trip=${r.trip} path=${r.pathI}/${r.path} vel=${r.vel} wait=${r.wait} dodge=${r.dodgeT} brain=${r.brain}` : "unknown"; };
try {
  await page.evaluate(() => localStorage.clear()); await page.reload();
  await page.waitForSelector("#title button", { timeout: 300000 });
  await focused("#title .menu"); await page.keyboard.press("Enter");
  await page.waitForSelector("#title .looks button"); await focused("#title .looks"); await page.keyboard.press("Enter");
  await page.waitForFunction(() => window.__pfs?.snapshot().state === "playing", null, { timeout: 300000 });
  await sleep(1500);
  await ev(() => window.__pfs.teleport(-3, -30, 0));
  for (let i = 0; i < 9; i++) { console.log(`t=${i * 8}s clock ${await ev(() => window.__pfs.hour())}  Lali uncle`, await where("keeper_kiryana")); await sleep(8000); }
  await ev(() => window.__pfs.hour(7.0));
  await sleep(2000);
  await ev(() => window.__pfs.hour(8.6));
  for (let i = 0; i < 9; i++) { console.log(`t=${i * 8}s clock ${await ev(() => window.__pfs.hour())}  Lali uncle`, await where("keeper_kiryana")); await sleep(8000); }
} catch (e) { console.log("ERROR", String(e).slice(0, 300)); }
console.log("errors:", JSON.stringify(log.filter((l) => !/WebGPU|wasm|ArrayBuffer/.test(l)).slice(0, 4)));
await browser.close();
