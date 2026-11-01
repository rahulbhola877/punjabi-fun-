import { Matrix, Quaternion, Vector3 } from "../babylon";
import type { GeoBuilder } from "../render/GeoBuilder";
import type { MatKey } from "../render/Materials";
import type { Kit } from "./Kit";
import { bakedGeometry } from "./bakedGeometry";
import asset from "./assets/bungalow.json";

/** The owner's Tunyard bungalow, including its original painted palette. The
 * authored front faces +Z; the static bake preserves the porch and yard. */
const keys: MatKey[] = ["bungalowPalette", "bungalowGlass"];
let cached: Map<MatKey, GeoBuilder> | undefined;
function template(): Map<MatKey, GeoBuilder> {
  return cached ??= bakedGeometry(asset.meshes, id => typeof id === "number" ? keys[id] : undefined);
}

/** Footprint of the closed building itself is 9 × 7 m before scaling. */
export function tunyardBungalow(kit: Kit, x: number, y: number, z: number, scale: number, yaw: number): void {
  kit.frame(x, z, 0, y);
  const m = Matrix.Compose(new Vector3(scale, scale, scale), Quaternion.RotationYawPitchRoll(yaw, 0, 0), new Vector3(x, y, z));
  for (const [key, geo] of template()) kit.g(key).appendTransformed(geo, m);
  kit.colliders.add(x, y + 1.4 * scale, z, 9 * scale, 2.8 * scale, 7 * scale, yaw);
}
