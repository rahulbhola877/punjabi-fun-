// City shop counters, goods and the bag: node tools/shopgoods.mjs [base]  (TRADE=lShawl picks which kind of shop)
// Walks up to a signed shop in Ludhiana/Nawan Shehar, opens its menu (shop_menu.png), buys goods,
// opens the bag (shop_bag.png) and gives a gift to the shopkeeper (shop_gift.png).
import { launch, snap, waitFor, sleep } from "./pt-lib.mjs";
const base = process.argv[2] ?? "http://localhost:4173/";
const { browser, page, log } = await launch(`${base}?probe&gfx=${process.env.GFX ?? "low"}`);
const focused = (sel) => page.waitForFunction((q) => !!document.activeElement?.closest(q), sel, { timeout: 60000 });
const ev = (f, ...a) => page.evaluate(f, ...a);
try {
  await page.waitForSelector("#title button", { timeout: 300000 });
  await focused("#title .menu"); await page.keyboard.press("Enter");
  await page.waitForSelector("#title .looks button"); await focused("#title .looks"); await page.keyboard.press("Enter");
  await waitFor(page, (x) => x.state === "playing", 300000);
  const shops = await ev(() => window.__pfs.cityShops());
  const c = shops.find((q) => q.trade === (process.env.TRADE ?? "lShawl")) ?? shops[0];
  console.log("shops", shops.length, "going to", JSON.stringify(c));
  // Stand at the counter, facing the shop; camera behind.
  await ev((q) => { window.__pfs.teleport(q.cx + Math.sin(q.yaw) * 0.6, q.cz + Math.cos(q.yaw) * 0.6, q.yaw + Math.PI); window.__pfs.face(q.yaw + Math.PI); }, c);
  await sleep(6000);
  let s = await snap(page);
  console.log("prompt", await ev(() => window.__pfs.prompt()), "fps", s.fps?.toFixed(1), "draws", s.drawCalls, "activeTris", s.activeTris);
  await page.screenshot({ path: "tools/out/shop_counter.png", timeout: 180000 });
  await page.keyboard.press("e");
  await sleep(1500);
  await page.screenshot({ path: "tools/out/shop_menu.png", timeout: 180000 });
  await page.keyboard.press("Escape");
  await sleep(800);
  for (const id of ["shawl", "atta", "biscuit"]) console.log("buy", id, await ev((i) => window.__pfs.buy(i), id));
  console.log("bag", JSON.stringify(await ev(() => window.__pfs.bag())));
  await sleep(500);
  await page.keyboard.press("b");
  await sleep(1200);
  await page.screenshot({ path: "tools/out/shop_bag.png", timeout: 180000 });
  // Pick the first entry (the shawl): give it to the keeper.
  await page.keyboard.press("Enter");
  await sleep(1200);
  s = await snap(page);
  await page.screenshot({ path: "tools/out/shop_gift.png", timeout: 180000 });
  console.log("after gift bag", JSON.stringify(await ev(() => window.__pfs.bag())), "bubbles", JSON.stringify(s.bubbles), "toasts", JSON.stringify(s.toasts));
  // From the side along the footpath: the keeper should be behind the counter.
  await ev((q) => { const x = q.cx + Math.cos(q.yaw) * 1.3 + Math.sin(q.yaw) * 1.2, z = q.cz - Math.sin(q.yaw) * 1.3 + Math.cos(q.yaw) * 1.2;
    window.__pfs.teleport(x, z, q.yaw + Math.PI); window.__pfs.face(q.yaw + Math.PI); }, c);
  await sleep(3000);
  await page.screenshot({ path: "tools/out/shop_side.png", timeout: 180000 });
  const k = (await snap(page)).people.find((q) => q.id === c.keeper);
  console.log("keeper", JSON.stringify(k), "player", JSON.stringify((await snap(page)).player ?? null), "home", c.x.toFixed(1), c.z.toFixed(1));
  console.log("errors", JSON.stringify(s.errors));
} catch (e) { console.log("ERROR", String(e)); }
console.log(log.filter((l) => !l.includes("WebGPU")).slice(0, 8).join("\n"));
await browser.close();
