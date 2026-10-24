// The economy: node tools/economy.mjs [base] -- take Mummy ji's tiffins, deliver them, read the day's books at 21:30
import { launch, snap, sleep } from "./pt-lib.mjs";
const base = process.argv[2] ?? "http://localhost:4173/";
const { browser, page, log } = await launch(`${base}?probe&gfx=low&hour=10.5`);
const ev = (f, ...a) => page.evaluate(f, ...a);
const out = new URL("./out/", import.meta.url).pathname;
const POI = { tailor: [5.5, -34], fruit: [4.9, -51.5], cycle: [-4.9, -1.5], chemist: [-5.4, 19], workshop: [10.2, 22.5], courtyard: [-43.2, -8], laneHouse: [-29.5, -7.6] };
const click = async (text) => { try { await page.click(`button:has-text("${text}")`, { timeout: 8000 }); return true; } catch { return false; } };
try {
  await page.evaluate(() => localStorage.clear()); await page.reload();
  await page.waitForSelector("#title button", { timeout: 300000 });
  await page.keyboard.press("Enter");
  await page.waitForSelector("#title .looks button"); await page.keyboard.press("Enter");
  await page.waitForFunction(() => window.__pfs?.snapshot().state === "playing", null, { timeout: 300000 });
  await sleep(2000);
  await ev(() => { window.__pfs.stage(999); window.__pfs.hour(10.5); });
  await ev(() => window.__pfs.teleport(50.5, -30.2, 0));
  await sleep(4000);
  console.log("prompt:", await ev(() => window.__pfs.prompt()), "| tiffin:", await ev(() => window.__pfs.tiffinPrompt()));
  console.log("open orders:", JSON.stringify((await ev(() => window.__pfs.econ())).open));
  await page.keyboard.press("e");
  await sleep(1500);
  await page.screenshot({ path: out + "econ-mummy.png" });
  console.log("take:", await click("Take them"));
  await sleep(1500);
  let e = await ev(() => window.__pfs.econ());
  console.log("batch:", JSON.stringify(e.batch), "money", e.money);
  for (const id of e.batch?.stops ?? []) {
    const p = POI[id];
    if (!p) { console.log("skip far stop", id); break; }
    await ev(([x, z]) => window.__pfs.teleport(x, z, 0), p);
    await sleep(3000);
    await page.keyboard.press("e");
    await sleep(1500);
    await click("Enjoy your meal") || await click("Sorry ji");
    await sleep(800);
    e = await ev(() => window.__pfs.econ());
    console.log("delivered", id, "money", e.money, "income", JSON.stringify(e.today.inc), "rep", JSON.stringify(e.rep));
  }
  await ev(() => window.__pfs.hour(21.6));
  for (let i = 0; i < 20; i++) { await sleep(1500); if (await page.locator("text=Din di kamai").count()) break; }
  await page.screenshot({ path: out + "econ-summary.png" });
  console.log("summary:", (await page.locator(".panel").first().innerText()).replace(/\n+/g, " | ").slice(0, 600));
} catch (e) { console.log("ERROR", String(e).slice(0, 400)); }
console.log("errors:", JSON.stringify(log.filter((l) => !/WebGPU|wasm|ArrayBuffer/.test(l)).slice(0, 4)));
await browser.close();
