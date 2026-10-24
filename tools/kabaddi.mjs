// Kabaddi: node tools/kabaddi.mjs [base] -- a friendly match: one raid that touches and gets home, one that is caught
import { launch, snap, sleep } from "./pt-lib.mjs";
const base = process.argv[2] ?? "http://localhost:4173/";
const { browser, page, log } = await launch(`${base}?probe&gfx=low&hour=15`);
const ev = (f, ...a) => page.evaluate(f, ...a);
const out = new URL("./out/", import.meta.url).pathname;
const click = async (text) => { try { await page.click(`button:has-text("${text}")`, { timeout: 8000 }); return true; } catch { return false; } };
const CX = -122.5, CZ = 365;
const hud = async () => (await page.locator(".job.match").first().innerText().catch(() => "-")).replace(/\n+/g, " | ");
try {
  await page.evaluate(() => localStorage.clear()); await page.reload();
  await page.waitForSelector("#title button", { timeout: 300000 });
  await page.keyboard.press("Enter");
  await page.waitForSelector("#title .looks button"); await page.keyboard.press("Enter");
  await page.waitForFunction(() => window.__pfs?.snapshot().state === "playing", null, { timeout: 300000 });
  await sleep(1500);
  await ev(([x, z]) => window.__pfs.teleport(x, z, Math.PI / 2), [CX - 13, CZ]);
  await sleep(4000);
  console.log("prompt:", await ev(() => window.__pfs.prompt()));
  await page.keyboard.press("e");
  await sleep(1200);
  console.log("go:", await click("khedde haan"));
  await sleep(3000);
  console.log("hud0:", await hud());
  // Raid 1: cross, go to the nearest defender, touch, come home.
  await ev(([x, z]) => window.__pfs.teleport(x, z, Math.PI / 2), [CX + 1.5, CZ - 1]);
  await sleep(1500);
  console.log("hud1:", await hud());
  await ev(([x, z]) => window.__pfs.teleport(x, z, Math.PI / 2), [CX + 5.3, CZ - 1.5]);
  await sleep(300);
  for (let i = 0; i < 4; i++) { await page.keyboard.press("q"); await sleep(250); }
  console.log("hud2:", await hud());
  await ev(([x, z]) => window.__pfs.teleport(x, z, -Math.PI / 2), [CX - 2, CZ]);
  await sleep(6000);
  console.log("hud3:", await hud());
  await page.screenshot({ path: out + "kabaddi.png" });
  // Raid 2: stand among them and be caught.
  await ev(([x, z]) => window.__pfs.teleport(x, z, Math.PI / 2), [CX - 8, CZ]);
  await sleep(2500);
  await ev(([x, z]) => window.__pfs.teleport(x, z, Math.PI / 2), [CX + 5, CZ]);
  await sleep(6000);
  console.log("hud4:", await hud());
  const s = await snap(page);
  console.log("toasts:", JSON.stringify(s.toasts.slice(-4)));
  await page.screenshot({ path: out + "kabaddi2.png" });
} catch (e) { console.log("ERROR", String(e).slice(0, 400)); }
console.log("errors:", JSON.stringify(log.filter((l) => !/WebGPU|wasm|ArrayBuffer/.test(l)).slice(0, 4)));
await browser.close();
