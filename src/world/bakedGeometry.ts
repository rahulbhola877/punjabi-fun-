import { GeoBuilder, rgb } from "../render/GeoBuilder";
import type { MatKey } from "../render/Materials";

export interface BakedMesh {
  position: string; normal: string; uv: string;
  groups: readonly { start: number; count: number; mat: string | number; color: string }[];
}

function floats(encoded: string): Float32Array {
  const raw = atob(encoded), bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return new Float32Array(bytes.buffer);
}

/** Convert non-indexed Tunyard triangles once, welding identical vertices
 * within each material group. Position, normal, UV and tint are unchanged;
 * hard edges and UV seams stay separate. Reusing indexed templates keeps each
 * placed copy significantly smaller while retaining its authored appearance. */
export function bakedGeometry(meshes: readonly BakedMesh[], material: (id: string | number) => MatKey | undefined): Map<MatKey, GeoBuilder> {
  const parts = new Map<MatKey, GeoBuilder>();
  for (const mesh of meshes) {
    const p = floats(mesh.position), n = floats(mesh.normal), uv = floats(mesh.uv);
    for (const group of mesh.groups) {
      const key = material(group.mat);
      if (!key) throw new Error(`Unsupported baked Tunyard material: ${group.mat}`);
      let g = parts.get(key);
      if (!g) { g = new GeoBuilder(); parts.set(key, g); }
      const color = rgb(`#${group.color}`), vertices = new Map<string, number>();
      const vertex = (i: number): number => {
        const j = i * 3, k = i * 2;
        const x = p[j]!, y = p[j + 1]!, z = p[j + 2]!;
        const nx = n[j]!, ny = n[j + 1]!, nz = n[j + 2]!, u = uv[k]!, v = uv[k + 1]!;
        const signature = `${x},${y},${z},${nx},${ny},${nz},${u},${v}`;
        const old = vertices.get(signature);
        if (old !== undefined) return old;
        // Mirror X for the right-handed Three geometry in Babylon's scene.
        const id = g!.vertex(-x, y, z, -nx, ny, nz, u, v, color);
        vertices.set(signature, id);
        return id;
      };
      for (let i = group.start; i < group.start + group.count; i += 3) g.tri(vertex(i), vertex(i + 1), vertex(i + 2));
    }
  }
  return parts;
}
