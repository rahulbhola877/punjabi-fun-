// Where do the triangles come from? Needs the dev server (npx vite --port 5174) so function names survive.
//   node tools/triprof.mjs   -> triangles built at load, by builder function, material and chunk ([material|chunk])
import { chromium } from "playwright";
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--enable-webgl"] });
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
await page.goto("http://localhost:5174/?probe&triprof&view=-12,2,-44,-2,1.5,-44", { waitUntil: "load", timeout: 600000 });
await page.waitForFunction(() => window.__pfs?.snapshot()?.state === "title", null, { timeout: 600000 });
const r = await page.evaluate(() => { const agg = new Map(); for (const [k, v] of window.__triProf.counts) { const f = k.split(" ")[0] + " [" + (k.split("[")[1] ?? "").split("|")[0]; agg.set(f, (agg.get(f) ?? 0) + v); } const c = [...agg.entries()].sort((a, b) => b[1] - a[1]); const tot = c.reduce((s, x) => s + x[1], 0); return { tot, top: c.slice(0, 60).map(([k, v]) => `${Math.round(v / 1000)}k ${k}`) }; });
console.log("total tris built", r.tot); console.log(r.top.join("\n"));
await browser.close();
