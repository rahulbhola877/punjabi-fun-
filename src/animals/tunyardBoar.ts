import { Color3, Mesh, PBRMaterial, Scene, Texture, TransformNode } from "../babylon";
import { GeoBuilder, rgb } from "../render/GeoBuilder";
import baked from "./assets/boar.json";

/**
 * The user's original Tunyard Low-Poly Boar, baked in its neutral pose from
 * the source commit recorded in the JSON. Its source palette atlases are
 * retained separately per part; the Three.js idle clip is not baked here.
 */
interface Part { texture: number | null; builder: GeoBuilder }
let template: Part[] | undefined;

function floats(encoded: string): Float32Array {
  const raw = atob(encoded), bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return new Float32Array(bytes.buffer);
}

/** Cache the neutral-pose meshes once; each group uses its own palette. */
export function tunyardBoarGeometry(): ReadonlyArray<Part> {
  if (template) return template;
  const parts = new Map<number | null, GeoBuilder>();
  for (const mesh of baked.meshes) {
    const pos = floats(mesh.position), normal = floats(mesh.normal), uv = floats(mesh.uv);
    for (const group of mesh.groups) {
      let g = parts.get(group.texture);
      if (!g) { g = new GeoBuilder(1); parts.set(group.texture, g); }
      const base = g.vertexCount, color = rgb(`#${group.color}`);
      for (let i = group.start; i < group.start + group.count; i++) {
        // Mirror X for Babylon's left-handed world, preserving the original
        // geometry, normals, UV coordinates and the connected joint pose.
        g.vertex(-pos[i * 3]!, pos[i * 3 + 1]!, pos[i * 3 + 2]!, -normal[i * 3]!, normal[i * 3 + 1]!, normal[i * 3 + 2]!, uv[i * 2]!, uv[i * 2 + 1]!, color);
      }
      for (let i = 0; i < group.count; i += 3) g.tri(base + i, base + i + 1, base + i + 2);
    }
  }
  template = Array.from(parts, ([texture, builder]) => ({ texture, builder }));
  return template;
}

export interface TunyardBoar {
  root: TransformNode;
  meshes: Mesh[];
  dispose(): void;
}

/** Create one movable boar. Caller controls its root transform and lifetime. */
export function createTunyardBoar(scene: Scene): TunyardBoar {
  const root = new TransformNode("tunyard-boar", scene);
  const meshes: Mesh[] = [], materials: PBRMaterial[] = [], textures: Texture[] = [];
  for (const [i, part] of tunyardBoarGeometry().entries()) {
    const mat = new PBRMaterial(`tunyard-boar-${i}`, scene);
    mat.albedoColor = Color3.White();
    mat.metallic = 0;
    mat.roughness = 0.85;
    mat.environmentBRDFTexture = null;
    if (part.texture !== null) {
      const tex = new Texture(`${import.meta.env.BASE_URL}tunyard/boar/palette-${part.texture}.png`, scene, true, true, Texture.BILINEAR_SAMPLINGMODE);
      tex.wrapU = Texture.CLAMP_ADDRESSMODE;
      tex.wrapV = Texture.CLAMP_ADDRESSMODE;
      mat.albedoTexture = tex;
      textures.push(tex);
    }
    const mesh = part.builder.toMesh(`tunyard-boar-part-${i}`, scene, mat);
    mesh.parent = root;
    mesh.isPickable = false;
    mesh.receiveShadows = true;
    meshes.push(mesh);
    materials.push(mat);
  }
  return {
    root, meshes,
    dispose: () => { root.dispose(); for (const mat of materials) mat.dispose(); for (const tex of textures) tex.dispose(); },
  };
}
