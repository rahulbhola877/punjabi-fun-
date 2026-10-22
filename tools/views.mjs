// Scenery screenshots from fixed cameras: node tools/views.mjs '{"name":"x,y,z,tx,ty,tz"}'
import { chromium } from "playwright";
const base = process.env.BASE ?? "http://localhost:5173/";
const views = JSON.parse(process.argv[2]);
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--enable-webgl"] });
for (const [name, v] of Object.entries(views)) {
  const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
  const logs = [];
  page.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") logs.push(m.text()); });
  page.on("pageerror", (e) => logs.push("pageerror " + e.message));
  const t0 = Date.now();
  await page.goto(base + "?probe" + (process.env.EXTRA ?? "") + "&view=" + v, { waitUntil: "load", timeout: 300000 });
  await page.waitForFunction(() => window.__pfs?.snapshot()?.state === "title", null, { timeout: 300000 });
  await page.addStyleTag({ content: "#ui > *:not(canvas){display:none !important}" });
  if (process.env.PRE) await page.evaluate(process.env.PRE);
  await page.waitForTimeout(Number(process.env.WAIT ?? 5000));
  const s = await page.evaluate(() => { const x = window.__pfs.snapshot(); return { fps: x.fps, draws: x.drawCalls, meshes: x.activeMeshes, verts: x.totalVertices, activeTris: Math.round(window.__pfs.scene().getActiveIndices() / 3) }; });
  await page.screenshot({ path: `tools/out/${name}.png`, timeout: 180000 });
  console.log(name, ((Date.now() - t0) / 1000).toFixed(0) + "s", JSON.stringify(s), logs.slice(0, 5).join(" | "));
  await page.close();
}
await browser.close();
