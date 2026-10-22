// Pick a fight with the nearest old uncle and check the player's "gitteyan" line plays: node tools/uncle.mjs [base]
import { launch, waitFor, sleep } from "./pt-lib.mjs";
const base = process.argv[2] ?? "http://localhost:4173/";
const { browser, page, log } = await launch(`${base}?probe&voicelog&gfx=low`);
const focused = (sel) => page.waitForFunction((q) => !!document.activeElement?.closest(q), sel, { timeout: 60000 });
try {
  await page.waitForSelector("#title button", { timeout: 300000 });
  await focused("#title .menu"); await page.keyboard.press("Enter");
  await page.waitForSelector("#title .looks button"); await focused("#title .looks"); await page.keyboard.press("Enter");
  await waitFor(page, (x) => x.state === "playing", 300000);
  await sleep(1500);
  console.log("fight with", await page.evaluate(() => window.__pfs.fightNearest(true)));
  await sleep(9000);
  console.log((await page.evaluate(() => window.__pfs.voiceLog())).join("\n"));
} catch (e) { console.log("ERROR", String(e)); }
await browser.close();
