import { PhysicsBody, PhysicsMotionType, PhysicsShapeBox, PhysicsShapeContainer, Quaternion, Scene, TransformNode, Vector3, type AbstractMesh, type Mesh } from "../babylon";
import { Group } from "../app/config";
import type { Physics } from "../physics/Physics";
import type { Materials } from "../render/Materials";
import { buildTrolley, type TrolleyLoad } from "../vehicles/models";
import type { Vehicle } from "../vehicles/Vehicle";

/**
 * Tractor trolleys, as things in the world. A trolley is either loose (it stands on the road: a static body that
 * vehicles bump into) or towed (it trails a tractor's rear hitch: a kinematic body the tractor collides with). Its
 * load sits on the bed in its own node, so it slides as the tractor brakes, accelerates and corners, and a loaded
 * trolley drags on the tractor it pulls. Trolleys (below) keeps the list, and does the hitching.
 */

/** From a tractor's origin to its rear hitch, behind it (m). */
export const TRACTOR_HITCH = 2.05;
/** From a trolley's axle to its hitch ring, ahead of it (m). */
export const TONGUE = 3.2;
/** How close a loose ring must be to a tractor's hitch to couple (m). */
export const REACH = 2.2;
/** A tractor may only be hitched or unhitched below this speed (m/s). */
export const STOPPED = 1;

const G = 9.81;
/** Rolling drag, as a fraction of the weight the trolley pulls. */
const ROLLING = 0.035;
/** Kilograms: the empty trolley, and what each load weighs. */
const TROLLEY_KG = 300;
const LOAD_KG: Record<TrolleyLoad, number> = { sugarcane: 1300, straw: 450, bricks: 2000, empty: 0 };
/**
 * The load's slide is a damped spring: natural frequency (rad/s), damping ratio, and the push it feels. A steady push of
 * a m/s² moves the load SLIDE_PER_PUSH × a / OMEGA² metres, so a hard brake (4 m/s²) shifts it about 0.25 m.
 */
const OMEGA = 3.5, ZETA = 0.3, SLIDE_PER_PUSH = 0.75;
/** How far the load can slide along the bed (z) and across it (x), in metres. */
const SLIDE_Z = 0.9, SLIDE_X = 0.3;

export type TrolleyState = "loose" | "towed";

/** The world's shadow-caster hooks (the same ones traffic uses for vehicles). */
export interface CasterHost {
  addCaster(m: AbstractMesh): void;
  removeCaster(m: AbstractMesh): void;
}

export class Trolley {
  readonly root: TransformNode;
  /** The load's node: the cargo is parented here and slides about the bed. */
  readonly loadRoot: TransformNode;
  readonly meshes: Mesh[];
  readonly body: PhysicsBody;
  private readonly shape: PhysicsShapeContainer;
  /** Kilograms: the trolley and its load. */
  readonly mass: number;
  state: TrolleyState;
  /** The tractor that pulls it (the player's or a traffic one), while it is towed. */
  tractor: Vehicle | null = null;
  /** Where the axle is, on the ground: the trolley's origin. */
  readonly axle = new Vector3();
  /** Heading: the trolley's forward (+z) points from its axle to the hitch ring. */
  yaw: number;
  private slideX = 0;
  private slideZ = 0;
  private velX = 0;
  private velZ = 0;
  /** The tractor's acceleration, smoothed (m/s², world x and z). */
  private push = new Vector3();
  private lastPos: Vector3 | null = null;
  private lastVel = new Vector3();

  constructor(
    scene: Scene, mats: Materials, private readonly physics: Physics, private readonly caster: CasterHost,
    id: string, load: TrolleyLoad, paint: string, x: number, z: number, yaw: number, state: TrolleyState,
  ) {
    const built = buildTrolley(scene, mats, id, load, paint);
    this.root = built.root;
    this.loadRoot = built.loadRoot;
    this.meshes = built.meshes;
    this.mass = TROLLEY_KG + LOAD_KG[load];
    this.state = state;
    this.yaw = yaw;
    this.axle.set(x, 0, z);
    this.root.position.set(x, 0, z);
    this.root.rotationQuaternion = Quaternion.RotationYawPitchRoll(yaw, 0, 0);
    for (const m of this.meshes) caster.addCaster(m);
    // Collision: the bed and the tongue, in the PROP group that vehicles collide with.
    this.shape = new PhysicsShapeContainer(scene);
    const bed = new PhysicsShapeBox(Vector3.Zero(), Quaternion.Identity(), new Vector3(2.0, 1.4, 3.6), scene);
    const tongue = new PhysicsShapeBox(Vector3.Zero(), Quaternion.Identity(), new Vector3(0.16, 0.16, 1.3), scene);
    for (const sh of [bed, tongue]) { sh.filterMembershipMask = Group.PROP; sh.filterCollideMask = 0xffff & ~Group.RESIDENT; }
    this.shape.addChild(bed, new Vector3(0, 0.8, 0.2), Quaternion.Identity());
    this.shape.addChild(tongue, new Vector3(0, 0.7, 2.55), Quaternion.Identity());
    this.shape.filterMembershipMask = Group.PROP;
    this.shape.filterCollideMask = 0xffff & ~Group.RESIDENT;
    this.body = new PhysicsBody(this.root, state === "towed" ? PhysicsMotionType.ANIMATED : PhysicsMotionType.STATIC, false, scene);
    this.body.shape = this.shape;
    this.body.disablePreStep = true;
  }

  /** Where the hitch ring is, on the ground: TONGUE ahead of the axle. */
  get ring(): Vector3 {
    return new Vector3(this.axle.x + Math.sin(this.yaw) * TONGUE, 0, this.axle.z + Math.cos(this.yaw) * TONGUE);
  }

  /** The rear hitch of a tractor, on the ground. */
  static hitchOf(v: Vehicle): Vector3 {
    return new Vector3(0, 0, -TRACTOR_HITCH).applyRotationQuaternion(v.node.rotationQuaternion!).addInPlace(v.node.position);
  }

  /** Couple to a tractor: the ring is brought to its hitch, and the trolley trails the tractor from now on. */
  attach(tractor: Vehicle): void {
    this.tractor = tractor;
    this.state = "towed";
    this.body.setMotionType(PhysicsMotionType.ANIMATED);
    this.lastPos = null;
    this.trail(Trolley.hitchOf(tractor), tractor.position.y);
  }

  /** Uncouple: the trolley stays where it stands, as a loose body. */
  detach(): void {
    if (this.tractor) this.tractor.towDrag = 0;
    this.tractor = null;
    this.state = "loose";
    this.body.setMotionType(PhysicsMotionType.STATIC);
  }

  /** One fixed step while towed: trail the hitch, slide the load, and drag on the tractor. */
  fixedUpdate(dt: number): void {
    const v = this.tractor;
    if (!v || this.state !== "towed") return;
    this.trail(Trolley.hitchOf(v), v.position.y);
    this.slide(v, dt);
    v.towDrag = ROLLING * this.mass * G;
  }

  /** Bring the axle TONGUE behind the hitch, turn to face it, and move the body there. */
  private trail(hitch: Vector3, tractorY: number): void {
    let dx = hitch.x - this.axle.x, dz = hitch.z - this.axle.z;
    const d = Math.hypot(dx, dz);
    if (d > 1e-4) { dx /= d; dz /= d; } else { dx = Math.sin(this.yaw); dz = Math.cos(this.yaw); }
    this.axle.set(hitch.x - dx * TONGUE, Math.max(0, tractorY - 0.05), hitch.z - dz * TONGUE);
    this.yaw = Math.atan2(dx, dz);
    this.root.position.copyFrom(this.axle);
    this.root.rotationQuaternion = Quaternion.RotationYawPitchRoll(this.yaw, 0, 0);
    this.physics.teleport(this.body, this.root);
  }

  /** The load slides about the bed: the tractor's push (braking, pulling away, cornering) moves it, and a spring brings it back. */
  private slide(v: Vehicle, dt: number): void {
    const p = v.position;
    if (this.lastPos) {
      const vx = (p.x - this.lastPos.x) / dt, vz = (p.z - this.lastPos.z) / dt;
      const ax = (vx - this.lastVel.x) / dt, az = (vz - this.lastVel.z) / dt;
      this.push.x += (ax - this.push.x) * 0.2;
      this.push.z += (az - this.push.z) * 0.2;
      this.lastVel.set(vx, 0, vz);
    }
    this.lastPos = p.clone();
    // The trolley's own axes: forward f = (sin yaw, cos yaw), and right r = (f.z, 0, -f.x) for this left-handed world.
    const fx = Math.sin(this.yaw), fz = Math.cos(this.yaw);
    const along = this.push.x * fx + this.push.z * fz;
    const across = this.push.x * fz - this.push.z * fx;
    const k = OMEGA * OMEGA, c = 2 * ZETA * OMEGA;
    this.velZ += (-k * this.slideZ - c * this.velZ - SLIDE_PER_PUSH * along) * dt;
    this.slideZ += this.velZ * dt;
    this.velX += (-k * this.slideX - c * this.velX - SLIDE_PER_PUSH * across) * dt;
    this.slideX += this.velX * dt;
    if (Math.abs(this.slideZ) > SLIDE_Z) { this.slideZ = Math.sign(this.slideZ) * SLIDE_Z; this.velZ = 0; }
    if (Math.abs(this.slideX) > SLIDE_X) { this.slideX = Math.sign(this.slideX) * SLIDE_X; this.velX = 0; }
    this.loadRoot.position.set(this.slideX, 0, this.slideZ);
  }

  /** Take it out of the world: its meshes, its shadows, and its body. */
  dispose(): void {
    if (this.tractor) this.tractor.towDrag = 0;
    this.tractor = null;
    for (const m of this.meshes) this.caster.removeCaster(m);
    this.body.dispose();
    this.shape.dispose();
    this.root.dispose();
  }
}

/**
 * The trolleys left about the farm roads at the start of a game: each on the edge of a kacha track (clear of the stretch
 * the tractor race will use), which way it faces, and what it carries.
 */
export const LOOSE_TROLLEYS: Array<{ x: number; z: number; yaw: number; load: TrolleyLoad; paint: string }> = [
  { x: -297.5, z: -240, yaw: 0, load: "straw", paint: "#c62828" },
  { x: -150, z: -397, yaw: Math.PI / 2, load: "sugarcane", paint: "#2e7d32" },
  { x: 303.5, z: 350, yaw: 0, load: "empty", paint: "#6d4c41" },
];

/** Every trolley in the world: the loose ones on the roads, and those being towed. */
export class Trolleys {
  readonly all: Trolley[] = [];
  private n = 0;

  constructor(private readonly host: { scene: Scene; mats: Materials; physics: Physics; caster: CasterHost }) {}

  /** A loose trolley, left where it stands, its tongue ahead along the heading yaw. */
  place(x: number, z: number, yaw: number, load: TrolleyLoad, paint: string): Trolley {
    return this.add(`loose${this.n++}`, load, paint, x, z, yaw, "loose");
  }

  /** A trolley hitched to a tractor: traffic gives one to most of the tractors it spawns. */
  tow(tractor: Vehicle, load: TrolleyLoad, paint: string): Trolley {
    const f = new Vector3(0, 0, 1).applyRotationQuaternion(tractor.node.rotationQuaternion!);
    const hitch = Trolley.hitchOf(tractor);
    const t = this.add(`towed${this.n++}`, load, paint, hitch.x - f.x * TONGUE, hitch.z - f.z * TONGUE, Math.atan2(f.x, f.z), "towed");
    t.attach(tractor);
    return t;
  }

  private add(id: string, load: TrolleyLoad, paint: string, x: number, z: number, yaw: number, state: TrolleyState): Trolley {
    const h = this.host;
    const t = new Trolley(h.scene, h.mats, h.physics, h.caster, id, load, paint, x, z, yaw, state);
    this.all.push(t);
    return t;
  }

  /** The loose trolley whose ring is in reach of this tractor's hitch, if there is one. */
  reach(tractor: Vehicle): Trolley | null {
    const h = Trolley.hitchOf(tractor);
    for (const t of this.all) {
      if (t.state !== "loose") continue;
      const r = t.ring;
      if (Math.hypot(r.x - h.x, r.z - h.z) < REACH) return t;
    }
    return null;
  }

  /** The trolley this tractor pulls, if it pulls one. */
  towedBy(tractor: Vehicle): Trolley | null {
    return this.all.find((t) => t.tractor === tractor) ?? null;
  }

  /** The hitch key: couple a loose trolley to a stopped tractor, or uncouple the one it pulls. */
  toggle(tractor: Vehicle): "hitched" | "unhitched" | "moving" | "none" {
    if (tractor.speed > STOPPED) return "moving";
    const mine = this.towedBy(tractor);
    if (mine) { mine.detach(); return "unhitched"; }
    const t = this.reach(tractor);
    if (!t) return "none";
    t.attach(tractor);
    return "hitched";
  }

  /** A tractor is going away (traffic despawns it): the trolley it pulls goes with it. */
  drop(tractor: Vehicle): void {
    const t = this.towedBy(tractor);
    if (t) this.remove(t);
  }

  fixedUpdate(dt: number): void {
    for (const t of this.all) t.fixedUpdate(dt);
  }

  clear(): void {
    for (const t of [...this.all]) this.remove(t);
  }

  private remove(t: Trolley): void {
    t.dispose();
    this.all.splice(this.all.indexOf(t), 1);
  }
}
