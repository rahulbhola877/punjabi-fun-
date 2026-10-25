import type { Rect } from './layout';

/** Static broad phase. Buckets preserve source order, including overlapping roads. */
export class RectIndex<T extends Rect> {
  private cells = new Map<string, T[]>();
  constructor(rects: readonly T[], private cellSize = 40, padding = 0) {
    for (const rect of rects) {
      for (let x = Math.floor((rect.x0 - padding) / cellSize); x <= Math.floor((rect.x1 + padding) / cellSize); x++) {
        for (let z = Math.floor((rect.z0 - padding) / cellSize); z <= Math.floor((rect.z1 + padding) / cellSize); z++) {
          const key = `${x},${z}`;
          let bucket = this.cells.get(key);
          if (!bucket) this.cells.set(key, bucket = []);
          bucket.push(rect);
        }
      }
    }
  }
  at(x: number, z: number): readonly T[] {
    return this.cells.get(`${Math.floor(x / this.cellSize)},${Math.floor(z / this.cellSize)}`) ?? EMPTY;
  }
}
const EMPTY: never[] = [];
