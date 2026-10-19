// Phase 2 (continues from a fresh game that has completed the intro via phase 1 helpers):
// delivery job end-to-end, horn reactions, pause, save, reload/continue, auto reverse.
import { launch, snap, waitFor, shot, walkTo, driveTo, clearDialogues, tap, sleep, release, hold } from "./pt-lib.mjs";
import fs from "node:fs";

const base = process.argv[2] ?? "http://localhost:5173/";
const gfx = process.env.GFX ?? "low";
const T0 = Date.now();
const report = { steps: [] };
const step = (name, data = {}) => { const e = { t: ((Date.now() - T0) / 1000).toFixed(1), name, ...data }; report.steps.push(e); console.log(JSON.stringify(e)); };

// Seed a save where the intro is done, by PLAYING the intro is phase 1's job; here we only
// accept a save produced by phase 1 (copied from its browser storage file) or play it again quickly.
const seed = process.env.SEED_SAVE ? fs.readFileSync(process.env.SEED_SAVE, "utf8") : null;
const { browser, page, log } = await launch(`${base}?probe&gfx=${gfx}`);
try {
  await page.waitForSelector("#title button", { timeout: 180000 });
  if (seed) {
    await page.evaluate((s) => localStorage.setItem("pfs.save", s), seed);
    await page.reload({ timeout: 180000 });
    await page.waitForSelector("#title button", { timeout: 180000 });
  }
  await page.keyboard.press("Enter"); // Continue
  let s = await waitFor(page, (x) => x.state === "playing");
  step("continued", { stage: s.introStage, money: s.money, player: s.player, vehicles: s.vehicles });

  // Take a job from Bhola if none.
  if (!s.job) {
    // Walk down the middle of the bazaar road (clear of poles, trees and stalls).
    await walkTo(page, [{ x: 0, z: s.player.z - 1 }, { x: 0, z: -38.5 }, { x: -5.4, z: -38.5 }, { x: -7.9, z: -39.7 }], { sprint: true });
    await tap(page, "KeyE");
    await waitFor(page, (x) => x.dialogueOpen);
    await clearDialogues(page);
    s = await waitFor(page, (x) => !!x.job);
  }
  step("job", { job: s.job, target: s.objective.target });
  // Walk to the nearest scooter.
  const sc = s.vehicles.filter((v) => v.id.startsWith("scooter")).sort((a, b) => Math.hypot(a.x - s.player.x, a.z - s.player.z) - Math.hypot(b.x - s.player.x, b.z - s.player.z))[0];
  await walkTo(page, [{ x: -5.4, z: -38.5 }, { x: -3.6, z: -38.5 }, { x: -3.6, z: sc.z + (sc.z > -38.5 ? -1.5 : 1.5) }, { x: sc.x - 0.9, z: sc.z }], { tol: 0.7, sprint: true });
  await tap(page, "KeyE");
  s = await waitFor(page, (x) => !!x.vehicle);
  step("riding", { vehicle: s.vehicle.id });
  // Horn near people.
  await tap(page, "KeyH");
  await sleep(1500);
  s = await snap(page);
  step("horn", { bubbles: s.bubbles });
  // Follow the GPS route (skip the first point = our position).
  const target = s.objective.target;
  const route = s.route.slice(1).filter((p, i, a) => i === a.length - 1 || Math.hypot(p.x - a[i + 1].x, p.z - a[i + 1].z) > 3);
  step("route", { n: route.length, route });
  const t0 = s.job.elapsed;
  await driveTo(page, route.map((p, i) => (i === route.length - 1 ? { x: target.x, z: target.z } : p)), { cruise: 8, tol: 2.2 });
  s = await snap(page);
  step("arrived", { vehicle: s.vehicle, prompt: s.prompt, job: s.job });
  await shot(page, "10-delivery-arrive");
  // If we could not get close enough on wheels, get off and walk.
  if (!s.prompt || !s.prompt.startsWith("Deliver")) {
    await tap(page, "KeyE");
    await waitFor(page, (x) => !x.vehicle);
    await walkTo(page, [{ x: target.x, z: target.z }], { tol: 1.5 });
    s = await snap(page);
  }
  await tap(page, "KeyE");
  await waitFor(page, (x) => x.dialogueOpen || x.modalOpen);
  await clearDialogues(page);
  await sleep(400);
  s = await waitFor(page, (x) => !x.job && !x.modalOpen && !x.dialogueOpen);
  step("delivered", { money: s.money, rep: s.rep, stats: s.stats, medals: s.medals, bests: s.bests, simElapsed: t0 });
  await shot(page, "11-after-delivery");

  // Pause / resume.
  await page.keyboard.press("Escape");
  s = await waitFor(page, (x) => x.state === "paused");
  await shot(page, "12-pause-menu");
  // Tab to "Save game" and press Enter.
  await page.keyboard.press("Tab");
  await page.keyboard.press("Enter");
  await sleep(800);
  await page.keyboard.press("Escape");
  s = await waitFor(page, (x) => x.state === "playing");
  step("saved via pause menu", {});
  const saved = await page.evaluate(() => localStorage.getItem("pfs.save"));
  fs.writeFileSync("tools/out/save-after-delivery.json", saved ?? "");
  const before = await snap(page);

  // Reload and continue.
  await page.reload({ timeout: 180000 });
  await page.waitForSelector("#title button", { timeout: 180000 });
  await shot(page, "13-title-continue");
  await page.keyboard.press("Enter");
  s = await waitFor(page, (x) => x.state === "playing");
  const same = s.money === before.money && s.rep === before.rep && s.stats.deliveries === before.stats.deliveries && s.introStage === before.introStage;
  const vdiff = Math.max(...s.vehicles.map((v) => { const b = before.vehicles.find((x) => x.id === v.id); return b ? Math.hypot(v.x - b.x, v.z - b.z) : 99; }));
  step("reload/continue", { same, money: s.money, rep: s.rep, deliveries: s.stats.deliveries, maxVehicleShift: vdiff.toFixed(2), player: s.player });

  // Auto-rickshaw: drive, brake, reverse.
  const auto = s.vehicles.find((v) => v.id === "auto_1");
  await walkTo(page, [{ x: 0, z: s.player.z }, { x: 0, z: auto.z + 2 }, { x: auto.x + 1.5, z: auto.z }], { tol: 0.6, timeout: 300000, sprint: true });
  await tap(page, "KeyE");
  s = await waitFor(page, (x) => x.vehicle?.type === "auto");
  await shot(page, "14-auto");
  await hold(page, ["KeyW"]);
  await sleep(4000);
  const fwd = await snap(page);
  await hold(page, ["KeyS"]);
  let minSpeed = 99;
  for (let i = 0; i < 80; i++) { const x = await snap(page); minSpeed = Math.min(minSpeed, x.vehicle.speed); await sleep(100); }
  await release(page);
  step("auto drive/brake/reverse", { fwdSpeed: fwd.vehicle.speed, minSpeedWhileHoldingS: minSpeed });
} catch (e) {
  step("ERROR", { message: String(e) });
  await shot(page, "zz-error2").catch(() => {});
} finally {
  await release(page).catch(() => {});
  report.final = await snap(page).catch(() => null);
  report.errors = log;
  report.externalRequests = page.__external ?? [];
  fs.writeFileSync("tools/out/playtest2-report.json", JSON.stringify(report, null, 2));
  await browser.close();
}
