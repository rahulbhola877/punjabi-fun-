// Render the four radio stations offline and measure them: node tools/radio.mjs [base] [seconds]
// Prints loudness, peak, how much of the time is silent and how many onsets a second each station has; writes
// tools/out/radio-<station>.wav so they can be listened to.
import { chromium } from "playwright";
import fs from "node:fs";
const base = process.argv.find((a) => a.startsWith("http")) ?? "http://localhost:4173/";
const secs = Number(process.argv.find((a, i) => i > 1 && /^\d+$/.test(a)) ?? 20);
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--enable-webgl"] });
const page = await browser.newPage();
await page.goto(`${base}?probe`, { waitUntil: "load", timeout: 300000 });
await page.waitForFunction(() => window.__pfs?.radioRender, null, { timeout: 300000 });
const out = new URL("./out/", import.meta.url).pathname;
function wav(samples, sr) {
  const b = Buffer.alloc(44 + samples.length * 2);
  b.write("RIFF", 0); b.writeUInt32LE(36 + samples.length * 2, 4); b.write("WAVEfmt ", 8); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22);
  b.writeUInt32LE(sr, 24); b.writeUInt32LE(sr * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write("data", 36); b.writeUInt32LE(samples.length * 2, 40);
  samples.forEach((v, i) => b.writeInt16LE(Math.max(-1, Math.min(1, v)) * 32767, 44 + i * 2));
  return b;
}
let bad = 0;
for (const st of ["bhangra", "purane", "gurbani", "talk"]) {
  const s = await page.evaluate(([st, secs]) => window.__pfs.radioRender(st, secs), [st, secs]);
  const sr = 22050, W = Math.round(sr * 0.05);
  let peak = 0, sum = 0, silent = 0, wins = 0, onsets = 0, prev = 0;
  for (let w = 0; w + W < s.length; w += W) {
    let e = 0;
    for (let i = w; i < w + W; i++) { const a = Math.abs(s[i]); peak = Math.max(peak, a); e += s[i] * s[i]; }
    const rms = Math.sqrt(e / W);
    sum += e; wins++;
    if (rms < 0.004) silent++;
    if (rms > prev * 2.2 && rms > 0.01) onsets++;
    prev = rms;
  }
  const rms = Math.sqrt(sum / (wins * W));
  fs.writeFileSync(`${out}radio-${st}.wav`, wav(s, sr));
  const ok = rms > 0.01 && peak < 0.99 && silent / wins < 0.25;
  if (!ok) bad++;
  console.log(`${st.padEnd(8)} rms ${rms.toFixed(3)} peak ${peak.toFixed(2)} silent ${(100 * silent / wins).toFixed(0)}% onsets/s ${(onsets / secs).toFixed(1)} ${ok ? "ok" : "CHECK"}`);
}
await browser.close();
process.exit(bad ? 1 : 0);
