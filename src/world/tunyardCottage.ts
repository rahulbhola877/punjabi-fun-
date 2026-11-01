import { Matrix, Quaternion, Vector3 } from "../babylon";
import type { GeoBuilder } from "../render/GeoBuilder";
import { bakedGeometry } from "./bakedGeometry";
import type { MatKey } from "../render/Materials";
import type { Kit } from "./Kit";
import type tree from "./assets/cottage.json";
import { bakedAsset } from "./bakedAssets";

// Original Tunyard Cottage generated from rahulbhola877/tunyard at the source
// commit recorded in the JSON. This is its actual authored geometry and
// painted materials, baked with shingles and a simple winter-friendly palette.
const material: Record<string, MatKey> = { brass: "metal", canvas: "cottageCanvas", iron: "cottageIron", matte: "matte", planks: "cottagePlanks", plaster: "cottagePlaster", shingles: "cottageShingles", smooth: "matte", stone: "cottageStone", stoneWall: "cottageStoneWall", windowGlass: "glass", wood: "cottageWood" };
let cached: Map<MatKey, GeoBuilder> | undefined;

function template(): Map<MatKey, GeoBuilder> {
  return cached ??= bakedGeometry(bakedAsset<typeof tree>("cottage").meshes, (id) => material[String(id)]);
}

/** Append the authored cottage into existing chunk batches at a shared height. */
export function tunyardCottage(kit: Kit, x: number, y: number, z: number, scale: number, yaw: number, wallTint: readonly [number, number, number] = [1, 1, 1], roofTint: readonly [number, number, number] = [1, 1, 1]): void {
  kit.frame(x, z, 0, y);
  const m = Matrix.Compose(new Vector3(scale, scale, scale), Quaternion.RotationYawPitchRoll(yaw, 0, 0), new Vector3(x, y, z));
  for (const [key, geo] of template()) {
    const builder = kit.g(key), start = builder.colors.length;
    builder.appendTransformed(geo, m);
    // Painted wall and shingle tints distinguish neighbouring homes while
    // preserving the authored geometry and material textures.
    const tint = key === "cottagePlaster" ? wallTint : key === "cottageShingles" ? roofTint : null;
    if (tint) for (let i = start; i < builder.colors.length; i += 4) {
      builder.colors[i] = builder.colors[i]! * tint[0];
      builder.colors[i + 1] = builder.colors[i + 1]! * tint[1];
      builder.colors[i + 2] = builder.colors[i + 2]! * tint[2];
    }
  }
  kit.colliders.add(x, y + 1.8 * scale, z, 5.2 * scale, 3.6 * scale, 4.2 * scale, yaw);
}
