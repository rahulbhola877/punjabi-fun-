// Routes: set one (ROUTE=placeId, default ghar), screenshot the HUD, open the map, then ride there.
// node tools/route.mjs [base]  → tools/out/route_hud.png, route_map.png
import { launch, waitFor, sleep } from "./pt-lib.mjs";
const base = process.argv[2] ?? "http://localhost:4173/";
const { browser, page, log } = await launch(`${base}?probe&gfx=low`);
const focused = (sel) => page.waitForFunction((q) => !!document.activeElement?.closest(q), sel, { timeout: 60000 });
try {
  await page.waitForSelector("#title button", { timeout: 300000 });
  await focused("#title .menu"); await page.keyboard.press("Enter");
  await page.waitForSelector("#title .looks button"); await focused("#title .looks"); await page.keyboard.press("Enter");
  await waitFor(page, (x) => x.state === "playing", 300000);
  await sleep(2000);
  console.log("set", JSON.stringify(await page.evaluate((id) => window.__pfs.routeTo(id), process.env.ROUTE ?? "ghar")));
  await sleep(2500);
  console.log("route", JSON.stringify(await page.evaluate(() => window.__pfs.route())));
  await page.screenshot({ path: "tools/out/route_hud.png", timeout: 180000 });
  await page.keyboard.press("KeyM");
  await sleep(2000);
  await page.screenshot({ path: "tools/out/route_map.png", timeout: 180000 });
  await page.keyboard.press("Escape");
} catch (e) { console.log("ERROR", String(e)); }
console.log(log.filter((l) => !l.includes("WebGPU")).slice(0, 8).join("\n"));
await browser.close();
