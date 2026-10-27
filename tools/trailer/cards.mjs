// Title cards for the trailer: node tools/trailer/cards.mjs → tools/out/trailer/cards/<id>.png (1280×720)
import { chromium } from "playwright";
import fs from "node:fs";
const fonts = new URL("../../node_modules/@fontsource/", import.meta.url).pathname;
const out = new URL("../out/trailer/cards/", import.meta.url).pathname;
fs.mkdirSync(out, { recursive: true });
const face = (fam, file, w) => `@font-face{font-family:'${fam}';font-weight:${w};src:url(data:font/woff2;base64,${fs.readFileSync(fonts + file).toString("base64")}) format('woff2');}`;
const css = [
  ...[500, 700, 800].flatMap((w) => [face("Baloo", `baloo-paaji-2/files/baloo-paaji-2-latin-${w}-normal.woff2`, w), face("Baloo", `baloo-paaji-2/files/baloo-paaji-2-gurmukhi-${w}-normal.woff2`, w)]),
].join("") + `
html,body{margin:0;width:1280px;height:720px;background:#000;color:#f6ead2;font-family:Baloo,sans-serif;}
.c{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;}
.pa{font-size:46px;font-weight:600;color:#ffb74d;letter-spacing:1px;}
.en{font-size:58px;font-weight:700;letter-spacing:2px;}
.sm{font-size:30px;font-weight:500;color:#cdbb9c;letter-spacing:6px;text-transform:uppercase;margin-top:6px;}
.logo{font-size:132px;font-weight:800;letter-spacing:6px;line-height:1;background:linear-gradient(#ffe082,#ff8f00);-webkit-background-clip:text;color:transparent;}
.logopa{font-size:84px;font-weight:700;color:#ffb74d;margin-top:8px;}
.tag{font-size:30px;font-weight:500;color:#e8d9bd;margin-top:28px;letter-spacing:1px;}
.url{font-size:26px;font-weight:500;color:#9e9e9e;margin-top:18px;letter-spacing:2px;}
.rule{width:120px;height:3px;background:#ff8f00;margin:22px 0;}`;
const CARDS = {
  place: `<div class="pa">ਰੰਗਗੜ੍ਹ, ਪੰਜਾਬ</div><div class="rule"></div><div class="sm">Ranggarh, Punjab</div>`,
  gali: `<div class="en">Every gali has a story.</div><div class="sm">bazaar · pind · city · G.T. Road</div>`,
  bell: `<div class="en">Ring a bell.</div><div class="en" style="color:#ffb74d">Someone will answer.</div>`,
  year: `<div class="en">One year. Six festivals.</div><div class="sm">Diwali · Lohri · Baisakhi · Teeyan</div>`,
  logo: `<div class="logo">GEDI ROUTE</div><div class="logopa">ਗੇੜੀ ਰੂਟ</div><div class="tag">Take a gedi round Ranggarh.</div><div class="url">punjabi-fun.vercel.app</div>`,
};
// Lower thirds: transparent, laid over a shot.
const SUBS = {
  "sub-jaggi": `<div class="sub"><div class="who">Jaggi</div><div class="pa2">ਸਤਿ ਸ੍ਰੀ ਅਕਾਲ ਜੀ! ਤੁਸੀਂ ਠੀਕ ਹੋ?</div><div class="en2">Sat sri akal ji! Are you well?</div></div>`,
  "sub-rok": `<div class="sub"><div class="who">Havaldar</div><div class="pa2">ਗੱਡੀ ਰੋਕ! ਸਾਈਡ ਤੇ ਲਾ!</div><div class="en2">Stop right there! Pull over!</div></div>`,
  "sub-papers": `<div class="sub"><div class="who">Havaldar</div><div class="pa2">ਕਾਗ਼ਜ਼ ਦਿਖਾਓ — ਲਾਇਸੈਂਸ, RC, ਇੰਸ਼ੋਰੈਂਸ, ਪਲੂਸ਼ਨ। ਤੇ ਹੈਲਮਟ ਕਿੱਥੇ ਏ?</div><div class="en2">Papers — licence, RC, insurance, pollution. And where's your helmet?</div></div>`,
  "sub-bhola": `<div class="sub"><div class="who">Jaggi</div><div class="pa2">ਮੈਂ ਭੋਲੇ ਦਾ ਬੰਦਾ ਹਾਂ, ਜੀ!</div><div class="en2">I'm Bhola's man, ji!</div></div>`,
  "sub-rajma": `<div class="sub"><div class="who">Havaldar</div><div class="pa2">ਭੋਲੇ ਦਾ? ਓਹ, ਢਾਬੇ ਵਾਲਾ! ਜਾ ਜਾ, ਤੇ ਰਾਜਮਾਂ ਭੇਜ ਦੇਈਂ!</div><div class="en2">Bhola's? Oh, the dhaba guy! Off you go — and send some rajma!</div></div>`,
  "sub-kaun": `<div class="sub"><div class="who">Havaldar</div><div class="pa2">ਭੋਲਾ ਕੌਣ? ਕਾਗ਼ਜ਼ ਦਿਖਾ!</div><div class="en2">Who's Bhola? Papers!</div></div>`,
  "sub-gossip": `<div class="sub"><div class="who">Teeyan di gossip</div><div class="pa2">ਪਤਾ ਏ? ਗਿੱਲਾਂ ਦੀ ਨੂੰਹ ਕੈਨੇਡਾ ਚਲੀ ਗਈ, ਤੇ ਮੁੰਡਾ ਏਥੇ ਹੀ ਰਹਿ ਗਿਆ!</div><div class="en2">Heard? The Gills' bahu went to Canada — and left the son behind!</div></div>`,
  "sub-chakka": `<div class="sub"><div class="who">Gali de munde</div><div class="pa2">ਛੱਕਾ! ਗੇਂਦ ਆਂਟੀ ਜੀ ਦੇ ਛੱਜੇ ਤੇ!</div><div class="en2">SIX! The ball's on aunty ji's chhajja!</div></div>`,
  "sub-aunty": `<div class="sub"><div class="who">Sharma aunty</div><div class="pa2">ਸਤਿ ਸ੍ਰੀ ਅਕਾਲ ਜੀ! ਅੱਜ ਬੜੇ ਦਿਨਾਂ ਬਾਅਦ ਚੱਕਰ ਲਾਇਆ ਏ!</div><div class="en2">Sat sri akal ji! You've come round after so long!</div></div>`,
};
const subCss = `html,body{background:transparent!important}.sub{position:absolute;left:0;right:0;bottom:46px;text-align:center;text-shadow:0 2px 8px #000,0 0 3px #000;}
.who{font-size:22px;font-weight:700;color:#ffb74d;letter-spacing:3px;text-transform:uppercase}.pa2{font-size:36px;font-weight:600;color:#fff}.en2{font-size:26px;font-weight:500;color:#e8d9bd}`;
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
for (const [id, body] of Object.entries(CARDS)) {
  await page.setContent(`<!doctype html><meta charset="utf-8"><style>${css}</style><div class="c">${body}</div>`, { waitUntil: "load" });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: `${out}${id}.png` });
}
for (const [id, body] of Object.entries(SUBS)) {
  await page.setContent(`<!doctype html><meta charset="utf-8"><style>${css}${subCss}</style>${body}`, { waitUntil: "load" });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: `${out}${id}.png`, omitBackground: true });
}
await browser.close();
console.log("cards:", Object.keys(CARDS).join(" "));
