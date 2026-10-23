// New game: Jaggi starts at home beside his Bullet; get on and ride down the gali.
// node tools/bullet.mjs [base] → tools/out/bullet_start.png, bullet_ride.png; logs position/speed.
import { launch, snap, waitFor, sleep } from "./pt-lib.mjs";
const base = process.argv[2] ?? "http://localhost:4173/";
const { browser, page, log } = await launch(`${base}?probe&gfx=low`);
const focused = (sel) => page.waitForFunction((q) => !!document.activeElement?.closest(q), sel, { timeout: 60000 });
const ev = (f, ...a) => page.evaluate(f, ...a);
try {
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForSelector("#title button", { timeout: 300000 });
  await focused("#title .menu"); await page.keyboard.press("Enter");
  await page.waitForSelector("#title .looks button"); await focused("#title .looks"); await page.keyboard.press("Enter");
  await waitFor(page, (x) => x.state === "playing", 300000);
  await sleep(4000);
  let s = await snap(page);
  console.log("start", JSON.stringify(s.player ?? s.pos), "money", s.money, "prompt", JSON.stringify(await ev(() => window.__pfs.prompt())));
  console.log("objective", s.objective?.detail);
  await page.screenshot({ path: "tools/out/bullet_start.png" });
  await page.keyboard.press("KeyE"); await sleep(2500);
  s = await snap(page); console.log("on", s.drivingType);
  await page.keyboard.down("KeyW");
  for (let i = 0; i < 8; i++) { await sleep(2000); s = await snap(page); console.log("ride", i, s.vehicle ? `${s.vehicle.id} ${s.vehicle.x.toFixed(1)},${s.vehicle.z.toFixed(1)} v=${s.vehicle.speed.toFixed(1)}` : "on foot"); }
  await page.screenshot({ path: "tools/out/bullet_ride.png" });
  await page.keyboard.up("KeyW");
  console.log("errors", JSON.stringify(s.errors));
} catch (e) { console.log("ERROR", String(e)); }
console.log(log.filter((l) => !l.includes("WebGPU")).slice(0, 8).join("\n"));
await browser.close();
