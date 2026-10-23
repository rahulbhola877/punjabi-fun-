// The hero's home: node tools/home.mjs [base]  (HOUR=h). Shots home_gate (the Bullet in the yard),
// home_in (walking in: the family greets), home_sofa (sitting with them), home_meal (eating together).
import { launch, snap, waitFor, sleep } from "./pt-lib.mjs";
const base = process.argv[2] ?? "http://localhost:4173/";
const { browser, page, log } = await launch(`${base}?probe&gfx=${process.env.GFX ?? "low"}`);
const focused = (sel) => page.waitForFunction((q) => !!document.activeElement?.closest(q), sel, { timeout: 60000 });
const ev = (f, ...a) => page.evaluate(f, ...a);
const shot = (n) => page.screenshot({ path: `tools/out/home_${n}.png`, timeout: 180000 });
try {
  await page.waitForSelector("#title button", { timeout: 300000 });
  await focused("#title .menu"); await page.keyboard.press("Enter");
  await page.waitForSelector("#title .looks button"); await focused("#title .looks"); await page.keyboard.press("Enter");
  await waitFor(page, (x) => x.state === "playing", 300000);
  if (process.env.HOUR) await ev((h) => window.__pfs.hour(Number(h)), process.env.HOUR);
  const H = await ev(() => window.__pfs.homeAt());
  console.log("home", JSON.stringify(H));
  await ev((g) => { window.__pfs.teleport(g.x, g.z, g.yaw); window.__pfs.face(g.yaw); }, H.gate);
  await sleep(5000);
  await shot("gate");
  // Walk in: stand by the sofa.
  await ev((a) => { window.__pfs.teleport(a.x, a.z, 0); }, H.sofaFront);
  await sleep(3000);
  console.log("in", JSON.stringify(await ev(() => window.__pfs.home())), JSON.stringify(await ev(() => window.__pfs.prompt())));
  await shot("in");
  await page.keyboard.press("KeyE");
  await sleep(4000);
  console.log("sofa", JSON.stringify(await ev(() => window.__pfs.home())), JSON.stringify(await ev(() => window.__pfs.prompt())));
  await shot("sofa");
  await page.keyboard.press("KeyE"); // get up
  await sleep(1500);
  await ev((a) => { window.__pfs.teleport(a.x, a.z, 0); }, H.tableSide);
  await sleep(2000);
  console.log("table prompt", JSON.stringify(await ev(() => window.__pfs.prompt())));
  await page.keyboard.press("KeyE");
  await sleep(1500);
  await page.keyboard.press("Enter"); // "Haan ji"
  await sleep(4500);
  console.log("meal", JSON.stringify(await ev(() => window.__pfs.home())));
  await shot("meal");
  await sleep(Number(process.env.AFTER ?? 25000));
  const s = await snap(page);
  console.log("after", JSON.stringify(await ev(() => window.__pfs.home())), "hp", s.hp, "errors", JSON.stringify(s.errors));
} catch (e) { console.log("ERROR", String(e)); }
console.log(log.filter((l) => !l.includes("WebGPU")).slice(0, 8).join("\n"));
await browser.close();
