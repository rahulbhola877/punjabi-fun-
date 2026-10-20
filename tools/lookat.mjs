// Park a free camera at a spot and photograph it, for looking at a place
// the playtest got stuck in.
//
//   node tools/lookat.mjs http://localhost:4173/ name x z [height] [tx tz]
import { launch, snap, sleep, shot } from "./pt-lib.mjs";

const [, , URL = "http://localhost:4173/", NAME = "look", X = "0", Z = "0", H = "12", TX, TZ] = process.argv;

const main = async () => {
  const { browser, page } = await launch(`${URL}?probe&gfx=low&start=${X},${Z}`, { w: 1100, h: 700 });
  await page.waitForSelector("#title button", { timeout: 180000 });
  const focused = (sel) => page.waitForFunction((q) => !!document.activeElement?.closest(q), sel, { timeout: 60000 });
  await focused("#title .menu");
  await page.keyboard.press("Enter");
  await page.waitForSelector("#title .looks button");
  await focused("#title .looks");
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => window.__pfs?.snapshot().state === "playing", null, { timeout: 180000 });
  await sleep(2000);
  await page.evaluate(([x, z]) => window.__pfs.teleport(x, z), [Number(X), Number(Z)]);
  // Let the crowd and traffic stream in before judging how busy it is.
  await sleep(16000);
  await page.evaluate(([x, z, h, tx, tz]) => {
    const scene = window.__pfs.scene();
    const cam = scene.activeCamera.clone("lookat");
    cam.minZ = 0.1;
    const V = cam.position.constructor;
    const p = new V(x, h, z - h * 0.9), t = new V(tx, 1, tz);
    cam.position.copyFrom(p);
    cam.setTarget(t);
    scene.activeCamera = cam;
    scene.onBeforeRenderObservable.add(() => { cam.position.copyFrom(p); cam.setTarget(t); });
  }, [Number(X), Number(Z), Number(H), Number(TX ?? X), Number(TZ ?? Z)]);
  await sleep(2500);
  const s = await snap(page);
  console.log(`people near ${s.people.length}  traffic ${s.traffic}  wedged ${s.trafficWedged}  idleMax ${s.trafficIdleMax}s`);
  await shot(page, NAME);
  console.log(`docs/screenshots/${NAME}.png`);
  await browser.close();
};

main().catch((e) => { console.error(e); process.exit(1); });
