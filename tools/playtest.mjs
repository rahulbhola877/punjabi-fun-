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
  // New game → choose the first look (keyboard: Enter on focused New Game, then
  // Enter on first look). The menu focuses its first button on a rAF, which on
  // the software renderer can be a few hundred ms out — wait for focus to land
  // rather than racing it, or Enter goes nowhere and the run stalls at the title.
  const focused = (sel) => page.waitForFunction((q) => !!document.activeElement?.closest(q), sel, { timeout: 60000 });
  await focused("#title .menu");
  await page.keyboard.press("Enter");
  await page.waitForSelector("#title .looks button");
  await focused("#title .looks");
  await page.keyboard.press("Enter");
  let s = await waitFor(page, (x) => x.state === "playing");
  step("new game", { player: s.player, objective: s.objective.title });
  await sleep(1500);
  await shot(page, "02-start");

  // 1. Meet Bhola: his phone broke — off to Chaura Bazaar, Ludhiana.
  await walkTo(page, [{ x: -5.4, z: -40.5 }, { x: -7.9, z: -39.7 }]);
  s = await snap(page);
  step("at Bhola", { prompt: s.prompt, player: s.player });
  await tap(page, "KeyE");
  await waitFor(page, (x) => x.dialogueOpen);
  await sleep(800);
  await shot(page, "03-meet-bhola");
  await clearDialogues(page);
  s = await waitFor(page, (x) => x.introStage === 2);
  step("sent to Chaura Bazaar", { objective: s.objective.title, voice: s.lastVoice });
  if (s.lastVoice !== "bhola_chaura") throw new Error(`expected Bhola's Chaura Bazaar line, got ${s.lastVoice}`);

  // 2. Walk out to the scooter and ride.
  await walkTo(page, [{ x: -8.0, z: -32.6 }, { x: -5.2, z: -32.6 }, { x: -3.9, z: -32.4 }]);
  s = await snap(page);
  step("at scooter", { prompt: s.prompt });
  await tap(page, "KeyE");
  s = await waitFor(page, (x) => !!x.vehicle && x.introStage === 3);
  step("mounted", { vehicle: s.vehicle.id, stage: s.introStage, objective: s.objective.title });
  await sleep(1000);
  await shot(page, "05-on-scooter");

  // 3. Out of the south gate, west on the G.T. Road, into Ludhiana's Chaura Bazaar.
  const ROUTE = [{ x: -1.5, z: -50 }, { x: 0, z: -120 }, { x: -6, z: -160 }, { x: -200, z: -162 }, { x: -462, z: -162 }, { x: -470, z: -176 }, { x: -470, z: -284 }, { x: -480, z: -290 }, { x: -574, z: -290 }, { x: -579, z: -300 }, { x: -582.5, z: -307 }];
  const p0 = Date.now();
  await driveTo(page, ROUTE, { cruise: 10 });
  s = await snap(page);
  step("arrived Chaura Bazaar", { secs: (Date.now() - p0) / 1000, vehicle: s.vehicle, prompt: s.prompt, shows: s.quarrel ?? null });
  await shot(page, "06-chaura-bazaar");
  await tap(page, "KeyE");
  await waitFor(page, (x) => x.dialogueOpen);
  await sleep(500);
  await shot(page, "07-mobile-shop");
  s = await snap(page);
  const shopVoice = s.lastVoice;
  await clearDialogues(page);
  s = await waitFor(page, (x) => x.introStage === 4);
  step("bought the mobile", { voice: shopVoice, objective: s.objective.title });

  // 4. Back to Bhola.
  await driveTo(page, [...ROUTE].reverse().slice(1).concat([{ x: -1.5, z: -50 }, { x: -2.6, z: -36.5 }]), { cruise: 10 });
  await tap(page, "KeyE");
  s = await waitFor(page, (x) => !x.vehicle);
  await walkTo(page, [{ x: -5.4, z: -38.5 }, { x: -7.9, z: -39.7 }]);
  await tap(page, "KeyE");
  await waitFor(page, (x) => x.dialogueOpen);
  await clearDialogues(page);
  s = await waitFor(page, (x) => x.introStage === 999);
  step("intro complete", { money: s.money, rep: s.rep, voice: s.lastVoice });
  if (s.lastVoice !== "bhola_thanks") throw new Error(`expected Bhola's thanks, got ${s.lastVoice}`);

  // 5. Take a delivery job.
  await sleep(600);
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
