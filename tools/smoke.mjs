// Quick open-world smoke test: new game, idle, punch the air, report state and errors.
import { launch, snap, waitFor, sleep, tap, shot } from "./pt-lib.mjs";
const base = process.argv[2] ?? "http://localhost:5173/";
const { browser, page, log } = await launch(`${base}?probe&gfx=${process.env.GFX ?? "low"}`);
try {
  await page.waitForSelector("#title button", { timeout: 300000 });
  await page.keyboard.press("Enter");
  await page.waitForSelector("#title .looks button");
  await page.keyboard.press("Enter");
  let s = await waitFor(page, (x) => x.state === "playing", 300000);
  const pick = (x) => ({ fps: x.fps?.toFixed(1), draws: x.drawCalls, residents: x.residents, traffic: x.traffic, town: x.townTraffic, patrols: x.patrols, cops: x.constables, people: x.people, vehicles: x.vehicleCount, hp: x.hp, wanted: x.wanted, errors: x.errors, toasts: x.toasts });
  console.log("start", JSON.stringify(pick(s)));
  await sleep(15000);
  await tap(page, "KeyQ"); await sleep(300); await tap(page, "KeyQ"); await sleep(300); await tap(page, "KeyQ");
  await sleep(5000);
  s = await snap(page);
  console.log("after", JSON.stringify(pick(s)));
  await shot(page, "smoke");
} catch (e) { console.log("ERROR", String(e)); }
console.log("log", JSON.stringify(log.slice(0, 15)));
console.log("external", JSON.stringify(page.__external));
await browser.close();
