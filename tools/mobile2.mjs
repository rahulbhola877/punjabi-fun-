// Phone check for the V2 screens: node tools/mobile2.mjs [base] -- the chapter card, the match scoreboard, the day's book and a shop, at phone sizes
import { chromium } from "playwright";
const base = process.argv[2] ?? "http://localhost:4173/";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const out = new URL("./out/", import.meta.url).pathname;
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const problems = [];
async function run(name, w, h) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(`${base}?probe&gfx=low&hour=11`, { waitUntil: "load", timeout: 240000 });
  await page.waitForSelector("#title button", { timeout: 240000 });
  const tap = async (sel) => { const b = await page.locator(sel).first().boundingBox(); await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2); };
  await sleep(3500);
  await tap("#title button");
  await page.waitForSelector("#title .looks button", { timeout: 120000 });
  await tap("#title .looks button");
  await page.waitForFunction(() => window.__pfs?.snapshot().state === "playing", null, { timeout: 240000 });
  await sleep(1500);
  const fits = async (label, sel) => {
    const boxes = await page.locator(sel).evaluateAll((els) => els.map((e) => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height, t: (e.textContent ?? "").slice(0, 30) }; }));
    for (const b of boxes) if (b.w > 0 && (b.x < -1 || b.y < -1 || b.x + b.w > w + 1 || b.y + b.h > h + 1)) problems.push(`${name} ${label}: ${sel} sticks out ${JSON.stringify(b)}`);
    return boxes.length;
  };
  // 1. The chapter card (the objective when nothing else is on).
  await page.evaluate(() => { window.__pfs.stage(999); window.__pfs.poke("home", "bless", 0); });
  await sleep(2500);
  await page.screenshot({ path: out + `m2-${name}-chapter.png` });
  await fits("objective", ".obj, .objective");
  // 2. The match scoreboard: a cricket over.
  await page.evaluate(() => window.__pfs.teleport(133, -19, Math.PI / 2));
  await sleep(4000);
  const prompt = await page.evaluate(() => window.__pfs.prompt());
  const iBtn = page.locator(".tbtn.interact");
  if (await iBtn.count()) await tap(".tbtn.interact");
  await sleep(1200);
  await page.screenshot({ path: out + `m2-${name}-dialogue.png` });
  await fits("dialogue", ".dialogue, .panel");
  await tap(".dialogue .btn");
  await sleep(3500);
  await page.screenshot({ path: out + `m2-${name}-match.png` });
  await fits("match", ".job.match");
  console.log(name, "prompt:", prompt, "| match panel:", await page.locator(".job.match").count());
  // 3. The day's book (and its buttons).
  await page.evaluate(() => { window.__pfs.poke("flag", "x", true); window.__pfs.day(14); window.__pfs.hour(21.7); });
  await sleep(6000);
  await page.screenshot({ path: out + `m2-${name}-book.png` });
  await fits("book", ".panel");
  await fits("book buttons", ".panel button");
  console.log(name, "errors:", JSON.stringify(errors.slice(0, 3)));
  await ctx.close();
}
try {
  for (const d of (process.argv[3] ?? "land,port").split(",")) {
    if (d === "land") await run("phone-land", 844, 390);
    if (d === "port") await run("phone-port", 390, 844);
  }
} catch (e) { console.log("ERROR", String(e).slice(0, 400)); }
console.log("problems:", JSON.stringify(problems));
await browser.close();
