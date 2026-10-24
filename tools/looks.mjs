// Close looks at things that may read as blocks: node tools/looks.mjs [base]  -> tools/out/look-*.png
import { launch, sleep } from "./pt-lib.mjs";
const base = process.argv[2] ?? "http://localhost:4173/";
const q = process.env.Q ?? "high";
const { browser, page, log } = await launch(`${base}?probe&hour=10`);
await page.addInitScript((s) => localStorage.setItem("pfs.settings.v1", s), JSON.stringify({ quality: q, post: q !== "low", shadows: q === "low" ? "off" : "low", renderScale: 1 }));
await page.reload();
const ev = (f, ...a) => page.evaluate(f, ...a);
const out = new URL("./out/", import.meta.url).pathname;
const spots = JSON.parse(process.env.SPOTS ?? "null") ?? [
  ["wheat", -40, -372, 0], ["sugarcane", -40, -388, 3.14], ["paddy", -100, -340, 0], ["sarson", -100, -240, 0],
  ["fodder", -100, -178, 1.57], ["village", 0, 250, 0], ["colony", 60, -20, 1.57], ["dhaba", -12, -30, 3.14],
  ["fieldroad", 5, 480, 0], ["tree", 20, 130, 0],
];
try {
  const focused = (sel) => page.waitForFunction((q) => !!document.activeElement?.closest(q), sel, { timeout: 60000 });
  await page.waitForSelector("#title button", { timeout: 300000 });
  await focused("#title .menu"); await page.keyboard.press("Enter");
  await page.waitForSelector("#title .looks button"); await focused("#title .looks"); await page.keyboard.press("Enter");
  await page.waitForFunction(() => window.__pfs?.snapshot().state === "playing", null, { timeout: 300000 });
  await sleep(1500);
  for (const [name, x, z, yaw] of spots) {
    await ev(([x, z, yaw]) => { window.__pfs.teleport(x, z, yaw); window.__pfs.face(yaw); }, [x, z, yaw]);
    await sleep(3500);
    await page.screenshot({ path: out + `look-${name}.png` });
    const errs = await ev(() => window.__pfs.snapshot().errors);
    if (errs?.length) console.log(name, "ERRORS", JSON.stringify(errs).slice(0, 700));
  }
} catch (e) { console.log("ERROR", String(e).slice(0, 300)); }
console.log("errors:", JSON.stringify(log.filter((l) => !/WebGPU|wasm|ArrayBuffer/.test(l)).slice(0, 3)));
await browser.close();
