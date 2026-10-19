// High-quality gameplay screenshots (default graphics). Plays from a real save using normal controls.
import { launch, snap, waitFor, shot, walkTo, driveTo, tap, sleep, release, hold } from "./pt-lib.mjs";
import fs from "node:fs";
const base = process.argv[2] ?? "http://localhost:4173/";
const seed = fs.readFileSync(process.env.SEED_SAVE ?? "tools/out/save-phase1.json", "utf8");
const { browser, page } = await launch(`${base}?probe`, { w: 1280, h: 720 });
const log = (m) => console.log(new Date().toISOString().slice(11, 19), m);
try {
  await page.waitForSelector("#title button", { timeout: 300000 });
  await page.evaluate((s) => localStorage.setItem("pfs.save", s), seed);
  await page.reload({ timeout: 300000 });
  await page.waitForSelector("#title button", { timeout: 300000 });
  await shot(page, "hq-01-title");
  log("title");
  await page.keyboard.press("Enter");
  let s = await waitFor(page, (x) => x.state === "playing", 300000);
  // Hide the onboarding hint panel for clean shots by waiting it out is slow; just capture.
  await sleep(3000);
  await shot(page, "hq-02-workshop");
  log("workshop");
  // Ride the scooter south through the bazaar.
  const sc = s.vehicles.find((v) => v.id === "scooter_1");
  await walkTo(page, [{ x: sc.x - 0.8, z: sc.z + 0.9 }], { tol: 0.5 });
  await tap(page, "KeyE");
  s = await waitFor(page, (x) => !!x.vehicle);
  await driveTo(page, [{ x: 4, z: 22 }, { x: 0.5, z: 14 }], { cruise: 6, finalStop: false });
  await hold(page, ["KeyW"]);
  await sleep(2500);
  await shot(page, "hq-03-riding-bazaar");
  log("riding");
  await release(page);
  await driveTo(page, [{ x: 0, z: -12 }, { x: -2.6, z: -27 }], { cruise: 7 });
  await tap(page, "KeyE");
  await waitFor(page, (x) => !x.vehicle);
  await walkTo(page, [{ x: -5.4, z: -30 }, { x: -8.0, z: -32.6 }, { x: -11, z: -33 }]);
  await sleep(1500);
  await shot(page, "hq-04-dhaba-interior");
  log("dhaba");
  // Turn the camera with the arrow keys to look back at the street through the dhaba front.
  await hold(page, ["ArrowRight"]);
  await sleep(1400);
  await release(page);
  await sleep(800);
  await shot(page, "hq-05-dhaba-to-street");
  await walkTo(page, [{ x: -8.0, z: -38.5 }, { x: -7.9, z: -39.6 }]);
  await tap(page, "KeyE");
  await waitFor(page, (x) => x.dialogueOpen);
  await sleep(800);
  await shot(page, "hq-06-bhola-dialogue");
  log("bhola");
  await page.keyboard.press("1");
  await sleep(500);
  s = await snap(page);
  // Map overlay.
  await page.keyboard.press("KeyM");
  await waitFor(page, (x) => x.modalOpen);
  await sleep(600);
  await shot(page, "hq-07-map");
  await page.keyboard.press("Escape");
  log("map");
  // Walk out and look along the street toward the gate.
  await walkTo(page, [{ x: -5.4, z: -40 }, { x: -1, z: -50 }]);
  await hold(page, ["ArrowLeft"]);
  await sleep(900);
  await release(page);
  await sleep(1200);
  await shot(page, "hq-08-street-south");
  log("street");
  const perf = await snap(page);
  fs.writeFileSync("tools/out/showcase-perf.json", JSON.stringify({ fps: perf.fps, drawCalls: perf.drawCalls, frameTimeMs: perf.frameTimeMs, activeMeshes: perf.activeMeshes, totalVertices: perf.totalVertices }, null, 2));
} catch (e) {
  console.log("ERROR", String(e));
  await shot(page, "hq-zz-error").catch(() => {});
} finally {
  await release(page).catch(() => {});
  await browser.close();
}
