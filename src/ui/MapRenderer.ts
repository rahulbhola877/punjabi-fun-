import { BUILDINGS, COURTYARD, LANE_W, ROAD_RECTS, SIDEWALK_RECTS, footprint, type Rect } from "../world/layout";
import { CANAL, OUTER_BUILDINGS, PLOTS, ROADS, SITES, TOWN, WORLD, BRIDGES } from "../world/region";

export interface MapMarker { x: number; z: number; color: string; label?: string; kind: "objective" | "job" | "vehicle" | "contact" | "shop" | "police" | "activity" }

const USE_COLOR: Record<string, string> = {
  dhaba: "#d35400", workshop: "#2e6da4", cycle: "#c9a227", fruit: "#6a9a2c", tailor: "#7a5a8a", house: "#b9a68b",
};
const CROP_COLOR: Record<string, string> = { wheat: "#cfae55", sarson: "#d9cb3a", sugarcane: "#6e9447", paddy: "#86a85a", fodder: "#679a44", fallow: "#8e7556" };
const ROAD_COLOR: Record<string, string> = { highway: "#4b4743", road: "#5b5650", street: "#625d56", track: "#9b8360" };
const SITE_COLOR: Record<string, string> = {
  highwayDhaba: "#d35400", petrol: "#1b8a5a", busAdda: "#1565c0", ghantaGhar: "#a2432f", mandi: "#c8a86b", park: "#7fa35a", thana: "#283593",
  cinema: "#6a1b9a", akhada: "#a0522d", gurdwara: "#f5f0e6", kabaddi: "#b79a6e", dera: "#a9906c", kiln: "#8d4e3a",
};

/**
 * Draws the map (north up) into a 2D canvas: the whole countryside, and the
 * bazaar's streets and shops when zoomed in. The same routine serves the
 * circular minimap (centred on the player) and the full map.
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
  const sc = view.scale;
  const tx = (x: number) => W / 2 + (x - view.cx) * sc;
  const tz = (z: number) => H / 2 - (z - view.cz) * sc;
  // Visible world rectangle (with a margin) for culling.
  const vx0 = view.cx - W / 2 / sc - 5, vx1 = view.cx + W / 2 / sc + 5, vz0 = view.cz - H / 2 / sc - 5, vz1 = view.cz + H / 2 / sc + 5;
  const vis = (r: Rect) => r.x1 >= vx0 && r.x0 <= vx1 && r.z1 >= vz0 && r.z0 <= vz1;
  ctx.save();
  ctx.fillStyle = "#3d3428";
  ctx.fillRect(0, 0, W, H);
  const rect = (r: Rect, fill: string) => {
    if (!vis(r)) return;
    ctx.fillStyle = fill;
    ctx.fillRect(tx(r.x0), tz(r.z1), (r.x1 - r.x0) * sc, (r.z1 - r.z0) * sc);
  };
  rect({ x0: WORLD.minX, x1: WORLD.maxX, z0: WORLD.minZ, z1: WORLD.maxZ }, "#a9a774");
  for (const p of PLOTS) rect(p, CROP_COLOR[p.crop] ?? "#9a8");
  rect({ x0: WORLD.minX, x1: WORLD.maxX, z0: CANAL.z0, z1: CANAL.z1 }, "#4f8f96");
  for (const s of SITES) rect(s, SITE_COLOR[s.kind] ?? "#bbb");
  for (const r of ROADS) {
    // Keep roads readable when zoomed out.
    const minW = 2.2 / sc;
    const alongX = r.x1 - r.x0 >= r.z1 - r.z0;
    const g = alongX ? { ...r, z0: Math.min(r.z0, (r.z0 + r.z1) / 2 - minW / 2), z1: Math.max(r.z1, (r.z0 + r.z1) / 2 + minW / 2) } : { ...r, x0: Math.min(r.x0, (r.x0 + r.x1) / 2 - minW / 2), x1: Math.max(r.x1, (r.x0 + r.x1) / 2 + minW / 2) };
    rect(g, ROAD_COLOR[r.kind]!);
  }
  for (const b of BRIDGES) rect({ x0: b.x - b.w / 2, x1: b.x + b.w / 2, z0: CANAL.z0 - 1.5, z1: CANAL.z1 + 1.5 }, "#c9c1b2");
  for (const b of OUTER_BUILDINGS) rect(b, b.style === "city" ? "#d9c9aa" : "#b4735a");
  // The walled bazaar.
  rect(TOWN, "#b9ab8e");
  for (const r of ROAD_RECTS) rect(r, "#5b5650");
  if (sc > 0.9) for (const r of SIDEWALK_RECTS) rect(r, "#d9cbb0");
  rect({ x0: COURTYARD.x0, x1: COURTYARD.x1, z0: COURTYARD.z0, z1: COURTYARD.z1 }, "#c39a7c");
  rect({ x0: LANE_W.x0, x1: LANE_W.x1, z0: LANE_W.z0, z1: LANE_W.z1 }, "#a9a397");
  for (const b of BUILDINGS) {
    const f = footprint(b);
    rect(f, USE_COLOR[b.use] ?? "#e0cfae");
    if (sc < 1.2) continue;
    ctx.strokeStyle = "rgba(60,40,20,.55)";
    ctx.lineWidth = 1;
    ctx.strokeRect(tx(f.x0), tz(f.z1), (f.x1 - f.x0) * sc, (f.z1 - f.z0) * sc);
    if (labels && b.use !== "house") {
      ctx.save();
      ctx.fillStyle = "#1e130a";
      ctx.font = `600 ${Math.max(10, Math.min(16, sc * 2.4))}px "Baloo Paaji 2", sans-serif`;
      ctx.textAlign = "center";
      ctx.translate(tx((f.x0 + f.x1) / 2), tz((f.z0 + f.z1) / 2));
      ctx.rotate(-Math.PI / 2);
      ctx.fillText(b.use === "dhaba" ? "DHABA" : b.use.toUpperCase(), 0, 4);
      ctx.restore();
    }
  }
  ctx.strokeStyle = "#7a4a32";
  ctx.lineWidth = Math.max(1.5, sc * 0.6);
  if (vis(TOWN)) ctx.strokeRect(tx(TOWN.x0), tz(TOWN.z1), (TOWN.x1 - TOWN.x0) * sc, (TOWN.z1 - TOWN.z0) * sc);
  // Place names.
  if (labels) {
    ctx.textAlign = "center";
    const name = (t: string, x: number, z: number, size: number) => {
      if (x < vx0 || x > vx1 || z < vz0 || z > vz1) return;
      ctx.font = `700 ${size}px "Baloo Paaji 2", sans-serif`;
      ctx.lineWidth = 3;
      ctx.strokeStyle = "rgba(255,248,232,.85)";
      ctx.strokeText(t, tx(x), tz(z));
      ctx.fillStyle = "#2a1405";
      ctx.fillText(t, tx(x), tz(z));
    };
    name("Ranggarh Bazaar", -6, 60, 15);
    name("Nawan Shehar", 350, 165 - 30, 17);
    name("Pind Kotli", -20, 420, 17);
    name("G.T. Road", -400, -170, 13);
    name("Nehar (canal)", -420, 186, 12);
    if (sc > 0.35) for (const s of SITES) name(s.label, (s.x0 + s.x1) / 2, s.z1 + 4 / sc, 11);
  }
  // Route line.
  if (route.length > 1) {
    ctx.strokeStyle = "#ffd36b";
    ctx.lineWidth = Math.max(3, Math.min(8, sc * 1.1));
    ctx.lineJoin = "round";
    ctx.setLineDash([Math.max(6, sc * 2), Math.max(4, sc * 1.2)]);
    ctx.beginPath();
    route.forEach((p, i) => (i ? ctx.lineTo(tx(p.x), tz(p.z)) : ctx.moveTo(tx(p.x), tz(p.z))));
    ctx.stroke();
    ctx.setLineDash([]);
  }
  for (const m of markers) {
    // Off-screen markers are pinned to the edge so you can still find them.
    let x = tx(m.x), y = tz(m.z);
    const pinned = x < 8 || x > W - 8 || y < 8 || y > H - 8;
    if (pinned && m.kind !== "objective" && m.kind !== "police") continue;
    x = Math.max(8, Math.min(W - 8, x));
    y = Math.max(8, Math.min(H - 8, y));
    const r = m.kind === "objective" ? 7 : 5;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = m.color;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = "#1e130a";
    ctx.stroke();
    if (labels && m.label && !pinned) {
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
