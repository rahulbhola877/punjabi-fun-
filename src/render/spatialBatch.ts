import { GeoBuilder } from "./GeoBuilder";

export interface SpatialBatch { cellX: number; cellZ: number; geometry: GeoBuilder }

/** Rebucket an oversized static builder without cutting triangles or reapplying transforms.
 * Small occupied cells join their nearest substantial cell, avoiding detail-sized draws.
 * Original triangle bounds remain intact, including triangles spanning several cells. */
export function spatialBatches(source: GeoBuilder, cellSize: number): SpatialBatch[] | null {
  if (source.indices.length < 2048 * 3 || !Number.isFinite(cellSize) || cellSize <= 0) return null;
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (let i = 0; i < source.positions.length; i += 3) {
    minX = Math.min(minX, source.positions[i]!); maxX = Math.max(maxX, source.positions[i]!);
    minZ = Math.min(minZ, source.positions[i + 2]!); maxZ = Math.max(maxZ, source.positions[i + 2]!);
  }
  if (Math.max(maxX - minX, maxZ - minZ) <= cellSize * 2) return null;
  const cells = new Map<string, { cellX: number; cellZ: number; triangles: number[] }>();
  for (let i = 0; i < source.indices.length; i += 3) {
    const a = source.indices[i]! * 3, b = source.indices[i + 1]! * 3, c = source.indices[i + 2]! * 3;
    const cellX = Math.floor((source.positions[a]! + source.positions[b]! + source.positions[c]!) / 3 / cellSize);
    const cellZ = Math.floor((source.positions[a + 2]! + source.positions[b + 2]! + source.positions[c + 2]!) / 3 / cellSize);
    const key = `${cellX},${cellZ}`;
    let cell = cells.get(key);
    if (!cell) { cell = { cellX, cellZ, triangles: [] }; cells.set(key, cell); }
    cell.triangles.push(i);
  }
  const substantial = [...cells.values()].filter(c => c.triangles.length >= 64);
  if (substantial.length < 2) return null;
  for (const cell of cells.values()) {
    if (cell.triangles.length >= 64) continue;
    let nearest = substantial[0]!, distance = Infinity;
    for (const candidate of substantial) {
      const d = (candidate.cellX - cell.cellX) ** 2 + (candidate.cellZ - cell.cellZ) ** 2;
      if (d < distance) { distance = d; nearest = candidate; }
    }
    nearest.triangles.push(...cell.triangles);
  }
  return substantial.map(cell => {
    const geometry = new GeoBuilder(source.uvScale);
    geometry.label = source.label;
    const vertices = new Map<number, number>();
    const streams = [
      [source.positions, geometry.positions, 3], [source.normals, geometry.normals, 3],
      [source.uvs, geometry.uvs, 2], [source.colors, geometry.colors, 4],
      [source.boneIdx, geometry.boneIdx, 4], [source.boneW, geometry.boneW, 4],
    ] as const;
    for (const triangle of cell.triangles) for (let j = 0; j < 3; j++) {
      const original = source.indices[triangle + j]!;
      let local = vertices.get(original);
      if (local === undefined) {
        local = vertices.size; vertices.set(original, local);
        for (const [from, to, width] of streams) {
          if (!from.length) continue;
          for (let k = 0; k < width; k++) to.push(from[original * width + k]!);
        }
      }
      geometry.indices.push(local);
    }
    return { cellX: cell.cellX, cellZ: cell.cellZ, geometry };
  });
}
