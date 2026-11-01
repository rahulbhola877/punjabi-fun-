import { Matrix, Quaternion, Vector3 } from "../babylon";
import { GeoBuilder } from "../render/GeoBuilder";
import type { Kit } from "./Kit";
import source from "./assets/lowpoly-nature.json";

export interface LowpolyTreeTemplate { bark: GeoBuilder; leaves: GeoBuilder }
const cached = new Map<number, LowpolyTreeTemplate>();

function floats(encoded: string): Float32Array {
  const raw = atob(encoded), bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return new Float32Array(bytes.buffer);
}

function template(index: number): LowpolyTreeTemplate {
  const previous = cached.get(index);
  if (previous) return previous;
  const out = { bark: new GeoBuilder(), leaves: new GeoBuilder() };
  for (const mesh of source.variants[index]!.meshes) {
    const target = mesh.part === "bark" ? out.bark : out.leaves;
    const p = floats(mesh.position), n = floats(mesh.normal), c = floats(mesh.color);
    const offset = target.vertexCount;
    for (let i = 0; i < p.length; i += 3) {
      // Preserve original source vertex colours and normals. Mirror the whole
      // asset once for Babylon's left-handed scene, including every branch.
      target.vertex(-p[i]!, p[i + 1]!, p[i + 2]!, -n[i]!, n[i + 1]!, n[i + 2]!, 0, 0, [c[i]!, c[i + 1]!, c[i + 2]!]);
    }
    for (let i = 0; i < mesh.indices.length; i += 3) target.tri(offset + mesh.indices[i]!, offset + mesh.indices[i + 1]!, offset + mesh.indices[i + 2]!);
  }
  cached.set(index, out);
  return out;
}

/** Three owner-authored broadleaf variants; one grounded complete source
 * transform, 4.8 m high, at most 3.3 m wide and below 500 triangles each. */
export function lowpolyTreeTemplate(variant: number): LowpolyTreeTemplate {
  return template(((Math.floor(variant) % 3) + 3) % 3);
}

/** Source Karikomi shrubs, 0.9 m high and at most 1.15 m wide. */
export function lowpolyShrubTemplate(variant: number): LowpolyTreeTemplate {
  return template(3 + ((Math.floor(variant) % 2) + 2) % 2);
}

function append(kit: Kit, x: number, y: number, z: number, scale: number, yaw: number, tree: LowpolyTreeTemplate, worldXScale = 1): void {
  kit.frame(x, z, 0, y);
  const m = Matrix.Compose(new Vector3(scale, scale, scale), Quaternion.RotationYawPitchRoll(yaw, 0, 0), Vector3.Zero())
    .multiply(Matrix.Scaling(worldXScale, 1, 1)).multiply(Matrix.Translation(x, y, z));
  // Both parts share one opaque, texture-free material; vertex colours
  // distinguish bark and foliage without per-tree draw calls or alpha cards.
  const batch = kit.g("lowpolyNature");
  batch.appendTransformed(tree.bark, m);
  batch.appendTransformed(tree.leaves, m);
}

export function lowpolyBroadleaf(kit: Kit, x: number, y: number, z: number, scale: number, yaw: number, options?: { width: number; height: number; worldXScale?: number }): void {
  const variant = Math.floor(Math.abs(x * 0.37 + z * 0.61)) % 3;
  append(kit, x, y, z, scale, yaw, lowpolyTreeTemplate(variant), options?.worldXScale);
  const width = options?.width ?? 0.5 * scale, height = options?.height ?? 2;
  kit.colliders.add(x, y + height / 2, z, width, height, width);
}

/** Plant a source shrub without an invisible trunk collider blocking paths. */
export function lowpolyShrub(kit: Kit, x: number, y: number, z: number, scale: number, yaw: number, variant = 0): void {
  append(kit, x, y, z, scale, yaw, lowpolyShrubTemplate(variant));
}
