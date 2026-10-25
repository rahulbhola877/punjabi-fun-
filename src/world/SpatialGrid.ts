/** Rebuilt once per simulation step; queries only inspect nearby cells. */
export class SpatialGrid<T> {
  private cells = new Map<string, T[]>();
  constructor(private size: number) {}
  rebuild(items: readonly T[], position: (item: T) => { x: number; z: number }): void {
    this.cells.clear();
    for (const item of items) {
      const p = position(item), key = `${Math.floor(p.x / this.size)},${Math.floor(p.z / this.size)}`;
      const cell = this.cells.get(key);
      if (cell) cell.push(item); else this.cells.set(key, [item]);
    }
  }
  *near(x: number, z: number, radius: number): Iterable<T> {
    for (let i = Math.floor((x - radius) / this.size); i <= Math.floor((x + radius) / this.size); i++)
      for (let j = Math.floor((z - radius) / this.size); j <= Math.floor((z + radius) / this.size); j++)
        yield* this.cells.get(`${i},${j}`) ?? [];
  }
}
