// Shops, outfit, buff, tiffin carry — keyboard only, from a real post-delivery save.
import { launch, snap, waitFor, shot, walkTo, clearDialogues, tap, sleep, release } from "./pt-lib.mjs";
import fs from "node:fs";
const base = process.argv[2] ?? "http://localhost:5173/";
const seed = fs.readFileSync("tools/out/save-after-delivery.json", "utf8");
const T0 = Date.now();
const step = (name, data = {}) => console.log(JSON.stringify({ t: ((Date.now() - T0) / 1000).toFixed(1), name, ...data }));
const { browser, page, log } = await launch(`${base}?probe&gfx=low`);
try {
  await page.waitForSelector("#title button", { timeout: 180000 });
  const save = JSON.parse(seed); save.money = 400; // pocket money for the shopping test
  await page.evaluate((s) => localStorage.setItem("pfs.save", s), JSON.stringify(save));
  await page.reload({ timeout: 180000 });
  await page.waitForSelector("#title button", { timeout: 180000 });
  await page.keyboard.press("Enter");
  let s = await waitFor(page, (x) => x.state === "playing");
  step("continued", { money: s.money, player: s.player });
  const go = async (pts) => walkTo(page, [{ x: 0, z: s.player.z }, ...pts], { sprint: true, tol: 0.6 });
  // Sweets: jalebi buff.
  await go([{ x: 0, z: -22 }, { x: -5.6, z: -22 }]);
  s = await snap(page);
  step("at sweets", { prompt: s.prompt });
  await tap(page, "KeyE");
  await waitFor(page, (x) => x.modalOpen);
  await page.keyboard.press("Tab"); // first item button is focused? focus first focusable = first item button
  await page.keyboard.press("Shift+Tab");
  await page.keyboard.press("Enter");
  await sleep(500);
  await page.keyboard.press("Escape");
  s = await waitFor(page, (x) => x.state === "playing");
  step("bought jalebi", { money: s.money, buff: s.buff, speedMul: s.speedMul });
  // Textile: saffron turban/patka.
  await walkTo(page, [{ x: 0, z: -22 }, { x: 0, z: -44.2 }, { x: -5.6, z: -44.2 }, { x: -5.6, z: -46.5 }], { sprint: true });
  s = await snap(page);
  step("at textile", { prompt: s.prompt });
  await tap(page, "KeyE");
  await waitFor(page, (x) => x.modalOpen);
  await page.keyboard.press("Enter");
  await sleep(800);
  await shot(page, "15-shop-textile");
  await page.keyboard.press("Escape");
  s = await waitFor(page, (x) => x.state === "playing");
  step("bought outfit", { money: s.money, outfit: s.outfit });
  // Take a delivery and look at the carry pose.
  await walkTo(page, [{ x: -5.4, z: -40.5 }, { x: -7.9, z: -39.7 }]);
  await tap(page, "KeyE");
  await waitFor(page, (x) => x.dialogueOpen);
  await clearDialogues(page);
  s = await waitFor(page, (x) => !!x.job);
  step("job", { job: s.job });
  await walkTo(page, [{ x: -5.4, z: -40.5 }, { x: -5.4, z: -45 }]);
  await tap(page, "KeyJ", 900); // swing the camera round with the keyboard camera keys
  await sleep(600);
  await shot(page, "16-tiffin-carry");
  s = await snap(page);
  step("carry", { carrying: s.player.carrying });
} catch (e) {
  step("ERROR", { message: String(e) });
  await shot(page, "zz-pt4").catch(() => {});
} finally {
  await release(page).catch(() => {});
  step("console", { log: log.slice(0, 8), external: page.__external });
  await browser.close();
}
