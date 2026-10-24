// The new voice moments: node tools/voicecheck.mjs [base] -- ring a plain, a family and a neighbour bell, trigger a power cut, and list which recorded lines played
import { launch, snap, sleep } from "./pt-lib.mjs";
const base = process.argv[2] ?? "http://localhost:4173/";
const { browser, page, log } = await launch(`${base}?probe&voicelog&gfx=low&hour=11`);
const ev = (f, ...a) => page.evaluate(f, ...a);
const lines = [];
page.on("console", (m) => { if (m.text().startsWith("[voice]")) lines.push(m.text()); });
const heard = [];
try {
  await page.evaluate(() => localStorage.clear()); await page.reload();
  await page.waitForSelector("#title button", { timeout: 300000 });
  await page.keyboard.press("Enter");
  await page.waitForSelector("#title .looks button"); await page.keyboard.press("Enter");
  await page.waitForFunction(() => window.__pfs?.snapshot().state === "playing", null, { timeout: 300000 });
  await sleep(2500);
  for (const [name, x, z, rot] of [["plain", 66.5, -11.39, Math.PI / 2], ["family", 111.5, -110.14, Math.PI / 2], ["neighbour", 73.5, -35.88, -Math.PI / 2], ["plain2", 66.5, -11.39, Math.PI / 2]]) {
    const yaw = Math.atan2(-Math.sin(rot), -Math.cos(rot));
    await ev(([x, z, yaw]) => { window.__pfs.teleport(x, z, yaw); window.__pfs.face(yaw); }, [x, z, yaw]);
    await sleep(2500);
    await page.keyboard.press("e");
    for (let i = 0; i < 50 && !lines.some((l) => /doorbell/.test(l)); i++) { await sleep(1500); const s = await snap(page); heard.push(...(s.audio?.heard ?? [])); }
    await sleep(3000); heard.push(...((await snap(page)).audio?.heard ?? []));
    console.log(name, "->", lines.filter((l) => !/pass-by|chat/.test(l)).join("\n   ")); lines.length = 0;
    await sleep(2000);
  }
  await ev(() => window.__pfs.teleport(2, -40, 0));
  await sleep(4000);
  await ev(() => window.__pfs.power(30));
  for (let i = 0; i < 8; i++) { await sleep(1500); const s = await snap(page); heard.push(...(s.audio?.heard ?? [])); }
  console.log("power ->", lines.splice(0).join("\n   "));
  console.log("voices heard:", JSON.stringify(heard.filter((h) => h.startsWith("v:"))));
} catch (e) { console.log("ERROR", String(e).slice(0, 300)); }
console.log("errors:", JSON.stringify(log.filter((l) => !/WebGPU|wasm|ArrayBuffer/.test(l)).slice(0, 4)));
await browser.close();
