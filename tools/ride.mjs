// Walk up to a vehicle at AT=x,z,yaw, press E to get on, hold W: node tools/ride.mjs [base]
import { launch, snap, waitFor, sleep } from "./pt-lib.mjs";
const base = process.argv[2] ?? "http://localhost:4173/";
const { browser, page, log } = await launch(`${base}?probe&gfx=low`);
const focused = (sel) => page.waitForFunction((q) => !!document.activeElement?.closest(q), sel, { timeout: 60000 });
try {
  await page.waitForSelector("#title button", { timeout: 300000 });
  await focused("#title .menu"); await page.keyboard.press("Enter");
  await page.waitForSelector("#title .looks button"); await page.click(`#title .looks button:nth-child(${Number(process.env.LOOK ?? 0) + 1})`);
  await waitFor(page, (x) => x.state === "playing", 300000);
  await sleep(2000);
  await page.evaluate((a) => window.__pfs.teleport(...a.split(",").map(Number)), process.env.AT);
  await sleep(2500);
  await page.keyboard.press("KeyE");
  await sleep(1500);
  await page.keyboard.down("KeyW");
  for (let i = 0; i < 4; i++) { await sleep(2500); const s = await snap(page); console.log(i, JSON.stringify({ player: s.player, type: s.drivingType, speed: s.drivingSpeed, prompt: s.prompt, fps: s.fps?.toFixed(1), errors: s.errors })); }
  await page.screenshot({ path: `tools/out/${process.env.NAME ?? "ride"}.png` });
  // Stop and look from the side to check the rider's pose on the seat.
  await page.keyboard.up("KeyW"); await page.keyboard.down("KeyS"); await sleep(2500); await page.keyboard.up("KeyS");
  await page.evaluate(() => window.__pfs.camYaw(Math.PI / 2)); await sleep(1500);
  await page.screenshot({ path: `tools/out/${process.env.NAME ?? "ride"}_side.png` });
  await page.keyboard.up("KeyW");
} catch (e) { console.log("ERROR", String(e)); }
console.log(log.filter((l) => !l.includes("WebGPU")).slice(0, 8).join("\n"));
await browser.close();
