// The people who know the family: node tools/people.mjs [base]
// New game, stand in front of a few of them, and print what they say and what the save remembers.
import { launch, snap, sleep } from "./pt-lib.mjs";
const base = process.argv[2] ?? "http://localhost:4173/";
const { browser, page, log } = await launch(`${base}?probe&gfx=low`);
const focused = (sel) => page.waitForFunction((q) => !!document.activeElement?.closest(q), sel, { timeout: 60000 });
const ev = (f, ...a) => page.evaluate(f, ...a);
try {
  await page.evaluate(() => localStorage.clear()); await page.reload();
  await page.waitForSelector("#title button", { timeout: 300000 });
  await focused("#title .menu"); await page.keyboard.press("Enter");
  await page.waitForSelector("#title .looks button"); await focused("#title .looks"); await page.keyboard.press("Enter");
  await page.waitForFunction(() => window.__pfs?.snapshot().state === "playing", null, { timeout: 300000 });
  await sleep(2500);
  // Known people in the bazaar, standing at their counters: [id, x, z, side of them to stand on].
  for (const [id, x, z] of [["keeper_kiryana", -7.9, -56.5], ["keeper_hardware", 7.9, -6], ["chatA", 5.4, -45.6]]) {
    const east = x < 0;
    await ev((q) => window.__pfs.teleport(q.x, q.z, q.yaw), { x: east ? x + 1.5 : x - 1.5, z, yaw: east ? -Math.PI / 2 : Math.PI / 2 });
    await sleep(4500);
    const s = await snap(page);
    console.log(id, "bubbles:", JSON.stringify(s.bubbles));
  }
  const save = await ev(() => JSON.parse(localStorage.getItem("pfs.save") ?? "{}"));
  console.log("saved people:", JSON.stringify(save.people));
  // The Jaan-pehchaan page of the pause menu.
  await page.keyboard.press("Escape");
  await page.waitForSelector(".menu-panel button");
  await page.locator(".menu-panel button", { hasText: "Jaan-pehchaan" }).click();
  await page.waitForSelector(".panel table");
  console.log("page rows:", JSON.stringify(await page.$$eval(".panel table tr", (rs) => rs.map((r) => r.textContent))));
  await page.screenshot({ path: new URL("./out/people-page.png", import.meta.url).pathname });
} catch (e) { console.log("ERROR", String(e).slice(0, 300)); }
console.log("errors:", JSON.stringify(log.filter((l) => !/WebGPU|wasm|ArrayBuffer/.test(l)).slice(0, 4)));
await browser.close();
