// The 16:00 shift change at the Focal Point: node tools/shift.mjs [base] -- count who is on the floor before and after
import { launch, snap, sleep } from "./pt-lib.mjs";
const base = process.argv[2] ?? "http://localhost:4173/";
const { browser, page, log } = await launch(`${base}?probe&gfx=low&hour=15.5`);
const ev = (f, ...a) => page.evaluate(f, ...a);
const folk = async () => JSON.stringify(await ev(() => window.__pfs.shiftFolk("facCycle_hand")));
const count = async () => { const s = await snap(page); const ids = s.people.filter((p) => p.id.startsWith("facCycle_hand")); return `${ids.length} on the floor: ${ids.map((p) => p.id.slice(-4) + "@" + p.x.toFixed(0) + "," + p.z.toFixed(0)).join(" ")}`; };
try {
  await page.evaluate(() => localStorage.clear()); await page.reload();
  await page.waitForSelector("#title button", { timeout: 300000 });
  await page.keyboard.press("Enter");
  await page.waitForSelector("#title .looks button"); await page.keyboard.press("Enter");
  await page.waitForFunction(() => window.__pfs?.snapshot().state === "playing", null, { timeout: 300000 });
  await sleep(1500);
  await ev(() => { window.__pfs.teleport(-560, -156, 0); window.__pfs.face(0); });
  await sleep(8000);
  console.log("15:30", await count());
  for (let i = 0; i < 3; i++) {
    await sleep(3000);
    const h = await ev(() => window.__pfs.hour());
    console.log(h, await count());
  }
  await ev(() => window.__pfs.hour(16.6));
  await sleep(10000);
  console.log("16:36", await count());
  await ev(() => window.__pfs.hour(17.5));
  await sleep(15000);
  console.log("17:30", await count());
  for (let i = 0; i < 6; i++) { await sleep(10000); console.log("later", await ev(() => window.__pfs.hour()), (await ev(() => window.__pfs.shiftFolk("facCycle_hand"))).map((p) => p.id.slice(-2) + (p.away ? "A" : p.trip ? p.trip[0] + p.routeI : "w") + "@" + p.x + "," + p.z).join(" ")); }
  console.log("traffic target by hour -> see tests/rhythm.test.ts");
} catch (e) { console.log("ERROR", String(e).slice(0, 300)); }
console.log("errors:", JSON.stringify(log.filter((l) => !/WebGPU|wasm|ArrayBuffer/.test(l)).slice(0, 4)));
await browser.close();
