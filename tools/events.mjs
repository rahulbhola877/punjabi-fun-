// Try each street event through the probe: teleport, trigger, wait, screenshot.
import { launch, snap, waitFor, sleep, shot } from "./pt-lib.mjs";
const base = process.argv[2] ?? "http://localhost:5173/";
const only = process.argv[3];
const { browser, page, log } = await launch(`${base}?probe&gfx=${process.env.GFX ?? "low"}`);
const focused = (sel) => page.waitForFunction((q) => !!document.activeElement?.closest(q), sel, { timeout: 60000 });
const runs = [
  // [name, x, z, yaw, event, wait ms]
  ["ev-ram", 300, -60, Math.PI / 2, "ram", 5000],
  ["ev-tip", 300, -60, Math.PI / 2, "tip", 7000],
  ["ev-crash", 300, -60, Math.PI / 2, "crash", 9000],
  ["ev-chase", 300, -60, Math.PI / 2, "chase", 6000],
  ["ev-colony", 0, -40, 0, "colony", 15000],
  ["ev-elders", -80, 320, 0, "elders", 12000],
  ["ev-naka", 0, 0, 0, "naka", 6000],
  ["ev-chowki", 0, 0, 0, "chowki", 6000],
].filter((r) => !only || r[0] === only);
try {
  await page.waitForSelector("#title button", { timeout: 300000 });
  await focused("#title .menu"); await page.keyboard.press("Enter");
  await page.waitForSelector("#title .looks button"); await focused("#title .looks"); await page.keyboard.press("Enter");
  await waitFor(page, (x) => x.state === "playing", 300000);
  await sleep(4000);
  for (const [name, x, z, yaw, ev, wait] of runs) {
    await page.evaluate(([x, z, yaw]) => window.__pfs.teleport(x, z, yaw), [x, z, yaw]);
    await sleep(3000);
    const at = await page.evaluate((e) => window.__pfs.event(e), ev);
    console.log(name, "at", JSON.stringify(at));
    await sleep(Number(process.env.LEAD ?? 2500));
    // Walk over to watch it: stand 9 m off, facing it.
    if (at && ev !== "naka" && ev !== "chowki") {
      const me = (await snap(page)).player ?? { x, z };
      const dx = at.x - me.x, dz = at.z - me.z, d = Math.hypot(dx, dz) || 1;
      await page.evaluate(([x, z, yaw]) => window.__pfs.teleport(x, z, yaw), [at.x - (dx / d) * 7 + 4, at.z - (dz / d) * 7, Math.atan2(dx, dz)]);
    }
    await sleep(wait);
    if (process.env.EXTRA) { await shot(page, name + "-a"); await sleep(Number(process.env.EXTRA)); }
    const s = await snap(page);
    const ppl = (s.people ?? []).filter((r) => /crash|colony|Sawari|cop|naka|chowki/i.test(r.id + (r.name ?? ""))).map((r) => r.id);
    console.log(name, JSON.stringify({ toasts: s.toasts, errors: s.errors, traffic: s.traffic, ppl }));
    await shot(page, name);
  }
} catch (e) { console.log("ERROR", String(e)); }
console.log("log", JSON.stringify(log.slice(0, 10)));
await browser.close();
