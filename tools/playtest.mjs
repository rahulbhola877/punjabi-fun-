// Milestone 1 playtest: plays the intro, a delivery job, shop, save/reload — keyboard only.
// Usage: node tools/playtest.mjs [baseUrl] [phase]
import { launch, snap, waitFor, shot, walkTo, driveTo, clearDialogues, tap, sleep, release, hold } from "./pt-lib.mjs";
import fs from "node:fs";

const base = process.argv[2] ?? "http://localhost:5173/";
const gfx = process.env.GFX ?? "low";
const report = { started: new Date().toISOString(), steps: [], perf: [], errors: [] };
const step = (name, data = {}) => { const e = { t: ((Date.now() - T0) / 1000).toFixed(1), name, ...data }; report.steps.push(e); console.log(JSON.stringify(e)); };
const T0 = Date.now();

const { browser, page, log } = await launch(`${base}?probe&gfx=${gfx}`);
try {
  await page.waitForSelector("#title button", { timeout: 180000 });
  step("title shown");
  await shot(page, "01-title");
  // New game → choose the first look (keyboard: Enter on focused New Game, then Enter on first look).
  await page.keyboard.press("Enter");
  await page.waitForSelector("#title .looks button");
  await page.keyboard.press("Enter");
  let s = await waitFor(page, (x) => x.state === "playing");
  step("new game", { player: s.player, objective: s.objective.title });
  await sleep(1500);
  await shot(page, "02-start");

  // 1. Meet Bhola.
  await walkTo(page, [{ x: -5.4, z: -40.5 }, { x: -7.9, z: -39.7 }]);
  s = await snap(page);
  step("at Bhola", { prompt: s.prompt, player: s.player });
  await tap(page, "KeyE");
  await waitFor(page, (x) => x.dialogueOpen);
  await sleep(800);
  await shot(page, "03-meet-bhola");
  await clearDialogues(page);
  s = await waitFor(page, (x) => x.introStage === 1);
  step("intro stage 1", { objective: s.objective.title, voice: s.lastVoice });
  if (s.lastVoice !== "bhola_hello") throw new Error(`expected Bhola voice line, got ${s.lastVoice}`);

  // 2. Collect the tiffin from the kitchen pass.
  await walkTo(page, [{ x: -8.0, z: -32.6 }, { x: -14.9, z: -32.4 }]);
  s = await snap(page);
  step("at pickup", { prompt: s.prompt });
  await tap(page, "KeyE");
  s = await waitFor(page, (x) => x.introStage === 2 && x.player.carrying);
  step("tiffin collected");
  await shot(page, "04-dhaba-interior-carry");

  // 3. Walk out to the scooter and ride.
  await walkTo(page, [{ x: -8.0, z: -32.6 }, { x: -5.2, z: -32.6 }, { x: -3.9, z: -32.4 }]);
  s = await snap(page);
  step("at scooter", { prompt: s.prompt });
  await tap(page, "KeyE");
  s = await waitFor(page, (x) => !!x.vehicle);
  step("mounted", { vehicle: s.vehicle.id, stage: s.introStage });
  await sleep(1000);
  await shot(page, "05-on-scooter");

  // 4. Ride to the workshop.
  const p0 = Date.now();
  await driveTo(page, [{ x: -1.5, z: -26 }, { x: 0, z: 0 }, { x: 0.5, z: 16 }, { x: 5, z: 22 }, { x: 8.8, z: 23.0 }], { cruise: 9 });
  s = await snap(page);
  step("arrived workshop", { secs: (Date.now() - p0) / 1000, vehicle: s.vehicle, prompt: s.prompt });
  await shot(page, "06-workshop-arrival");
  await tap(page, "KeyE");
  await waitFor(page, (x) => x.dialogueOpen);
  await sleep(500);
  await shot(page, "07-gurnam-dialogue");
  await clearDialogues(page);
  s = await waitFor(page, (x) => x.introStage === 999);
  step("intro complete", { money: s.money, rep: s.rep, voice: s.lastVoice });
  if (s.lastVoice !== "gurnam_finally") throw new Error(`expected Gurnam voice line, got ${s.lastVoice}`);

  // 5. Spend the reward at Gurnam's: get off, talk, buy brakes and a paint.
  await tap(page, "KeyE"); // get off
  s = await waitFor(page, (x) => !x.vehicle);
  step("got off", { player: s.player });
  await walkTo(page, [{ x: 10.9, z: 21.8 }]);
  s = await snap(page);
  step("near Gurnam", { prompt: s.prompt });
  await tap(page, "KeyE");
  await waitFor(page, (x) => x.modalOpen);
  await sleep(400);
  await shot(page, "08-workshop-shop");
  // First item = brakes (₹180). Focus is on it.
  await page.keyboard.press("Enter");
  await sleep(600);
  s = await snap(page);
  step("bought brakes?", { money: s.money });
  // Close the shop with Escape.
  await waitFor(page, (x) => x.modalOpen);
  await page.keyboard.press("Escape");
  await waitFor(page, (x) => !x.modalOpen && x.state === "playing");

  // 6. Ride back to Bhola and take a delivery job.
  s = await snap(page);
  const ridden = s.vehicles.find((v) => v.id === "scooter_1");
  // Approach from whichever side we are standing on (walking through the scooter just pushes it).
  const toP = Math.atan2(s.player.x - ridden.x, s.player.z - ridden.z);
  await walkTo(page, [{ x: ridden.x + Math.sin(toP) * 1.1, z: ridden.z + Math.cos(toP) * 1.1 }], { tol: 0.5 });
  s = await snap(page);
  step("at scooter again", { prompt: s.prompt });
  await tap(page, "KeyE");
  s = await waitFor(page, (x) => !!x.vehicle);
  await driveTo(page, [{ x: 4, z: 22 }, { x: 0.5, z: 14 }, { x: 0, z: -20 }, { x: -2.6, z: -36.5 }], { cruise: 9 });
  await tap(page, "KeyE");
  s = await waitFor(page, (x) => !x.vehicle);
  await walkTo(page, [{ x: -5.4, z: -38.5 }, { x: -7.9, z: -39.7 }]);
  await tap(page, "KeyE");
  await waitFor(page, (x) => x.dialogueOpen);
  await clearDialogues(page);
  s = await waitFor(page, (x) => !!x.job);
  step("job taken", { job: s.job, objective: s.objective });
  await shot(page, "09-job-taken");
  report.job = s.job;
  report.objective = s.objective;
} catch (e) {
  step("ERROR", { message: String(e) });
  await shot(page, "zz-error").catch(() => {});
} finally {
  await release(page).catch(() => {});
  const s = await snap(page).catch(() => null);
  report.final = s;
  const save = await page.evaluate(() => localStorage.getItem("pfs.save")).catch(() => null);
  if (save) fs.writeFileSync("tools/out/save-phase1.json", save);
  report.errors = log;
  report.externalRequests = page.__external ?? [];
  fs.mkdirSync("tools/out", { recursive: true });
  fs.writeFileSync("tools/out/playtest-report.json", JSON.stringify(report, null, 2));
  await browser.close();
}
