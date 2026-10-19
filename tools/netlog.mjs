// List non-200 / unexpected network requests while the game loads a view (debug).
import { chromium } from "playwright";
const [, , query = "?probe"] = process.argv;
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const page = await browser.newPage({ viewport: { width: 640, height: 360 } });
page.on("response", (r) => { if (r.status() >= 300) console.log(r.status(), r.url()); });
page.on("requestfailed", (r) => console.log("FAILED", r.url()));
await page.goto("http://localhost:5173/" + query, { waitUntil: "load", timeout: 300000 });
await page.waitForFunction(() => window.__pfs?.snapshot()?.state === "title", null, { timeout: 300000 });
await page.waitForTimeout(20000);
await browser.close();
