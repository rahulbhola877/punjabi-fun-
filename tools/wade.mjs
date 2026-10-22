// Rain on, then walk dry vs into the Dal Bazaar flood: logs speed and wade depth. node tools/wade.mjs
import { launch, snap, waitFor, sleep } from "./pt-lib.mjs";
const { browser, page, log } = await launch(`http://localhost:4173/?probe&gfx=low`);
const focused = (sel) => page.waitForFunction((q) => !!document.activeElement?.closest(q), sel, { timeout: 60000 });
try {
  await page.waitForSelector("#title button", { timeout: 300000 });
  await focused("#title .menu"); await page.keyboard.press("Enter");
  await page.waitForSelector("#title .looks button"); await focused("#title .looks"); await page.keyboard.press("Enter");
  await waitFor(page, (x) => x.state === "playing", 300000);
  await sleep(1500);
  await page.evaluate(() => window.__pfs.weather(true));
  for (const [name, at] of [["dry", "-415,-215,3.14159"], ["wet", "-415,-232,3.14159"]]) {
    await page.evaluate((a) => window.__pfs.teleport(...a.split(",").map(Number)), at);
    await sleep(2000);
    await page.keyboard.down("KeyW");
    await sleep(2500);
    const s = await snap(page);
    console.log(name, JSON.stringify({ player: s.player, weather: s.weather, fps: s.fps?.toFixed(1), errors: s.errors }));
    await page.keyboard.up("KeyW");
  }
  await page.screenshot({ path: `tools/out/wade.png` });
} catch (e) { console.log("ERROR", String(e)); }
console.log(log.filter((l) => !l.includes("WebGPU")).slice(0, 8).join("\n"));
await browser.close();
