// Bank, ATM and post office: node tools/civic.mjs [base]
import { launch, snap, sleep } from "./pt-lib.mjs";
const base = process.argv[2] ?? "http://localhost:4173/";
const { browser, page, log } = await launch(`${base}?probe&gfx=low&hour=11`);
const ev = (f, ...a) => page.evaluate(f, ...a);
const out = new URL("./out/", import.meta.url).pathname;
const prompt = () => ev(() => window.__pfs.prompt?.());
try {
  await page.evaluate(() => localStorage.clear()); await page.reload();
  await page.waitForSelector("#title button", { timeout: 300000 });
  await page.keyboard.press("Enter");
  await page.waitForSelector("#title .looks button"); await page.keyboard.press("Enter");
  await page.waitForFunction(() => window.__pfs?.snapshot().state === "playing", null, { timeout: 300000 });
  await sleep(1500);
  for (const [name, x, z, yaw] of [["bank", 312.7, -4.6, Math.PI], ["atm", 324.5, -4.6, Math.PI], ["post", 387.7, -74.9, 0]]) {
    await ev(([x, z, yaw]) => { window.__pfs.teleport(x, z, yaw); window.__pfs.face(yaw); }, [x, z, yaw]);
    await sleep(3500);
    console.log(name, "at", JSON.stringify((await snap(page)).player && (({x,z}) => ({x: Math.round(x), z: Math.round(z)}))((await snap(page)).player)), "prompt:", await prompt());
    await page.screenshot({ path: out + `civic-${name}.png` });
    await page.keyboard.press("e");
    await sleep(1200);
    const txt = await page.evaluate(() => document.querySelector(".dialogue .txt")?.textContent ?? null);
    console.log(name, "dialogue:", txt);
    if (name === "bank") {
      // Deposit 5000, then all.
      await page.locator(".dialogue button", { hasText: "Deposit ₹5000" }).click(); await sleep(600);
      console.log("after deposit:", await page.evaluate(() => document.querySelector(".dialogue .txt")?.textContent));
      await page.locator(".dialogue button", { hasText: "Done" }).click(); await sleep(500);
    } else if (name === "atm") {
      await page.locator(".dialogue button", { hasText: "Withdraw ₹1000" }).click(); await sleep(500);
      await page.locator(".dialogue button", { hasText: "Done" }).click(); await sleep(500);
    } else {
      await page.screenshot({ path: out + "civic-post-letter.png" });
      await page.locator(".dialogue button").first().click(); await sleep(600);
    }
  }
  console.log("saved", JSON.stringify(await ev(() => { const s = JSON.parse(localStorage.getItem("pfs.save") ?? "{}"); return { money: s.money, bank: s.bank }; })));
} catch (e) { console.log("ERROR", String(e).slice(0, 300)); }
console.log("errors:", JSON.stringify(log.filter((l) => !/WebGPU|wasm|ArrayBuffer/.test(l)).slice(0, 4)));
await browser.close();
