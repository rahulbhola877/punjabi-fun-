import { DistrictControls } from "./DistrictControls";
import { ForegroundFrameClock, forEachFrameSubstep } from "./frameSubsteps";
import { canWalkPixel, collectPixelLanterns, HOUSES, isPixelWater, LANTERNS, normalizePixelProgress, PIXEL_TREES, PIXEL_WORLD, type PixelProgress } from "./pixelMap";

const TILE = 16, WIDTH = 384, HEIGHT = 216;
const center = (n: number): number => Math.round(n * TILE);

/**
 * An independent, authored pixel-art destination. The caller pauses its own
 * render loop while it is open; this world owns only its canvas, animation
 * frame and input listeners. Returning disposes all of them before onExit.
 */
export function openPixelWorld(parent: HTMLElement, onExit: () => void, options: Partial<PixelProgress> & { onProgress?: (progress: PixelProgress) => void } = {}): { dispose: () => void } {
  const overlay = document.createElement("div");
  overlay.dataset.pixelWorld = "";
  overlay.setAttribute("role", "region");
  overlay.setAttribute("aria-label", "Lantern Valley pixel world");
  Object.assign(overlay.style, { position: "fixed", inset: "0", zIndex: "10000", background: "#182b38", overflow: "hidden", color: "#fff6cf", fontFamily: "system-ui, sans-serif", touchAction: "none", pointerEvents: "auto" });

  const canvas = document.createElement("canvas");
  canvas.width = WIDTH; canvas.height = HEIGHT;
  canvas.setAttribute("aria-label", "A top-down pixel landscape with a river, village and shrine");
  Object.assign(canvas.style, { position: "absolute", left: "50%", top: "50%", transform: "translate(-50%, -50%)", width: "min(100vw, 177.78vh)", height: "min(100vh, 56.25vw)", imageRendering: "pixelated", background: "#436b56" });
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not create the Lantern Valley canvas");
  ctx.imageSmoothingEnabled = false;
  overlay.appendChild(canvas);

  const top = document.createElement("div");
  Object.assign(top.style, { position: "absolute", top: "max(10px, env(safe-area-inset-top))", left: "12px", right: "12px", display: "flex", justifyContent: "space-between", alignItems: "start", gap: "8px", pointerEvents: "none" });
  const status = document.createElement("div");
  status.dataset.pixelStatus = "";
  Object.assign(status.style, { background: "rgba(27,40,53,.88)", border: "2px solid #edcb81", borderRadius: "8px", padding: "7px 11px", fontSize: "14px", lineHeight: "1.35", maxWidth: "min(68vw, 420px)", boxShadow: "0 3px #263334" });
  status.setAttribute("aria-live", "polite");
  const back = document.createElement("button");
  back.type = "button"; back.dataset.pixelReturn = ""; back.textContent = "Return to Ranggarh";
  Object.assign(back.style, { pointerEvents: "auto", border: "2px solid #edcb81", borderRadius: "7px", padding: "8px 10px", color: "#fff6cf", background: "#624357", cursor: "pointer", fontWeight: "700" });
  top.append(status, back); overlay.appendChild(top);

  // On-screen directions also work with a mouse; the main game's controls are
  // kept isolated while the parent loop is paused.
  const controls = document.createElement("div");
  Object.assign(controls.style, { position: "absolute", left: "12px", bottom: "max(12px, env(safe-area-inset-bottom))", display: "grid", gridTemplateColumns: "repeat(3, 44px)", gap: "3px", opacity: "0.88" });
  const held = new Set<string>();
  const abort = new AbortController();
  const signal = abort.signal;
  const control = (label: string, code: string, column: string, row: string): void => {
    const b = document.createElement("button");
    b.type = "button"; b.textContent = label; b.setAttribute("aria-label", `Move ${code}`);
    Object.assign(b.style, { gridColumn: column, gridRow: row, width: "44px", height: "44px", color: "#fff6cf", background: "#354b58", border: "2px solid #edcb81", borderRadius: "7px", fontSize: "20px", touchAction: "none" });
    b.addEventListener("pointerdown", (e) => { e.preventDefault(); held.add(code); b.setPointerCapture(e.pointerId); }, { signal });
    for (const name of ["pointerup", "pointercancel", "lostpointercapture"] as const) b.addEventListener(name, () => held.delete(code), { signal });
    controls.appendChild(b);
  };
  control("▲", "up", "2", "1"); control("◀", "left", "1", "2"); control("▼", "down", "2", "2"); control("▶", "right", "3", "2");
  overlay.appendChild(controls);
  const action = document.createElement("button");
  action.type = "button"; action.textContent = "Interact"; action.dataset.pixelInteract = "";
  Object.assign(action.style, { position: "absolute", right: "12px", bottom: "max(18px, env(safe-area-inset-bottom))", border: "2px solid #edcb81", borderRadius: "8px", padding: "12px", color: "#fff6cf", background: "#624357", fontWeight: "700", touchAction: "none" });
  overlay.appendChild(action);
  parent.appendChild(overlay);

  const saved = normalizePixelProgress(options);
  const found = new Set<number>(saved.found);
  const player = { ...PIXEL_WORLD.start, facing: "down" };
  let completed = saved.completed, closed = false, frame = 0;
  let previous: number | undefined;
  const clock = new ForegroundFrameClock();
  document.addEventListener("visibilitychange", () => clock.interrupt(), { signal });
  window.addEventListener("blur", () => clock.interrupt(), { signal });
  let notice = completed ? "The shrine is lit. Explore or return to Ranggarh." : found.size === LANTERNS.length ? "All five lights found! Visit the shrine in the north." : "Find five lanterns, then visit the shrine.";
  const saveProgress = (): void => options.onProgress?.({ found: [...found].sort((a, b) => a - b), completed });
  const updateStatus = (): void => {
    status.textContent = `Lantern Valley · ${found.size}/${LANTERNS.length} lights\n${districtInput.hint(notice)}`;
    status.style.whiteSpace = "pre-line";
    overlay.dataset.pixelLanterns = String(found.size);
    overlay.dataset.pixelCompleted = String(completed);
  };
  const exit = (): void => {
    if (closed) return;
    closed = true; districtInput.dispose(); held.clear(); abort.abort(); cancelAnimationFrame(frame); overlay.remove(); onExit();
  };
  const interact = (): void => {
    if(districtInput.isPaused) return;
    if (Math.hypot(player.x - PIXEL_WORLD.portal.x, player.y - PIXEL_WORLD.portal.y) < 1.7) { exit(); return; }
    if (Math.hypot(player.x - PIXEL_WORLD.shrine.x, player.y - PIXEL_WORLD.shrine.y) < 2.2) {
      if (found.size === LANTERNS.length) { if (!completed) { completed = true; saveProgress(); } notice = "The shrine is lit! The valley is glowing again."; }
      else notice = `The shrine needs ${LANTERNS.length - found.size} more lights.`;
    } else notice = "Walk into lanterns to collect them. E at the shrine or return portal.";
    updateStatus();
  };
  back.addEventListener("click", exit, { signal });
  action.addEventListener("click", interact, { signal });
  const districtInput = new DistrictControls(overlay,canvas,held,interact,exit,false);

  const terrain = document.createElement("canvas");
  terrain.width = PIXEL_WORLD.width * TILE; terrain.height = PIXEL_WORLD.height * TILE;
  const land = terrain.getContext("2d")!; land.imageSmoothingEnabled = false;
  const rect = (c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string): void => { c.fillStyle = color; c.fillRect(Math.round(x), Math.round(y), w, h); };
  const hash = (x: number, y: number): number => ((Math.imul(x + 41, 92837111) ^ Math.imul(y + 97, 689287499)) >>> 0) / 4294967296;
  for (let y = 0; y < PIXEL_WORLD.height; y++) for (let x = 0; x < PIXEL_WORLD.width; x++) {
    const n = hash(x, y), meadow = x < 20, color = meadow ? (n < 0.33 ? "#76ad78" : n < 0.66 ? "#7eb781" : "#86be87") : (n < 0.33 ? "#719f75" : n < 0.66 ? "#79a77c" : "#80af7f");
    rect(land, x * TILE, y * TILE, TILE, TILE, color);
    if (n > 0.66) { rect(land, x * TILE + 3, y * TILE + 10, 2, 2, "#5e986b"); rect(land, x * TILE + 11, y * TILE + 4, 1, 2, "#a2cc8b"); }
    if (meadow && y < 14 && n > 0.82) { rect(land, x * TILE + 8, y * TILE + 7, 2, 2, "#f3d385"); rect(land, x * TILE + 9, y * TILE + 9, 1, 2, "#5d9463"); }
  }
  // Hand-laid paths bind the bridge, village, shrine and return portal.
  land.strokeStyle = "#d2be8c"; land.lineWidth = 15; land.lineJoin = "round"; land.lineCap = "round";
  const road = (points: ReadonlyArray<readonly [number, number]>): void => { land.beginPath(); points.forEach(([x, y], i) => i ? land.lineTo(center(x), center(y)) : land.moveTo(center(x), center(y))); land.stroke(); };
  road([[5.5, 26.5], [12, 26], [21, 25.5], [26, 25], [34, 25], [43, 24], [43, 19], [40, 18], [34, 16], [26, 15], [21, 14.5], [16, 14], [8, 14], [8, 8]]);
  road([[26, 15], [27, 10], [31, 5], [36.5, 3.5]]);
  for (let y = 0; y < PIXEL_WORLD.height; y++) for (let x = 0; x < PIXEL_WORLD.width; x++) {
    if (isPixelWater(x, y)) {
      const n = hash(x + 9, y), water = n > 0.5 ? "#4896a7" : "#428b9f";
      rect(land, x * TILE, y * TILE, TILE, TILE, water);
      rect(land, x * TILE + 2, y * TILE + 4 + (x % 3), 6, 1, "#86c5c2");
      if (n > 0.45) rect(land, x * TILE + 9, y * TILE + 11, 4, 1, "#6fb4b8");
    }
  }
  for (const y of [14, 25]) {
    rect(land, 20 * TILE, y * TILE, 3 * TILE, 2 * TILE, "#aa7553");
    for (let x = 20 * TILE; x < 23 * TILE; x += 6) rect(land, x, y * TILE + 2, 1, 2 * TILE - 4, "#775442");
    rect(land, 20 * TILE, y * TILE, 3 * TILE, 2, "#e4c18b"); rect(land, 20 * TILE, (y + 2) * TILE - 2, 3 * TILE, 2, "#e4c18b");
  }

  const drawTree = (x: number, y: number): void => {
    const px = center(x + 0.5), py = center(y + 0.72);
    rect(ctx, px - 7, py + 1, 16, 3, "#507d5d");
    rect(ctx, px - 2, py - 9, 5, 11, "#765343"); rect(ctx, px, py - 8, 2, 8, "#a97e59");
    rect(ctx, px - 9, py - 15, 18, 8, "#366f54"); rect(ctx, px - 7, py - 20, 14, 7, "#417e58");
    rect(ctx, px - 4, py - 23, 8, 4, "#4c9062"); rect(ctx, px - 8, py - 16, 4, 3, "#68a96a"); rect(ctx, px + 1, py - 20, 4, 3, "#7cba76");
  };
  const drawHouse = (h: typeof HOUSES[number]): void => {
    const x = h.x * TILE, y = h.y * TILE;
    rect(ctx, x - 2, y + 9, h.w * TILE + 4, h.h * TILE - 7, "#5b5550");
    rect(ctx, x, y + 8, h.w * TILE, h.h * TILE - 8, h.color);
    rect(ctx, x - 4, y + 5, h.w * TILE + 8, 8, "#634753"); rect(ctx, x, y, h.w * TILE, 6, "#9a5861");
    for (const wx of [x + 8, x + h.w * TILE - 17]) { rect(ctx, wx, y + 18, 9, 9, "#534f52"); rect(ctx, wx + 2, y + 20, 5, 5, "#99d2cd"); }
    rect(ctx, x + h.w * TILE / 2 - 5, y + h.h * TILE - 17, 10, 17, "#675143"); rect(ctx, x + h.w * TILE / 2 + 2, y + h.h * TILE - 9, 1, 2, "#f0d790");
  };
  const drawPortal = (): void => {
    const x = center(PIXEL_WORLD.portal.x), y = center(PIXEL_WORLD.portal.y);
    rect(ctx, x - 11, y + 3, 23, 4, "#52765b"); rect(ctx, x - 8, y - 16, 17, 20, "#6e668b"); rect(ctx, x - 5, y - 13, 11, 15, "#74d4cd");
    rect(ctx, x - 3, y - 11, 2, 9, "#bef6db"); rect(ctx, x - 10, y - 18, 21, 3, "#c6b7d5");
  };
  const drawShrine = (): void => {
    const x = center(PIXEL_WORLD.shrine.x), y = center(PIXEL_WORLD.shrine.y);
    rect(ctx, x - 12, y, 25, 5, "#63735d"); rect(ctx, x - 10, y - 4, 21, 5, "#ddcf9e");
    rect(ctx, x - 6, y - 15, 13, 11, "#8b6d72"); rect(ctx, x - 4, y - 18, 9, 4, "#f2d28b");
    rect(ctx, x - 2, y - 12, 5, 7, completed ? "#fff1a9" : "#60778b");
  };
  const drawLantern = (i: number): void => {
    if (found.has(i)) return;
    const p = LANTERNS[i]!, x = center(p.x), y = center(p.y);
    rect(ctx, x - 5, y - 7, 11, 10, "#a16c62"); rect(ctx, x - 3, y - 5, 7, 6, "#ffe99a"); rect(ctx, x - 1, y - 9, 3, 2, "#fff8d2");
  };
  const drawPlayer = (): void => {
    const x = center(player.x), y = center(player.y);
    rect(ctx, x - 5, y + 2, 11, 3, "#547c5d");
    rect(ctx, x - 3, y - 5, 7, 8, "#395a78"); rect(ctx, x - 4, y - 8, 9, 4, "#dba879");
    rect(ctx, x - 4, y - 11, 9, 4, "#8f464f"); rect(ctx, x - 2, y - 13, 5, 2, "#c15b62");
    rect(ctx, x - 3, y + 2, 3, 3, "#443e47"); rect(ctx, x + 2, y + 2, 3, 3, "#443e47");
  };
  const render = (): void => {
    const camX = Math.max(0, Math.min(terrain.width - WIDTH, center(player.x) - WIDTH / 2));
    const camY = Math.max(0, Math.min(terrain.height - HEIGHT, center(player.y) - HEIGHT / 2));
    ctx.clearRect(0, 0, WIDTH, HEIGHT); ctx.save(); ctx.translate(-camX, -camY); ctx.drawImage(terrain, 0, 0);
    const objects: Array<{ y: number; draw: () => void }> = [
      ...PIXEL_TREES.map(([x, y]) => ({ y: y + 0.72, draw: () => drawTree(x, y) })),
      ...HOUSES.map((h) => ({ y: h.y + h.h, draw: () => drawHouse(h) })),
      ...LANTERNS.map((p, i) => ({ y: p.y, draw: () => drawLantern(i) })),
      { y: PIXEL_WORLD.portal.y, draw: drawPortal }, { y: PIXEL_WORLD.shrine.y, draw: drawShrine }, { y: player.y, draw: drawPlayer },
    ];
    objects.sort((a, b) => a.y - b.y).forEach((o) => o.draw());
    ctx.restore();
  };
  const tick = (now: number): void => {
    if (closed) return;
    const rawDt = previous === undefined ? 0 : (now - previous) / 1000; previous = now;
    const input = districtInput.read(clock.preview(rawDt, districtInput.isPaused || document.hidden)); if (closed) return;
    const dt = clock.read(rawDt, input.paused), dx = input.dx, dy = -input.dz, length = Math.hypot(dx, dy);
    if (length && dt > 0) {
      const speed = input.running ? 5.5 : 3.3;
      let collected = false;
      forEachFrameSubstep(dt, step => {
        const mx = dx / length * step * speed, my = dy / length * step * speed;
        if (canWalkPixel(player.x + mx, player.y)) player.x += mx;
        if (canWalkPixel(player.x, player.y + my)) player.y += my;
        // Check the traversed route, so a lantern crossed during a slow frame
        // is collected even when the final position is beyond its reach.
        for (const i of collectPixelLanterns(player.x, player.y, found)) { found.add(i); collected = true; }
      });
      player.facing = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : (dy > 0 ? "down" : "up");
      if (collected) {
        saveProgress(); notice = found.size === LANTERNS.length ? "All five lights found! Visit the shrine in the north." : "A lantern found. Explore the valley for the rest."; updateStatus();
      }
    }
    overlay.dataset.pixelX = player.x.toFixed(2);
    overlay.dataset.pixelY = player.y.toFixed(2);
    render(); frame = requestAnimationFrame(tick);
  };
  updateStatus(); render(); frame = requestAnimationFrame(tick);
  return { dispose: exit };
}
