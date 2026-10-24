// The first job starts on the Bullet: node tools/intro-bullet.mjs [base]
// New game → the Meet Bhola objective → stand at the counter (a few spots are tried, since a spot inside
// the counter is moved to open ground) → talk to him → the objective should now be "Chaura Bazaar,
// Ludhiana" and mention the Bullet at the gate. Logs both objectives, where you stood and any errors.
import { launch, snap, sleep } from "./pt-lib.mjs";
const base = process.argv[2] ?? "http://localhost:4173/";
const { browser, page, log } = await launch(`${base}?probe&gfx=low`);
const focused = (sel) => page.waitForFunction((q) => !!document.activeElement?.closest(q), sel, { timeout: 60000 });
const ev = (f, ...a) => page.evaluate(f, ...a);
// The counter's front is 1.5 m inside the dhaba's frontage and the prompt needs you within 2 m of it, so
// the spots that work are the ones just outside the frontage. A ring 1.8 m out finds that side.
const SPOTS = Array.from({ length: 16 }, (_, i) => [1.8 * Math.cos((i / 16) * 2 * Math.PI), 1.8 * Math.sin((i / 16) * 2 * Math.PI)]);
try {
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForSelector("#title button", { timeout: 300000 });
  await focused("#title .menu"); await page.keyboard.press("Enter");
  await page.waitForSelector("#title .looks button"); await focused("#title .looks"); await page.keyboard.press("Enter");
  await page.waitForFunction(() => window.__pfs?.snapshot().state === "playing", null, { timeout: 300000 });
  await sleep(2000);
  let s = await snap(page);
  console.log("start:", s.objective?.title, "|", s.objective?.detail);
  const t = s.objective.target;
  let label = null;
  for (const [dx, dz] of SPOTS) {
    await ev((p) => window.__pfs.teleport(p.x, p.z, 0), { x: t.x + dx, z: t.z + dz });
    await sleep(900);
    label = await ev(() => window.__pfs.prompt());
    if (label && /Bhola/.test(label)) { console.log("stood at offset", dx, dz, "| prompt:", label); break; }
  }
  if (!label || !/Bhola/.test(label)) {
    s = await snap(page);
    console.log("no Bhola prompt at any spot; last prompt", label, "| player", JSON.stringify(s.player), "| target", JSON.stringify(t));
  } else {
    await page.keyboard.press("KeyE");
    for (let i = 0; i < 8; i++) { await sleep(1800); await page.keyboard.press("Enter"); }
    await sleep(2500);
    s = await snap(page);
    console.log("after talk: introStage", s.introStage, "|", s.objective?.title, "|", s.objective?.detail);
  }
  console.log("errors", JSON.stringify(s.errors));
} catch (e) { console.log("ERROR", String(e)); }
console.log(log.filter((l) => !l.includes("WebGPU")).slice(0, 6).join("\n"));
await browser.close();
