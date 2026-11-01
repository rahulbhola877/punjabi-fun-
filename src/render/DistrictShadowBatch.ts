import { Mesh, StandardMaterial, VertexData, type Scene } from "../babylon";

/** Shadow depth does not need a separate draw for every facade material.
 * Keep the colour geometry untouched and bake only immutable silhouettes into
 * one position/normal buffer. Layer zero excludes it from all colour cameras;
 * an explicit shadow render list ignores camera layers. Animated/skinned
 * casters stay independent, so limbs and moving people keep live sun shadows. */
export function batchShadowCasters(scene: Scene, sources: readonly Mesh[]): Mesh | null {
  if (!sources.length) return null;
  const positions: number[] = [], normals: number[] = [], indices: number[] = [];
  for (const mesh of sources) {
    const data = VertexData.ExtractFromMesh(mesh, true, true);
    if (!data.positions || !data.normals || !data.indices) continue;
    data.transform(mesh.computeWorldMatrix(true));
    const offset = positions.length / 3;
    for (const v of data.positions) positions.push(v);
    for (const v of data.normals) normals.push(v);
    for (const i of data.indices) indices.push(i + offset);
  }
  if (!indices.length) return null;
  const batch = new Mesh("district-static-shadow-depth", scene), data = new VertexData();
  data.positions=positions; data.normals=normals; data.indices=indices; data.applyToMesh(batch);
  const material = new StandardMaterial("district-shadow-depth", scene);
  material.disableLighting=true; material.backFaceCulling=false;
  batch.material=material; batch.layerMask=0; batch.isPickable=false; batch.freezeWorldMatrix();
  return batch;
}
