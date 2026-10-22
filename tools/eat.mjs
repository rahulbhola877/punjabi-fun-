// Eat at the dhaba: open the kitchen menu (screenshot), then eat a parantha and watch health come back: node tools/eat.mjs [base]
import { launch, snap, waitFor, sleep } from "./pt-lib.mjs";
const base = process.argv[2] ?? "http://localhost:4173/";
const { browser, page, log } = await launch(`${base}?probe${process.env.EX ?? ""}${process.env.EX ?? ""}&gfx=${process.env.GFX ?? "low"}`);
const focused = (sel) => page.waitForFunction((q) => !!document.activeElement?.closest(q), sel, { timeout: 60000 });
const ev = (f, ...a) => page.evaluate(f, ...a);
try {
  await page.waitForSelector("#title button", { timeout: 300000 });
  await focused("#title .menu"); await page.keyboard.press("Enter");
  await page.waitForSelector("#title .looks button"); await focused("#title .looks"); await page.keyboard.press("Enter");
  await waitFor(page, (x) => x.state === "playing", 300000);
  await sleep(2000);
  await ev(() => window.__pfs.shop("keeper_sweets"));
  await sleep(1500);
  await page.screenshot({ path: `tools/out/eat_menu.png`, timeout: 180000 });
  await page.keyboard.press("Escape");
  await sleep(1000);
  await ev(() => { window.__pfs.teleport(2, -60, 0); window.__pfs.face(Math.PI); });
  await sleep(1500);
  for (const id of [process.env.FOOD ?? "parantha"]) {
    console.log("eat", id, await ev((i) => window.__pfs.eat(i), id));
    await sleep(1600);
    console.log("eating", JSON.stringify(await ev(() => window.__pfs.eating())));
    await page.screenshot({ path: `tools/out/eat_${id}.png`, timeout: 180000 });
    await sleep(3500);
    console.log("after", JSON.stringify(await ev(() => window.__pfs.eating())), (await snap(page)).toasts);
  }
  console.log("errors", JSON.stringify((await snap(page)).errors));
} catch (e) { console.log("ERROR", String(e)); }
console.log(log.filter((l) => !l.includes("WebGPU")).slice(0, 8).join("\n"));
await browser.close();
