import { Color3, Mesh, PBRMaterial, Scene, Texture, TransformNode, VertexData } from "../babylon";
import data from "./assets/chinaMarketAssets.json";

/** Original Tunyard assets, static geometry with their baked material maps.
 * Wind and other Three.js animation do not survive the static bake. */
export type ChinaAssetKind = keyof typeof data.assets;
type BakedGroup = (typeof data.assets)[ChinaAssetKind][number]["groups"][number];

interface SceneAssets {
  templates: Map<ChinaAssetKind, TransformNode>;
  materials: Map<string, PBRMaterial>;
  textures: Map<number, Texture>;
}
const cache = new WeakMap<Scene, SceneAssets>();
function floats(encoded: string): Float32Array {
  const binary = atob(encoded), bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Float32Array(bytes.buffer);
}
function materialKey(g: BakedGroup): string {
  return [g.texture, g.normalTexture, g.alphaTest, g.opacity, g.doubleSided, g.roughness, g.metalness].join(":");
}
function sceneAssets(scene: Scene): SceneAssets {
  let result = cache.get(scene);
  if (!result) { result = { templates: new Map(), materials: new Map(), textures: new Map() }; cache.set(scene, result); }
  return result;
}
function texture(scene: Scene, assets: SceneAssets, id: number): Texture {
  let t = assets.textures.get(id);
  if (!t) { t = new Texture(`${import.meta.env.BASE_URL}tunyard/china-market/${id}.png`, scene); assets.textures.set(id, t); }
  return t;
}
function getMaterial(scene: Scene, assets: SceneAssets, group: BakedGroup): PBRMaterial {
  const key = materialKey(group);
  let mat = assets.materials.get(key);
  if (!mat) {
    mat = new PBRMaterial(`china-market-${key}`, scene);
    mat.albedoColor = Color3.White();
    mat.roughness = group.roughness;
    mat.metallic = group.metalness;
    mat.alpha = group.opacity;
    mat.backFaceCulling = !group.doubleSided;
    if (group.texture !== null) {
      const t = texture(scene, assets, group.texture);
      if (group.alphaTest > 0) { t.hasAlpha = true; mat.useAlphaFromAlbedoTexture = true; mat.transparencyMode = PBRMaterial.PBRMATERIAL_ALPHATEST; mat.alphaCutOff = group.alphaTest; }
      mat.albedoTexture = t;
    }
    if (group.normalTexture !== null) {
      const normal = texture(scene, assets, group.normalTexture);
      normal.gammaSpace = false;
      mat.bumpTexture = normal;
    }
    assets.materials.set(key, mat);
  }
  return mat;
}

/**
 * Place a cached original Tunyard asset in a Babylon scene. Instances share
 * their source geometry and materials; the scene owns every GPU resource.
 * The returned root can be disposed independently. Source positions are
 * converted from Three's right-handed frame by mirroring X.
 */
export function addChinaAsset(scene: Scene, kind: ChinaAssetKind, x: number, y: number, z: number, scale = 1, yaw = 0): TransformNode {
  const assets = sceneAssets(scene);
  let template = assets.templates.get(kind);
  if (!template) {
    template = new TransformNode(`china-market-${kind}-template`, scene);
    const groups = new Map<string, { group: BakedGroup; positions: number[]; normals: number[]; uvs: number[]; colors: number[]; indices: number[]; lookup: Map<string, number> }>();
    for (const mesh of data.assets[kind]) {
      const p = floats(mesh.position), n = floats(mesh.normal), uv = floats(mesh.uv);
      for (const group of mesh.groups) {
        const key = materialKey(group);
        let target = groups.get(key);
        if (!target) { target = { group, positions: [], normals: [], uvs: [], colors: [], indices: [], lookup: new Map() }; groups.set(key, target); }
        const c = Color3.FromHexString(`#${group.color}`);
        for (let i = group.start; i < group.start + group.count; i++) {
          // Reuse only exact matches across all vertex attributes, including
          // tint. UV seams and hard normals remain distinct.
          const attrs = [-p[i * 3]!, p[i * 3 + 1]!, p[i * 3 + 2]!, -n[i * 3]!, n[i * 3 + 1]!, n[i * 3 + 2]!, uv[i * 2]!, uv[i * 2 + 1]!, c.r, c.g, c.b];
          const id = attrs.join(",");
          let index = target.lookup.get(id);
          if (index === undefined) {
            index = target.positions.length / 3;
            target.lookup.set(id, index);
            target.positions.push(...attrs.slice(0, 3));
            target.normals.push(...attrs.slice(3, 6));
            target.uvs.push(...attrs.slice(6, 8));
            target.colors.push(c.r, c.g, c.b, 1);
          }
          target.indices.push(index);
        }
      }
    }
    for (const [key, source] of groups) {
      const mesh = new Mesh(`china-market-${kind}-${key}`, scene), v = new VertexData();
      v.positions = source.positions; v.normals = source.normals; v.uvs = source.uvs; v.colors = source.colors; v.indices = source.indices;
      v.applyToMesh(mesh); mesh.parent = template; mesh.material = getMaterial(scene, assets, source.group); mesh.isPickable = false;
    }
    template.setEnabled(false);
    assets.templates.set(kind, template);
  }
  const instance = template.clone(`china-market-${kind}`, null, false)!;
  instance.setEnabled(true);
  instance.position.set(x, y, z);
  instance.scaling.setAll(scale);
  instance.rotation.y = yaw;
  return instance;
}
