// The bell: node tools/doorbell.mjs [base]  -- ring a plain house's bell and a family's, watch the door open and someone come out
import { launch, snap, sleep } from "./pt-lib.mjs";
const base = process.argv[2] ?? "http://localhost:4173/";
const { browser, page, log } = await launch(`${base}?probe&gfx=low&hour=11`);
const ev = (f, ...a) => page.evaluate(f, ...a);
const out = new URL("./out/", import.meta.url).pathname;
// [name, bell x, bell z, house rot]
const heard = [];
const houses = [["plain", 66.5, -11.39, Math.PI / 2], ["family", 111.5, -110.14, Math.PI / 2], ["neighbour", 73.5, -35.88, -Math.PI / 2]];
try {
  await page.evaluate(() => localStorage.clear()); await page.reload();
  await page.waitForSelector("#title button", { timeout: 300000 });
  await page.keyboard.press("Enter");
  await page.waitForSelector("#title .looks button"); await page.keyboard.press("Enter");
  await page.waitForFunction(() => window.__pfs?.snapshot().state === "playing", null, { timeout: 300000 });
  await sleep(1500);
  for (const [name, x, z, rot] of houses) {
    const yaw = Math.atan2(-Math.sin(rot), -Math.cos(rot));
    await ev(([x, z, yaw]) => { window.__pfs.teleport(x, z, yaw); window.__pfs.face(yaw); }, [x, z, yaw]);
    await sleep(3000);
    console.log(name, "prompt:", await ev(() => window.__pfs.prompt?.()));
    await page.keyboard.press("e");
    for (let i = 0; i < 9; i++) {
      await sleep(1500);
      const s = await snap(page);
      const bell = (await ev(() => window.__pfs.bellFolk())).map((p) => `${p.name}@${p.x},${p.z}${p.known ? "*" : ""}`);void 0;const bell2 = s.people.filter((p) => p.id.startsWith("bell_")).map((p) => `${p.id}@${p.x.toFixed(1)},${p.z.toFixed(1)}`);
      if (i === 3 || i === 6) await page.screenshot({ path: out + `bell-${name}-${i}.png` });
      heard.push(...(s.audio?.heard ?? []));
      console.log(`  t=${(i + 1) * 1.5}s`, bell.join(" ") || bell2.join(" ") || "-", JSON.stringify(s.toasts.slice(-1)), JSON.stringify(s.bubbles ?? []).slice(0, 120));
    }
    await sleep(12000);
  }
  console.log("heard", JSON.stringify(heard.filter((h) => h === "doorbell").length), "voices:", JSON.stringify(heard.filter((h) => h.startsWith("v:"))));
} catch (e) { console.log("ERROR", String(e).slice(0, 300)); }
console.log("errors:", JSON.stringify(log.filter((l) => !/WebGPU|wasm|ArrayBuffer/.test(l)).slice(0, 4)));
await browser.close();
