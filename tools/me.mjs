// Look at the player character: idle from the front, walking, running, a greeting. node tools/me.mjs [base]  (LOOK=0|1 picks the hero, AT=x,z,yaw)
import { launch, snap, waitFor, sleep } from "./pt-lib.mjs";
const base = process.argv[2] ?? "http://localhost:4173/";
const { browser, page, log } = await launch(`${base}?probe&gfx=${process.env.GFX ?? "low"}${process.env.EXTRA ?? ""}`);
const focused = (sel) => page.waitForFunction((q) => !!document.activeElement?.closest(q), sel, { timeout: 60000 });
const shot = (n) => page.screenshot({ path: `tools/out/me_${process.env.LOOK ?? 0}_${n}.png`, timeout: 180000 });
try {
  await page.waitForSelector("#title button", { timeout: 300000 });
  await focused("#title .menu"); await page.keyboard.press("Enter");
  await page.waitForSelector("#title .looks button"); await focused("#title .looks");
  await page.click(`#title .looks button:nth-child(${Number(process.env.LOOK ?? 0) + 1})`);
  await waitFor(page, (x) => x.state === "playing", 300000);
  await sleep(1500);
  await page.evaluate((a) => window.__pfs.teleport(...a.split(",").map(Number)), process.env.AT ?? "0,-110,0");
  await sleep(1500);
  // Swing the camera round to the front.
  await page.evaluate(() => window.__pfs.camYaw(Math.PI));
  await sleep(1500); await shot("front");
  await page.keyboard.press("e"); await sleep(600); await shot("e");
  await page.evaluate(() => window.__pfs.camYaw(Math.PI));
  await page.keyboard.down("w"); await sleep(1600); await shot("walk"); await page.keyboard.up("w");
  await page.keyboard.down("Shift"); await page.keyboard.down("w"); await sleep(1800); await shot("run"); await page.keyboard.up("w"); await page.keyboard.up("Shift");
  await sleep(800);
  await page.keyboard.press("q"); await sleep(250); await shot("punch");
  const s = await snap(page);
  console.log(JSON.stringify({ fps: s.fps?.toFixed(1), draws: s.drawCalls, errors: s.errors }));
} catch (e) { console.log("ERROR", String(e)); }
console.log(log.filter((l) => !l.includes("WebGPU")).slice(0, 8).join("\n"));
await browser.close();
