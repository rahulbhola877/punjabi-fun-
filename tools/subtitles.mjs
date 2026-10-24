// Subtitles and text size: node tools/subtitles.mjs [base]
import { launch, snap, sleep } from "./pt-lib.mjs";
const base = process.argv[2] ?? "http://localhost:4173/";
const { browser, page, log } = await launch(`${base}?probe&gfx=low`);
const ev = (f, ...a) => page.evaluate(f, ...a);
try {
  await page.evaluate(() => { localStorage.clear(); localStorage.setItem("pfs.settings.v1", JSON.stringify({ subtitles: "captions", textSize: 1.3, quality: "low", post: false, shadows: "off", renderScale: 0.7 })); });
  await page.reload();
  await page.waitForSelector("#title button", { timeout: 300000 });
  await page.keyboard.press("Enter");
  await page.waitForSelector("#title .looks button"); await page.keyboard.press("Enter");
  await page.waitForFunction(() => window.__pfs?.snapshot().state === "playing", null, { timeout: 300000 });
  await sleep(2500);
  await ev(() => window.__pfs.teleport(3.9, -45.6, Math.PI / 2));
  for (let i = 0; i < 8; i++) {
    await sleep(1500);
    const c = await ev(() => { const e = document.querySelector(".caption"); return e ? { text: e.textContent, on: e.classList.contains("on") } : null; });
    if (c?.on) { console.log("caption:", JSON.stringify(c)); break; }
  }
  console.log("zoom:", await ev(() => document.getElementById("ui")?.style.zoom ?? [...document.body.children].map((c) => c.id + ":" + c.style.zoom).join(",")));
  await page.screenshot({ path: new URL("./out/subtitles.png", import.meta.url).pathname });
} catch (e) { console.log("ERROR", String(e).slice(0, 300)); }
console.log("errors:", JSON.stringify(log.filter((l) => !/WebGPU|wasm|ArrayBuffer/.test(l)).slice(0, 4)));
await browser.close();
