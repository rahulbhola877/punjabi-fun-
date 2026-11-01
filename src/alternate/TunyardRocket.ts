import { Color3, Mesh, Scene, StandardMaterial, TransformNode, VertexData } from "../babylon";
import rocket from "./assets/toonRocket.json";

/**
 * Tunyard's cartoon rocket, baked from its source in its neutral pose. The original
 * Three.js outline shader and idle animation are not part of this static bake.
 * Geometry is grouped by color so one resident does not need a mesh per part.
 */
export function createTunyardRocket(scene: Scene): TransformNode {
  const root = new TransformNode("tunyardRocket", scene);
  const colors = new Map<string, { positions: number[]; normals: number[]; indices: number[] }>();
  const decode = (encoded: string): Float32Array => {
    const text = atob(encoded), bytes = new Uint8Array(text.length);
    for (let i = 0; i < text.length; i++) bytes[i] = text.charCodeAt(i);
    return new Float32Array(bytes.buffer);
  };
  for (const mesh of rocket.meshes) {
    const positions = decode(mesh.position), normals = decode(mesh.normal);
    for (const group of mesh.groups) {
      let data = colors.get(group.color);
      if (!data) { data = { positions: [], normals: [], indices: [] }; colors.set(group.color, data); }
      for (let i = group.start; i < group.start + group.count; i++) {
        data.indices.push(data.positions.length / 3);
        // The source is right-handed; the main game uses Babylon's left-handed scene.
        data.positions.push(-positions[i * 3]!, positions[i * 3 + 1]!, positions[i * 3 + 2]!);
        data.normals.push(-normals[i * 3]!, normals[i * 3 + 1]!, normals[i * 3 + 2]!);
      }
    }
  }
  for (const [color, data] of colors) {
    const material = new StandardMaterial(`rocket-${color}`, scene);
    material.diffuseColor = Color3.FromHexString(`#${color}`);
    material.specularColor = Color3.Black();
    const mesh = new Mesh(`tunyardRocket-${color}`, scene), vertices = new VertexData();
    vertices.positions = data.positions; vertices.normals = data.normals; vertices.indices = data.indices;
    vertices.applyToMesh(mesh); mesh.material = material; mesh.parent = root; mesh.isPickable = false;
  }
  return root;
}
