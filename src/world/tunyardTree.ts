import { Matrix, Quaternion, Vector3 } from "../babylon";
import type { GeoBuilder } from "../render/GeoBuilder";
import { bakedGeometry } from "./bakedGeometry";
import type { MatKey } from "../render/Materials";
import type { Kit } from "./Kit";
import type tree from "./assets/broadleaf.json";
import { bakedAsset } from "./bakedAssets";
import { lowpolyBroadleaf } from "./lowpolyNature";

// Original Broadleaf Tree generated from rahulbhola877/tunyard at the source
// commit recorded in the JSON. This is its actual authored geometry and
// painted materials, baked with fewer leaf clumps for an explorable orchard.
// The source's Three.js wind shader cannot be carried over in this static bake.
const material: Record<string, MatKey> = { bark: "tunyardBark", moss: "tunyardMoss", leaves: "tunyardLeaves" };
let cached: Map<MatKey, GeoBuilder> | undefined;

function template(): Map<MatKey, GeoBuilder> {
  return cached ??= bakedGeometry(bakedAsset<typeof tree>("broadleaf").meshes, (id) => material[String(id)]);
}

/** Default world tree: the user's lean LowPoly Lab model with a complete
 * connected trunk/crown and one opaque palette batch per spatial chunk. */
export const tunyardBroadleaf = lowpolyBroadleaf;

/** Retain the original textured Tunyard tree for deliberately authored hero
 * placements. Default roadsides and forest density use the cheaper model. */
export function tunyardHeroBroadleaf(kit: Kit, x: number, y: number, z: number, scale: number, yaw: number, options?: { width: number; height: number; worldXScale?: number }): void {
  kit.frame(x, z, 0, y);
  // A street guard can be very close to a facade. Apply any world-X width
  // constraint after rotating the complete tree, so every branch and leaf
  // remains attached and no randomly rotated crown enters the building.
  const m = Matrix.Compose(new Vector3(scale, scale, scale), Quaternion.RotationYawPitchRoll(yaw, 0, 0), Vector3.Zero())
    .multiply(Matrix.Scaling(options?.worldXScale ?? 1, 1, 1))
    .multiply(Matrix.Translation(x, y, z));
  for (const [key, geo] of template()) kit.g(key).appendTransformed(geo, m);
  const width = options?.width ?? 0.5 * scale, height = options?.height ?? 2;
  kit.colliders.add(x, y + height / 2, z, width, height, width);
}
