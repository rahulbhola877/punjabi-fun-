// One trailer shot: node tools/trailer/shot.mjs <name> [preview]
// Renders tools/out/trailer/<name>/NNNN.jpg at 30 fps (game time stepped at 1/30 s) and <name>.json with the
// sounds the game made on each frame (doorbell, voice clips, fireworks), for the audio mix.
// `preview` renders small and keeps only the first, middle and last frames, to frame the camera.
import fs from "node:fs";
import { open, tick, shoot, framesDir, ease, lerp3, sleep } from "./lib.mjs";

const [name, mode] = process.argv.slice(2);
const preview = mode === "preview";
const base = "http://localhost:4173/";
const PI = Math.PI;

/** A camera moving from a to b (eye and target) over the shot, eased. */
const move = (eye0, eye1, at0, at1, fov = 0.8) => (t) => ({ eye: lerp3(eye0, eye1, ease(t)), at: lerp3(at0, at1, ease(t)), fov });
/** A slow orbit round p (radius r, height h) from angle a0 to a1, looking at p raised by lookH. */
const orbit = (p, r, h, a0, a1, lookH = 1.4, fov = 0.8) => (t) => {
  const a = a0 + (a1 - a0) * ease(t);
  return { eye: [p[0] + Math.cos(a) * r, h, p[1] + Math.sin(a) * r], at: [p[0], lookH, p[1]], fov };
};
const closeBook = async (page) => {
  for (let k = 0; k < 3; k++) { const b = page.locator('button:has-text("Theek ae")'); if (await b.count()) { await b.first().click().catch(() => {}); await sleep(500); } }
};
const place = (day, hour, x, z, yaw) => async ({ ev, page }) => {
  await ev(([day, hour, x, z, yaw]) => { if (day !== null) window.__pfs.day(day); window.__pfs.hour(hour); window.__pfs.teleport(x, z, yaw); window.__pfs.face(yaw); }, [day, hour, x, z, yaw]);
  await closeBook(page);
};

const SHOTS = {
  // Dawn: mist over the fields by the railway, the sun coming up.
  dawn: { frames: 150, setup: place(12, 6.7, -40, 531, 0), cam: move([-70, 2.2, 505], [-62, 4.5, 512], [-10, 3, 560], [-10, 4, 560], 0.85) },
  // The bazaar in the morning rush.
  bazaar: { frames: 150, setup: place(null, 10, 0, -40, PI), cam: move([0, 3.5, -72], [0, 3.2, -56], [0, 2, -20], [0, 1.8, -20], 0.9) },
  // The Bullet down the road, the game's own chase camera.
  ride: {
    frames: 180,
    setup: async ({ ev, page }) => {
      await ev(() => { window.__pfs.hour(16.5); window.__pfs.teleport(-60, -160, Math.PI / 2); });
      await tick(ev, 30, null);
      await ev(() => window.__pfs.driveAt("motorcycle", -60, -158, Math.PI / 2));
      await tick(ev, 20, null);
      await page.keyboard.down("KeyW");
      await tick(ev, 60, null);
    },
    cam: () => null,
    after: async ({ page }) => page.keyboard.up("KeyW"),
  },
  // Ring the neighbour's bell; the door opens and they come out to the gate.
  doorbell: {
    frames: 330,
    setup: place(null, 11, 73.5, -35.88, PI / 2),
    at: { 20: "KeyE" },
    // The host's "andar aao" stays up (hidden): answering it would send them back in.
    keepDialogue: true,
    cam: move([68.8, 1.9, -40.6], [70.4, 1.75, -39.6], [77.5, 1.3, -33.5], [76.4, 1.35, -35.2], 0.8),
  },
  // The goods train through the phatak, gates down.
  train: {
    frames: 180,
    setup: async ({ ev, page }) => {
      await place(null, 17.2, 8, 548, -PI / 2)({ ev, page });
      // The next eastbound run with its nose 90 m short of the crossing.
      await ev(() => { const now = window.__pfs.rail().time; let k = Math.ceil((now - 70) / 240); if (k % 2) k++; window.__pfs.timeShift(70 + k * 240 + 67 - now); });
    },
    cam: move([6, 1.4, 540.5], [4, 1.5, 542], [-25, 2.4, 560], [-4, 2.6, 560], 0.85),
  },
  // Diwali night: diyas on the walls, fireworks.
  diwali: {
    frames: 165, setup: place(3, 20, 111.5, -110.14, -PI / 2),
    cam: move([116.5, 1.3, -92], [116, 1.5, -98], [109, 9, -130], [109, 11, -132], 1.0),
    // Rockets over the street, where the camera looks (the game's own fly off in every direction).
    fx: Object.fromEntries([[6, 96, 34, -175], [34, 125, 40, -190], [58, 104, 30, -160], [84, 88, 38, -185], [108, 118, 33, -170], [130, 100, 42, -195], [150, 110, 30, -165]]
      .map(([f, x, y, z]) => [f, ({ ev }) => ev(([x, y, z]) => window.__pfs.firework(x, y, z), [x, y, z])])),
  },
  // Lohri bonfire in the gali.
  lohri: { frames: 135, setup: place(11, 19.3, 23, 350, PI), cam: orbit([23, 343], 6.5, 1.7, 0.75, 1.25, 1.3, 0.85) },
  // Teeyan: the swing under the neem at the chaupal.
  teeyan: { frames: 135, setup: place(37, 12, 28, 342, PI), cam: orbit([28.5, 330.5], 9, 2.0, 1.2, 1.7, 2.0, 0.85) },
  // Hola Mohalla day in the pind: everyone stops to ask after you.
  holi: { frames: 135, setup: place(20, 14, -12, 316, 0), cam: move([-13.2, 1.7, 311.5], [-13.6, 1.75, 312.6], [-8, 2, 330], [-8.6, 2, 330], 0.9) },
  // Baisakhi mela.
  mela: { frames: 135, setup: place(24, 12.5, -122, 365, 0), cam: move([-140, 3, 345], [-136, 3.4, 347], [-122, 4, 370], [-120, 4, 370], 0.95) },
  // Tape-ball cricket in the park: the batsman hits one.
  cricket: {
    frames: 150,
    setup: async ({ ev, page }) => {
      await place(null, 11, 133, -19, PI / 2)({ ev, page });
      await tick(ev, 40, null);
      await page.keyboard.down("KeyE"); await tick(ev, 1, null, false); await page.keyboard.up("KeyE");
      await tick(ev, 10, null, false);
      // "Haan, khedde haan": say yes to the game.
      await ev(() => [...document.querySelectorAll(".dialogue button")].find((b) => /khedde/i.test(b.textContent))?.click());
      await tick(ev, 50, null);
    },
    each: async ({ ev, page }) => {
      const c = await ev(() => window.__pfs.cricket());
      return c?.phase === "flight" && c.t >= c.flight - 0.05 ? "KeyQ" : null;
    },
    cam: move([129.5, 1.5, -23.8], [130.6, 1.5, -23.6], [142, 1.0, -18.5], [142, 1.0, -18.5], 0.8),
  },
  // Dusk: the factory chimneys at Focal Point.
  factory: { frames: 135, setup: place(null, 18.3, -470, -140, PI), cam: move([-455, 4.8, -150], [-460, 5.6, -146], [-500, 8, -120], [-500, 10, -120], 0.9) },
};

const shot = SHOTS[name];
if (!shot) { console.log("shots:", Object.keys(SHOTS).join(" ")); process.exit(1); }
// Two queues may list the same shot: the first to start it takes it.
const lock = new URL(`../out/trailer/${name}${preview ? "-preview" : ""}.lock`, import.meta.url).pathname;
if (fs.existsSync(lock)) { console.log(name, "taken by another queue"); process.exit(0); }
fs.writeFileSync(lock, String(process.pid));
const size = preview ? { width: 640, height: 360 } : undefined;
const { browser, page, ev, log } = await open(base, "", size);
const ctx = { ev, page };
await shot.setup(ctx);
await tick(ev, 45, shot.cam(0)); // let the place stream in and settle
await ev(() => window.__pfs.snapshot().audio.heard);
const dir = framesDir(preview ? `${name}-preview` : name);
const heard = [];
const keep = new Set([0, Math.floor(shot.frames / 2), shot.frames - 1]);
const t0 = Date.now();
let extra = 0;
for (let i = 0; i < shot.frames; i++) {
  // A key held down for just this frame (the bell, a swing).
  if (shot.fx?.[i]) await shot.fx[i](ctx);
  const key = shot.at?.[i] ?? (shot.each ? await shot.each(ctx) : null);
  if (key) { await page.keyboard.down(key); extra++; }
  await tick(ev, 1, shot.cam(i / (shot.frames - 1)), !shot.keepDialogue);
  if (key) await page.keyboard.up(key);
  const h = await ev(() => window.__pfs.snapshot().audio.heard);
  for (const e of h) heard.push([i, e]);
  if (!preview || keep.has(i)) await shoot(page, dir, i);
  if (i % 30 === 0) console.log(name, i, `${((Date.now() - t0) / (i + 1) / 1000).toFixed(1)}s/f`, preview ? JSON.stringify(await ev(() => window.__pfs.bellFolk())) : "");
}
if (shot.after) await shot.after(ctx);
fs.writeFileSync(`${dir}heard.json`, JSON.stringify({ heard, extra }));
console.log(name, "done; heard:", JSON.stringify(heard.filter(([, e]) => !e.startsWith("radio") && !e.startsWith("tv"))), "errors:", JSON.stringify(log.slice(0, 3)), JSON.stringify(await ev(() => window.__pfs.snapshot().errors?.slice?.(0, 3))));
await browser.close();
