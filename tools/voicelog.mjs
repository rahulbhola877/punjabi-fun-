// Walk down the Dal Bazaar with ?voicelog and print why each voice line played or stayed silent: node tools/voicelog.mjs [base]
import { launch, waitFor, sleep, hold, release } from "./pt-lib.mjs";
const base = process.argv[2] ?? "http://localhost:4173/";
const { browser, page, log } = await launch(`${base}?probe&voicelog&gfx=low`);
const focused = (sel) => page.waitForFunction((q) => !!document.activeElement?.closest(q), sel, { timeout: 60000 });
try {
  await page.waitForSelector("#title button", { timeout: 300000 });
  await focused("#title .menu"); await page.keyboard.press("Enter");
  await page.waitForSelector("#title .looks button"); await focused("#title .looks"); await page.keyboard.press("Enter");
  await waitFor(page, (x) => x.state === "playing", 300000);
  await page.evaluate(() => { window.__pfs.teleport(0, -100, 0); window.__pfs.face(0); });
  await sleep(1500);
  await hold(page, ["w"]);
  await sleep(Number(process.env.SECS ?? 40) * 1000);
  await release(page);
  console.log((await page.evaluate(() => window.__pfs.voiceLog())).join("\n"));
} catch (e) { console.log("ERROR", String(e)); }
console.log(log.filter((l) => !l.includes("WebGPU")).slice(0, 5).join("\n"));
await browser.close();
