// Photograph every vehicle model: node tools/fleet.mjs [base]  -> tools/out/fleet-*.png (side-front views along the G.T. Road)
import { launch, sleep } from "./pt-lib.mjs";
const base = process.argv[2] ?? "http://localhost:4173/";
const { browser, page, log } = await launch(`${base}?probe&hour=10`);
await page.addInitScript((s) => localStorage.setItem("pfs.settings.v1", s), JSON.stringify({ quality: "high", post: true, shadows: "low", renderScale: 1 }));
await page.reload();
const ev = (f, ...a) => page.evaluate(f, ...a);
const out = new URL("./out/", import.meta.url).pathname;
try {
  const focused = (sel) => page.waitForFunction((q) => !!document.activeElement?.closest(q), sel, { timeout: 60000 });
  await page.waitForSelector("#title button", { timeout: 300000 });
  await focused("#title .menu"); await page.keyboard.press("Enter");
  await page.waitForSelector("#title .looks button"); await focused("#title .looks"); await page.keyboard.press("Enter");
  await page.waitForFunction(() => window.__pfs?.snapshot().state === "playing", null, { timeout: 300000 });
  await sleep(1500);
  await ev(() => window.__pfs.teleport(-190, -157, Math.PI / 2));
  await sleep(2500);
  await ev(() => window.__pfs.parkAll(-170, -158));
  await sleep(2500);
  const n = await ev(() => window.__pfs.snapshot().vehicles.filter((v) => v.id.startsWith("show_")).map((v) => [v.id, Math.round(v.x)]));
  console.log(JSON.stringify(n));
  for (const [id, x] of n) {
    await ev(([x]) => { window.__pfs.teleport(x - 6, -150, 0.7); window.__pfs.face(0.7); }, [x]);
    await sleep(2500);
    await page.screenshot({ path: out + `fleet-${id.replace("show_", "")}.png` });
  }
  console.log("errors", JSON.stringify(await ev(() => window.__pfs.snapshot().errors)));
} catch (e) { console.log("ERROR", String(e).slice(0, 300)); }
await browser.close();
