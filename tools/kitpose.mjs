// Offline contact sheet of a kit animation clip: node tools/kitpose.mjs CLIP [ARCH] [OUTFIT]
// Env: P0 (first phase 0..1), NOGUARD=1, BUILD=stocky, COLORS='{"top":"#f00"}', N (frames, default 6), VIEWS (side,front,q,back,top,left,ql), CELL (px), ZOOM, FY (focus height m).
// Writes tools/out/kp_<clip>_<arch>.png. Rows are views, columns are evenly spaced phases of the clip.
import { build } from "esbuild";
import { chromium } from "playwright";
import fs from "node:fs";
const [clip = "walk", arch = "male", outfit = ""] = process.argv.slice(2);
fs.mkdirSync("tools/out/kitpose", { recursive: true });
await build({ entryPoints: ["tools/kitpose/page.ts"], bundle: true, outfile: "tools/out/kitpose/page.js", format: "esm", logLevel: "error" });
fs.writeFileSync("tools/out/kitpose/index.html", `<!doctype html><body style="margin:0"><script type="module" src="page.js"></script></body>`);
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--allow-file-access-from-files"] });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
page.on("pageerror", (e) => console.error(e.message));
page.on("console", (m) => { if (m.type() === "error") console.error(m.text()); });
const q = new URLSearchParams({ clip, arch, ...(outfit ? { outfit } : {}), n: process.env.N ?? "6", views: process.env.VIEWS ?? "side,front,q", cell: process.env.CELL ?? "220", zoom: process.env.ZOOM ?? "1", ...(process.env.FY ? { fy: process.env.FY } : {}), ...(process.env.BUILD ? { build: process.env.BUILD } : {}), ...(process.env.COLORS ? { colors: process.env.COLORS } : {}), ...(process.env.NOGUARD ? { noguard: "1" } : {}), ...(process.env.P0 ? { p0: process.env.P0 } : {}) });
await page.goto(`file://${process.cwd()}/tools/out/kitpose/index.html?${q}`);
await page.waitForFunction(() => window.done, null, { timeout: 120000 });
const out = `tools/out/kp_${process.env.NAME ?? `${clip}_${arch}`}.png`;
await page.locator("canvas").screenshot({ path: out });
console.log(out);
await browser.close();
