// Walk-in kothis: node tools/house.mjs [base]  (AT=x,z: the nearest open house to there)
// Shots: house_gate.png (from the street), house_in.png (third person inside, by the host),
// house_room.png / house_back.png (a camera in the baithak corner / looking into the back room).
import { launch, snap, waitFor, sleep } from "./pt-lib.mjs";
const base = process.argv[2] ?? "http://localhost:4173/";
const { browser, page, log } = await launch(`${base}?probe&gfx=${process.env.GFX ?? "low"}`);
const focused = (sel) => page.waitForFunction((q) => !!document.activeElement?.closest(q), sel, { timeout: 60000 });
const ev = (f, ...a) => page.evaluate(f, ...a);
const cam = (c) => ev((c) => {
  const sc = window.__pfs.scene();
  let k = sc.getCameraByName("houseCam");
  if (!k) { k = sc.activeCamera.clone("houseCam"); }
  sc.activeCamera = k;
  k.position.set(c[0], c[1], c[2]); k.setTarget(new k.position.constructor(c[3], c[4], c[5]));
}, c);
try {
  await page.waitForSelector("#title button", { timeout: 300000 });
  await focused("#title .menu"); await page.keyboard.press("Enter");
  await page.waitForSelector("#title .looks button"); await focused("#title .looks"); await page.keyboard.press("Enter");
  await waitFor(page, (x) => x.state === "playing", 300000);
  const [x, z] = (process.env.AT ?? "-167,0").split(",").map(Number);
  await ev((a) => window.__pfs.teleport(a[0], a[1], 0), [x, z]);
  await sleep(1500);
  const hs = await ev(() => window.__pfs.openHouses());
  const h = hs[Number(process.env.N ?? 0)];
  console.log("house", JSON.stringify(h), "of", hs.length);
  // In the street, facing the gate.
  const fx = Math.sin(h.rot), fz = Math.cos(h.rot);
  await ev((a) => { window.__pfs.teleport(a[0], a[1], a[2]); window.__pfs.face(a[2]); }, [h.gate.x + fx * 5, h.gate.z + fz * 5, h.rot + Math.PI]);
  await sleep(6000);
  let s = await snap(page);
  console.log("street fps", s.fps?.toFixed(1), "draws", s.drawCalls, "activeTris", s.activeTris);
  await page.screenshot({ path: "tools/out/house_gate.png", timeout: 180000 });
  // Inside, by the host.
  await ev((a) => { window.__pfs.teleport(a[0], a[1], a[2]); window.__pfs.face(a[2]); }, [h.talk.x, h.talk.z, h.host.yaw + Math.PI]);
  await sleep(4000);
  s = await snap(page);
  console.log("inside prompt", JSON.stringify(await ev(() => window.__pfs.prompt())), "fps", s.fps?.toFixed(1), "draws", s.drawCalls);
  await page.screenshot({ path: "tools/out/house_in.png", timeout: 180000 });
  // A camera in the baithak's front corner (by the TV wall) looking at the sofa and the partition.
  const L = (u, zz) => ({ x: h.ox + u * Math.cos(h.rot) + zz * Math.sin(h.rot), z: h.oz - u * Math.sin(h.rot) + zz * Math.cos(h.rot) });
  const hh = await ev((id) => window.__pfs.openHouses().find((q) => q.id === id), h.id);
  void hh;
  console.log("errors", JSON.stringify((await snap(page)).errors));
  // Local house frame (u along the front, z into the street; the house front is at z = -yd).
  const z0 = -h.yd - 0.2, zp = z0 - 4.6;
  const at = (u, y, zz, tu, ty, tz) => { const p = L(u, zz), t = L(tu, tz); return [p.x, y, p.z, t.x, ty, t.z]; };
  await cam(at(h.w - 0.6, 2.5, z0 - 0.5, 0.8, 0.8, z0 - 3.4));
  await sleep(1500);
  await page.screenshot({ path: "tools/out/house_room.png", timeout: 180000 });
  await cam(at(h.w / 2, 2.4, zp - 0.3, h.w / 2 - 0.5, 0.9, -h.dd + 0.4));
  await sleep(1500);
  await page.screenshot({ path: "tools/out/house_back.png", timeout: 180000 });
  void L;
} catch (e) { console.log("ERROR", String(e)); }
console.log(log.filter((l) => !l.includes("WebGPU")).slice(0, 8).join("\n"));
await browser.close();
