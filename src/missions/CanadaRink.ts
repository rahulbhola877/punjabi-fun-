import { Color3, DynamicTexture, Mesh, MeshBuilder, Scene, StandardMaterial } from "../babylon";

/** A neighborhood rink behind Maple Street. Distances are in world metres. */
export const CANADA_RINK = { x: 1245, z: 1740, halfWidth: 14, halfLength: 18, goalHalfWidth: 2.2 } as const;
export function onCanadaIce(x: number, z: number): boolean {
  return Math.abs(x - CANADA_RINK.x) < CANADA_RINK.halfWidth - 0.35 && Math.abs(z - CANADA_RINK.z) < CANADA_RINK.halfLength - 0.35;
}

/** A small 2-D ice simulation: the puck has momentum, rebounds and can be scored at either end. */
export class RinkPuck {
  x: number = CANADA_RINK.x;
  z: number = CANADA_RINK.z;
  vx = 0;
  vz = 0;
  private cooldown = 0;
  reset(): void { this.x = CANADA_RINK.x; this.z = CANADA_RINK.z; this.vx = 0; this.vz = 0; this.cooldown = 0; }
  isNear(x: number, z: number): boolean { return onCanadaIce(x, z) && Math.hypot(x - this.x, z - this.z) <= 2.2; }
  kick(x: number, z: number, yaw: number): boolean {
    if (this.cooldown > 0 || !this.isNear(x, z) || !Number.isFinite(yaw)) return false;
    this.vx = Math.sin(yaw) * 19; this.vz = Math.cos(yaw) * 19; this.cooldown = 0.3;
    return true;
  }
  /** Returns true when the puck crosses a goal line. */
  update(dt: number): boolean {
    if (!Number.isFinite(dt) || dt <= 0) return false;
    // Substeps prevent a slow render frame from skipping a board or goal.
    const steps = Math.ceil(Math.min(dt, 0.2) / 0.02), step = Math.min(dt, 0.2) / steps;
    for (let i = 0; i < steps; i++) {
      this.cooldown = Math.max(0, this.cooldown - step);
      this.x += this.vx * step; this.z += this.vz * step;
      const edgeX = CANADA_RINK.halfWidth - 0.35, edgeZ = CANADA_RINK.halfLength - 0.35;
      if (Math.abs(this.x - CANADA_RINK.x) > edgeX) {
        this.x = CANADA_RINK.x + Math.sign(this.x - CANADA_RINK.x) * edgeX; this.vx *= -0.8;
      }
      if (Math.abs(this.z - CANADA_RINK.z) > edgeZ) {
        if (Math.abs(this.x - CANADA_RINK.x) < CANADA_RINK.goalHalfWidth) {
          this.reset(); return true;
        }
        this.z = CANADA_RINK.z + Math.sign(this.z - CANADA_RINK.z) * edgeZ; this.vz *= -0.8;
      }
      const friction = Math.exp(-0.48 * step); this.vx *= friction; this.vz *= friction;
    }
    return false;
  }
}

/** The puck and a physical scoreboard; geometry is owned by the scene. */
export class CanadaRink {
  readonly puck = new RinkPuck();
  private mesh: Mesh;
  private scoreboard: DynamicTexture;
  private score = -1;
  constructor(scene: Scene) {
    const puckMat = new StandardMaterial("rinkPuckMaterial", scene); puckMat.diffuseColor = Color3.FromHexString("#252f36");
    this.mesh = MeshBuilder.CreateCylinder("rinkPuck", { diameter: 0.62, height: 0.17, tessellation: 16 }, scene);
    this.mesh.material = puckMat; this.mesh.isPickable = false;
    this.scoreboard = new DynamicTexture("rinkScore", { width: 512, height: 256 }, scene, true);
    const scoreMat = new StandardMaterial("rinkScoreMaterial", scene); scoreMat.diffuseTexture = this.scoreboard;
    scoreMat.emissiveColor = new Color3(0.32, 0.32, 0.32); scoreMat.backFaceCulling = false;
    const board = MeshBuilder.CreatePlane("rinkScoreBoard", { width: 4, height: 2 }, scene);
    board.position.set(CANADA_RINK.x + 12, 3, CANADA_RINK.z); board.rotation.y = -Math.PI / 2; board.material = scoreMat; board.isPickable = false;
    this.sync(0);
  }
  sync(goals: number): void {
    this.mesh.position.set(this.puck.x, 0.14, this.puck.z);
    const score = Number.isFinite(goals) ? Math.max(0, Math.floor(goals)) : 0;
    if (score === this.score) return;
    this.score = score;
    const c = this.scoreboard.getContext() as CanvasRenderingContext2D;
    c.fillStyle = "#264653"; c.fillRect(0, 0, 512, 256);
    c.fillStyle = "#f7f0dc"; c.textAlign = "center"; c.font = "bold 46px sans-serif"; c.fillText("MAPLE STREET RINK", 256, 73);
    c.fillStyle = "#f9d98a"; c.font = "bold 95px sans-serif"; c.fillText(String(score), 256, 182);
    c.fillStyle = "#f7f0dc"; c.font = "30px sans-serif"; c.fillText("GOALS", 256, 227); this.scoreboard.update();
  }
}
