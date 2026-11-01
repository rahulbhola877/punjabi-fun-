import type { Rect } from './layout';

/** Static broad phase. Buckets preserve source order, including overlapping roads. */
export class RectIndex<T extends Rect> {
  private cells = new Map<string, T[]>();
  private order = new Map<T, number>();
  constructor(rects: readonly T[], private cellSize = 40, padding = 0) {
    for (const [i, rect] of rects.entries()) {
      if (!this.order.has(rect)) this.order.set(rect, i);
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

  /** Rectangles intersecting a query, once each and in original input order. */
  inRect(query: Rect): T[] {
    const found = new Set<T>();
    for (let x = Math.floor(query.x0 / this.cellSize); x <= Math.floor(query.x1 / this.cellSize); x++) {
      for (let z = Math.floor(query.z0 / this.cellSize); z <= Math.floor(query.z1 / this.cellSize); z++) {
        for (const r of this.cells.get(`${x},${z}`) ?? EMPTY) {
          if (r.x1 >= query.x0 && r.x0 <= query.x1 && r.z1 >= query.z0 && r.z0 <= query.z1) found.add(r);
        }
      }
    }
    return [...found].sort((a, b) => this.order.get(a)! - this.order.get(b)!);
  }
}
const EMPTY: never[] = [];
