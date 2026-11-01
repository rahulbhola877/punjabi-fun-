import { Color3, Mesh, MeshBuilder, Scene, StandardMaterial, Vector3 } from "../babylon";
import { CANAL, GHAT, inCanal } from "../world/region";

/** The open landing above the steps. The camera controls the throwing angle. */
export const SKIPPING_LANDING = { x: GHAT.x, z: CANAL.z1 + 2.5 } as const;
// Land the first bounce in mid-channel, where it is visible over the ghat's
// parapet from the player's camera rather than hidden directly below it.
const START_WATER_Z = CANAL.z1 - 6.1;
const STEP_LENGTHS = [3.4, 2.8, 2.3, 1.8, 1.5, 1.2] as const;
export interface SkipPoint { x: number; z: number }

/** Plan real impact points on the water. A diagonal throw stays in the canal
 * longer than a straight throw; a bridge or bank ends the sequence. */
export function planStoneSkips(origin: SkipPoint, yaw: number): SkipPoint[] {
  if (![origin.x, origin.z, yaw].every(Number.isFinite)) return [];
  if (Math.hypot(origin.x - SKIPPING_LANDING.x, origin.z - SKIPPING_LANDING.z) > 2.7) return [];
  const dx = Math.sin(yaw), dz = Math.cos(yaw);
  if (dz >= -0.18 || origin.z <= CANAL.z1 + 0.25) return [];
  // The ball must pass through the actual gap in the parapet, rather than
  // visibly cutting through the side walls of the steps.
  const wallDist = (origin.z - (CANAL.z1 + 0.2)) / -dz;
  const wallX = origin.x + dx * wallDist;
  if (Math.abs(wallX - GHAT.x) > GHAT.w / 2 - 0.25) return [];
  const distance = (origin.z - START_WATER_Z) / -dz;
  if (distance > 14) return [];
  let x = origin.x + dx * distance, z = START_WATER_Z;
  if (!inCanal(x, z)) return [];
  const points: SkipPoint[] = [{ x, z }];
  for (const length of STEP_LENGTHS) {
    const nx = x + dx * length, nz = z + dz * length;
    // Check along the whole flight, so a narrow bridge cannot be skipped
    // across merely because both endpoints happen to lie on open water.
    const samples = Math.ceil(length / 0.5);
    let clear = true;
    for (let i = 1; i <= samples; i++) if (!inCanal(x + (nx - x) * i / samples, z + (nz - z) * i / samples)) { clear = false; break; }
    if (!clear) break;
    x = nx; z = nz; points.push({ x, z });
  }
  return points;
}

/** One flat stone and a small reusable pool of spreading water rings. */
export class CanalSkipping {
  private stone: Mesh;
  private stoneMat: StandardMaterial;
  private rings: Array<{ mesh: Mesh; mat: StandardMaterial; age: number }>;
  private points: SkipPoint[] = [];
  private from = Vector3.Zero();
  private target = Vector3.Zero();
  private segment = 0;
  private elapsed = 0;
  private duration = 0;
  private count = 0;
  private nextRing = 0;
  active = false;
  snapshot(): { active: boolean; impacts: number; planned: number } { return { active: this.active, impacts: this.count, planned: this.points.length }; }
  constructor(scene: Scene, private onImpact: (at: Vector3, count: number) => void, private onFinish: (count: number) => void) {
    this.stoneMat = new StandardMaterial("skipStoneMaterial", scene);
    this.stoneMat.diffuseColor = Color3.FromHexString("#b5a694"); this.stoneMat.specularColor = new Color3(0.08, 0.08, 0.08);
    this.stone = MeshBuilder.CreateSphere("skipStone", { diameter: 0.24, segments: 8 }, scene);
    this.stone.scaling.set(1, 0.28, 0.8); this.stone.material = this.stoneMat; this.stone.isPickable = false; this.stone.setEnabled(false);
    this.rings = Array.from({ length: 4 }, (_, i) => {
      const mesh = MeshBuilder.CreateTorus(`skipRipple${i}`, { diameter: 1, thickness: 0.07, tessellation: 24 }, scene);
      const mat = new StandardMaterial(`skipRippleMaterial${i}`, scene);
      mat.diffuseColor = Color3.FromHexString("#e5f6ed"); mat.emissiveColor = new Color3(0.18, 0.22, 0.2); mat.specularColor = Color3.Black(); mat.alpha = 0.8;
      mesh.material = mat; mesh.isPickable = false; mesh.setEnabled(false); return { mesh, mat, age: 2 };
    });
  }
  start(origin: Vector3, yaw: number): boolean {
    if (this.active) return false;
    const points = planStoneSkips(origin, yaw);
    if (!points.length) return false;
    this.points = points; this.count = 0; this.segment = 0; this.elapsed = 0; this.active = true;
    this.from.set(origin.x, origin.y + 1.25, origin.z); this.setTarget();
    this.stone.position.copyFrom(this.from); this.stone.setEnabled(true);
    return true;
  }
  private setTarget(): void {
    const p = this.points[this.segment]!;
    this.target.set(p.x, CANAL.waterY + 0.08, p.z);
    this.duration = Math.max(0.22, Vector3.Distance(this.from, this.target) / 15);
  }
  update(dt: number): void {
    const step = Math.max(0, Math.min(0.1, dt));
    for (const ring of this.rings) {
      if (ring.age >= 1) continue;
      ring.age += step; ring.mesh.scaling.setAll(0.55 + ring.age * 1.8); ring.mat.alpha = Math.max(0, (1 - ring.age) * 0.8);
      if (ring.age >= 1) ring.mesh.setEnabled(false);
    }
    if (!this.active) return;
    this.elapsed += step;
    const t = Math.min(1, this.elapsed / this.duration);
    Vector3.LerpToRef(this.from, this.target, t, this.stone.position);
    this.stone.position.y += Math.sin(Math.PI * t) * (this.segment === 0 ? 1.05 : Math.max(0.1, 0.38 - this.segment * 0.04));
    this.stone.rotation.z += step * 15;
    if (t < 1) return;
    this.count++;
    const ring = this.rings[this.nextRing++ % this.rings.length]!;
    ring.age = 0; ring.mesh.position.copyFrom(this.target); ring.mesh.position.y = CANAL.waterY + 0.035;
    ring.mesh.scaling.setAll(0.55); ring.mat.alpha = 0.8; ring.mesh.setEnabled(true);
    this.onImpact(this.target, this.count);
    this.segment++;
    if (this.segment >= this.points.length) {
      this.active = false; this.stone.setEnabled(false); this.onFinish(this.count); return;
    }
    this.from.copyFrom(this.target); this.elapsed = 0; this.setTarget();
  }
  reset(): void {
    this.active = false; this.stone.setEnabled(false);
    for (const ring of this.rings) { ring.age = 2; ring.mesh.setEnabled(false); }
  }
  dispose(): void { this.reset(); this.stone.dispose(); this.stoneMat.dispose(); for (const ring of this.rings) { ring.mesh.dispose(); ring.mat.dispose(); } }
}
