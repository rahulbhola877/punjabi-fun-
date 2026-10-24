// Bijli gayi: node tools/powercut.mjs [base]  -- shots of the bazaar at night with power, in a cut, and after
import { launch, snap, sleep } from "./pt-lib.mjs";
const base = process.argv[2] ?? "http://localhost:4173/";
const { browser, page, log } = await launch(`${base}?probe&gfx=low&hour=21`);
const ev = (f, ...a) => page.evaluate(f, ...a);
const out = new URL("./out/", import.meta.url).pathname;
try {
  await page.evaluate(() => localStorage.clear()); await page.reload();
  await page.waitForSelector("#title button", { timeout: 300000 });
  await page.keyboard.press("Enter");
  await page.waitForSelector("#title .looks button"); await page.keyboard.press("Enter");
  await page.waitForFunction(() => window.__pfs?.snapshot().state === "playing", null, { timeout: 300000 });
  await sleep(1500);
  await ev(() => window.__pfs.teleport(0, -45, 0));
  await sleep(3000);
  console.log("power", JSON.stringify(await ev(() => window.__pfs.power())));
  await page.screenshot({ path: out + "power-on.png" });
  console.log("cut", JSON.stringify(await ev(() => window.__pfs.power(30))));
  await sleep(4000);
  console.log("power", JSON.stringify(await ev(() => window.__pfs.power())));
  await page.screenshot({ path: out + "power-off.png" });
  const s = await snap(page);
  console.log("heard", JSON.stringify(s.audio?.heard), "toasts", JSON.stringify(s.toasts));
} catch (e) { console.log("ERROR", String(e).slice(0, 300)); }
console.log("errors:", JSON.stringify(log.filter((l) => !/WebGPU|wasm|ArrayBuffer/.test(l)).slice(0, 4)));
await browser.close();
