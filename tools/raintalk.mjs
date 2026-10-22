// People react to rain and the flood (bubbles / voice lines): node tools/raintalk.mjs [base]  (AT=x,z,yaw)
import { launch, snap, waitFor, sleep } from "./pt-lib.mjs";
const base = process.argv[2] ?? "http://localhost:4173/";
const { browser, page, log } = await launch(`${base}?probe&voicelog&gfx=${process.env.GFX ?? "low"}`);
const focused = (sel) => page.waitForFunction((q) => !!document.activeElement?.closest(q), sel, { timeout: 60000 });
const ev = (f, ...a) => page.evaluate(f, ...a);
try {
  await page.waitForSelector("#title button", { timeout: 300000 });
  await focused("#title .menu"); await page.keyboard.press("Enter");
  await page.waitForSelector("#title .looks button"); await focused("#title .looks"); await page.keyboard.press("Enter");
  await waitFor(page, (x) => x.state === "playing", 300000);
  const [x, z, yaw] = (process.env.AT ?? "0,-75,0").split(",").map(Number);
  await ev((a) => { window.__pfs.teleport(a[0], a[1], a[2]); window.__pfs.face(a[2]); }, [x, z, yaw]);
  await sleep(4000);
  await ev(() => window.__pfs.weather(true, true));
  const seen = new Set();
  for (let i = 0; i < 40; i++) {
    await sleep(2000);
    const s = await snap(page);
    for (const b of s.bubbles ?? []) if (!seen.has(b)) { seen.add(b); console.log(`t+${2 * i + 2}s bubble:`, b); }
    if (i === 3) await page.screenshot({ path: "tools/out/raintalk.png", timeout: 180000 });
  }
  const s = await snap(page);
  console.log("fps", s.fps?.toFixed(1), "draws", s.drawCalls, "weather", JSON.stringify(s.weather), "errors", JSON.stringify(s.errors));
  console.log((await ev(() => window.__pfs.voiceLog())).filter((l) => /rain-start|flood/.test(l)).join("\n"));
} catch (e) { console.log("ERROR", String(e)); }
console.log(log.filter((l) => !l.includes("WebGPU") && !l.includes("[voice]")).slice(0, 5).join("\n"));
await browser.close();
