// Evaluate an expression in the running game (title screen): node tools/evalpage.mjs '<js expr>' [query]
import { chromium } from "playwright";
const [, , expr, query = "?probe"] = process.argv;
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const page = await browser.newPage({ viewport: { width: 640, height: 360 } });
page.on("pageerror", (e) => console.log("pageerror", e.message));
await page.goto("http://localhost:5173/" + query, { waitUntil: "load", timeout: 300000 });
await page.waitForFunction(() => window.__pfs?.snapshot()?.state === "title", null, { timeout: 300000 });
console.log(JSON.stringify(await page.evaluate(expr), null, 1));
await browser.close();
