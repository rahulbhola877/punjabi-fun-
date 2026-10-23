// The hero's home: node tools/home.mjs [base]. Walks through every home interaction and
// screenshots it: home_gate (the Bullet), home_in (the family greets by name, heads turn),
// home_tv (on the sofa, TV on), home_bebe, home_simran (errand, then the cold drink),
// home_meal (lunch at 13:00), home_bed (sleep at 21:00 → 06:30).
import { launch, snap, waitFor, sleep } from "./pt-lib.mjs";
const base = process.argv[2] ?? "http://localhost:4173/";
const { browser, page, log } = await launch(`${base}?probe&gfx=${process.env.GFX ?? "low"}`);
const focused = (sel) => page.waitForFunction((q) => !!document.activeElement?.closest(q), sel, { timeout: 60000 });
const ev = (f, ...a) => page.evaluate(f, ...a);
const shot = (n) => page.screenshot({ path: `tools/out/home_${n}.png`, timeout: 180000 });
const state = async (tag) => console.log(tag, JSON.stringify(await ev(() => window.__pfs.home())), "prompt:", JSON.stringify(await ev(() => window.__pfs.prompt())));
const go = (a, yaw = 0) => ev(([p, y]) => { window.__pfs.teleport(p.x, p.z, y); }, [a, yaw]);
const press = async (k, ms = 1500) => { await page.keyboard.press(k); await sleep(ms); };
try {
  await page.waitForSelector("#title button", { timeout: 300000 });
  await focused("#title .menu"); await page.keyboard.press("Enter");
  await page.waitForSelector("#title .looks button"); await focused("#title .looks"); await page.keyboard.press("Enter");
  await waitFor(page, (x) => x.state === "playing", 300000);
  await ev(() => window.__pfs.hour(10));
  const H = await ev(() => window.__pfs.homeAt());
  console.log("money", (await snap(page)).money ?? JSON.stringify(await ev(() => window.__pfs.snapshot().money)));
  await go(H.gate, H.gate.yaw); await ev((y) => window.__pfs.face(y), H.gate.yaw);
  await sleep(4000); await shot("gate");
  // Walk in: stand by the sofa, facing the family.
  await go(H.sofaFront, H.gate.yaw); await ev((y) => window.__pfs.face(y), H.gate.yaw); await sleep(5000);
  await state("in"); await shot("in");
  // Sofa: TV on, change channel.
  await press("KeyE", 4000); await state("sofa"); await shot("tv");
  await press("KeyE", 1200); await press("Enter", 4000); await state("channel"); await shot("tv2");
  await press("KeyE", 1200); await page.locator("button", { hasText: "Get up" }).click(); await sleep(2000); await state("up");
  // Bebe ji: blessing + ₹50.
  const fam = (await ev(() => window.__pfs.home())).family;
  const bebe = fam.find((f) => f.id === "home_bebe"), sim = fam.find((f) => f.id === "home_simran");
  await go({ x: bebe.x + (H.sofaFront.x - bebe.x) * 0.5, z: bebe.z + (H.sofaFront.z - bebe.z) * 0.5 }, Math.atan2(bebe.x - H.sofaFront.x, bebe.z - H.sofaFront.z)); await sleep(1500);
  await state("bebe"); await press("KeyE", 2500); await shot("bebe"); await state("bebe after");
  // Simran: errand, then give the drink.
  await go({ x: sim.x + (H.sofaFront.x - sim.x) * 0.5, z: sim.z + (H.sofaFront.z - sim.z) * 0.5 }, Math.atan2(sim.x - H.sofaFront.x, sim.z - H.sofaFront.z)); await sleep(1500);
  await state("simran"); await press("KeyE", 1500); await press("Enter", 2500); await shot("simran"); await state("errand");
  await ev(() => window.__pfs.buy("colddrink")); await sleep(500);
  await state("with drink"); await press("KeyE", 3000); await state("given"); console.log("bag", JSON.stringify(await ev(() => window.__pfs.bag())));
  // Lunch at 13:00: Mummy ji calls, eat at the table.
  await ev(() => window.__pfs.hour(13.1)); await sleep(1500);
  await go(H.tableSide, 0); await sleep(1500); await state("table");
  await press("KeyE", 1500); await press("Enter", 4500); await state("meal"); await shot("meal");
  for (let i = 0; i < 60 && (await ev(() => window.__pfs.home().mode)) === "meal"; i++) await sleep(2000);
  await state("after meal");
  // Night: sleep in the bed.
  await ev(() => window.__pfs.hour(21.6)); await go(H.bedSide, 0); await sleep(2500); await state("bed"); await shot("bed");
  await press("KeyE", 1000); await shot("sleeping"); await sleep(3500);
  const s = await snap(page);
  console.log("woke", JSON.stringify(await ev(() => window.__pfs.hour())), "hp", s.hp, "errors", JSON.stringify(s.errors));
  await state("morning"); await shot("morning");
} catch (e) { console.log("ERROR", String(e)); }
console.log(log.filter((l) => !l.includes("WebGPU")).slice(0, 8).join("\n"));
await browser.close();
