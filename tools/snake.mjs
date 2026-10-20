// Stand on a city road and watch snake bikers come and weave (distances logged), then screenshot.
import { launch, snap, waitFor, sleep, shot } from "./pt-lib.mjs";
const base = process.argv[2] ?? "http://localhost:4173/";
const { browser, page } = await launch(`${base}?probe&gfx=low`);
const focused = (sel) => page.waitForFunction((q) => !!document.activeElement?.closest(q), sel, { timeout: 60000 });
try {
  await page.waitForSelector("#title button", { timeout: 300000 });
  await focused("#title .menu"); await page.keyboard.press("Enter");
  await page.waitForSelector("#title .looks button"); await focused("#title .looks"); await page.keyboard.press("Enter");
  await waitFor(page, (x) => x.state === "playing", 300000);
  await page.evaluate(() => window.__pfs.teleport(-160, -158, Math.PI / 2));
  await page.evaluate(() => window.__pfs.event("snake"));
  let best = 99;
  for (let i = 0; i < 14; i++) {
    await sleep(2000);
    const s = await snap(page);
    console.log(i, JSON.stringify(s.snakes));
    const m = Math.min(99, ...(s.snakes ?? []));
    if (m < best && m < 25) { best = m; await shot(page, "snake"); }
  }
} catch (e) { console.log("ERROR", String(e)); }
await browser.close();
