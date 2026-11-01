import type { Scene } from "../babylon";
import type { Rect } from "../world/layout";
import { RectIndex } from "../world/RectIndex";
import { StaticColliderBuilder, type ColliderBox } from "./Physics";

export interface CollisionAnchor { x: number; z: number }

interface Chunk extends Rect {
  boxes: ColliderBox[];
  active: StaticColliderBuilder | null;
}

/** Conservative horizontal AABB, including a box's yaw and pitch. */
function bounds(b: ColliderBox): Rect {
  const c = Math.abs(Math.cos(b.rotY)), s = Math.abs(Math.sin(b.rotY));
  const pitch = b.rotX ?? 0;
  const hx = b.sx / 2;
  const hz = (Math.abs(Math.sin(pitch)) * b.sy + Math.abs(Math.cos(pitch)) * b.sz) / 2;
  const ex = c * hx + s * hz, ez = s * hx + c * hz;
  return { x0: b.cx - ex, x1: b.cx + ex, z0: b.cz - ez, z1: b.cz + ez };
}

function distanceSquared(chunk: Rect, p: CollisionAnchor): number {
  const dx = Math.max(chunk.x0 - p.x, 0, p.x - chunk.x1);
  const dz = Math.max(chunk.z0 - p.z, 0, p.z - chunk.z1);
  return dx * dx + dz * dz;
}

/**
 * Opt-in static collision streaming for a region whose full box descriptions
 * are already known. A chunk is active near ANY simulation anchor. Callers
 * must include every simulated actor (including parked vehicles and AI), and
 * synchronously update with the destination before a teleport or remote ray.
 * Do not enable this for a world until all its simulations satisfy that rule.
 *
 * Chunk bounds include the complete boxes, not just their centres: long
 * ground slabs and boundary walls remain active along their entire length.
 */
export class StaticColliderStreamer {
  private readonly chunks: Chunk[] = [];
  private readonly index: RectIndex<Chunk>;
  private readonly active = new Set<Chunk>();

  constructor(
    private readonly scene: Scene,
    boxes: readonly ColliderBox[],
    private readonly loadRadius: number,
    private readonly unloadRadius: number,
    private readonly chunkSize = 40,
  ) {
    if (!Number.isFinite(chunkSize) || !Number.isFinite(loadRadius) || !Number.isFinite(unloadRadius) || !(chunkSize > 0) || !(loadRadius > 0) || unloadRadius < loadRadius) {
      throw new Error("Invalid static collision streaming distances");
    }
    const byCell = new Map<string, Chunk>();
    for (const box of boxes) {
      if (![box.cx, box.cy, box.cz, box.sx, box.sy, box.sz, box.rotY, box.rotX ?? 0].every(Number.isFinite) || box.sx <= 0 || box.sy <= 0 || box.sz <= 0) {
        throw new Error("Invalid static collider box");
      }
      const key = `${Math.floor(box.cx / chunkSize)},${Math.floor(box.cz / chunkSize)}`;
      const r = bounds(box);
      let chunk = byCell.get(key);
      if (!chunk) {
        chunk = { ...r, boxes: [], active: null };
        byCell.set(key, chunk);
        this.chunks.push(chunk);
      } else {
        chunk.x0 = Math.min(chunk.x0, r.x0); chunk.x1 = Math.max(chunk.x1, r.x1);
        chunk.z0 = Math.min(chunk.z0, r.z0); chunk.z1 = Math.max(chunk.z1, r.z1);
      }
      chunk.boxes.push(box);
    }
    this.index = new RectIndex(this.chunks, Math.max(chunkSize, 200));
  }

  get activeChunks(): number { return this.active.size; }
  get totalChunks(): number { return this.chunks.length; }

  /** Load and unload synchronously; use both origin and destination while travelling. */
  update(anchors: readonly CollisionAnchor[]): void {
    if (anchors.some((a) => !Number.isFinite(a.x) || !Number.isFinite(a.z))) throw new Error("Invalid collision streaming anchor");
    const wanted = new Set<Chunk>();
    const load2 = this.loadRadius ** 2, unload2 = this.unloadRadius ** 2;
    for (const a of anchors) {
      for (const chunk of this.index.inRect({ x0: a.x - this.loadRadius, x1: a.x + this.loadRadius, z0: a.z - this.loadRadius, z1: a.z + this.loadRadius })) {
        if (distanceSquared(chunk, a) <= load2) wanted.add(chunk);
      }
    }
    for (const chunk of wanted) {
      if (chunk.active) continue;
      const builder = new StaticColliderBuilder();
      builder.boxes.push(...chunk.boxes);
      builder.build(this.scene, this.chunkSize);
      chunk.active = builder;
      this.active.add(chunk);
    }
    for (const chunk of this.active) {
      if (anchors.some((a) => distanceSquared(chunk, a) <= unload2)) continue;
      chunk.active!.dispose();
      chunk.active = null;
      this.active.delete(chunk);
    }
  }

  dispose(): void {
    for (const chunk of this.active) { chunk.active!.dispose(); chunk.active = null; }
    this.active.clear();
  }
}
