// The six festival days: node tools/festivals.mjs [base] [only] -- screenshots of each on its day, at its hour
import { launch, snap, sleep } from "./pt-lib.mjs";
const base = process.argv[2] ?? "http://localhost:4173/";
const only = process.argv[3];
const { browser, page, log } = await launch(`${base}?probe&gfx=low&hour=11`);
const ev = (f, ...a) => page.evaluate(f, ...a);
const out = new URL("./out/", import.meta.url).pathname;
// [name, day, hour, x, z, yaw]
const days = [
  ["diwali", 3, 19.5, 111.5, -110.14, -Math.PI / 2], ["diwaliSky", 3, 20, 111.5, -110.14, 0.4], ["lohri", 11, 19, -160, 25, 0], ["lohri2", 11, 19.5, 23, 350, Math.PI], ["holi", 20, 14, -12, 316, 0],
  ["baisakhi", 24, 12.5, -122, 365, 0], ["teeyan", 37, 12, 28, 342, Math.PI], ["gurpurab", 4, 11, 67, 327, Math.PI],
];
try {
  await page.evaluate(() => localStorage.clear()); await page.reload();
  await page.waitForSelector("#title button", { timeout: 300000 });
  await page.keyboard.press("Enter");
  await page.waitForSelector("#title .looks button"); await page.keyboard.press("Enter");
  await page.waitForFunction(() => window.__pfs?.snapshot().state === "playing", null, { timeout: 300000 });
  await sleep(1500);
  for (const [name, day, hour, x, z, yaw] of days) {
    if (only && !name.startsWith(only)) continue;
    await ev(([day, hour, x, z, yaw]) => { window.__pfs.day(day); window.__pfs.hour(hour); window.__pfs.teleport(x, z, yaw); window.__pfs.face(yaw); }, [day, hour, x, z, yaw]);
    await sleep(3000);
    // The day's book may have popped up because the day jumped: close it.
    for (let k = 0; k < 3; k++) { const b = page.locator('button:has-text("Theek ae")'); if (await b.count()) { await b.first().click(); await sleep(1500); } }
    await sleep(7000);
    await page.screenshot({ path: out + `fest-${name}.png` });
    const s = await snap(page);
    console.log(name, "people:", s.people.filter((p) => /lohri|teeyan|mela/.test(p.id)).length, "prompt:", await ev(() => window.__pfs.prompt?.()), "toasts:", JSON.stringify(s.toasts.slice(-2)));
  }
} catch (e) { console.log("ERROR", String(e).slice(0, 300)); }
console.log("errors:", JSON.stringify(log.filter((l) => !/WebGPU|wasm|ArrayBuffer/.test(l)).slice(0, 4)));
await browser.close();
