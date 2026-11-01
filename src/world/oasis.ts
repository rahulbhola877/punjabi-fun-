import { MeshBuilder, Vector3, type Mesh, type Scene } from "../babylon";
import { rgb } from "../render/GeoBuilder";
import type { Materials } from "../render/Materials";
import type { Kit } from "./Kit";
import { outerHeight } from "./outerTerrain";
import { tunyardBench } from "./tunyardBench";
import { tunyardBroadleaf } from "./tunyardTree";

/** The valve is reachable from both sides of the irrigation channel. */
export const OASIS_VALVE = { x: 156, z: -1658 } as const;
const X = 150, Z = -1650;
const sand = rgb("#d6bd94"), pale = rgb("#e3cfaa"), stone = rgb("#a98d69");
const timber = rgb("#73553d"), clay = rgb("#ad6748"), cloth = rgb("#b76f4e");

/** An authored little courtyard, made in the tile's batch and disposed with it. */
export function oasisCourtyard(kit: Kit): void {
  const y = outerHeight(X, Z);
  kit.frame(X, Z, 0, y);
  // Separate small paved areas fit the buildings rather than turning the
  // entire desert into a single square slab.
  kit.g("paver").box(-15.5, 0.015, -5, 10.5, 0.03, 11, rgb("#cfb995"));
  kit.g("paver").box(-1, 0.015, 0, 18, 0.03, 11, rgb("#cdb692"));
  kit.g("paver").box(-2, 0.015, 13, 20, 0.03, 6, rgb("#cfb995"));

  // A workshop with an open doorway. Collision follows the individual walls,
  // leaving the interior accessible instead of putting an invisible box over it.
  kit.solid("plaster", -20, 1.8, -5.5, 0.4, 3.6, 8, sand);
  kit.solid("plaster", -12, 1.8, -5.5, 0.4, 3.6, 8, sand);
  kit.solid("plaster", -16, 1.8, -9.5, 8, 3.6, 0.4, sand);
  kit.solid("plaster", -18.8, 1.8, -1.5, 2.8, 3.6, 0.4, sand);
  kit.solid("plaster", -13.2, 1.8, -1.5, 2.8, 3.6, 0.4, sand);
  kit.solid("plaster", -16, 3.2, -1.5, 2.8, 0.8, 0.4, sand);
  kit.g("wood").box(-16, 3.75, -5.5, 8.8, 0.3, 8.8, timber);
  kit.collide(-16, 3.75, -5.5, 8.8, 0.3, 8.8);
  kit.g("plaster").box(-16, 3.95, -5.5, 8.9, 0.16, 8.9, pale);
  // Recessed blue window, sill, pottery and a work table make it a workshop.
  kit.g("paint").box(-20.22, 2, -5.5, 0.05, 1.15, 1.5, rgb("#547e7b"));
  kit.g("wood").box(-16, 0.8, -8.15, 3.4, 0.16, 0.85, timber);
  for (const dx of [-1.4, 1.4]) kit.solid("wood", -16 + dx, 0.39, -8.15, 0.14, 0.78, 0.65, timber);
  for (const [x, z, h] of [[-18.7, -8.3, 0.65], [-13.4, -8.5, 0.8], [-18.7, -7.4, 0.48]] as const) {
    kit.g("matte").cylinder(x, 0, z, 0.27, 0.34, h * 0.7, 10, clay);
    kit.g("matte").cylinder(x, h * 0.7, z, 0.34, 0.16, h * 0.3, 10, clay);
  }

  // Two open-front shade stalls with cloth awnings, counters and baskets.
  for (const [cx, cz, tint] of [[-8, 13, cloth], [4, 13, rgb("#678782")]] as const) {
    for (const dx of [-3, 3]) for (const dz of [-2, 2]) kit.solid("wood", cx + dx, 1.5, cz + dz, 0.16, 3, 0.16, timber);
    kit.g("fabric").box(cx, 3.05, cz, 6.7, 0.12, 4.7, tint);
    kit.solid("wood", cx, 0.62, cz + 1.4, 5.2, 1.24, 0.7, timber);
    for (const dx of [-1.5, 0, 1.5]) {
      kit.g("matte").cylinder(cx + dx, 1.25, cz + 1.4, 0.35, 0.45, 0.3, 9, stone);
      kit.g("matte").cylinder(cx + dx, 1.52, cz + 1.4, 0.37, 0.32, 0.08, 9, rgb(dx === 0 ? "#d7a65e" : "#9b704c"));
    }
  }

  // A raised stone pool: the pool edge and its solid foundation align.
  kit.g("concrete").cylinder(11, 0, 0, 4.3, 4.3, 0.38, 24, stone);
  kit.g("water").cylinder(11, 0.39, 0, 3.8, 3.8, 0.025, 24, rgb("#75a5a0"));
  kit.collide(11, 0.19, 0, 7.5, 0.38, 7.5);

  // A shallow lined channel. Its separate water mesh is switched by the
  // actual valve, so the player's action has a visible persistent result.
  kit.g("concrete").box(-1, 0.08, -8, 12.4, 0.16, 1.1, stone);
  for (const dz of [-0.52, 0.52]) kit.g("concrete").box(-1, 0.21, -8 + dz, 12.4, 0.26, 0.14, pale);
  kit.g("concrete").box(5, 0.08, -8.75, 1.1, 0.16, 1.7, stone);
  kit.solid("metal", 5.8, 0.48, -8, 0.35, 0.96, 0.35, rgb("#5e6f68"));
  kit.g("metal").box(5.8, 1.03, -8, 1.1, 0.12, 0.12, rgb("#7c8c83"));

  // A small kitchen garden brings the channel to an actual destination.
  // Its dirt is sunk inside the masonry edging and each plant is rooted in it.
  kit.g("dirt").box(8.3, 0.13, -11, 7, 0.26, 3.8, rgb("#80634b"));
  kit.solid("concrete", 8.3, 0.22, -13, 7.3, 0.44, 0.25, stone);
  kit.solid("concrete", 8.75, 0.22, -9, 6.4, 0.44, 0.25, stone);
  for (const dx of [-3.55, 3.55]) kit.solid("concrete", 8.3 + dx, 0.22, -11, 0.25, 0.44, 3.8, stone);
  for (const dx of [-2.6, -1.3, 0, 1.3, 2.6]) for (const dz of [-1.1, 0, 1.1]) {
    const x = 8.3 + dx, z = -11 + dz;
    kit.g("matte").cylinder(x, 0.27, z, 0.07, 0.045, 0.55, 5, rgb("#678452"));
    for (let k = 0; k < 3; k++) {
      const a = k * Math.PI * 2 / 3 + dx * 0.3, ex = Math.cos(a) * 0.35, ez = Math.sin(a) * 0.35;
      kit.g("leaf").quad(new Vector3(x, 0.44, z), new Vector3(x + ex - ez * 0.25, 0.62, z + ez + ex * 0.25),
        new Vector3(x + ex * 1.25, 0.76, z + ez * 1.25), new Vector3(x + ex + ez * 0.25, 0.62, z + ez - ex * 0.25), rgb("#719762"));
    }
  }

  // A pergola gives the bench a purpose and keeps the approach unobstructed.
  for (const dx of [-7, 1]) for (const dz of [-15, -12]) kit.solid("wood", dx, 1.55, dz, 0.18, 3.1, 0.18, timber);
  for (const dz of [-15, -12]) kit.g("wood").box(-3, 3.15, dz, 8.6, 0.2, 0.2, timber);
  for (let x = -6.8; x <= 0.8; x += 0.8) kit.g("wood").box(x, 3.3, -13.5, 0.1, 0.12, 3.5, timber);

  // Seats and trees frame the square; all tree parts use the same grounded
  // transform from the user's original Tunyard broadleaf asset.
  tunyardBench(kit, X - 3, y, Z - 13.5, Math.PI);
  for (const [dx, dz, scale, yaw] of [[-25, 11, 0.85, 0], [19, 16, 0.95, 1.4], [21, -17, 0.85, 2.8]] as const) {
    tunyardBroadleaf(kit, X + dx, outerHeight(X + dx, Z + dz), Z + dz, scale, yaw);
  }
}

/** One lightweight, switchable channel surface; state belongs to the save. */
export class OasisWater {
  private readonly surfaces: Mesh[];
  constructor(scene: Scene, materials: Materials) {
    const y = outerHeight(X, Z) + 0.18;
    this.surfaces = [
      MeshBuilder.CreateBox("oasis_irrigation_water", { width: 12, height: 0.025, depth: 0.85 }, scene),
      MeshBuilder.CreateBox("oasis_irrigation_turn", { width: 0.85, height: 0.025, depth: 1.6 }, scene),
    ];
    this.surfaces[0]!.position.set(X - 1, y, Z - 8);
    this.surfaces[1]!.position.set(X + 5, y, Z - 8.75);
    for (const surface of this.surfaces) {
      surface.material = materials.get("water");
      surface.isPickable = false;
      surface.addLODLevel(550, null);
      surface.setEnabled(false);
    }
  }
  sync(open: boolean): void { for (const surface of this.surfaces) surface.setEnabled(open); }
  dispose(): void { for (const surface of this.surfaces) surface.dispose(); }
}
