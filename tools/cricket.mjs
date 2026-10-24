// Gali cricket: node tools/cricket.mjs [base] -- bat one over, swinging at the right moment
import { launch, snap, sleep } from "./pt-lib.mjs";
const base = process.argv[2] ?? "http://localhost:4173/";
const { browser, page, log } = await launch(`${base}?probe&gfx=low&hour=11`);
const ev = (f, ...a) => page.evaluate(f, ...a);
const out = new URL("./out/", import.meta.url).pathname;
const click = async (text) => { try { await page.click(`button:has-text("${text}")`, { timeout: 8000 }); return true; } catch { return false; } };
try {
  await page.evaluate(() => localStorage.clear()); await page.reload();
  await page.waitForSelector("#title button", { timeout: 300000 });
  await page.keyboard.press("Enter");
  await page.waitForSelector("#title .looks button"); await page.keyboard.press("Enter");
  await page.waitForFunction(() => window.__pfs?.snapshot().state === "playing", null, { timeout: 300000 });
  await sleep(1500);
  await ev(() => window.__pfs.teleport(133, -19, Math.PI / 2));
  await sleep(5000);
  console.log("prompt:", await ev(() => window.__pfs.prompt()));
  await page.keyboard.press("e");
  await sleep(1200);
  console.log("go:", await click("khedde haan"));
  await sleep(2500);
  let shots = 0;
  for (let i = 0; i < 400 && shots < 8; i++) {
    const c = await ev(() => window.__pfs.cricket());
    if (!c.active) break;
    if (c.phase === "flight" && c.t >= c.flight - 0.015 + (shots % 3 === 2 ? 0.25 : 0)) { await page.keyboard.press("q"); shots++; console.log("swing", JSON.stringify(c)); await sleep(2500); }
    await sleep(40);
    if (i === 60) await page.screenshot({ path: out + "cricket.png" });
  }
  await sleep(4000);
  const s = await snap(page);
  console.log("end:", JSON.stringify(await ev(() => window.__pfs.cricket())), JSON.stringify(s.toasts.slice(-3)));
  console.log("modal:", (await page.locator(".panel").first().innerText().catch(() => "-")).replace(/\n+/g, " | ").slice(0, 300));
  await page.screenshot({ path: out + "cricket2.png" });
} catch (e) { console.log("ERROR", String(e).slice(0, 400)); }
console.log("errors:", JSON.stringify(log.filter((l) => !/WebGPU|wasm|ArrayBuffer/.test(l)).slice(0, 4)));
await browser.close();
