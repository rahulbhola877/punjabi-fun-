// Fast-travel spot at Ghanta Ghar: where you land, then walk about and log fps and sounds.
import { launch, snap, waitFor, sleep, shot } from "./pt-lib.mjs";
const base = process.argv[2] ?? "http://localhost:4173/";
const { browser, page, log } = await launch(`${base}?probe&gfx=${process.env.GFX ?? "low"}`);
const focused = (sel) => page.waitForFunction((q) => !!document.activeElement?.closest(q), sel, { timeout: 60000 });
try {
  await page.waitForSelector("#title button", { timeout: 300000 });
  await focused("#title .menu"); await page.keyboard.press("Enter");
  await page.waitForSelector("#title .looks button"); await focused("#title .looks"); await page.keyboard.press("Enter");
  await waitFor(page, (x) => x.state === "playing", 300000);
  await sleep(3000);
  await page.evaluate((a) => window.__pfs.teleport(...a.split(',').map(Number)), process.env.AT ?? '321,42,1.5708');
  await sleep(1500);
  let s = await snap(page);
  console.log("landed", JSON.stringify({ player: s.player, fps: s.fps, residents: s.residents, audio: s.audio }));
  await shot(page, "gg-land");
  await page.keyboard.down("KeyW");
  for (let i = 0; i < 10; i++) {
    await sleep(2000);
    s = await snap(page);
    console.log(i, JSON.stringify({ p: s.player && [s.player.x.toFixed(1), s.player.z.toFixed(1)], fps: s.fps?.toFixed(1), draws: s.drawCalls, res: s.residents, traffic: s.traffic, audio: s.audio, toasts: s.toasts, errors: s.errors }));
  }
  await page.keyboard.up("KeyW");
  await shot(page, "gg-walk");
} catch (e) { console.log("ERROR", String(e)); }
await browser.close();
