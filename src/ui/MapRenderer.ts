import { BUILDINGS, COURTYARD, LANE_W, ROAD_RECTS, SIDEWALK_RECTS, footprint, type Rect } from "../world/layout";

export interface MapMarker { x: number; z: number; color: string; label?: string; kind: "objective" | "job" | "vehicle" | "contact" | "shop" }

const USE_COLOR: Record<string, string> = {
  dhaba: "#d35400", workshop: "#2e6da4", cycle: "#c9a227", fruit: "#6a9a2c", tailor: "#7a5a8a", house: "#b9a68b",
};

/**
 * Draws the district map (north up) into a 2D canvas. The same routine
 * serves the circular minimap (centred on the player) and the full map.
 */
export function drawMap(
  c: HTMLCanvasElement,
  view: { cx: number; cz: number; scale: number; rotate?: number },
  player: { x: number; z: number; yaw: number },
  markers: MapMarker[],
  route: Array<{ x: number; z: number }>,
  labels: boolean,
): void {
  const ctx = c.getContext("2d")!;
  const W = c.width, H = c.height;
  const tx = (x: number) => W / 2 + (x - view.cx) * view.scale;
  const tz = (z: number) => H / 2 - (z - view.cz) * view.scale;
  ctx.save();
  ctx.fillStyle = "#cdb48c";
  ctx.fillRect(0, 0, W, H);
  const rect = (r: Rect, fill: string) => {
    ctx.fillStyle = fill;
    ctx.fillRect(tx(r.x0), tz(r.z1), (r.x1 - r.x0) * view.scale, (r.z1 - r.z0) * view.scale);
  };
  for (const r of ROAD_RECTS) rect(r, "#5b5650");
  for (const r of SIDEWALK_RECTS) rect(r, "#d9cbb0");
  rect({ x0: COURTYARD.x0, x1: COURTYARD.x1, z0: COURTYARD.z0, z1: COURTYARD.z1 }, "#c39a7c");
  rect({ x0: LANE_W.x0, x1: LANE_W.x1, z0: LANE_W.z0, z1: LANE_W.z1 }, "#a9a397");
  for (const b of BUILDINGS) {
    const f = footprint(b);
    rect(f, USE_COLOR[b.use] ?? "#e0cfae");
    ctx.strokeStyle = "rgba(60,40,20,.55)";
    ctx.lineWidth = 1;
    ctx.strokeRect(tx(f.x0), tz(f.z1), (f.x1 - f.x0) * view.scale, (f.z1 - f.z0) * view.scale);
    if (labels && b.use !== "house") {
      ctx.save();
      ctx.fillStyle = "#1e130a";
      ctx.font = `600 ${Math.max(10, view.scale * 2.4)}px "Baloo Paaji 2", sans-serif`;
      ctx.textAlign = "center";
      const lx = tx((f.x0 + f.x1) / 2), lz = tz((f.z0 + f.z1) / 2);
      ctx.translate(lx, lz);
      ctx.rotate(-Math.PI / 2);
      ctx.fillText(b.use === "dhaba" ? "DHABA" : b.use === "workshop" ? "WORKSHOP" : b.use.toUpperCase(), 0, 4);
      ctx.restore();
    }
  }
  // Route line.
  if (route.length > 1) {
    ctx.strokeStyle = "#ffd36b";
    ctx.lineWidth = Math.max(3, view.scale * 1.1);
    ctx.lineJoin = "round";
    ctx.setLineDash([view.scale * 2, view.scale * 1.2]);
    ctx.beginPath();
    route.forEach((p, i) => (i ? ctx.lineTo(tx(p.x), tz(p.z)) : ctx.moveTo(tx(p.x), tz(p.z))));
    ctx.stroke();
    ctx.setLineDash([]);
  }
  for (const m of markers) {
    const x = tx(m.x), y = tz(m.z);
    const r = m.kind === "objective" ? 7 : 5;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = m.color;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = "#1e130a";
    ctx.stroke();
    if (labels && m.label) {
      ctx.fillStyle = "#1e130a";
      ctx.font = `600 12px "Baloo Paaji 2", sans-serif`;
      ctx.textAlign = "left";
      ctx.fillText(m.label, x + 9, y + 4);
    }
  }
  // Player arrow.
  ctx.translate(tx(player.x), tz(player.z));
  ctx.rotate(player.yaw);
  ctx.beginPath();
  ctx.moveTo(0, -10);
  ctx.lineTo(7, 8);
  ctx.lineTo(0, 4);
  ctx.lineTo(-7, 8);
  ctx.closePath();
  ctx.fillStyle = "#ffffff";
  ctx.fill();
  ctx.strokeStyle = "#c0392b";
  ctx.lineWidth = 2.5;
  ctx.stroke();
  ctx.restore();
}
