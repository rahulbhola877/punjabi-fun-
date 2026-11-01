import { Color3, Mesh, PBRMaterial, Scene, Texture, TransformNode, VertexData } from "../babylon";
import type treeData from "../world/assets/broadleaf.json";
import { bakedAsset } from "../world/bakedAssets";

/** Original Tunyard broadleaf tree, shared between copies in this scene.
 * Geometry and textures are generated from the owner's recorded source. Its
 * original Three.js wind shader is not part of this static bake. */
const cache = new WeakMap<Scene, TransformNode>();
const floats = (encoded: string): Float32Array => {
  const text = atob(encoded), bytes = new Uint8Array(text.length);
  for (let i = 0; i < text.length; i++) bytes[i] = text.charCodeAt(i);
  return new Float32Array(bytes.buffer);
};

function template(scene: Scene): TransformNode {
  const existing = cache.get(scene);
  if (existing) return existing;
  const root = new TransformNode("harbor-tree-template", scene);
  const materials = new Map<string, PBRMaterial>();
  const data = bakedAsset<typeof treeData>("broadleaf");
  for (const mesh of data.meshes) {
    const p = floats(mesh.position), n = floats(mesh.normal), uv = floats(mesh.uv);
    for (const group of mesh.groups) {
      const key = group.mat;
      let mat = materials.get(key);
      if (!mat) {
        mat = new PBRMaterial(`harbor-tree-${key}`, scene); mat.roughness = key === "leaves" ? 0.7 : 0.92; mat.metallic = 0;
        const albedo = new Texture(`${import.meta.env.BASE_URL}tunyard/tree/${key}-albedo.png`, scene);
        const normal = new Texture(`${import.meta.env.BASE_URL}tunyard/tree/${key}-normal.png`, scene); normal.gammaSpace = false;
        mat.albedoTexture = albedo; mat.bumpTexture = normal;
        if (key === "leaves") { albedo.hasAlpha = true; mat.useAlphaFromAlbedoTexture = true; mat.transparencyMode = PBRMaterial.PBRMATERIAL_ALPHATEST; mat.alphaCutOff = 0.5; mat.backFaceCulling = false; }
        materials.set(key, mat);
      }
      const positions: number[] = [], normals: number[] = [], uvs: number[] = [], colors: number[] = [], indices: number[] = [];
      const c = Color3.FromHexString(`#${group.color}`);
      for (let i = group.start; i < group.start + group.count; i++) {
        positions.push(-p[i * 3]!, p[i * 3 + 1]!, p[i * 3 + 2]!); normals.push(-n[i * 3]!, n[i * 3 + 1]!, n[i * 3 + 2]!);
        uvs.push(uv[i * 2]!, uv[i * 2 + 1]!); colors.push(c.r, c.g, c.b, 1); indices.push(i - group.start);
      }
      const vertex = new VertexData(); vertex.positions = positions; vertex.normals = normals; vertex.uvs = uvs; vertex.colors = colors; vertex.indices = indices;
      const out = new Mesh(`harbor-tree-part-${key}`, scene); vertex.applyToMesh(out); out.material = mat; out.parent = root; out.isPickable = false;
    }
  }
  root.setEnabled(false); cache.set(scene, root); return root;
}

export function addChinaTree(scene: Scene, x: number, y: number, z: number, scale: number, yaw: number): void {
  const root = template(scene).clone("harbor-tree", null, false)!;
  root.setEnabled(true); root.position.set(x, y, z); root.scaling.setAll(scale); root.rotation.y = yaw;
}
