// Deep audit: boot the real game, visit every zone, and report what the
// engine is actually doing there — frame time, draw calls, active meshes,
// crowd and traffic counts, how much of the traffic is stuck, plus every
// console error and page error along the way.
//
//   node tools/audit.mjs http://localhost:4173/
//
// Writes docs/screenshots/audit-<zone>.png and prints a table.
import { launch, snap, sleep, shot, tap } from "./pt-lib.mjs";

const URL = process.argv[2] ?? "http://localhost:4173/";
// Software rendering here: the frame rate is not a player's frame rate. The
// numbers worth reading are draw calls, active meshes and the stuck counts.
const GFX = process.env.GFX ?? "low";

/** One sample point per kind of place, in the middle of what makes it that place. */
const SPOTS = [
  ["ranggarh-bazaar", 0, -10],
  ["gt-road", 0, -160],
  ["dhaba", 80, -188],
  ["nawan-chowk", 321, 21],
  ["nawan-mandi", 250, -119],
  ["nawan-adda", 450, -119],
  ["ludh-chaura", -470, -290],
  ["ludh-gali", -525, -240],
  ["ludh-chowk", -441, -266],
  ["ludh-adda", -412, -343],
  ["ludh-mandi", -527, -343],
  ["ludh-avenue", -470, -210],
  ["pind-kotli", -23, 320],
  ["khet", 150, 100],
];

const SETTLE = 14000;
const SAMPLE = 7000;

async function sample(page, ms) {
  const out = [];
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    out.push(await snap(page));
    await sleep(350);
  }
  const num = (k) => out.map((s) => s[k]).filter((v) => typeof v === "number");
  const avg = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
  const p95 = (a) => (a.length ? [...a].sort((x, y) => x - y)[Math.floor(a.length * 0.95)] : 0);
  const last = out[out.length - 1];
  return {
    fps: avg(num("fps")),
    worstFrameMs: p95(num("frameTimeMs")),
    draws: Math.round(avg(num("drawCalls"))),
    meshes: Math.round(avg(num("activeMeshes"))),
    verts: last.totalVertices,
    residents: last.residents,
    near: last.people.length,
    traffic: last.traffic,
    stopped: Math.round(avg(num("trafficStopped"))),
    stuckPeople: Math.round(avg(num("residentsStuck"))),
    bubbles: [...new Set(out.flatMap((s) => s.bubbles))],
    audio: last.audioState,
  };
}

const main = async () => {
  const { browser, page, log } = await launch(`${URL}?probe&gfx=${GFX}`, { w: 960, h: 540 });
  // Start a fresh game: New Game, then pick the first look. The menu focuses
  // its first button on a rAF, so wait for focus rather than racing it.
  await page.waitForSelector("#title button", { timeout: 180000 });
  const focused = (sel) => page.waitForFunction((q) => !!document.activeElement?.closest(q), sel, { timeout: 60000 });
  await focused("#title .menu");
  await page.keyboard.press("Enter");
  await page.waitForSelector("#title .looks button");
  await focused("#title .looks");
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => window.__pfs?.snapshot().state === "playing", null, { timeout: 180000 });
  await sleep(3000);
  // Skip the intro dialogue if one is open.
  for (let i = 0; i < 8; i++) {
    const s = await snap(page);
    if (!s.dialogueOpen) break;
    await tap(page, "Escape");
    await sleep(400);
  }

  const rows = [];
  for (const [name, x, z] of SPOTS) {
    await page.evaluate(([x, z]) => window.__pfs.teleport(x, z), [x, z]);
    await sleep(SETTLE);
    const r = await sample(page, SAMPLE);
    rows.push([name, r]);
    await shot(page, `audit-${name}`);
    console.log(
      `${name.padEnd(16)} fps ${r.fps.toFixed(0).padStart(3)}  p95frame ${r.worstFrameMs.toFixed(0).padStart(3)}ms  ` +
      `draws ${String(r.draws).padStart(4)}  meshes ${String(r.meshes).padStart(4)}  ` +
      `people ${String(r.residents).padStart(3)} (${r.near} near)  traffic ${String(r.traffic).padStart(2)} (${r.stopped} stopped)  ` +
      `stuck ${r.stuckPeople}  audio ${r.audio}`
    );
    if (r.bubbles.length) console.log(`${" ".repeat(16)} said: ${r.bubbles.slice(0, 6).join(" / ")}`);
  }

  console.log("\n--- console errors / warnings ---");
  const uniq = [...new Set(log)];
  for (const l of uniq.slice(0, 40)) console.log(l.slice(0, 300));
  if (!uniq.length) console.log("(none)");
  const ext = page.__external ?? [];
  if (ext.length) console.log(`\nBLOCKED external requests: ${[...new Set(ext)].slice(0, 10).join(", ")}`);
  const errs = await page.evaluate(() => window.__pfs.snapshot().errors ?? []);
  if (errs?.length) { console.log("\n--- in-game errors ---"); for (const e of errs.slice(0, 20)) console.log(String(e).slice(0, 300)); }
  await browser.close();
};

main().catch((e) => { console.error(e); process.exit(1); });
