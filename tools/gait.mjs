// Close side view of the player's walk / run cycle: node tools/gait.mjs [base]  (RUN=1 sprints, N=frames)
// Writes tools/out/gait_<i>.png from a camera 3 m to the side, moved along with the player.
import { launch, waitFor, sleep } from "./pt-lib.mjs";
const base = process.argv[2] ?? "http://localhost:4173/";
const { browser, page, log } = await launch(`${base}?probe&gfx=low`);
const focused = (sel) => page.waitForFunction((q) => !!document.activeElement?.closest(q), sel, { timeout: 60000 });
const name = process.env.NAME ?? "gait";
try {
  await page.waitForSelector("#title button", { timeout: 300000 });
  await focused("#title .menu"); await page.keyboard.press("Enter");
  await page.waitForSelector("#title .looks button"); await focused("#title .looks"); await page.keyboard.press("Enter");
  await waitFor(page, (x) => x.state === "playing", 300000);
  await sleep(1500);
  await page.evaluate((a) => window.__pfs.teleport(...a.split(",").map(Number)), process.env.AT ?? "0,-110,0");
  await sleep(1500);
  if (process.env.RUN) await page.keyboard.down("Shift");
  await page.keyboard.down("KeyW");
  await sleep(Number(process.env.LEAD ?? 1500));
  if (process.env.LOGSWIM) console.log(JSON.stringify(await page.evaluate(() => { const s = window.__pfs.snapshot(); return { p: s.player, swim: s.swimming }; })));
  for (let i = 0; i < Number(process.env.N ?? 6); i++) {
    await page.evaluate(([side, eye]) => {
      const sc = window.__pfs.scene();
      const p = sc.getTransformNodeByName("player_root") ?? sc.getMeshByName("player_body")?.parent?.parent;
      let k = sc.getCameraByName("gaitCam");
      if (!k) k = sc.activeCamera.clone("gaitCam");
      sc.activeCamera = k;
      const q = p.getAbsolutePosition();
      const V = q.constructor;
      k.position.copyFrom(new V(q.x + side, q.y + eye, q.z + 0.3));
      k.setTarget(new V(q.x, q.y + 0.95, q.z));
      for (const e of document.querySelectorAll("body *")) if (!(e instanceof HTMLCanvasElement) && !e.querySelector("canvas")) e.style.visibility = "hidden";
    }, [Number(process.env.SIDE ?? 3), Number(process.env.EYE ?? 1.1)]);
    await page.screenshot({ path: `tools/out/${name}_${i}.png`, timeout: 180000 });
    await page.evaluate(() => { const sc = window.__pfs.scene(); sc.activeCamera = sc.cameras[0]; });
    await sleep(Number(process.env.GAP ?? 120));
  }
} catch (e) { console.log("ERROR", String(e)); }
console.log(log.filter((l) => !l.includes("WebGPU")).slice(0, 8).join("\n"));
await browser.close();
