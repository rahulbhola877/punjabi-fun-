import { expect, it } from "vitest";
import cottage from "../src/world/assets/cottage.json";
import broadleaf from "../src/world/assets/broadleaf.json";
import snowyPine from "../src/world/assets/snowyPine.json";
import { bakedGeometry } from "../src/world/bakedGeometry";
import { rgb } from "../src/render/GeoBuilder";

it.each([["cottage", cottage], ["broadleaf", broadleaf], ["snowy pine", snowyPine]] as const)("welds the authored %s without changing its triangle attributes", (_name, asset) => {
  const out = bakedGeometry(asset.meshes, () => "matte").get("matte")!;
  let index = 0, rawVertices = 0;
  for (const mesh of asset.meshes) {
    const decode = (s: string) => {
      const bytes = Uint8Array.from(atob(s), c => c.charCodeAt(0));
      return new Float32Array(bytes.buffer);
    };
    const p = decode(mesh.position), n = decode(mesh.normal), uv = decode(mesh.uv);
    for (const group of mesh.groups) {
      const c = rgb(`#${group.color}`);
      for (let i = group.start; i < group.start + group.count; i++) {
      const dst = out.indices[index++]!, j = dst * 3, k = dst * 2;
      if (Math.abs(out.positions[j]! + p[i * 3]!) > 1e-6 || Math.abs(out.positions[j + 1]! - p[i * 3 + 1]!) > 1e-6 ||
          Math.abs(out.positions[j + 2]! - p[i * 3 + 2]!) > 1e-6 || Math.abs(out.normals[j]! + n[i * 3]!) > 1e-5 ||
          Math.abs(out.normals[j + 1]! - n[i * 3 + 1]!) > 1e-5 || Math.abs(out.normals[j + 2]! - n[i * 3 + 2]!) > 1e-5 ||
          Math.abs(out.uvs[k]! - uv[i * 2]!) > 1e-6 || Math.abs(out.uvs[k + 1]! - uv[i * 2 + 1]!) > 1e-6 ||
          Math.abs(out.colors[dst * 4]! - c[0]) > 1e-6 || Math.abs(out.colors[dst * 4 + 1]! - c[1]) > 1e-6 ||
          Math.abs(out.colors[dst * 4 + 2]! - c[2]) > 1e-6 || out.colors[dst * 4 + 3] !== 1) {
        throw new Error(`Triangle vertex ${i} changed`);
      }
      rawVertices++;
      }
    }
  }
  expect(out.indices).toHaveLength(rawVertices);
  expect(out.vertexCount).toBeLessThan(rawVertices * 0.4);
});
