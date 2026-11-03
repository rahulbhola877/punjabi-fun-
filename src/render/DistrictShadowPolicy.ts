import type { AbstractMesh } from "../babylon";

/** The authored fixed silhouettes survive colour batching under new mesh names.
 * Keep trim, ground and submerged geometry out even when sharing a material. */
export function districtShadowSilhouette(mesh: AbstractMesh, selectedAsset = false): boolean {
  if (!mesh.material || mesh.material.alpha < 1 || /ground|paving|asphalt|road|marking|lines|pondBed|gardenSand/i.test(mesh.material.name) || /submerged|label|sign|water|stars|planet|ridge|glow|sea|ground|terrain|path|track/i.test(mesh.name)) return false;
  return selectedAsset || !!mesh.metadata?.districtSilhouette || /_body$|harborHome|harborEave|harborRoofLine|^building\d|^roof\d|^block\d|^habitat\d|heroTorso|heroHead|harbor-tree|japan-cherry|japan-bamboo|japan-teahouse|japan-torii|marketStall|^rover|space-pod|space-solar|space-dish|pondEdgeStone/.test(mesh.name);
}
