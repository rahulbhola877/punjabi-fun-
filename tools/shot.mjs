// Quick visual check: node tools/shot.mjs <url-query> <out.png> [waitMs]
import { chromium } from "playwright";
const [, , query = "", out = "tools/out/shot.png", wait = "4000"] = process.argv;
const base = process.env.PFS_URL ?? "http://localhost:5173/";
const browser = await chromium.launch({
  executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--enable-webgl"],
});
const page = await browser.newPage({ viewport: { width: Number(process.env.W ?? 960), height: Number(process.env.H ?? 540) } });
const logs = [];
page.on("console", (m) => logs.push(`[${m.type()}] ${m.text()}`));
page.on("pageerror", (e) => logs.push(`[pageerror] ${e.message}`));
await page.goto(base + query, { waitUntil: "load" });
await page.waitForTimeout(Number(wait));
await page.screenshot({ path: out, timeout: 180000 });
console.log(logs.filter((l) => !l.includes("[vite]")).slice(0, 30).join("\n"));
await browser.close();
