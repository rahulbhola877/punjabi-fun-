import { rgb } from "../render/GeoBuilder";
import type { Kit } from "./Kit";
import { tunyardBench } from "./tunyardBench";
import { tunyardBroadleaf } from "./tunyardTree";
import { tunyardFallenLog, tunyardRockCluster } from "./tunyardNature";

/** A small shaded rest by the northern road. Every feature is in the local
 * ground frame; nearby visitors can approach from the road on foot. */
export function buildNorthWayside(kit: Kit): void {
  const shade = rgb("#a18765"), plank = rgb("#a88963"), roof = rgb("#927663");
  // A footpath and a compact earthen clearing, not another farm rectangle.
  kit.frame(196, 1563, 0, 0);
  kit.g("dirt").box(0, 0.008, 0, 3, 0.016, 42, shade);
  kit.frame(201, 1591, 0, 0);
  kit.g("dirt").box(0, 0.01, 0, 17, 0.02, 17, shade);
  // An open shade with a picnic table and space around the benches.
  for (const x of [-2.1, 2.1]) for (const z of [-1.7, 1.7]) {
    kit.g("wood").box(x, 1.35, z, 0.14, 2.7, 0.14, plank);
    kit.collide(x, 1.35, z, 0.16, 2.7, 0.16);
  }
  kit.g("shutter").box(0, 2.75, 0, 4.7, 0.16, 3.9, roof);
  kit.g("wood").box(0, 0.78, 0, 2.1, 0.12, 0.9, plank);
  for (const x of [-0.8, 0.8]) for (const z of [-0.32, 0.32]) kit.g("wood").box(x, 0.38, z, 0.1, 0.76, 0.1, plank);
  kit.collide(0, 0.4, 0, 2.1, 0.8, 0.9);
  tunyardBench(kit, 201, 0, 1589.85, 0);
  tunyardBench(kit, 201, 0, 1592.15, Math.PI);
  // A pair of actual Tunyard trees, rocks and a fallen trunk give the rest its
  // own silhouette without obscuring the road or the walking route.
  tunyardBroadleaf(kit, 183, 0, 1598, 1.1, 0.6);
  tunyardBroadleaf(kit, 220, 0, 1604, 1.0, 2.3);
  tunyardRockCluster(kit, 183, 1607, 91, 0);
  tunyardFallenLog(kit, 217, 1606, 0.5, 0);
  kit.world();
}
