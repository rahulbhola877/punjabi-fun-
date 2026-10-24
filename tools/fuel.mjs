// Fuel: node tools/fuel.mjs [base]  -- drain the Bullet's tank, stall, fill up at the pump
import { launch, snap, sleep } from "./pt-lib.mjs";
const base = process.argv[2] ?? "http://localhost:4173/";
const { browser, page, log } = await launch(`${base}?probe&gfx=low`);
const ev = (f, ...a) => page.evaluate(f, ...a);
const toasts = async () => (await snap(page)).toasts;
try {
  await page.evaluate(() => localStorage.clear()); await page.reload();
  await page.waitForSelector("#title button", { timeout: 300000 });
  await page.keyboard.press("Enter");
  await page.waitForSelector("#title .looks button"); await page.keyboard.press("Enter");
  await page.waitForFunction(() => window.__pfs?.snapshot().state === "playing", null, { timeout: 300000 });
  await sleep(2000);
  const v = (await snap(page)).vehicles.find((x) => x.id === "bullet_ghar");
  await ev(([x, z]) => window.__pfs.teleport(x + 1.2, z, 0), [v.x, v.z]);
  await sleep(1500);
  await page.keyboard.press("e"); await sleep(1500);
  console.log("tank on boarding:", await ev(() => window.__pfs.fuel()));
  await ev(() => window.__pfs.fuel(0.16));
  await page.keyboard.down("w"); await sleep(5000);
  console.log("low:", await ev(() => window.__pfs.fuel()), JSON.stringify(await toasts()));
  await ev(() => window.__pfs.fuel(0.001));
  await sleep(4000);
  const s = await snap(page);
  console.log("empty: speed", s.vehicle?.speed?.toFixed(2), "tank", await ev(() => window.__pfs.fuel()), JSON.stringify(await toasts()));
  await page.keyboard.up("w");
  await ev(() => window.__pfs.placeVehicle(140, -176, 0));
  await sleep(3000);
  console.log("prompt at pump:", await ev(() => window.__pfs.prompt?.()));
  await page.keyboard.press("e"); await sleep(1200);
  console.log("after fill:", await ev(() => window.__pfs.fuel()), JSON.stringify(await toasts()));
  console.log("saved:", JSON.stringify(await ev(() => JSON.parse(localStorage.getItem("pfs.save") ?? "{}").fuel)));
} catch (e) { console.log("ERROR", String(e).slice(0, 300)); }
console.log("errors:", JSON.stringify(log.filter((l) => !/WebGPU|wasm|ArrayBuffer/.test(l)).slice(0, 4)));
await browser.close();
