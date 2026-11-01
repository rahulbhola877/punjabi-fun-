import { Color3, Mesh, MeshBuilder, Scene, StandardMaterial, TransformNode, Vector3 } from "../babylon";

/** A little public target range on the open snow east of Maple Street. */
export const SNOW_RANGE = { x: 1390, z: 1704, radius: 25 } as const;
const TARGETS = [
  { x: 1382, z: 1717, phase: 0 },
  { x: 1390, z: 1719, phase: 2.1 },
  { x: 1398, z: 1717, phase: 4.2 },
] as const;
export const SNOW_ROUND_SECONDS = 35;
export const SNOW_ROUND_THROWS = 8;

/** The same deterministic motion drives rendering and aiming. */
export function snowTargetPosition(index: number, elapsed: number): { x: number; z: number } {
  const t = TARGETS[index];
  if (!t) throw new RangeError("Unknown snowball target");
  return { x: t.x + Math.sin(elapsed * 1.3 + t.phase) * 1.15, z: t.z };
}

/** Test the player's facing direction in the ground plane. Targets are small,
 * so missing by even a little feels different from simply pressing a button. */
export function aimSnowTarget(x: number, z: number, yaw: number, target: { x: number; z: number }): boolean {
  const dx = target.x - x, dz = target.z - z;
  const along = dx * Math.sin(yaw) + dz * Math.cos(yaw);
  const across = dx * Math.cos(yaw) - dz * Math.sin(yaw);
  return along >= 2 && along <= 23 && Math.abs(across) <= 0.85;
}

/** Local, time-limited rounds; only the finished best score needs saving. */
export class SnowballRound {
  active = false;
  remaining = 0;
  elapsed = 0;
  throws = 0;
  score = 0;
  lastHit: { x: number; z: number } | null = null;
  private cooldown = 0;
  private reset = [0, 0, 0];

  start(): void {
    this.active = true; this.remaining = SNOW_ROUND_SECONDS; this.elapsed = 0;
    this.throws = 0; this.score = 0; this.cooldown = 0; this.reset = [0, 0, 0]; this.lastHit = null;
  }
  update(dt: number): boolean {
    if (!this.active) return false;
    this.elapsed += dt; this.remaining = Math.max(0, this.remaining - dt);
    this.cooldown = Math.max(0, this.cooldown - dt);
    this.reset = this.reset.map((n) => Math.max(0, n - dt));
    if (this.remaining === 0) { this.active = false; return true; }
    return false;
  }
  targetUp(index: number): boolean { return this.active && (this.reset[index] ?? 0) <= 0; }
  throw(x: number, z: number, yaw: number, blocked: (x: number, z: number) => boolean = () => false): "wait" | "miss" | "hit" | "finished" {
    if (!this.active || this.cooldown > 0) return "wait";
    this.cooldown = 0.45; this.throws++; this.lastHit = null;
    const candidates = TARGETS.map((_, i) => ({ i, p: snowTargetPosition(i, this.elapsed) }))
      .filter(({ i, p }) => this.targetUp(i) && aimSnowTarget(x, z, yaw, p) && !blocked(p.x, p.z))
      .sort((a, b) => Math.hypot(a.p.x - x, a.p.z - z) - Math.hypot(b.p.x - x, b.p.z - z));
    if (candidates.length) { this.score++; this.reset[candidates[0]!.i] = 1.3; this.lastHit = candidates[0]!.p; }
    if (this.throws >= SNOW_ROUND_THROWS) { this.active = false; return "finished"; }
    return candidates.length ? "hit" : "miss";
  }
}

/** Small temporary range meshes; no collision or permanent world geometry. */
export class SnowballRange {
  readonly round = new SnowballRound();
  private targets: TransformNode[];
  private materials: StandardMaterial[];
  private ball: Mesh;
  private ballTime = 0;
  private ballFrom = Vector3.Zero();
  private ballTo = Vector3.Zero();
  constructor(scene: Scene) {
    const red = new StandardMaterial("snow_range_red", scene); red.diffuseColor = Color3.FromHexString("#bf393d");
    const light = new StandardMaterial("snow_range_light", scene); light.diffuseColor = Color3.FromHexString("#f4ebd8");
    this.materials = [red, light];
    this.ball = MeshBuilder.CreateSphere("snowball", { diameter: 0.28, segments: 8 }, scene);
    this.ball.material = light; this.ball.isPickable = false; this.ball.setEnabled(false);
    this.targets = TARGETS.map((_, i) => {
      const root = new TransformNode(`snow_target_${i}`, scene);
      const post = MeshBuilder.CreateBox(`snow_post_${i}`, { width: 0.15, height: 1.4, depth: 0.15 }, scene);
      post.position.y = 0.7; post.parent = root; post.material = light; post.isPickable = false;
      const face = MeshBuilder.CreateBox(`snow_face_${i}`, { width: 1.5, height: 1.5, depth: 0.16 }, scene);
      face.position.y = 1.55; face.parent = root; face.material = red; face.isPickable = false;
      const bull = MeshBuilder.CreateCylinder(`snow_bull_${i}`, { diameter: 0.55, height: 0.03, tessellation: 12 }, scene);
      bull.rotation.x = Math.PI / 2; bull.position.set(0, 1.55, -0.1); bull.parent = root; bull.material = light; bull.isPickable = false;
      root.setEnabled(false);
      return root;
    });
  }
  launch(from: Vector3, yaw: number): void {
    const hit = this.round.lastHit;
    this.ballFrom.copyFrom(from);
    this.ballTo.set(hit?.x ?? from.x + Math.sin(yaw) * 16, 1.45, hit?.z ?? from.z + Math.cos(yaw) * 16);
    this.ballTime = 0.3; this.ball.position.copyFrom(from); this.ball.setEnabled(true);
  }
  sync(dt = 0): void {
    this.targets.forEach((mesh, i) => {
      const p = snowTargetPosition(i, this.round.elapsed);
      mesh.position.set(p.x, 0, p.z); mesh.setEnabled(this.round.targetUp(i));
    });
    if (this.ballTime > 0) {
      this.ballTime = Math.max(0, this.ballTime - dt);
      const t = 1 - this.ballTime / 0.3;
      Vector3.LerpToRef(this.ballFrom, this.ballTo, t, this.ball.position);
      this.ball.position.y += Math.sin(t * Math.PI) * 0.6;
      if (!this.ballTime) this.ball.setEnabled(false);
    }
  }
  dispose(): void { this.targets.forEach((m) => m.dispose()); this.ball.dispose(); this.materials.forEach((m) => m.dispose()); }
}
