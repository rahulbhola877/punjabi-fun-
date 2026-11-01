import { MeshBuilder, type Mesh, type Scene } from "../babylon";
import type { Materials } from "../render/Materials";

/** Litter on the route to the northern wayside, and the bin at its shelter. */
export const WAYSIDE_LITTER = [{ x: 190, z: 1560 }, { x: 200, z: 1573 }, { x: 211, z: 1585 }] as const;
export const WAYSIDE_BIN = { x: 208, z: 1596 } as const;
const STEP = "waysideCleanupStep", DONE_DAY = "waysideCleanupDay";

/** 0 idle, 1–3 next piece, 4 ready to put the litter in the bin. */
export function cleanupStep(home: Record<string, number>): number {
  const n = home[STEP];
  return Number.isInteger(n) && n! >= 0 && n! <= 4 ? n! : 0;
}
export function cleanupAvailable(home: Record<string, number>, day: number): boolean {
  return cleanupStep(home) === 0 && home[DONE_DAY] !== Math.floor(day) + 1;
}
export function startCleanup(home: Record<string, number>, day: number): boolean {
  if (!cleanupAvailable(home, day)) return false;
  home[STEP] = 1;
  return true;
}
export function collectLitter(home: Record<string, number>, index: number): boolean {
  if (index < 0 || index >= WAYSIDE_LITTER.length || cleanupStep(home) !== index + 1) return false;
  home[STEP] = index + 2;
  return true;
}
export function finishCleanup(home: Record<string, number>, day: number): boolean {
  if (cleanupStep(home) !== 4 || home[DONE_DAY] === Math.floor(day) + 1) return false;
  home[DONE_DAY] = Math.floor(day) + 1;
  home[STEP] = 0;
  return true;
}

/** The three pieces disappear as they are picked up and reappear on a later day. */
export class WaysideLitter {
  private items: Mesh[];
  constructor(scene: Scene, mats: Materials) {
    this.items = WAYSIDE_LITTER.map((p, i) => {
      const mesh = MeshBuilder.CreateBox(`wayside_litter_${i}`, { width: 0.42, height: 0.1, depth: 0.3 }, scene);
      mesh.position.set(p.x, 0.07, p.z);
      mesh.rotation.y = i * 1.1;
      mesh.material = mats.get(i === 1 ? "metal" : "fabric");
      mesh.isPickable = false;
      return mesh;
    });
    const bin = MeshBuilder.CreateCylinder("wayside_bin", { height: 0.85, diameterTop: 0.55, diameterBottom: 0.45, tessellation: 10 }, scene);
    bin.position.set(WAYSIDE_BIN.x, 0.425, WAYSIDE_BIN.z);
    bin.material = mats.get("metal");
    bin.isPickable = false;
  }
  sync(home: Record<string, number>, day: number): void {
    const step = cleanupStep(home), done = home[DONE_DAY] === Math.floor(day) + 1;
    for (let i = 0; i < this.items.length; i++) this.items[i]!.setEnabled(!done && (step === 0 || i >= step - 1));
  }
}
