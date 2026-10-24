// Sounds of the hours: node tools/hours-sound.mjs [base]  -- night in a colony (train), dawn in the colony (rooster)
import { launch, snap, sleep } from "./pt-lib.mjs";
const base = process.argv[2] ?? "http://localhost:4173/";
const { browser, page, log } = await launch(`${base}?probe&gfx=low`);
const ev = (f, ...a) => page.evaluate(f, ...a);
try {
  await page.evaluate(() => localStorage.clear()); await page.reload();
  await page.waitForSelector("#title button", { timeout: 300000 });
  await page.keyboard.press("Enter");
  await page.waitForSelector("#title .looks button"); await page.keyboard.press("Enter");
  await page.waitForFunction(() => window.__pfs?.snapshot().state === "playing", null, { timeout: 300000 });
  await sleep(1500);
  await ev(() => window.__pfs.teleport(52, -20, 0));
  for (const [h, label] of [[23, "night"], [5.4, "dawn"]]) {
    await ev((x) => window.__pfs.hour(x), h);
    const heard = new Set();
    for (let i = 0; i < 12; i++) { await sleep(5000); (await snap(page)).audio?.heard.forEach((x) => heard.add(x)); }
    console.log(label, [...heard].join(", "));
  }
} catch (e) { console.log("ERROR", String(e).slice(0, 300)); }
console.log("errors:", JSON.stringify(log.filter((l) => !/WebGPU|wasm|ArrayBuffer/.test(l)).slice(0, 4)));
await browser.close();
