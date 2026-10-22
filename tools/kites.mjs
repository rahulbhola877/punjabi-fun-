// Patang-baazi on the colony roofs: node tools/kites.mjs [base]  (AT=x,z,yaw; default Guru Nanak Nagar main road)
// Logs the flyers/kites, forces a pech (kite fight), screenshots kites_1.png (sky) and kites_2.png (after the cut).
import { launch, snap, waitFor, sleep } from "./pt-lib.mjs";
const base = process.argv[2] ?? "http://localhost:4173/";
const { browser, page, log } = await launch(`${base}?probe&gfx=${process.env.GFX ?? "low"}`);
const focused = (sel) => page.waitForFunction((q) => !!document.activeElement?.closest(q), sel, { timeout: 60000 });
const ev = (f, ...a) => page.evaluate(f, ...a);
try {
  await page.waitForSelector("#title button", { timeout: 300000 });
  await focused("#title .menu"); await page.keyboard.press("Enter");
  await page.waitForSelector("#title .looks button"); await focused("#title .looks"); await page.keyboard.press("Enter");
  await waitFor(page, (x) => x.state === "playing", 300000);
  const [x, z, yaw] = (process.env.AT ?? "-167,0,0.9").split(",").map(Number);
  await ev((a) => { window.__pfs.teleport(a[0], a[1], a[2]); window.__pfs.face(a[2]); }, [x, z, yaw]);
  await sleep(6000);
  // Turn towards the kites, then tilt the camera up at the sky.
  const k0 = await ev(() => window.__pfs.kites());
  if (k0.length) {
    const mx = k0.reduce((a, k) => a + k.x, 0) / k0.length, mz = k0.reduce((a, k) => a + k.z, 0) / k0.length;
    await ev((a) => window.__pfs.face(Math.atan2(a[0] - a[2], a[1] - a[3])), [mx, mz, x, z]);
    await sleep(500);
  }
  await page.keyboard.down(process.env.UPKEY ?? "i"); await sleep(Number(process.env.UPMS ?? 700)); await page.keyboard.up(process.env.UPKEY ?? "i");
  await sleep(800);
  // Optional overview from a fixed spot above the roofs: CAM=x,y,z,tx,ty,tz (a clone of the game camera).
  if (process.env.CAM) await ev((c) => {
    const sc = window.__pfs.scene(), cam = sc.activeCamera.clone("kiteCam");
    cam.position.set(c[0], c[1], c[2]); cam.setTarget(cam.position.constructor ? new cam.position.constructor(c[3], c[4], c[5]) : null);
    sc.activeCamera = cam;
  }, process.env.CAM.split(",").map(Number));
  await sleep(600);
  let s = await snap(page);
  console.log("kites", JSON.stringify(await ev(() => window.__pfs.kites())));
  console.log("fps", s.fps?.toFixed(1), "draws", s.drawCalls, "activeTris", s.activeTris);
  await page.screenshot({ path: "tools/out/kites_1.png", timeout: 180000 });
  await ev(() => window.__pfs.pech());
  const seen = new Set();
  for (let i = 0; i < 20; i++) {
    await sleep(1500);
    s = await snap(page);
    for (const b of s.bubbles ?? []) if (!seen.has(b)) { seen.add(b); console.log(`t+${(i + 1) * 1.5}s bubble:`, b); }
    if (i === 8) await page.screenshot({ path: "tools/out/kites_2.png", timeout: 180000 });
  }
  const after = await ev(() => window.__pfs.kites());
  console.log("kites after", JSON.stringify(after));
  // Close look at one flyer on the roof (from a few metres off, a little above).
  if (after.length) await ev((r) => { const cam = window.__pfs.scene().activeCamera; cam.position.set(r[0] - 6, r[1] + 3.5, r[2] - 6); cam.setTarget(new cam.position.constructor(r[0], r[1] + 1.2, r[2])); }, after[0].roof);
  await sleep(1500);
  await page.screenshot({ path: "tools/out/kites_roof.png", timeout: 180000 });
  await ev(() => window.__pfs.weather(true, true));
  await sleep(4000);
  console.log("kites in rain", JSON.stringify(await ev(() => window.__pfs.kites())));
  console.log("errors", JSON.stringify((await snap(page)).errors));
} catch (e) { console.log("ERROR", String(e)); }
console.log(log.filter((l) => !l.includes("WebGPU")).slice(0, 8).join("\n"));
await browser.close();
