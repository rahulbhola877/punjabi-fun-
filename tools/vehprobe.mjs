import { launch, snap, waitFor, sleep } from "./pt-lib.mjs";
const { browser, page, log } = await launch(`http://localhost:5173/?probe&gfx=low`, { w: 480, h: 270 });
await page.waitForSelector("#title button", { timeout: 180000 });
await page.keyboard.press("Enter");
await page.waitForSelector("#title .looks button");
await page.keyboard.press("Enter");
await waitFor(page, (x) => x.state === "playing");
for (let i = 0; i < 25; i++) {
  const s = await snap(page);
  console.log(s.time.toFixed(2), s.vehicles.map((v) => `${v.id}:${v.x.toFixed(2)},${v.y.toFixed(2)},${v.z.toFixed(2)} yaw${v.yaw.toFixed(2)}`).join(" | "));
  await sleep(700);
}
console.log(log.slice(0, 5));
await browser.close();
