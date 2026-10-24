// N tunes the radio in a vehicle: node tools/radio-game.mjs [base]
import { launch, snap, sleep } from "./pt-lib.mjs";
const base = process.argv[2] ?? "http://localhost:4173/";
const { browser, page, log } = await launch(`${base}?probe&gfx=low`);
const ev = (f, ...a) => page.evaluate(f, ...a);
try {
  await page.evaluate(() => localStorage.clear()); await page.reload();
  await page.waitForSelector("#title button", { timeout: 300000 });
  await page.keyboard.press("Enter");
  await page.waitForSelector("#title .looks button"); await page.keyboard.press("Enter");
  await page.waitForFunction(() => window.__pfs?.snapshot().state === "playing", null, { timeout: 300000 });
  await sleep(2000);
  const heard = [];
  const grab = async () => { const s = await snap(page); heard.push(...(s.audio?.heard ?? [])); return s; };
  await page.keyboard.press("n");
  await sleep(600);
  console.log("on foot, N:", JSON.stringify((await grab()).toasts));
  const v = (await snap(page)).vehicles.find((x) => /bullet|moto/i.test(x.id)) ?? (await snap(page)).vehicles[0];
  console.log("vehicle", v.id, Math.round(v.x), Math.round(v.z));
  await ev(([x, z]) => window.__pfs.teleport(x + 1.2, z, 0), [v.x, v.z]);
  await sleep(1500);
  await page.keyboard.press("e");
  await sleep(2000);
  console.log("driving:", await ev(() => window.__pfs.vehicleType?.() ?? null), (await snap(page)).vehicle?.type);
  for (let i = 0; i < 5; i++) {
    await page.keyboard.press("n");
    await sleep(2500);
    const s = await grab();
    console.log("N", i + 1, JSON.stringify(s.toasts), "audio:", s.audio?.state);
  }
  console.log("heard:", JSON.stringify(heard.filter((h) => h.startsWith("radio"))));
  // At Lali uncle's counter the shop radio plays.
  await ev(() => window.__pfs.teleport(-4, -56, 0));
  await sleep(4000);
  console.log("at the shops:", JSON.stringify((await grab(), heard.filter((h) => h.startsWith("radio:")))));
} catch (e) { console.log("ERROR", String(e).slice(0, 300)); }
console.log("errors:", JSON.stringify(log.filter((l) => !/WebGPU|wasm|ArrayBuffer/.test(l)).slice(0, 4)));
await browser.close();
