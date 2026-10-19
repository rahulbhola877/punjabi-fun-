// Open-world playtest: a street fight, the police and their "chai-paani", a ride out to the
// G.T. Road with traffic and animals, and the world map — keyboard only.
import { launch, snap, waitFor, shot, walkTo, driveTo, clearDialogues, tap, sleep, release, hold } from "./pt-lib.mjs";
import fs from "node:fs";

const base = process.argv[2] ?? "http://localhost:5173/";
const report = { steps: [], errors: [] };
const T0 = Date.now();
const step = (name, data = {}) => { const e = { t: ((Date.now() - T0) / 1000).toFixed(1), name, ...data }; report.steps.push(e); console.log(JSON.stringify(e)); };
const fail = (m) => { throw new Error(m); };

const { browser, page, log } = await launch(`${base}?probe&gfx=${process.env.GFX ?? "low"}`);
try {
  await page.waitForSelector("#title button", { timeout: 300000 });
  await page.keyboard.press("Enter");
  await page.waitForSelector("#title .looks button");
  await page.keyboard.press("Enter");
  let s = await waitFor(page, (x) => x.state === "playing", 300000);
  step("new game", { residents: s.residents, vehicles: s.vehicleCount, animals: s.animals });

  // ---- 1. Ladai: find a walker and keep punching until someone fights back or goes down.
  const money0 = s.money;
  let fought = false, ko = false;
  for (let round = 0; round < 40 && !(fought && ko); round++) {
    s = await snap(page);
    const target = s.people.filter((p) => p.role === "walker" && p.pose === "stand").sort((a, b) => Math.hypot(a.x - s.player.x, a.z - s.player.z) - Math.hypot(b.x - s.player.x, b.z - s.player.z))[0];
    if (!target) { await sleep(1000); continue; }
    try { await walkTo(page, [{ x: target.x, z: target.z }], { tol: 1.1, timeout: 8000, sprint: true }); } catch { /* moving target */ }
    for (let k = 0; k < 4; k++) { await tap(page, "KeyQ", 80); await sleep(250); }
    s = await snap(page);
    if (s.fights > 0 || s.people.some((p) => p.fight)) fought = true;
    if (s.people.some((p) => p.pose === "down")) ko = true;
  }
  s = await snap(page);
  step("street fight", { fought, ko, hp: s.hp, wanted: s.wanted, playerDown: s.playerDown });
  if (!fought) fail("nobody reacted to being punched");
  if (s.wanted < 1) fail("police were not interested in a brawl");
  await shot(page, "ow-01-fight");

  // ---- 2. Police come, catch you, take chai-paani and leave.
  const caught = await waitFor(page, (x) => x.dialogueOpen || x.playerDown, 90000).catch(() => null);
  s = await snap(page);
  if (s.playerDown) { await waitFor(page, (x) => !x.playerDown, 20000); step("knocked out and woke up", { money: (await snap(page)).money }); await waitFor(page, (x) => x.dialogueOpen, 90000); }
  const txt = await page.evaluate(() => document.querySelector(".dialogue .txt")?.textContent ?? "");
  step("caught by police", { dialogue: txt.slice(0, 80) });
  if (!/chai-paani/i.test(txt)) fail("expected the chai-paani conversation");
  await shot(page, "ow-02-chai-paani");
  await clearDialogues(page);
  s = await waitFor(page, (x) => !x.dialogueOpen && x.state === "playing", 20000);
  step("bribe paid", { money: s.money, paid: money0 - s.money, wanted: s.wanted, bribes: s.stats.bribes });
  if (s.wanted !== 0) fail("police still interested after the bribe");
  if (s.stats.bribes <= 0 && money0 > 0) fail("no bribe recorded");
  await sleep(2000);

  // ---- 3. Ride out of the bazaar to the G.T. Road.
  s = await snap(page);
  await walkTo(page, [{ x: -3.2, z: -33.5 }], { tol: 1.2, sprint: true });
  await tap(page, "KeyE");
  s = await waitFor(page, (x) => !!x.vehicle, 10000);
  step("mounted", { vehicle: s.vehicle.id });
  await driveTo(page, [{ x: 0, z: -60 }, { x: 0, z: -110 }, { x: -1.5, z: -155 }, { x: 40, z: -157 }, { x: 70, z: -158 }], { cruise: 11, tol: 3.5, timeout: 400000 });
  s = await snap(page);
  step("on the G.T. Road", { vehicle: s.vehicle, traffic: s.traffic, animals: s.animals, flips: s.counters.flips, jolts: s.counters.jolts });
  await shot(page, "ow-03-gt-road");
  if (s.traffic < 1) fail("no traffic out on the highway");
  if (s.vehicle.upY < 0.8) fail("vehicle not upright");

  // ---- 4. World map.
  await tap(page, "KeyM");
  await waitFor(page, (x) => x.modalOpen, 10000);
  await sleep(800);
  await shot(page, "ow-04-map");
  await page.keyboard.press("Minus");
  await sleep(600);
  await shot(page, "ow-05-map-world");
  await page.keyboard.press("Escape");
  await waitFor(page, (x) => !x.modalOpen, 10000);

  s = await snap(page);
  report.final = { fps: s.fps, draws: s.drawCalls, residents: s.residents, traffic: s.traffic, errors: s.errors, stats: s.stats };
  step("done", report.final);
  if (s.errors.filter((e) => !e.startsWith("flip")).length) fail("runtime errors: " + s.errors.join(" | "));
} catch (e) {
  step("ERROR", { message: String(e) });
  report.errors.push(String(e));
  await shot(page, "ow-error").catch(() => {});
}
report.log = log;
report.external = page.__external;
fs.writeFileSync("tools/out/playtest5.json", JSON.stringify(report, null, 2));
console.log("console:", JSON.stringify(log.slice(0, 10)), "external:", JSON.stringify(page.__external));
await browser.close();
process.exit(report.errors.length ? 1 : 0);
