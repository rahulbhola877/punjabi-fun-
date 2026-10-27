// Where to film a gali: node tools/trailer/find-elders.mjs [x0,x1,z0,z1] → seated elders with people chatting near them, nearest groups first.
import { open, tick } from "./lib.mjs";
const { browser, ev } = await open("http://localhost:4173/", "", { width: 320, height: 180 });
await ev(() => window.__pfs.hour(17));
const found = new Map();
const [x0, x1, z0, z1] = (process.argv[2] ?? "40,160,-130,30").split(",").map(Number);
for (let x = x0; x <= x1; x += 30) for (let z = z0; z <= z1; z += 30) {
  await ev(([x, z]) => window.__pfs.teleport(x, z, 0), [x, z]);
  await tick(ev, 30, null);
  const ps = await ev(() => window.__pfs.snapshot().people);
  for (const p of ps) if (p.pose === "sit" || p.role === "chatter") found.set(p.id, p);
}
const all = [...found.values()];
const elders = all.filter((p) => p.pose === "sit");
const rows = elders.map((e) => ({ id: e.id, x: Math.round(e.x * 10) / 10, z: Math.round(e.z * 10) / 10, chat: all.filter((p) => p.role === "chatter" && Math.hypot(p.x - e.x, p.z - e.z) < 10).length }))
  .sort((a, b) => b.chat - a.chat);
console.log(JSON.stringify(rows.slice(0, 12)));
console.log("chatters", JSON.stringify(all.filter((p) => p.role === "chatter").map((p) => [p.id, Math.round(p.x), Math.round(p.z)])));
await browser.close();
