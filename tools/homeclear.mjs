// Street events never end up inside the hero's home: node tools/homeclear.mjs [base]
// Stands in the home and forces colony fights, elder quarrels, gossip and aunty jhagdas
// again and again; every second lists anyone (not the family) inside the plot.
import { launch, snap, waitFor, sleep } from "./pt-lib.mjs";
const base = process.argv[2] ?? "http://localhost:4173/";
const { browser, page, log } = await launch(`${base}?probe&gfx=low`);
const focused = (sel) => page.waitForFunction((q) => !!document.activeElement?.closest(q), sel, { timeout: 60000 });
const ev = (f, ...a) => page.evaluate(f, ...a);
let bad = 0;
try {
  await page.waitForSelector("#title button", { timeout: 300000 });
  await focused("#title .menu"); await page.keyboard.press("Enter");
  await page.waitForSelector("#title .looks button"); await focused("#title .looks"); await page.keyboard.press("Enter");
  await waitFor(page, (x) => x.state === "playing", 300000);
  const H = await ev(() => window.__pfs.homeAt());
  const plot = H.plot;
  console.log("plot", JSON.stringify(plot));
  const spots = [H.sofaFront, H.tableSide, H.gate];
  for (let k = 0; k < 18; k++) {
    const s = spots[k % spots.length];
    await ev((a) => window.__pfs.teleport(a.x, a.z, a.yaw ?? 0), s);
    await sleep(800);
    await ev((e) => { try { window.__pfs.event(e); } catch { /* */ } }, ["colony", "elders", "gossip", "aunty"][k % 4]);
    for (let i = 0; i < 4; i++) {
      await sleep(1000);
      const s2 = await snap(page);
      const inside = s2.people.filter((p) => !p.id.startsWith("home_") && p.x > plot.x0 && p.x < plot.x1 && p.z > plot.z0 && p.z < plot.z1);
      if (i === 3) console.log(k, "event folk near:", s2.people.filter((p) => /^(colony|elderq|gossip|aunty|fam)/.test(p.id)).length);
      if (inside.length) { bad++; console.log("INSIDE", k, JSON.stringify(inside.map((p) => p.id + "@" + p.x.toFixed(1) + "," + p.z.toFixed(1)))); }
    }
  }
  const s = await snap(page);
  console.log("bad", bad, "errors", JSON.stringify(s.errors));
} catch (e) { console.log("ERROR", String(e)); }
console.log(log.filter((l) => !l.includes("WebGPU")).slice(0, 8).join("\n"));
await browser.close();
