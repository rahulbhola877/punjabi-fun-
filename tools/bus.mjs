// Wait at Ranggarh Mor for the Ludhiana–Nawan Shehar bus, board it and ride to the Civil Hospital: node tools/bus.mjs [base]
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
  // Stand by the Ranggarh Mor shelter, looking west down the G.T. Road where the bus comes from.
  await ev(() => window.__pfs.teleport(27, -149.5, -Math.PI / 2));
  // Leg 0 is Ludhiana Adda → Ranggarh: bring bus_0 to 150 m short of the stop.
  await ev(() => window.__pfs.busWarp("bus_0", 0, 150));
  let at = null;
  for (let i = 0; i < Number(process.env.WAITS ?? 40); i++) {
    await sleep(3000);
    const b = (await ev(() => window.__pfs.buses())).find((q) => q.id === "bus_0");
    const s = await snap(page);
    console.log("wait", JSON.stringify(b), "fps", s.fps?.toFixed(1), "draws", s.drawCalls);
    if (b.stop === "ranggarh" && b.real) { at = b; break; }
  }
  if (!at) throw new Error("bus never pulled up");
  // A look at the bus at the shelter from a little way back.
  await ev(() => window.__pfs.teleport(4, -149, Math.PI / 2 + 0.25));
  await sleep(2500);
  await page.screenshot({ path: `tools/out/bus_stop.png`, timeout: 180000 });
  at = (await ev(() => window.__pfs.buses())).find((q) => q.id === "bus_0");
  // Walk to the door: just teleport next to it, then press E and pick the first stop.
  await ev((d) => window.__pfs.teleport(d[0], d[2], Math.PI / 2), at.door);
  await sleep(1500);
  const s0 = await snap(page);
  console.log("prompt", s0.prompt);
  await page.keyboard.press("e");
  await sleep(1500);
  await page.keyboard.press("Enter");
  await sleep(1500);
  console.log("ride", JSON.stringify(await ev(() => window.__pfs.busRide())), (await snap(page)).toasts);
  for (let i = 0; i < 30; i++) {
    await sleep(4000);
    const r = await ev(() => window.__pfs.busRide());
    const s = await snap(page);
    const b = (await ev(() => window.__pfs.buses())).find((q) => q.id === "bus_0");
    console.log("riding", JSON.stringify(r), JSON.stringify(b), "player", s.player && [s.player.x.toFixed(0), s.player.z.toFixed(0)], "fps", s.fps?.toFixed(1), "toasts", s.toasts);
    if (i === 6) await page.screenshot({ path: `tools/out/bus_ride.png`, timeout: 180000 });
    if (!r) break;
  }
  await sleep(1500);
  await page.screenshot({ path: `tools/out/bus_off.png`, timeout: 180000 });
  const s = await snap(page);
  console.log("end", JSON.stringify({ p: s.player, errors: s.errors }));
} catch (e) { console.log("ERROR", String(e)); }
console.log(log.filter((l) => !l.includes("WebGPU")).slice(0, 8).join("\n"));
await browser.close();
