import { Matrix, Quaternion, Vector3 } from "../babylon";
import type { GeoBuilder } from "../render/GeoBuilder";
import type { MatKey } from "../render/Materials";
import type { Kit } from "./Kit";
import { bakedGeometry } from "./bakedGeometry";
import asset from "./assets/modernHouse.json";

/** The owner's Tunyard flat-roof villa and its original low-poly palette.
 * The source front faces +Z; this static bake has a garage and no pool. */
const keys: MatKey[] = ["modernHousePalette", "modernHouseGlass"];
let cached: Map<MatKey, GeoBuilder> | undefined;
function template(): Map<MatKey, GeoBuilder> {
  return cached ??= bakedGeometry(asset.meshes, id => typeof id === "number" ? keys[id] : undefined);
}

/** Main footprint 10 × 8 m before scaling; the front path extends beyond it. */
export function tunyardModernHouse(kit: Kit, x: number, y: number, z: number, scale: number, yaw: number): void {
  kit.frame(x, z, 0, y);
  const m = Matrix.Compose(new Vector3(scale, scale, scale), Quaternion.RotationYawPitchRoll(yaw, 0, 0), new Vector3(x, y, z));
  for (const [key, geo] of template()) kit.g(key).appendTransformed(geo, m);
  kit.colliders.add(x, y + 3.4 * scale, z, 10 * scale, 6.8 * scale, 8 * scale, yaw);
}
