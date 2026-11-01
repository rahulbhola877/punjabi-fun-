import { Matrix, Quaternion, Vector3 } from "../babylon";
import type { GeoBuilder } from "../render/GeoBuilder";
import { bakedGeometry } from "./bakedGeometry";
import type { MatKey } from "../render/Materials";
import type { Kit } from "./Kit";
import tree from "./assets/snowyPine.json";

// Original snowy Pine Tree generated from rahulbhola877/tunyard at the source
// commit recorded in the JSON. This is its actual authored geometry and
// painted materials, baked with snow and fewer branch tiers for the themed set.
// The source's Three.js wind shader cannot be carried over in this static bake.
const material: Record<string, MatKey> = { bark: "tunyardBark", matte: "matte", needles: "tunyardNeedles" };
let cached: Map<MatKey, GeoBuilder> | undefined;

function template(): Map<MatKey, GeoBuilder> {
  return cached ??= bakedGeometry(tree.meshes, (id) => material[String(id)]);
}

/** Append the authored tree into existing chunk batches at a shared height. */
export function tunyardSnowyPine(kit: Kit, x: number, y: number, z: number, scale: number, yaw: number): void {
  kit.frame(x, z, 0, y);
  const m = Matrix.Compose(new Vector3(scale, scale, scale), Quaternion.RotationYawPitchRoll(yaw, 0, 0), new Vector3(x, y, z));
  for (const [key, geo] of template()) kit.g(key).appendTransformed(geo, m);
  kit.colliders.add(x, y + 1, z, 0.5 * scale, 2, 0.5 * scale);
}
