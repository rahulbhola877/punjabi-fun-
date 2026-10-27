// YouTube thumbnails (1280×720) from trailer frames: node tools/trailer/thumbs.mjs → tools/out/trailer/thumb-<id>.png
// Needs tools/out/trailer/th-naka.jpg (the naka, cropped) and th-fw.jpg (Diwali rockets, cropped).
import { chromium } from "playwright";
import fs from "node:fs";
const fonts = new URL("../../node_modules/@fontsource/", import.meta.url).pathname;
const out = new URL("../out/trailer/", import.meta.url).pathname;
const b64 = (p) => fs.readFileSync(p).toString("base64");
const face = (file, w) => `@font-face{font-family:'Baloo';font-weight:${w};src:url(data:font/woff2;base64,${b64(fonts + file)}) format('woff2');}`;
const css = [700, 800].flatMap((w) => [face(`baloo-paaji-2/files/baloo-paaji-2-latin-${w}-normal.woff2`, w), face(`baloo-paaji-2/files/baloo-paaji-2-gurmukhi-${w}-normal.woff2`, w)]).join("") + `
html,body{margin:0;width:1280px;height:720px;overflow:hidden;background:#0d0a14;font-family:Baloo,sans-serif}
.fw{position:absolute;inset:0;background:url(data:image/jpeg;base64,${b64(out + "th-fw.jpg")}) center/cover;filter:saturate(1.4) brightness(.8)}
.shot{position:absolute;left:-10px;top:170px;width:880px;height:550px;background:url(data:image/jpeg;base64,${b64(out + "th-naka.jpg")}) 0 0/960px auto;
  -webkit-mask-image:linear-gradient(90deg,#000 66%,transparent 100%),linear-gradient(180deg,transparent 0,#000 14%);-webkit-mask-composite:source-in;filter:saturate(1.25) contrast(1.08)}
.bub{position:absolute;background:#fff;color:#1a1a1a;border-radius:22px;padding:10px 22px;font-weight:800;box-shadow:0 6px 0 #0006;line-height:1.05}
.bub:after{content:"";position:absolute;bottom:-18px;border:12px solid transparent;border-top:16px solid #fff}
.cop{left:24px;top:56px;font-size:60px;transform:rotate(-4deg)}.cop:after{left:150px}
.me{left:360px;top:150px;width:310px;font-size:38px;transform:rotate(3deg);background:#ffe082}.me:after{left:200px;border-top-color:#ffe082}
.txt{position:absolute;right:30px;top:44px;width:540px;text-align:right;color:#fff}
.big{font-size:124px;font-weight:800;line-height:.86;letter-spacing:2px;color:#ffca28;-webkit-text-stroke:5px #3e1d00;paint-order:stroke fill;text-shadow:0 8px 0 #3e1d00}
.mid{font-size:72px;font-weight:800;line-height:.95;-webkit-text-stroke:4px #1b0f2b;paint-order:stroke fill;text-shadow:0 6px 0 #1b0f2b}
.pa{font-size:60px;font-weight:700;color:#ffb74d;-webkit-text-stroke:3px #2a1400;paint-order:stroke fill;margin-top:6px}
.tag{display:inline-block;margin-top:18px;background:#e53935;color:#fff;font-size:34px;font-weight:800;padding:6px 18px;border-radius:12px;transform:rotate(-2deg);box-shadow:0 5px 0 #7f0000}
.logo{position:absolute;right:36px;bottom:26px;color:#ffe082;font-size:40px;font-weight:800;letter-spacing:3px;-webkit-text-stroke:2px #2a1400;paint-order:stroke fill}`;
const THUMBS = {
  // The one to lead with: the game's own name, Punjab up front.
  punjab: `<div class="txt"><div class="mid">OPEN WORLD</div><div class="big">PUNJAB</div><div class="pa">ਗੇੜੀ ਰੂਟ</div><div class="tag">FREE · PLAYS IN BROWSER</div></div>`,
  // The trend-bait one: GTA only as a plain-text question, no Rockstar look.
  gta: `<div class="txt"><div class="mid">GTA... BUT IN</div><div class="big">PUNJAB?!</div><div class="pa">ਗੇੜੀ ਰੂਟ</div><div class="tag">FREE · PLAYS IN BROWSER</div></div>`,
};
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
for (const [id, txt] of Object.entries(THUMBS)) {
  await page.setContent(`<!doctype html><meta charset="utf-8"><style>${css}</style><div class="fw"></div><div class="shot"></div>
    <div class="bub cop">KAAGAZ DIKHAO!</div><div class="bub me">Main Bhole da banda haan ji!</div>${txt}<div class="logo">GEDI ROUTE</div>`, { waitUntil: "load" });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: `${out}thumb-${id}.png` });
}
await browser.close();
console.log("thumbs:", Object.keys(THUMBS).join(" "));
