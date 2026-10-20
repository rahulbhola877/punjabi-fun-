// Close-up of the player's face, for checking the head modelling (eyes,
// brows, beard) at a size you can actually see.
//
//   node tools/faceshot.mjs http://localhost:4173/ [name]
//
// Clones the active camera so the camera rig keeps driving its own one, then
// parks the clone half a metre in front of the player's nose.
import { launch, snap, sleep, shot } from "./pt-lib.mjs";

const URL = process.argv[2] ?? "http://localhost:4173/";
const NAME = process.argv[3] ?? "face";

const main = async () => {
  const { browser, page } = await launch(`${URL}?probe&gfx=low&facedir=${process.env.FACEDIR ?? 1}`, { w: 900, h: 900 });
  await page.waitForSelector("#title button", { timeout: 180000 });
  const focused = (sel) => page.waitForFunction((q) => !!document.activeElement?.closest(q), sel, { timeout: 60000 });
  await focused("#title .menu");
  await page.keyboard.press("Enter");
  await page.waitForSelector("#title .looks button");
  await focused("#title .looks");
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => window.__pfs?.snapshot().state === "playing", null, { timeout: 180000 });
  await sleep(4000);
  const s = await snap(page);
  await page.evaluate(({ x, y, z, yaw }) => {
    const scene = window.__pfs.scene();
    const cam = scene.activeCamera.clone("faceshot");
    cam.minZ = 0.02;
    cam.fov = 0.5;
    const d = Number(new URLSearchParams(location.search).get("facedir") ?? 1);
    // The snapshot's y is the player's feet, so the head is relative to it.
    cam.position.set(x + Math.sin(yaw) * 0.6 * d, y + 1.66, z + Math.cos(yaw) * 0.6 * d);
    cam.setTarget(new (cam.position.constructor)(x, y + 1.62, z));
    scene.activeCamera = cam;
    // The rig keeps steering the original camera; freeze this one each frame.
    const p = cam.position.clone(), t = new (cam.position.constructor)(x, y + 1.62, z);
    scene.onBeforeRenderObservable.add(() => { cam.position.copyFrom(p); cam.setTarget(t); });
  }, { x: s.player.x, y: s.player.y, z: s.player.z, yaw: s.player.yaw });
  await sleep(2500);
  await shot(page, NAME);
  console.log(`docs/screenshots/${NAME}.png`);
  await browser.close();
};

main().catch((e) => { console.error(e); process.exit(1); });
