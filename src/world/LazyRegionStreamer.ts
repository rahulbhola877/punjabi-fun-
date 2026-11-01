import type { Rect } from "./layout";
import { RectIndex } from "./RectIndex";

export interface RegionAnchor { x: number; z: number }
export interface LoadedRegion { dispose(): void }
export interface RegionUpdate { ready: boolean; pending: number }
export interface LazyRegion extends Rect {
  /** Stable id; bounds must include every object and collision body built by load. */
  id: string;
  /** Must return ownership of every region-created resource; called at most once until unload. */
  load(): LoadedRegion;
}

function distanceSquared(r: Rect, p: RegionAnchor): number {
  const dx = Math.max(r.x0 - p.x, 0, p.x - r.x1);
  const dz = Math.max(r.z0 - p.z, 0, p.z - r.z1);
  return dx * dx + dz * dz;
}

/**
 * Opt-in scenery lifecycle for authored regions. Construction is deferred
 * until a simulation anchor comes near; unload uses a wider radius to avoid
 * repeatedly rebuilding at boundaries. Region loaders own their resources,
 * while callers retain shared scene, materials, signs and player state.
 *
 * The caller must supply ALL active actors, not only the camera, and must
 * synchronously preload a destination before teleport, spawning or remote
 * physics queries. Region bounds must enclose even oversized props. This is
 * intentionally not connected to the existing eager world until those
 * contracts are met by traffic, parked vehicles and every travel path.
 */
export class LazyRegionStreamer {
  private readonly regions: readonly LazyRegion[];
  private readonly index: RectIndex<LazyRegion>;
  private readonly loaded = new Map<LazyRegion, LoadedRegion>();
  private readonly ids = new Map<string, LazyRegion>();
  private readonly order = new Map<LazyRegion, number>();

  constructor(regions: readonly LazyRegion[], private readonly loadRadius: number, private readonly unloadRadius: number) {
    if (!Number.isFinite(loadRadius) || !Number.isFinite(unloadRadius) || loadRadius <= 0 || unloadRadius < loadRadius) throw new Error("Invalid region streaming distances");
    for (const [i, r] of regions.entries()) {
      if (!r.id || this.ids.has(r.id) || ![r.x0, r.x1, r.z0, r.z1].every(Number.isFinite) || r.x0 > r.x1 || r.z0 > r.z1) throw new Error("Invalid or duplicate lazy region");
      this.ids.set(r.id, r);
      this.order.set(r, i);
    }
    this.regions = [...regions];
    this.index = new RectIndex(this.regions, 200);
  }

  get activeCount(): number { return this.loaded.size; }
  isLoaded(id: string): boolean { const r = this.ids.get(id); return !!r && this.loaded.has(r); }

  /** Update all anchors; cap noncritical loads to spread main-thread work.
   * Regions close to an actor bypass the cap so newly spawned or accelerated
   * actors never step onto missing collision while the rest fills in. */
  update(anchors: readonly RegionAnchor[], maxLoads = Infinity, criticalRadius = 0): RegionUpdate {
    if (anchors.some((a) => !Number.isFinite(a.x) || !Number.isFinite(a.z))) throw new Error("Invalid region streaming anchor");
    if (!(maxLoads === Infinity || (Number.isInteger(maxLoads) && maxLoads >= 0))) throw new Error("Invalid region loading budget");
    if (!Number.isFinite(criticalRadius) || criticalRadius < 0 || criticalRadius > this.loadRadius) throw new Error("Invalid critical region radius");
    const load2 = this.loadRadius ** 2, unload2 = this.unloadRadius ** 2;
    const candidates = new Map<LazyRegion, number>();
    for (const a of anchors) {
      const query = { x0: a.x - this.loadRadius, x1: a.x + this.loadRadius, z0: a.z - this.loadRadius, z1: a.z + this.loadRadius };
      for (const region of this.index.inRect(query)) {
        const d = distanceSquared(region, a);
        if (d <= load2 && !this.loaded.has(region)) candidates.set(region, Math.min(candidates.get(region) ?? Infinity, d));
      }
    }
    // Load nearest first; equal-distance ordering is deterministic.
    const queue = [...candidates].sort((a, b) => a[1] - b[1] || this.order.get(a[0])! - this.order.get(b[0])!);
    const required = criticalRadius > 0 ? queue.filter(([, d]) => d <= criticalRadius ** 2).length : 0;
    const allowance = Math.max(maxLoads, required);
    for (const [region] of queue.slice(0, allowance)) this.loaded.set(region, region.load());
    for (const [region, handle] of this.loaded) {
      if (anchors.some((a) => distanceSquared(region, a) <= unload2)) continue;
      handle.dispose();
      this.loaded.delete(region);
    }
    const pending = Math.max(0, queue.length - allowance);
    return { ready: pending === 0, pending };
  }

  /** Synchronous preloading for travel; include both origin and destination anchors if both must remain active. */
  preload(anchors: readonly RegionAnchor[]): void { this.update(anchors); }

  dispose(): void {
    for (const handle of this.loaded.values()) handle.dispose();
    this.loaded.clear();
  }
}
