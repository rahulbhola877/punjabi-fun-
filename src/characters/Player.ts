import {
  CharacterSupportedState, PhysicsCharacterController, Quaternion, Scene, Vector3, type CharacterSurfaceInfo, type Material,
} from "../babylon";
import { GRAVITY, Group } from "../app/config";
import type { Input } from "../input/Input";
import { buildHuman, type Appearance, type BuiltHuman } from "./HumanBuilder";
import { HumanAnimator, type BasePose } from "./HumanAnimator";
import { SAFE_SPOTS, WORLD_BOUNDS_PAD } from "../world/safety";

const RADIUS = 0.3;
const RUN = 3.9;
const SPRINT = 6.2;
const JUMP_V = 4.4;

/**
 * The player on foot: a Havok character-controller capsule (authoritative),
 * plus a skinned visual that is interpolated between fixed steps.
 */
export class Player {
  human!: BuiltHuman;
  anim!: HumanAnimator;
  cc!: PhysicsCharacterController;
  private height = 1.7;
  yaw = 0;
  private prev = new Vector3();
  private curr = new Vector3();
  private velocity = new Vector3();
  grounded = false;
  private support: CharacterSurfaceInfo | null = null;
  private coyote = 0;
  /** Briefly ignore ground support right after a jump so it is not cancelled. */
  private jumpLock = 0;
  private jumpBuffer = 0;
  private airTime = 0;
  /** Set while driving; disables the capsule and hides nothing (rider is shown on the vehicle). */
  inVehicle = false;
  carrying = false;
  /** Movement intent from input, relative to camera, set each frame. */
  private wantSprint = false;
  private gravity = new Vector3(0, GRAVITY, 0);
  onLand: ((impact: number) => void) | null = null;
  pose: BasePose = "stand";
  steer = 0;
  lookYaw = 0;
  /** Sprint/run speed multiplier from snacks and drinks. */
  speedMul = 1;
  /** True after a fall recovery this frame (for UI feedback). */
  recovered = false;
  /** Seconds during which movement input is ignored (throwing a punch, being hit). */
  frozen = 0;
  /** Knocked out: lies on the ground, no control. */
  down = false;
  /** Knockback velocity from blows, decays quickly. */
  private knock = new Vector3();

  /** Raycaster for the step assist (set by the game). */
  raycast: ((from: Vector3, to: Vector3) => { y: number; ny: number } | null) | null = null;
  private blockedT = 0;

  constructor(private scene: Scene, private input: Input) {}

  /**
   * Step assist: when walking into a low ledge (kerb, doorstep) that the
   * capsule cannot ride over, probe ahead and lift onto it if it is low enough.
   */
  private tryStepUp(dir: Vector3): boolean {
    if (!this.raycast) return false;
    const feet = this.curr.subtract(new Vector3(0, this.height / 2, 0));
    const ahead = feet.add(dir.scale(RADIUS + 0.18));
    const hit = this.raycast(ahead.add(new Vector3(0, 0.45, 0)), ahead.add(new Vector3(0, -0.05, 0)));
    if (!hit || hit.ny < 0.8) return false;
    const rise = hit.y - feet.y;
    if (rise < 0.04 || rise > 0.38) return false;
    // Headroom check above the ledge.
    const head = this.raycast(new Vector3(ahead.x, hit.y + this.height + 0.05, ahead.z), new Vector3(ahead.x, hit.y + 0.06, ahead.z));
    if (head) return false;
    // Move the capsule centre past the edge so its rounded bottom rests on the
    // top surface rather than balancing on (and sliding back off) the corner.
    const fwd = RADIUS + 0.06;
    const c = new Vector3(feet.x + dir.x * fwd, hit.y + this.height / 2 + 0.025, feet.z + dir.z * fwd);
    this.cc.setPosition(c);
    this.curr.copyFrom(c);
    return true;
  }

  spawn(look: Appearance, mat: Material, pos: Vector3, yaw: number): void {
    this.human?.root.dispose(false, false);
    this.human = buildHuman(this.scene, "player", look, mat);
    this.anim = new HumanAnimator(this.human);
    this.height = Math.max(1.4, look.height);
    if (!this.cc) {
      this.cc = new PhysicsCharacterController(pos.add(new Vector3(0, this.height / 2 + 0.02, 0)), { capsuleHeight: this.height, capsuleRadius: RADIUS }, this.scene);
      this.cc.maxStepHeight = 0.36;
      this.cc.maxSlopeCosine = Math.cos((62 * Math.PI) / 180);
      this.cc.keepDistance = 0.04;
      this.cc.characterMass = 70;
      this.cc.characterStrength = 900;
      // Tag the capsule so world raycasts (camera, ground probes) ignore it.
      this.cc.shape.filterMembershipMask = Group.PLAYER;
      this.cc.shape.filterCollideMask = 0xffff & ~Group.RESIDENT;
    }
    this.teleport(pos, yaw);
  }

  /** Rebuild the visual (new outfit) without moving the capsule. */
  restyle(look: Appearance, mat: Material): void {
    const parent = this.human.root.parent;
    const pos = this.human.root.position.clone();
    const rot = this.human.root.rotationQuaternion?.clone() ?? null;
    this.human.root.dispose(false, false);
    this.human = buildHuman(this.scene, "player", look, mat);
    this.anim = new HumanAnimator(this.human);
    this.human.root.parent = parent;
    this.human.root.position.copyFrom(pos);
    if (rot) this.human.root.rotationQuaternion = rot;
  }

  /** Feet position. */
  get feet(): Vector3 {
    return this.curr.subtract(new Vector3(0, this.height / 2, 0));
  }

  get capsuleCenter(): Vector3 {
    return this.curr;
  }

  get speed(): number {
    return Math.hypot(this.velocity.x, this.velocity.z);
  }

  teleport(feet: Vector3, yaw: number): void {
    const c = feet.add(new Vector3(0, this.height / 2 + 0.03, 0));
    this.cc.setPosition(c);
    this.cc.setVelocity(Vector3.Zero());
    this.prev.copyFrom(c);
    this.curr.copyFrom(c);
    this.velocity.setAll(0);
    this.yaw = yaw;
    this.syncVisual(1);
  }

  /** Read edge-triggered input once per rendered frame. */
  frameInput(): void {
    if (this.input.wasPressed("jump")) this.jumpBuffer = 0.15;
    this.wantSprint = this.input.isDown("sprint");
  }

  fixedUpdate(dt: number, camYaw: number): void {
    this.recovered = false;
    if (this.inVehicle) return;
    const fwd = this.input.axis("back", "forward");
    const side = this.input.axis("left", "right");
    this.frozen = Math.max(0, this.frozen - dt);
    const len = this.down || this.frozen > 0 ? 0 : Math.hypot(fwd, side);
    const target = new Vector3();
    if (len > 0) {
      const s = Math.sin(camYaw), c = Math.cos(camYaw);
      // Analog sticks scale speed (walk → run); pushing a stick fully on touch sprints.
      const mag = this.input.moveMagnitude;
      const touchSprint = this.input.touchMode && mag > 0.95;
      const speed = (this.wantSprint || touchSprint ? SPRINT : RUN) * Math.max(0.35, mag) * this.speedMul;
      target.set((s * fwd + c * side) / len * speed, 0, (c * fwd - s * side) / len * speed);
    }
    this.support = this.cc.checkSupport(dt, new Vector3(0, -1, 0));
    const wasGrounded = this.grounded;
    this.jumpLock = Math.max(0, this.jumpLock - dt);
    this.grounded = this.support.supportedState === CharacterSupportedState.SUPPORTED && this.jumpLock <= 0;
    this.coyote = this.grounded ? 0.12 : Math.max(0, this.coyote - dt);
    this.jumpBuffer = Math.max(0, this.jumpBuffer - dt);
    const v = this.cc.getVelocity().clone();
    const accel = this.grounded ? 22 : 5;
    const dx = target.x - v.x, dz = target.z - v.z;
    const dl = Math.hypot(dx, dz);
    const maxDv = accel * dt;
    if (dl > maxDv) {
      v.x += (dx / dl) * maxDv;
      v.z += (dz / dl) * maxDv;
    } else {
      v.x = target.x;
      v.z = target.z;
    }
    if (this.grounded) {
      if (!wasGrounded && this.airTime > 0.25) this.onLand?.(Math.min(1, -this.velocity.y / 9));
      this.airTime = 0;
      v.y = -1.5; // light stick-to-ground
    } else {
      this.airTime += dt;
      v.y = Math.max(-30, v.y + GRAVITY * dt);
    }
    v.x += this.knock.x;
    v.z += this.knock.z;
    this.knock.scaleInPlace(Math.exp(-dt * 10));
    if (this.jumpBuffer > 0 && this.coyote > 0 && !this.down && this.frozen <= 0) {
      v.y = JUMP_V;
      this.jumpLock = 0.2;
      this.jumpBuffer = 0;
      this.coyote = 0;
      this.grounded = false;
    }
    this.cc.setVelocity(v);
    this.cc.integrate(dt, this.support, this.gravity);
    this.prev.copyFrom(this.curr);
    this.curr.copyFrom(this.cc.getPosition());
    this.velocity.copyFrom(this.cc.getVelocity());
    // Blocked while trying to move on the ground → maybe a step.
    const want = Math.hypot(target.x, target.z);
    const got = Math.hypot(this.velocity.x, this.velocity.z);
    if (this.grounded && want > 0.5 && got < want * 0.35) {
      this.blockedT += dt;
      if (this.blockedT > 0.05 && this.tryStepUp(new Vector3(target.x / want, 0, target.z / want))) this.blockedT = 0;
    } else this.blockedT = 0;
    // Face the direction of travel.
    if (len > 0 && !this.down) {
      const want = Math.atan2(target.x, target.z);
      let d = want - this.yaw;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      this.yaw += d * (1 - Math.exp(-dt * 12));
    }
    // Recovery from invalid positions (fell through, out of bounds).
    const p = this.curr;
    const B = WORLD_BOUNDS_PAD;
    if (p.y < -4 || p.x < B.minX || p.x > B.maxX || p.z < B.minZ || p.z > B.maxZ || !Number.isFinite(p.x + p.y + p.z)) {
      this.recoverToSafety();
    }
  }

  /** A blow pushes the player (m/s, horizontal). */
  push(dx: number, dz: number): void {
    this.knock.x += dx;
    this.knock.z += dz;
  }

  recoverToSafety(): void {
    const p = this.curr;
    let best = SAFE_SPOTS[0]!;
    let bd = Infinity;
    for (const s of SAFE_SPOTS) {
      const d = (s.x - p.x) ** 2 + (s.z - p.z) ** 2;
      if (d < bd && Number.isFinite(d)) { bd = d; best = s; }
    }
    this.teleport(new Vector3(best.x, 0.2, best.z), this.yaw);
    this.recovered = true;
  }

  /** Disable the capsule while riding (parked far below the world). */
  enterVehicle(): void {
    this.inVehicle = true;
    this.cc.setPosition(new Vector3(0, -50, 0));
    this.cc.setVelocity(Vector3.Zero());
  }

  exitVehicle(feet: Vector3, yaw: number): void {
    this.inVehicle = false;
    this.pose = "stand";
    this.human.root.parent = null;
    this.teleport(feet, yaw);
  }

  /** Interpolated visual sync; alpha in [0,1). */
  syncVisual(alpha: number): void {
    if (this.inVehicle) return;
    const r = this.human.root;
    Vector3.LerpToRef(this.prev, this.curr, alpha, r.position);
    r.position.y -= this.height / 2;
    r.rotationQuaternion = Quaternion.RotationYawPitchRoll(this.yaw, 0, 0);
  }

  animate(dt: number): void {
    this.anim.update(dt, {
      speed: this.inVehicle ? 0 : this.speed,
      grounded: this.inVehicle || this.grounded || this.airTime < 0.15,
      pose: this.inVehicle ? this.pose : this.down ? "down" : "stand",
      carry: this.carrying && !this.inVehicle,
      lookYaw: this.lookYaw,
      steer: this.steer,
    });
  }

  dispose(): void {
    this.cc?.dispose();
    this.human?.root.dispose();
  }
}
