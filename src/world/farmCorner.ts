import { Rng } from "../render/textures";
import type { Plot } from "./region";

/** Reproduce the plot's stable corner choice for both scenery and crop clearings. */
export function farmCorner(p: Plot): { rng: Rng; choice: number; x: number; z: number } {
  const rng = new Rng(p.seed * 17 + 5);
  const hx = (p.x1 - p.x0) / 2, hz = (p.z1 - p.z0) / 2;
  const spacing = p.crop === "sugarcane" ? 1.7 : p.crop === "fodder" ? 1.1 : p.crop === "paddy" ? 0.9 : 1.25;
  if (p.crop !== "fallow") {
    const span = p.rowsAlongX ? hz : hx;
    for (let a = -span + 1.2; a < span - 1; a += spacing) { rng.next(); rng.next(); }
  }
  const choice = rng.next();
  const x = (p.x0 + p.x1) / 2 + (rng.next() < 0.5 ? -1 : 1) * (hx - 3);
  const z = (p.z0 + p.z1) / 2 + (rng.next() < 0.5 ? -1 : 1) * (hz - 3);
  return { rng, choice, x, z };
}

/** Only the larger new structures need a crop-free clearing. */
export function farmLandmark(p: Plot): { x: number; z: number; kind: "windpump" | "well" } | null {
  if (p.crop === "paddy") return null;
  const c = farmCorner(p);
  if (c.choice < 0.012) return { x: c.x, z: c.z, kind: "windpump" };
  if (c.choice < 0.026) return { x: c.x, z: c.z, kind: "well" };
  return null;
}
