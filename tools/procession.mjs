// Processions: node tools/procession.mjs [base]  (KIND=kirtan|rally|baraat, AT=x,z,yaw)
// Starts one near the player, follows it from the side with a clone of the
// camera (FOCUS=metres back from the head for a close-up, SIDE, UP), logs its state and the held-up traffic, screenshots proc_<kind>_N.png.
import { launch, snap, waitFor, sleep } from "./pt-lib.mjs";
const base = process.argv[2] ?? "http://localhost:4173/";
const kind = process.env.KIND ?? "kirtan";
const { browser, page, log } = await launch(`${base}?probe&gfx=${process.env.GFX ?? "low"}`);
const focused = (sel) => page.waitForFunction((q) => !!document.activeElement?.closest(q), sel, { timeout: 60000 });
const ev = (f, ...a) => page.evaluate(f, ...a);
try {
  await page.waitForSelector("#title button", { timeout: 300000 });
  await focused("#title .menu"); await page.keyboard.press("Enter");
  await page.waitForSelector("#title .looks button"); await focused("#title .looks"); await page.keyboard.press("Enter");
  await waitFor(page, (x) => x.state === "playing", 300000);
  const [x, z, yaw] = (process.env.AT ?? "300,0,0").split(",").map(Number);
  await ev((a) => { window.__pfs.teleport(a[0], a[1], a[2]); window.__pfs.face(a[2]); }, [x, z, yaw]);
  await sleep(5000);
  console.log("start", JSON.stringify(await ev((k) => window.__pfs.procession(k), kind)));
  const shots = Number(process.env.SHOTS ?? 4);
  for (let i = 0; i < shots; i++) {
    await sleep(Number(process.env.GAP ?? 8000));
    const st = await ev(() => window.__pfs.procs());
    console.log(`t${i}`, JSON.stringify(st));
    if (!st.head) break;
    // From the right-hand side of the road, a little ahead of the head, looking back along the line.
    const side = Number(process.env.SIDE ?? 9), up = Number(process.env.UP ?? 3.5), back = Number(process.env.BACK ?? 10);
    await ev((a) => {
      const [hx, hz, yw, sd, upp, bk, fo, ah] = a;
      const sc = window.__pfs.scene();
      let cam = sc.getCameraByName("procCam");
      if (!cam) { cam = sc.activeCamera.clone("procCam"); sc.activeCamera = cam; }
      const fx = Math.sin(yw), fz = Math.cos(yw), rx = fz, rz = -fx;
      if (fo >= 0) {
        // Close-up: beside the line at `fo` metres back from the head.
        cam.position.set(hx - fx * (fo - ah) + rx * sd, upp, hz - fz * (fo - ah) + rz * sd);
        cam.setTarget(new cam.position.constructor(hx - fx * fo, 1.3, hz - fz * fo));
      } else {
        cam.position.set(hx + fx * 4 + rx * sd, upp, hz + fz * 4 + rz * sd);
        cam.setTarget(new cam.position.constructor(hx - fx * bk, 1.4, hz - fz * bk));
      }
    }, [st.head[0], st.head[1], st.yaw, side, up, back, Number(process.env.FOCUS ?? -1), Number(process.env.AHEAD ?? 3)]);
    await sleep(1200);
    const s = await snap(page);
    console.log("fps", s.fps?.toFixed(1), "draws", s.drawCalls, "activeTris", s.activeTris, "bubbles", JSON.stringify(s.bubbles ?? []));
    await page.screenshot({ path: `tools/out/proc_${kind}_${i}.png`, timeout: 180000 });
  }
  // WATCH=seconds: keep logging the held-up traffic, then clear the
  // procession away and check every vehicle gets going again.
  const watch = Number(process.env.WATCH ?? 0);
  for (let t = 0; t < watch; t += 10) {
    await sleep(10000);
    const st = await ev(() => window.__pfs.procs());
    console.log(`w${t + 10}s s=${st.s} blocked=${st.blocked} held=${JSON.stringify(st.held)}`);
  }
  if (watch) {
    await ev(() => window.__pfs.procEnd());
    const before = (await snap(page)).trafficTypes;
    await sleep(25000);
    console.log("traffic at end", JSON.stringify(before));
    console.log("traffic 25s later", JSON.stringify((await snap(page)).trafficTypes));
  }
  console.log("errors", JSON.stringify((await snap(page)).errors));
} catch (e) { console.log("ERROR", String(e)); }
console.log(log.filter((l) => !l.includes("WebGPU")).slice(0, 8).join("\n"));
await browser.close();
