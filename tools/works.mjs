// The Focal Point factories, the dispensary and the chaupal: node tools/works.mjs [base] -- screenshots, and who is where at the shift change
import { launch, snap, sleep } from "./pt-lib.mjs";
const base = process.argv[2] ?? "http://localhost:4173/";
const { browser, page, log } = await launch(`${base}?probe&gfx=low&hour=11`);
const ev = (f, ...a) => page.evaluate(f, ...a);
const out = new URL("./out/", import.meta.url).pathname;
try {
  await page.evaluate(() => localStorage.clear()); await page.reload();
  await page.waitForSelector("#title button", { timeout: 300000 });
  await page.keyboard.press("Enter");
  await page.waitForSelector("#title .looks button"); await page.keyboard.press("Enter");
  await page.waitForFunction(() => window.__pfs?.snapshot().state === "playing", null, { timeout: 300000 });
  await sleep(1500);
  const shots = [
    ["factories", -496, -158, 0, 11], ["cycleyard", -560, -140, 0.2, 11], ["mill", -432, -140, -0.3, 11],
    ["dispensary", 22, 320, Math.PI, 10.5], ["chaupal", 23, 325, 0, 17],
  ];
  for (const [name, x, z, yaw, hour] of shots) {
    await ev(([x, z, yaw, hour]) => { window.__pfs.hour(hour); window.__pfs.teleport(x, z, yaw); window.__pfs.face(yaw); }, [x, z, yaw, hour]);
    await sleep(7000);
    await page.screenshot({ path: out + `works-${name}.png` });
    const s = await snap(page);
    console.log(name, "people near:", s.people.map((p) => p.id).slice(0, 12).join(" "), "prompt:", await ev(() => window.__pfs.prompt?.()));
  }
} catch (e) { console.log("ERROR", String(e).slice(0, 300)); }
console.log("errors:", JSON.stringify(log.filter((l) => !/WebGPU|wasm|ArrayBuffer/.test(l)).slice(0, 4)));
await browser.close();
