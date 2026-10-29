// Performance guard: node tools/budget.mjs [base] [--quiet]   (needs a preview build, default http://localhost:4173/)
//   ONLY=medium,high node tools/budget.mjs      to measure some presets only
//   UPDATE=1 node tools/budget.mjs              to print a new BASELINE table to paste below
// Rule: rebaseline in the same commit as any new visuals or map (see "The rebaseline rule" in docs/TESTING.md).
// For each preset and each of three fixed views it reads the active triangles (shadow pass included), the draw
// calls and the loaded vertices, and exits 1 when any number is more than 6% above its BASELINE. The goals in
// docs/V2_PLAN.md (11.6) are shown beside them: they are the target, the baseline is the guard.
// Software rendering here: the counts are real, the frame rates are not, so no frame rate is checked.
import { chromium } from "playwright";
import { browserOptions } from "./browser.mjs";
const base = process.argv[2]?.startsWith("http") ? process.argv[2] : "http://localhost:4173/";
const quiet = process.argv.includes("--quiet");
const VIEWS = { bazaar: "-12,2,-44,-2,1.5,-44", colony: "45,4,-20,62,1.5,-36", street: "0,1.8,-110,0,1.6,-20" };
const PRESETS = {
  low: { s: { quality: "low", post: false, shadows: "off", renderScale: 0.7 }, goal: [400, 150, 3.0] },
  medium: { s: { quality: "medium", post: false, shadows: "low", renderScale: 1 }, goal: [700, 300, 3.5] },
  high: { s: { quality: "high", post: true, shadows: "low", renderScale: 1 }, goal: [900, 400, 3.5] },
  ultra: { s: { quality: "ultra", post: true, shadows: "high", renderScale: 1 }, goal: [1200, 550, 4.0] },
};
// [thousand triangles, draw calls, million vertices], measured 2026-10-29 after the hill station Sukh Pahar (its pines, snow range, gabled roofs, Sunset Point, the hillside terrain, hill houses and the Mall) on top of the two new towns and the east edge at 1500 m. Rebaseline after any new visuals or map (docs/TESTING.md).
const BASELINE = {
  low: { bazaar: [349, 236, 4.81], colony: [208, 120, 4.78], street: [529, 292, 4.78] },
  medium: { bazaar: [934, 430, 5.37], colony: [686, 270, 5.35], street: [1137, 485, 5.35] },
  high: { bazaar: [985, 494, 5.36], colony: [788, 335, 5.35], street: [1224, 542, 5.35] },
  ultra: { bazaar: [1244, 652, 5.36], colony: [960, 457, 5.35], street: [1373, 653, 5.35] },
};
const only = process.env.ONLY?.split(",");
const browser = await chromium.launch(browserOptions());
let failed = 0;
const rows = [], table = {};
for (const [pname, P] of Object.entries(PRESETS)) {
  if (only && !only.includes(pname)) continue;
  table[pname] = {};
  for (const [vname, v] of Object.entries(VIEWS)) {
    const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
    await page.addInitScript((s) => localStorage.setItem("pfs.settings.v1", s), JSON.stringify(P.s));
    await page.goto(`${base}?probe&view=${v}`, { waitUntil: "load", timeout: 300000 });
    await page.waitForFunction(() => window.__pfs?.snapshot()?.state === "title", null, { timeout: 300000 });
    await page.waitForTimeout(4000);
    const r = await page.evaluate(() => {
      const sc = window.__pfs.scene();
      const groups = new Map();
      const am = sc.getActiveMeshes();
      for (let i = 0; i < am.length; i++) {
        const m = am.data[i];
        const n = (m.name || "?").replace(/[_\-:.]?\d+.*$/, "").slice(0, 28);
        const g = groups.get(n) ?? { tris: 0, meshes: 0 };
        g.tris += ((m.getTotalIndices?.() ?? 0) / 3) * (m.thinInstanceCount || 1); g.meshes++;
        groups.set(n, g);
      }
      const top = [...groups.entries()].sort((a, b) => b[1].tris - a[1].tris).slice(0, 8).map(([n, g]) => `${n} ${Math.round(g.tris / 1000)}k/${g.meshes}`);
      return { tris: Math.round(sc.getActiveIndices() / 3000), draws: window.__pfs.snapshot().drawCalls, verts: window.__pfs.snapshot().totalVertices / 1e6, top };
    });
    await page.close();
    table[pname][vname] = [r.tris, r.draws, +r.verts.toFixed(2)];
    const b = BASELINE[pname]?.[vname];
    const over = b ? ["tris", "draws", "verts"].filter((_, i) => [r.tris, r.draws, r.verts][i] > b[i] * 1.06) : [];
    if (over.length) failed++;
    const [gt, gd, gv] = P.goal;
    rows.push(`${pname.padEnd(6)} ${vname.padEnd(7)} tris ${String(r.tris).padStart(5)}k (goal ${gt}k)  draws ${String(r.draws).padStart(4)} (goal ${gd})  verts ${r.verts.toFixed(2)}M (goal ${gv}M)  ${over.length ? "OVER BASELINE: " + over.join(",") : "ok"}`);
    if (!quiet) rows.push("       " + r.top.join(" · "));
  }
}
await browser.close();
console.log(rows.join("\n"));
if (process.env.UPDATE) console.log("\nBASELINE =", JSON.stringify(table));
process.exit(failed ? 1 : 0);
