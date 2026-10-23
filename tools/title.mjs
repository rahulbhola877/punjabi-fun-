// Screens before play: loading, title, and the character select with each hero in focus. node tools/title.mjs [base]
import { launch, sleep } from "./pt-lib.mjs";
const base = process.argv[2] ?? "http://localhost:4173/";
const { browser, page, log } = await launch("about:blank");
// Hold the physics WASM back a few seconds so the loading screen is up long enough to see.
await page.route("**/*.wasm", async (route) => { await sleep(6000); await route.continue(); });
await page.goto(`${base}?probe&gfx=${process.env.GFX ?? "low"}`, { waitUntil: "load", timeout: 180000 });
const shot = (n) => page.screenshot({ path: `tools/out/title_${n}.png`, timeout: 180000 });
try {
  await page.waitForSelector(".loading .ld-text", { timeout: 60000 });
  await sleep(2500); await shot("loading");
  await page.waitForSelector("#title button", { timeout: 300000 });
  await sleep(1500); await shot("title");
  await page.click("#title .menu button:not(.secondary), #title .menu button");
  await page.waitForSelector("#title .looks button");
  await page.hover("#title .looks button:nth-child(1)"); await sleep(2500); await shot("pick1");
  await page.hover("#title .looks button:nth-child(2)"); await sleep(2500); await shot("pick2");
} catch (e) { console.log("ERROR", String(e)); }
console.log(log.filter((l) => !l.includes("WebGPU")).slice(0, 8).join("\n"));
await browser.close();
