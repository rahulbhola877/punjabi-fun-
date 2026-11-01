import { Color3, Mesh, PBRMaterial, Scene, Texture, TransformNode, VertexData } from '../babylon';
import data from './assets/koiAssets.json';

/** Original Tunyard koi, with its overlapping body joints preserved for swimming. */
export type KoiVariant = keyof typeof data.assets;
type Group = (typeof data.assets)[KoiVariant]['meshes'][number]['groups'][number];
interface Cache { templates: Map<KoiVariant, TransformNode>; materials: Map<string, PBRMaterial>; textures: Map<number, Texture> }
const scenes = new WeakMap<Scene, Cache>();
function floats(encoded: string): Float32Array {
  const binary = atob(encoded), bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Float32Array(bytes.buffer);
}
function key(g: Group): string { return [g.texture, g.opacity, g.doubleSided, g.roughness, g.metalness].join(':'); }
function getMaterial(scene: Scene, cache: Cache, g: Group): PBRMaterial {
  const k = key(g); let material = cache.materials.get(k);
  if (!material) {
    material = new PBRMaterial(`koi-${k}`, scene); material.albedoColor = Color3.White();
    material.roughness = g.roughness; material.metallic = g.metalness;
    material.alpha = g.opacity; material.backFaceCulling = !g.doubleSided;
    if (g.texture !== null) {
      let t = cache.textures.get(g.texture);
      if (!t) { t = new Texture(`${import.meta.env.BASE_URL}tunyard/koi/${g.texture}.png`, scene); cache.textures.set(g.texture, t); }
      material.albedoTexture = t;
    }
    cache.materials.set(k, material);
  }
  return material;
}
export interface TunyardKoi { root: TransformNode; mid: TransformNode; tail: TransformNode }
/**
 * Place a koi, with origin at the body centre and head along +Z. Geometry and
 * materials are shared per scene; the returned hierarchy can be disposed on
 * its own, while scene disposal also releases shared resources.
 * Animate mid and tail about Y for a lateral traveling wave.
 */
export function addTunyardKoi(scene: Scene, variant: KoiVariant, x: number, y: number, z: number, scale = 1): TunyardKoi {
  let cache = scenes.get(scene);
  if (!cache) { cache = { templates: new Map(), materials: new Map(), textures: new Map() }; scenes.set(scene, cache); }
  let template = cache.templates.get(variant);
  if (!template) {
    template = new TransformNode(`koi-${variant}-template`, scene);
    const source = data.assets[variant], pivots = source.pivots;
    const joints = [0, 1, 2].map(i => new TransformNode(`koi-joint-${i}`, scene));
    joints[0]!.parent = template; joints[1]!.parent = joints[0]!; joints[2]!.parent = joints[1]!;
    // Original source is lifted above ground; use its head pivot as y = 0.
    joints[0]!.position.set(-pivots[0]![0]!, 0, pivots[0]![2]!);
    for (let i = 1; i < 3; i++) joints[i]!.position.set(-(pivots[i]![0]! - pivots[i - 1]![0]!), pivots[i]![1]! - pivots[i - 1]![1]!, pivots[i]![2]! - pivots[i - 1]![2]!);
    const groups = new Map<string, { joint: number; group: Group; positions: number[]; normals: number[]; uvs: number[]; colors: number[]; indices: number[] }>();
    for (const mesh of source.meshes) {
      const p = floats(mesh.position), n = floats(mesh.normal), uv = floats(mesh.uv);
      for (const group of mesh.groups) {
        const k = `${mesh.joint}:${key(group)}`; let target = groups.get(k);
        if (!target) { target = { joint: mesh.joint, group, positions: [], normals: [], uvs: [], colors: [], indices: [] }; groups.set(k, target); }
        const color = Color3.FromHexString(`#${group.color}`);
        for (let i = group.start; i < group.start + group.count; i++) {
          target.indices.push(target.positions.length / 3);
          target.positions.push(-p[i * 3]!, p[i * 3 + 1]!, p[i * 3 + 2]!);
          target.normals.push(-n[i * 3]!, n[i * 3 + 1]!, n[i * 3 + 2]!);
          target.uvs.push(uv[i * 2]!, uv[i * 2 + 1]!); target.colors.push(color.r, color.g, color.b, 1);
        }
      }
    }
    for (const [k, g] of groups) {
      const mesh = new Mesh(`koi-${variant}-${k}`, scene), v = new VertexData();
      v.positions = g.positions; v.normals = g.normals; v.uvs = g.uvs; v.colors = g.colors; v.indices = g.indices;
      v.applyToMesh(mesh); mesh.parent = joints[g.joint]!; mesh.material = getMaterial(scene, cache, g.group); mesh.isPickable = false;
    }
    template.setEnabled(false); cache.templates.set(variant, template);
  }
  const root = template.clone(`koi-${variant}`, null, false)!; root.setEnabled(true);
  root.position.set(x, y, z); root.scaling.setAll(scale);
  const children = root.getChildTransformNodes(false);
  const mid = children.find(n => n.name.endsWith('.koi-joint-1'))!, tail = children.find(n => n.name.endsWith('.koi-joint-2'))!;
  if (!mid || !tail) throw new Error('Koi body joints missing');
  return { root, mid, tail };
}
