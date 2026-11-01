import { Matrix, Quaternion, Vector3 } from "../babylon";
import { GeoBuilder, rgb } from "../render/GeoBuilder";
import type { MatKey } from "../render/Materials";
import type { Kit } from "./Kit";
import bench from "./assets/rusticBench.json";

// Original Tunyard bench geometry and painted materials, baked from the
// source commit and parameters recorded in rusticBench.json.
const materials: Record<string, MatKey> = { planks: "tunyardBenchPlanks", wood: "tunyardBenchWood" };
let cached: Map<MatKey, GeoBuilder> | undefined;

function floats(encoded: string): Float32Array {
  const str = atob(encoded), bytes = new Uint8Array(str.length);
  for (let i = 0; i < str.length; i++) bytes[i] = str.charCodeAt(i);
  return new Float32Array(bytes.buffer);
}

function template(): Map<MatKey, GeoBuilder> {
  if (cached) return cached;
  const parts = new Map<MatKey, GeoBuilder>();
  for (const mesh of bench.meshes) {
    const p = floats(mesh.position), n = floats(mesh.normal), uv = floats(mesh.uv);
    for (const group of mesh.groups) {
      const key = materials[group.mat];
      if (!key) throw new Error(`Unsupported Tunyard bench material: ${group.mat}`);
      let g = parts.get(key);
      if (!g) { g = new GeoBuilder(); parts.set(key, g); }
      const color = rgb(`#${group.color}`), base = g.vertexCount;
      for (let i = group.start; i < group.start + group.count; i++) {
        g.vertex(-p[i * 3]!, p[i * 3 + 1]!, p[i * 3 + 2]!, -n[i * 3]!, n[i * 3 + 1]!, n[i * 3 + 2]!, uv[i * 2]!, uv[i * 2 + 1]!, color);
      }
      for (let i = 0; i < group.count; i += 3) g.tri(base + i, base + i + 1, base + i + 2);
    }
  }
  cached = parts;
  return parts;
}

/** Append the author's original rustic bench to the scenery batch. */
export function tunyardBench(kit: Kit, x: number, y: number, z: number, yaw: number): void {
  kit.frame(x, z, 0, y);
  const m = Matrix.Compose(Vector3.One(), Quaternion.RotationYawPitchRoll(yaw, 0, 0), new Vector3(x, y, z));
  for (const [key, geo] of template()) kit.g(key).appendTransformed(geo, m);
  kit.colliders.add(x, y + 0.4, z, 1.6, 0.8, 0.5, yaw);
}
