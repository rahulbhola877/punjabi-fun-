import { Rng } from "../render/textures";
import type { Kit } from "./Kit";
import type { CountryDecor } from "./country";
import { onRoad, type Plot } from "./region";

export interface WindbreakTree { x: number; z: number; scale: number; rotation: number; kind: "kikar" | "shisham" }

/**
 * A few fields have an irregular line of trees on their bund, as windbreaks
 * and shade. Keep the ends clear of the farm's corner features and keep the
 * trunks well away from roads. This is deliberately sparse: it should break
 * up the horizon, not turn every plot into a fenced rectangle.
 */
export function windbreakForPlot(p: Plot): WindbreakTree[] {
  const rng = new Rng(p.seed * 53 + 721);
  if (rng.next() > 0.075) return [];
  const alongX = p.x1 - p.x0 >= p.z1 - p.z0;
  const length = alongX ? p.x1 - p.x0 : p.z1 - p.z0;
  if (length < 39) return [];
  const side = rng.next() < 0.5 ? -1 : 1;
  const xMid = (p.x0 + p.x1) / 2, zMid = (p.z0 + p.z1) / 2;
  const offset = (alongX ? p.z1 - p.z0 : p.x1 - p.x0) / 2 - 1.1;
  const n = Math.min(4, Math.floor((length - 18) / 13));
  const out: WindbreakTree[] = [];
  for (let i = 0; i < n; i++) {
    const t = -length / 2 + 9 + (i + 0.5) * (length - 18) / n + rng.range(-1.5, 1.5);
    const across = side * (offset - rng.range(0, 0.45));
    const x = xMid + (alongX ? t : across), z = zMid + (alongX ? across : t);
    if (onRoad(x, z, 7)) continue;
    out.push({ x, z, scale: rng.range(0.8, 1.2), rotation: rng.range(0, Math.PI * 2), kind: rng.next() < 0.65 ? "kikar" : "shisham" });
  }
  return out;
}

export function farmWindbreaks(kit: Kit, plots: Plot[], decor: CountryDecor): void {
  for (const p of plots) for (const t of windbreakForPlot(p)) decor.addTree(kit, t.kind, t.x, t.z, t.scale, t.rotation);
}
