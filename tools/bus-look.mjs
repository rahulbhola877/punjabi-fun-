// Bring bus_0 to the Ranggarh Mor stop and photograph it from the kerb side (passengers, conductor): node tools/bus-look.mjs [base]
import { launch, snap, waitFor, sleep } from "./pt-lib.mjs";
const base = process.argv[2] ?? "http://localhost:4173/";
const { browser, page, log } = await launch(`${base}?probe&gfx=${process.env.GFX ?? "low"}`);
const focused = (sel) => page.waitForFunction((q) => !!document.activeElement?.closest(q), sel, { timeout: 60000 });
const ev = (f, ...a) => page.evaluate(f, ...a);
try {
  await page.waitForSelector("#title button", { timeout: 300000 });
  await focused("#title .menu"); await page.keyboard.press("Enter");
  await page.waitForSelector("#title .looks button"); await focused("#title .looks"); await page.keyboard.press("Enter");
  await waitFor(page, (x) => x.state === "playing", 300000);
  await sleep(2000);
  await ev(() => window.__pfs.teleport(27, -149.5, -Math.PI / 2));
  await ev(() => { window.__pfs.teleport(23, -156.5, 0); window.__pfs.face(0); });
  await sleep(3000);
  console.log("waiting", JSON.stringify(await ev(() => window.__pfs.busWaiters())));
  await page.screenshot({ path: `tools/out/bus_wait.png`, timeout: 180000 });
  await ev(() => window.__pfs.teleport(27, -149.5, -Math.PI / 2));
  await ev(() => window.__pfs.busWarp("bus_0", 0, 150));
  let at = null;
  for (let i = 0; i < 40; i++) {
    await sleep(3000);
    at = (await ev(() => window.__pfs.buses())).find((q) => q.id === "bus_0");
    if (at.stop === "ranggarh" && at.real) { await sleep(5000); console.log("after boarding", JSON.stringify(await ev(() => window.__pfs.busWaiters()))); break; }
    at = null;
  }
  if (!at) throw new Error("bus never pulled up");
  // Kerb side (the bus's left): yaw is atan2(x, z), so left of heading h is (-cos h, sin h).
  const nx = -Math.cos(at.yaw), nz = Math.sin(at.yaw), l = 1;
  for (const [name, d, along] of [["bus_side", 9, -1], ["bus_door", 4, 3.5]]) {
    const fx = -nz / l, fz = nx / l;
    const px = at.x + (nx / l) * d + fx * along, pz = at.z + (nz / l) * d + fz * along;
    await ev((a) => { const y = Math.atan2(a[2] - a[0], a[3] - a[1]); window.__pfs.teleport(a[0], a[1], y); window.__pfs.face(y); }, [px, pz, at.x, at.z]);
    await sleep(2500);
    const s = await snap(page);
    console.log(name, "fps", s.fps?.toFixed(1), "draws", s.drawCalls, "tris", s.activeTris);
    await page.screenshot({ path: `tools/out/${name}.png`, timeout: 180000 });
  }
  console.log("errors", JSON.stringify((await snap(page)).errors));
} catch (e) { console.log("ERROR", String(e)); }
console.log(log.filter((l) => !l.includes("WebGPU")).slice(0, 8).join("\n"));
await browser.close();
