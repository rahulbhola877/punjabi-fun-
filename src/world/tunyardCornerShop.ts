import { Matrix, Quaternion, Vector3 } from "../babylon";
import type { GeoBuilder } from "../render/GeoBuilder";
import type { MatKey } from "../render/Materials";
import type { Kit } from "./Kit";
import { bakedGeometry } from "./bakedGeometry";
import type shop from "./assets/cornerShop.json";
import { bakedAsset } from "./bakedAssets";

/** The author's original two-storey Tunyard corner shop. Geometry, material
 * groups and textures are baked by tools/bake-tunyard-corner-shop.mjs. */
const keys: MatKey[] = [
  "cornerRender", "matte", "glass", "paint", "cornerConcrete", "cornerPaintedMetal",
  "cornerAluminium", "chrome", "cornerSign0", "cornerSign1", "cottagePlanks", "cornerSign2",
  "cornerPaintedMetal", "emissive", "cornerStripes", "cornerConcreteBase", "cornerBrick",
];
let cached: Map<MatKey, GeoBuilder> | undefined;
function template(): Map<MatKey, GeoBuilder> {
  return cached ??= bakedGeometry(bakedAsset<typeof shop>("cornerShop").meshes, (id) => typeof id === "number" ? keys[id] : undefined);
}

/** Closed shop facade. Footprint 9 × 10 m; rotate +Z to the street. */
export function tunyardCornerShop(kit: Kit, x: number, y: number, z: number, yaw: number): void {
  kit.frame(x, z, 0, y);
  const m = Matrix.Compose(Vector3.One(), Quaternion.RotationYawPitchRoll(yaw, 0, 0), new Vector3(x, y, z));
  for (const [key, geo] of template()) kit.g(key).appendTransformed(geo, m);
  // The Tunyard asset is anchored at its front edge; the building extends
  // ten metres toward local -Z. Rotate that footprint with the facade.
  kit.frame(x, z, yaw, y);
  kit.collide(0, 3.6, -5, 9, 7.2, 10);
}
