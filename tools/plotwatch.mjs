// Watches traffic and people around the hero's home for a while: does anything drive
// through a house (inside an open-house plot), and does anything pop into view close by?
// node tools/plotwatch.mjs [base] (SECS=120)
import { launch, snap, waitFor, sleep } from "./pt-lib.mjs";
const base = process.argv[2] ?? "http://localhost:4173/";
const { browser, page } = await launch(`${base}?probe&gfx=low`);
const focused = (sel) => page.waitForFunction((q) => !!document.activeElement?.closest(q), sel, { timeout: 60000 });
const ev = (f, ...a) => page.evaluate(f, ...a);
try {
  await page.waitForSelector("#title button", { timeout: 300000 });
  await focused("#title .menu"); await page.keyboard.press("Enter");
  await page.waitForSelector("#title .looks button"); await focused("#title .looks"); await page.keyboard.press("Enter");
  await waitFor(page, (x) => x.state === "playing", 300000);
  const plots = (await ev(() => window.__pfs.openHouses())).slice(0, 12).map((h) => ({ id: h.id, ...h.plot }));
  const seen = new Map();
  let inside = 0, pops = 0;
  const t0 = Date.now();
  while (Date.now() - t0 < Number(process.env.SECS ?? 120) * 1000) {
    await sleep(1000);
    const s = await snap(page);
    const p = s.player;
    for (const v of s.vehicles) {
      const pl = plots.find((q) => v.x > q.x0 + 0.3 && v.x < q.x1 - 0.3 && v.z > q.z0 + 0.3 && v.z < q.z1 - 0.3);
      if (pl && !v.id.startsWith("bullet")) { inside++; console.log("IN PLOT", v.id, pl.id, v.x.toFixed(1), v.z.toFixed(1)); }
      if (!seen.has(v.id)) {
        const d = Math.hypot(v.x - p.x, v.z - p.z);
        if (seen.size && d < 35 && v.id.startsWith("traffic")) { pops++; console.log("POP", v.id, d.toFixed(0) + " m"); }
        seen.set(v.id, d);
      }
    }
  }
  console.log("vehicles seen", seen.size, "in plots", inside, "close pops", pops);
} catch (e) { console.log("ERROR", String(e)); }
await browser.close();
