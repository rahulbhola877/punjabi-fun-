import { Vector3 } from "../babylon";
import { rgb } from "../render/GeoBuilder";
import type { Kit } from "./Kit";
import type { OuterBuilding } from "./region";

/** Hand-placed domestic details for the player's neighborhood. Geometry uses
 * the kothi's existing local frame; the boundary wall supports all planters. */
export function neighborhoodDetail(kit: Kit, b: OuterBuilding, w: number, yd: number, gu: number, gw: number): void {
  if (!b.id.startsWith("santH")) return;
  const x = (b.x0 + b.x1) / 2, z = (b.z0 + b.z1) / 2;
  if (Math.hypot(x - 70, z + 35) > 90) return;
  const pot = (u: number, y: number, depth: number, index: number): void => {
    const terra = rgb(index % 2 ? "#b56347" : "#c7895c"), soil = rgb("#665342");
    const green = rgb(index % 2 ? "#638f4c" : "#4f813f");
    const blossom = rgb(["#edc36a", "#e39195", "#f5d9bc", "#db795c"][(b.seed + index) % 4]!);
    kit.g("paint").cylinder(u, y, depth, 0.105, 0.15, 0.23, 9, terra, true, 1, soil);
    kit.g("paint").cylinder(u, y + 0.20, depth, 0.16, 0.16, 0.035, 9, terra);
    for (let i = 0; i < 5; i++) {
      const a = i * Math.PI * 2 / 5 + index, dx = Math.cos(a) * 0.12, dz = Math.sin(a) * 0.12;
      const stemTop = new Vector3(u + dx, y + 0.37 + (i % 2) * 0.06, depth + dz);
      kit.g("paint").tube(new Vector3(u, y + 0.23, depth), stemTop, 0.009, 4, green);
      kit.g("leaf").ellipsoid(u + dx * 0.6, y + 0.29, depth + dz * 0.6, 0.065, 0.018, 0.04, 6, 4, green);
      for (let j = 0; j < 5; j++) {
        const angle = j * Math.PI * 2 / 5;
        kit.g("paint").ellipsoid(stemTop.x + Math.cos(angle) * 0.025, stemTop.y, stemTop.z + Math.sin(angle) * 0.025, 0.022, 0.012, 0.022, 5, 3, blossom);
      }
      kit.g("paint").ellipsoid(stemTop.x, stemTop.y + 0.012, stemTop.z, 0.012, 0.012, 0.012, 5, 3, rgb("#e7bf67"));
    }
  };
  // Only the solid wall on the opposite side of the gate carries pots. It
  // leaves the gate, doorbell and all walkable space completely clear.
  const leftSide = gu > w / 2;
  const start = leftSide ? 0.6 : gu + gw + 0.55;
  const end = leftSide ? gu - 0.5 : w - 0.6;
  if (end > start && b.seed % 3 !== 0) {
    const count = end - start > 2.3 && b.seed % 2 ? 2 : 1;
    for (let i = 0; i < count; i++) pot(start + (end - start) * (count === 1 ? 0.5 : 0.25 + i * 0.5), 1.4, -0.11, i);
  }
  // A few homes have washing drying under the front overhang. Strings are
  // attached to the wall at both ends; garments stay above head height.
  if (b.seed % 5 === 1 && w >= 8) {
    const u0 = 1.2, u1 = Math.min(w - 1.2, 5.8), depth = -yd + 0.16;
    kit.g("metal").tube(new Vector3(u0, 3.15, depth), new Vector3(u1, 3.15, depth), 0.012, 4, rgb("#77726a"));
    const colors = ["#e5ab8a", "#7cb6aa", "#e8cf84", "#c7a5be"];
    for (let i = 0; i < 3; i++) {
      const u = u0 + 0.52 + i * 1.2, color = rgb(colors[(b.seed + i) % colors.length]!);
      kit.g("fabric").boxMinMax(u - 0.28, 2.42, depth - 0.025, u + 0.28, 3.12, depth + 0.025, color);
      kit.g("fabric").boxMinMax(u - 0.41, 2.83, depth - 0.025, u + 0.41, 3.07, depth + 0.025, color);
      for (const du of [-0.18, 0.18]) kit.g("wood").boxMinMax(u + du - 0.025, 3.09, depth - 0.045, u + du + 0.025, 3.2, depth + 0.045, rgb("#9a7953"));
    }
  }
}
