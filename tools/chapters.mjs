// The story chapters: node tools/chapters.mjs [base] -- walk chapter 1 by setting what the game would have counted
import { launch, snap, sleep } from "./pt-lib.mjs";
const base = process.argv[2] ?? "http://localhost:4173/";
const { browser, page, log } = await launch(`${base}?probe&gfx=low&hour=11`);
const ev = (f, ...a) => page.evaluate(f, ...a);
const out = new URL("./out/", import.meta.url).pathname;
const show = async (label) => console.log(label, JSON.stringify(await ev(() => window.__pfs.chapter())));
try {
  await page.evaluate(() => localStorage.clear()); await page.reload();
  await page.waitForSelector("#title button", { timeout: 300000 });
  await page.keyboard.press("Enter");
  await page.waitForSelector("#title .looks button"); await page.keyboard.press("Enter");
  await page.waitForFunction(() => window.__pfs?.snapshot().state === "playing", null, { timeout: 300000 });
  await sleep(1500);
  await show("start");
  await ev(() => { window.__pfs.stage(999); window.__pfs.poke("home", "bless", 0); window.__pfs.poke("stat", "tiffins", 3); });
  await sleep(2500);
  await show("after bless+intro+tiffins");
  await ev(() => window.__pfs.poke("home", "meal2", 0));
  for (let i = 0; i < 20; i++) { await sleep(1000); if (await page.locator("text=Chapter 1: Pehla din").count()) break; }
  await page.screenshot({ path: out + "chapter1.png" });
  console.log("modal:", (await page.locator(".panel").first().innerText()).replace(/\n+/g, " | ").slice(0, 400));
  await page.click('button:has-text("Chalo")');
  await sleep(2000);
  await show("after ch1");
  await page.keyboard.press("Escape");
  await sleep(800);
  await page.click('button:has-text("Kahani")');
  await sleep(800);
  await page.screenshot({ path: out + "chapters-menu.png" });
} catch (e) { console.log("ERROR", String(e).slice(0, 400)); }
console.log("errors:", JSON.stringify(log.filter((l) => !/WebGPU|wasm|ArrayBuffer/.test(l)).slice(0, 4)));
await browser.close();
