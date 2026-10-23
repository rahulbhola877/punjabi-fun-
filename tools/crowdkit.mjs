// The kit crowd: start, go to AT=x,z,yaw, log who wears a kit body (and draws, tris, fps), screenshot.
// node tools/crowdkit.mjs [base]  (GFX=low|high, NAME=shot, WAIT=ms, N=rounds, CAM=x,y,z,tx,ty,tz clones the camera, EXTRA=&oldcrowd)
import { launch, snap, waitFor, sleep } from "./pt-lib.mjs";
const base = process.argv[2] ?? "http://localhost:4173/";
const { browser, page, log } = await launch(`${base}?probe&gfx=${process.env.GFX ?? "low"}${process.env.EXTRA ?? ""}`);
const focused = (sel) => page.waitForFunction((q) => !!document.activeElement?.closest(q), sel, { timeout: 60000 });
const name = process.env.NAME ?? "crowdkit";
try {
  await page.waitForSelector("#title button", { timeout: 300000 });
  await focused("#title .menu"); await page.keyboard.press("Enter");
  await page.waitForSelector("#title .looks button"); await focused("#title .looks"); await page.keyboard.press("Enter");
  await waitFor(page, (x) => x.state === "playing", 300000);
  await sleep(1500);
  await page.evaluate((a) => window.__pfs.teleport(...a.split(",").map(Number)), process.env.AT ?? "0,-30,0");
  if (process.env.PRE) await page.evaluate(process.env.PRE);
  for (let i = 0; i < Number(process.env.N ?? 2); i++) {
    await sleep(Number(process.env.WAIT ?? 6000));
    const s = await snap(page);
    const tris = await page.evaluate(() => Math.round(window.__pfs.scene().getActiveIndices() / 3));
    if (process.env.LOG) console.log("log", JSON.stringify(await page.evaluate(process.env.LOG)));
    console.log(i, JSON.stringify({ fps: s.fps?.toFixed(1), draws: s.drawCalls, tris, res: s.residents, kit: s.kit, errors: s.errors }));
  }
  if (process.env.GOTO) {
    // Walk up to someone (by id prefix): stand 3 m from them, facing them, so they get a kit body.
    const ok = await page.evaluate((pre) => {
      const n = window.__pfs.scene().transformNodes.find((t) => t.name.startsWith(pre) && t.name.endsWith("_root"));
      if (!n) return null;
      const p = n.getAbsolutePosition();
      window.__pfs.teleport(p.x + 3, p.z, -Math.PI / 2);
      return n.name;
    }, process.env.GOTO);
    console.log("goto", ok);
    await sleep(4000);
  }
  if (process.env.FOCUS?.startsWith("kit:")) {
    // The first person in a kit body whose id starts with this.
    const pre = process.env.FOCUS.slice(4);
    const k = (await snap(page)).kit.people.find((p) => p.id.startsWith(pre));
    console.log("kit focus", JSON.stringify(k));
    process.env.FOCUS = k?.id ?? "none";
  }
  if (process.env.FOCUS) {
    // A camera 2.6 m in front of that person, at eye height, looking at them.
    const ok = await page.evaluate(([id, eye, dist]) => {
      const scene = window.__pfs.scene();
      const n = scene.getTransformNodeByName(`${id}_root`) ?? scene.getTransformNodeByName(id);
      if (!n) return false;
      const p = n.getAbsolutePosition(), yaw = n.rotationQuaternion.toEulerAngles().y;
      const cam = scene.activeCamera.clone("kitcam");
      const V = p.constructor;
      cam.position.copyFrom(new V(p.x + Math.sin(yaw) * dist, p.y + eye, p.z + Math.cos(yaw) * dist));
      cam.setTarget(new V(p.x, p.y + 1.0, p.z));
      scene.activeCamera = cam;
      for (const e of document.querySelectorAll("body *")) if (!(e instanceof HTMLCanvasElement) && !e.querySelector("canvas")) e.style.visibility = "hidden";
      return true;
    }, [process.env.FOCUS, Number(process.env.EYE ?? 1.4), Number(process.env.DIST ?? 2.6)]);
    console.log("focus", ok);
    await sleep(Number(process.env.FWAIT ?? 300));
  }
  if (process.env.GOSSIPCAM) {
    // Stand 7 m from the first gossip circle, eye height 2 m, looking at it.
    const g = await page.evaluate(() => window.__pfs.gossip()[0]);
    console.log("circle", JSON.stringify(g));
    if (g) {
      const p = (await snap(page)).player;
      const dx = p.x - g.x, dz = p.z - g.z, d = Math.hypot(dx, dz) || 1;
      process.env.CAM = [g.x + dx / d * 7, 2.2, g.z + dz / d * 7, g.x, 1, g.z].join(",");
    }
  }
  if (process.env.CAM) {
    await page.evaluate((c) => {
      const [x, y, z, tx, ty, tz] = c.split(",").map(Number);
      const scene = window.__pfs.scene();
      const cam = scene.activeCamera.clone("kitcam");
      const V = cam.position.constructor;
      cam.position.copyFrom(new V(x, y, z)); cam.setTarget(new V(tx, ty, tz));
      scene.activeCamera = cam;
    }, process.env.CAM);
    await sleep(2500);
  }
  await page.screenshot({ path: `tools/out/${name}.png`, timeout: 180000 });
  if (process.env.SHOTS) for (let i = 1; i <= Number(process.env.SHOTS); i++) { await sleep(Number(process.env.SI ?? 1200)); await page.screenshot({ path: `tools/out/${name}_${i}.png`, timeout: 180000 }); }
} catch (e) { console.log("ERROR", String(e)); }
console.log(log.filter((l) => !l.includes("WebGPU")).slice(0, 8).join("\n"));
await browser.close();
