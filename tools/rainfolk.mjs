// Pouring rain in the Dal Bazaar: chhatris and people hurrying (screenshot + draws): node tools/rainfolk.mjs [base]
import { launch, snap, waitFor, sleep } from "./pt-lib.mjs";
const base = process.argv[2] ?? "http://localhost:4173/";
const { browser, page, log } = await launch(`${base}?probe&rain&gfx=${process.env.GFX ?? "low"}`);
const focused = (sel) => page.waitForFunction((q) => !!document.activeElement?.closest(q), sel, { timeout: 60000 });
const ev = (f, ...a) => page.evaluate(f, ...a);
try {
  await page.waitForSelector("#title button", { timeout: 300000 });
  await focused("#title .menu"); await page.keyboard.press("Enter");
  await page.waitForSelector("#title .looks button"); await focused("#title .looks"); await page.keyboard.press("Enter");
  await waitFor(page, (x) => x.state === "playing", 300000);
  const [x, z, yaw] = (process.env.AT ?? "0,-75,0").split(",").map(Number);
  await ev((a) => { window.__pfs.teleport(a[0], a[1], a[2]); window.__pfs.face(a[2]); }, [x, z, yaw]);
  await sleep(5000);
  const s = await snap(page);
  console.log("fps", s.fps?.toFixed(1), "draws", s.drawCalls, "weather", JSON.stringify(s.weather));
  await page.screenshot({ path: `tools/out/rainfolk.png`, timeout: 180000 });
  console.log("errors", JSON.stringify(s.errors));
} catch (e) { console.log("ERROR", String(e)); }
console.log(log.filter((l) => !l.includes("WebGPU")).slice(0, 5).join("\n"));
await browser.close();
