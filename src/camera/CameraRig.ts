import { Scene, UniversalCamera, Vector3 } from "../babylon";
import { Group } from "../app/config";
import type { Input } from "../input/Input";
import type { Physics } from "../physics/Physics";

export type CamMode = "foot" | "interior" | "twoWheeler" | "car" | "bus" | "flight";

/** `aim`: how far above the focus the camera looks (default 0): on foot it looks above the head, so the figure sits low in the frame. */
interface ModeParams { dist: number; height: number; pitch: number; fov: number; follow: boolean; aim?: number }

const MODES: Record<CamMode, ModeParams> = {
  foot: { dist: 4.2, height: 1.55, pitch: 0.16, fov: 0.95, follow: false, aim: 0.45 },
  interior: { dist: 2.4, height: 1.5, pitch: 0.12, fov: 1.0, follow: false },
  twoWheeler: { dist: 4.3, height: 1.4, pitch: 0.2, fov: 1.0, follow: true },
  car: { dist: 5.6, height: 1.6, pitch: 0.22, fov: 1.0, follow: true },
  // Riding a ten-metre bus: well back and up, so the camera is not inside it.
  bus: { dist: 14, height: 3.4, pitch: 0.24, fov: 1.0, follow: true },
  flight: { dist: 11, height: 2.0, pitch: 0.28, fov: 1.05, follow: true },
};

export interface CamSettings { sensitivity: number; invertY: boolean; keySpeed: number }

/**
 * Third-person orbit camera. Mouse (pointer lock) or arrow keys orbit; in
 * vehicles it drifts back behind the heading after a short idle. A ray from
 * the focus point to the desired eye pulls the camera in front of walls and
 * eases back out once clear.
 */
export class CameraRig {
  readonly camera: UniversalCamera;
  yaw = 0;
  pitch = 0.18;
  mode: CamMode = "foot";
  private dist = 3.6;
  private obstructedDist = 99;
  private focus = new Vector3();
  private idleLook = 10;
  private fovCur = 0.95;
  settings: CamSettings = { sensitivity: 1, invertY: false, keySpeed: 1 };
  /** Extra zoom from the mouse wheel (multiplier). */
  private zoom = 1;

  constructor(scene: Scene, private input: Input, private physics: Physics) {
    this.camera = new UniversalCamera("playerCam", new Vector3(0, 3, -10), scene);
    this.camera.inputs.clear();
    this.camera.minZ = 0.08;
    this.camera.maxZ = 700;
    this.camera.fov = 0.95;
  }

  private shot: { eye: Vector3; at: Vector3; fov: number } | null = null;

  /** Hold a fixed shot (watching TV from the sofa); null hands back to the orbit camera. */
  hold(eye: Vector3 | null, at?: Vector3, fov = 0.9): void {
    this.shot = eye && at ? { eye, at, fov } : null;
  }

  setMode(m: CamMode): void {
    this.mode = m;
  }

  /** Snap behind a heading (used on spawn and when entering vehicles). */
  snapBehind(heading: number, focus: Vector3): void {
    this.yaw = heading;
    this.pitch = MODES[this.mode].pitch;
    this.focus.copyFrom(focus);
    this.dist = MODES[this.mode].dist;
  }

  /**
   * @param target point to orbit (e.g. character position)
   * @param heading yaw the subject faces (for auto-follow)
   * @param speed subject speed (for follow + FOV kick)
   */
  update(dt: number, target: Vector3, heading: number, speed: number): void {
    const p = MODES[this.mode];
    const m = this.input.consumeMouse();
    if (this.shot) {
      this.camera.position.copyFrom(this.shot.eye);
      this.camera.setTarget(this.shot.at);
      this.camera.fov = this.fovCur = this.shot.fov;
      return;
    }
    const sens = 0.0024 * this.settings.sensitivity;
    let manual = false;
    if (m.dx !== 0 || m.dy !== 0) {
      this.yaw += m.dx * sens;
      this.pitch += m.dy * sens * (this.settings.invertY ? -1 : 1);
      manual = true;
    }
    const kx = this.input.axis("camLeft", "camRight");
    const ky = this.input.axis("camDown", "camUp");
    if (kx || ky) {
      this.yaw += kx * dt * 2.2 * this.settings.keySpeed;
      this.pitch -= ky * dt * 1.4 * this.settings.keySpeed;
      manual = true;
    }
    if (m.wheel) this.zoom = Math.min(1.8, Math.max(0.6, this.zoom + m.wheel * 0.1));
    this.idleLook = manual ? 0 : this.idleLook + dt;
    // Vehicles: swing back behind the direction of travel when not steering the camera.
    // Touch players have no free hand for the camera while walking: drift behind gently.
    // Only while pushing mostly forward — otherwise a sideways stick plus a swinging
    // camera makes the player run in circles.
    const follow = p.follow || (this.input.touchMode && (this.mode === "foot" || this.mode === "interior") && this.input.stickForwardish);
    if (follow && this.idleLook > 1.2 && speed > (p.follow ? 2 : 1)) {
      let d = heading - this.yaw;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      this.yaw += d * (1 - Math.exp(-dt * (p.follow ? 2.2 : 0.9)));
      this.pitch += (p.pitch - this.pitch) * (1 - Math.exp(-dt * 1.5));
    }
    this.pitch = Math.max(-0.45, Math.min(1.1, this.pitch));
    const lookBack = this.input.isDown("lookBack") ? Math.PI : 0;

    // Smooth the focus point (vertical smoothing hides step-ups).
    const fx = target.x, fz = target.z, fy = target.y + p.height;
    this.focus.x += (fx - this.focus.x) * (1 - Math.exp(-dt * 22));
    this.focus.z += (fz - this.focus.z) * (1 - Math.exp(-dt * 22));
    this.focus.y += (fy - this.focus.y) * (1 - Math.exp(-dt * 10));
    if (Vector3.DistanceSquared(this.focus, new Vector3(fx, fy, fz)) > 25) this.focus.set(fx, fy, fz);

    const wanted = p.dist * this.zoom;
    this.dist += (wanted - this.dist) * (1 - Math.exp(-dt * 4));
    const yaw = this.yaw + lookBack;
    const dir = new Vector3(-Math.sin(yaw) * Math.cos(this.pitch), Math.sin(this.pitch), -Math.cos(yaw) * Math.cos(this.pitch));
    // Obstruction: cast from focus toward the eye against static geometry.
    const far = this.focus.add(dir.scale(this.dist + 0.3));
    // Only static geometry pulls the camera in. A parked car or a crate behind the figure would otherwise drag the
    // camera down to the figure's head.
    const hit = this.physics.raycast(this.focus, far, Group.STATIC);
    let allowed = this.dist;
    if (hit) allowed = Math.max(0.6, Vector3.Distance(this.focus, hit.hitPointWorld) - 0.3);
    // Pull in immediately, ease back out.
    if (allowed < this.obstructedDist) this.obstructedDist = allowed;
    else this.obstructedDist += (allowed - this.obstructedDist) * (1 - Math.exp(-dt * 3));
    const d = Math.min(this.dist, this.obstructedDist);
    const eye = this.focus.add(dir.scale(d));
    // Keep above ground.
    eye.y = Math.max(eye.y, 0.35);
    this.camera.position.copyFrom(eye);
    this.camera.setTarget(this.focus.add(new Vector3(0, -0.15 + (p.aim ?? 0), 0)));
    const fovT = p.fov + Math.min(0.12, Math.max(0, speed - 6) * 0.01);
    this.fovCur += (fovT - this.fovCur) * (1 - Math.exp(-dt * 3));
    this.camera.fov = this.fovCur;
  }

  /** Camera-relative forward (XZ). */
  forward(): Vector3 {
    return new Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw));
  }
}
