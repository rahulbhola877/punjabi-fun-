// Reproducible real-browser render/CPU capture. BACKEND=webgpu|webgl, GFX=low|high.
import { chromium } from "playwright";
import fs from "node:fs";
import { browserOptions } from "./browser.mjs";
const backend = process.env.BACKEND ?? "webgl", quality = process.env.GFX ?? "high";
const label = process.env.LABEL ?? "profile";
const baseUrl = process.argv[2] ?? "http://127.0.0.1:5173/";
const allowedOrigin = new URL(baseUrl).origin;
const browser = await chromium.launch(browserOptions());
const errors = [], rows = [];
fs.mkdirSync("artifacts/profiles", { recursive: true });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on("pageerror", e => errors.push(e.message));
  page.on("console", m => { if (m.type() === "error" && errors.length < 30) errors.push(m.text()); });
  const external = [];
  await page.route("**/*", route => {
    const url = route.request().url();
    if (url.startsWith(`${allowedOrigin}/`) || /^(data|blob):/.test(url)) return route.continue();
    external.push(url); return route.abort();
  });
  await page.addInitScript(({ backend, quality }) => localStorage.setItem("pfs.settings.v1", JSON.stringify({ renderer: backend, quality })), { backend, quality });
  await page.goto(`${baseUrl}?probe&gfx=${quality}`, { timeout: 300000 });
  await page.waitForFunction(() => window.__pfs?.snapshot()?.state === "title", null, { timeout: 300000 });
  await page.locator("#title .menu button").first().click();
  await page.locator("#title .looks button").first().click();
  await page.waitForFunction(() => window.__pfs.snapshot().state === "playing");
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Profiler.enable");
  for (const [name, x, z] of [["bazaar", 0, -42], ["ludhiana", -470, -266], ["highway", 90, -160], ["north", 0, 720]]) {
    await page.evaluate(([x,z]) => window.__pfs.teleport(x,z,0), [x,z]);
    await page.waitForTimeout(Number(process.env.WARMUP_MS ?? 12000));
    await cdp.send("Profiler.start");
    const data = await page.evaluate(async () => {
      const scene = window.__pfs.scene(), engine = scene.getEngine();
      const times = [], draws = [], tris = [], cpu = [], gpu = [], passes = {main:[],scene:[],shadow:[]};
      let previous = performance.now();
      const observer = scene.onAfterRenderObservable.add(() => {
        const now = performance.now(); times.push(now - previous); previous = now;
        if (times.length % 5 !== 0) return;
        const s = window.__pfs.snapshot(); draws.push(s.drawCalls); cpu.push(s.frameTimeMs); tris.push(scene.getActiveIndices()/3);
        if (s.gpuFrameTimeMs > 0) gpu.push(s.gpuFrameTimeMs);
        for (const key of Object.keys(passes)) if (s.gpuPassTimeMs?.[key] > 0) passes[key].push(s.gpuPassTimeMs[key]);
      });
      await new Promise(r => setTimeout(r, 6000));
      scene.onAfterRenderObservable.remove(observer);
      const stats = a => { a.sort((a,b)=>a-b); return { median: a[Math.floor(a.length/2)], p95: a[Math.floor(a.length*.95)] }; };
      const active = scene.getActiveMeshes();
      const top = active.data.slice(0,active.length).map(m => ({name:m.name, triangles:m.getTotalIndices()/3})).sort((a,b)=>b.triangles-a.triangles).slice(0,12);
      return { backend: window.__pfs.snapshot().backend ?? (engine.isWebGPU ? "webgpu" : "webgl"), adapter: engine.getInfo(), timerQuerySupported: !!engine.getCaps().timerQuery, frames: times.length, frameMs: stats(times), renderCpuMs: stats(cpu), gpuMs: gpu.length ? stats(gpu) : null, gpuPassMs: Object.fromEntries(Object.entries(passes).map(([k,v])=>[k,v.length ? stats(v) : null])), draws: stats(draws), triangles: stats(tris), vertices: scene.getTotalVertices(), resolution: [engine.getRenderWidth(), engine.getRenderHeight()], top, errors: window.__pfs.snapshot().errors };
    });
    const { profile } = await cdp.send("Profiler.stop");
    fs.writeFileSync(`artifacts/profiles/${label}-${backend}-${quality}-${name}.cpuprofile`, JSON.stringify(profile));
    await page.screenshot({path: `artifacts/profiles/${label}-${backend}-${quality}-${name}.png`});
    rows.push({name, ...data}); console.log(JSON.stringify(rows.at(-1)));
  }
  fs.writeFileSync(`artifacts/profiles/${label}-${backend}-${quality}.json`, JSON.stringify({software: process.env.SOFTWARE === "1", errors, external, rows}, null, 2));
  if (errors.length || external.length || rows.some(r => r.errors?.length || !r.frames || !r.backend.toLowerCase().includes(backend))) process.exitCode = 1;
} finally { await browser.close(); }
