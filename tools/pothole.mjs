// Drive a fresh vehicle over potholes and log the ride: node tools/pothole.mjs [base]
// TYPE=car AT=x,z,yaw SECS=10 (default: Nehar Road eastbound over three holes)
import { launch, waitFor, sleep } from "./pt-lib.mjs";
const base = process.argv[2] ?? "http://localhost:4173/";
const { browser, page, log } = await launch(`${base}?probe&gfx=low`);
const focused = (sel) => page.waitForFunction((q) => !!document.activeElement?.closest(q), sel, { timeout: 60000 });
try {
  await page.waitForSelector("#title button", { timeout: 300000 });
  await focused("#title .menu"); await page.keyboard.press("Enter");
  await page.waitForSelector("#title .looks button"); await focused("#title .looks"); await page.keyboard.press("Enter");
  await waitFor(page, (x) => x.state === "playing", 300000);
  await sleep(1500);
  const [x, z, yaw] = (process.env.AT ?? "-425,152.3,1.5708").split(",").map(Number);
  console.log("drive", await page.evaluate((a) => window.__pfs.driveAt(...a), [process.env.TYPE ?? "car", x, z, yaw]));
  await sleep(1500);
  await page.keyboard.down("KeyW");
  const t0 = Date.now();
  while (Date.now() - t0 < Number(process.env.SECS ?? 10) * 1000) {
    const r = await page.evaluate(() => window.__pfs.ride());
    console.log(((Date.now() - t0) / 1000).toFixed(1), JSON.stringify(r));
    await sleep(150);
  }
  await page.keyboard.up("KeyW");
  await page.screenshot({ path: `tools/out/${process.env.NAME ?? "pothole"}.png` });
} catch (e) { console.log("ERROR", String(e)); }
console.log(log.filter((l) => !l.includes("WebGPU")).slice(0, 8).join("\n"));
await browser.close();
