import {
  PhysicsBody, PhysicsMotionType, PhysicsShapeBox, PhysicsShapeContainer, Quaternion, Scene, TransformNode, Vector3,
  type IPhysicsCollisionEvent, type Observer,
} from "../babylon";
import { Group } from "../app/config";
import type { Physics } from "../physics/Physics";
import { SPECS, type VehicleSpec, type VehicleType } from "./specs";
import type { VehicleModel } from "./models";

export interface VehicleControls { throttle: number; steer: number; handbrake: boolean }

interface WheelState { compression: number; contact: boolean; spin: number; load: number; hitY: number; inHole: boolean }

/** What the road is like under a wheel (potholes kick, mud drags). */
export type SurfaceFn = (x: number, z: number) => { kind: "pothole" | "mud" | "patch" | "gravel" } | null;

const UP = new Vector3(0, 1, 0);

/**
 * Ground vehicle on a dynamic Havok body. Each fixed step:
 *  1. raycast suspension per wheel → spring/damper impulses at the mounts;
 *  2. longitudinal drive/brake and lateral grip impulses at the centre of mass;
 *  3. assisted yaw toward the bicycle-model turn rate, and (two-wheelers)
 *     assisted lean toward the balance angle for the current turn.
 * Havok then integrates the body; visuals are interpolated between steps.
 */
export class Vehicle {
  readonly spec: VehicleSpec;
  readonly node: TransformNode;
  readonly body: PhysicsBody;
  /** Seconds with the self-righting assist switched off (a vehicle meant to go over, e.g. a tipping e-rickshaw). */
  assistOff = 0;
  model: VehicleModel;
  controls: VehicleControls = { throttle: 0, steer: 0, handbrake: false };
  hasDriver = false;
  steerAngle = 0;
  private wheels: WheelState[];
  private prevPos = new Vector3();
  private currPos = new Vector3();
  private prevRot = new Quaternion();
  private currRot = new Quaternion();
  private lin = new Vector3();
  private ang = new Vector3();
  forwardSpeed = 0;
  grounded = false;
  /** Seconds the vehicle has been upside-down or stuck. */
  stuckTime = 0;
  /** Strongest collision impulse since last read (for sounds/cargo). */
  impact = 0;
  private collisionObs: Observer<IPhysicsCollisionEvent> | null = null;
  paint: string;
  /** Engine load 0..1 for audio. */
  load = 0;
  reversing = false;
  private brakeHold = 0;
  /** Commanded heading for the two-wheeler orientation controller. */
  private heading = 0;
  private lean = 0;
  /** Road condition lookup (set by the game). */
  surface: SurfaceFn | null = null;
  /** Fraction of wheels currently in mud (for audio/feedback). */
  mud = 0;
  /** Upgrade multipliers. */
  brakeBonus = 1;
  gripBonus = 1;
  /** Workshop engine work: more pull and a higher top end. */
  powerBonus = 1;

  constructor(
    readonly id: string,
    type: VehicleType,
    readonly scene: Scene,
    private physics: Physics,
    model: VehicleModel,
    pos: Vector3,
    yaw: number,
    paint: string,
  ) {
    this.spec = SPECS[type];
    this.model = model;
    this.paint = paint;
    this.node = new TransformNode(`${id}_body`, scene);
    this.node.position.copyFrom(pos);
    this.node.rotationQuaternion = Quaternion.RotationYawPitchRoll(yaw, 0, 0);
    const container = new PhysicsShapeContainer(scene);
    for (const b of this.spec.colliders) {
      const sh = new PhysicsShapeBox(Vector3.Zero(), Quaternion.Identity(), new Vector3(...b.s), scene);
      sh.material = { friction: 0.4, restitution: 0.1 };
      // Filters must be set on the child shapes; Havok filters per leaf shape.
      sh.filterMembershipMask = Group.VEHICLE;
      sh.filterCollideMask = 0xffff & ~Group.RESIDENT;
      container.addChild(sh, new Vector3(...b.c), Quaternion.Identity());
    }
    container.filterMembershipMask = Group.VEHICLE;
    container.filterCollideMask = 0xffff & ~Group.RESIDENT;
    this.body = new PhysicsBody(this.node, PhysicsMotionType.DYNAMIC, false, scene);
    this.body.shape = container;
    const m = this.spec.mass;
    // Box inertia from the main collider, then boosted in yaw/pitch for calmer handling.
    const s = this.spec.colliders[0]!.s;
    const ix = (m / 12) * (s[1] ** 2 + s[2] ** 2), iy = (m / 12) * (s[0] ** 2 + s[2] ** 2), iz = (m / 12) * (s[0] ** 2 + s[1] ** 2);
    this.body.setMassProperties({ mass: m, centerOfMass: new Vector3(...this.spec.com), inertia: new Vector3(ix * 1.5, iy * 1.3, iz * 1.6), inertiaOrientation: Quaternion.Identity() });
    this.body.setLinearDamping(0.05);
    this.body.setAngularDamping(0.6);
    this.body.disablePreStep = true;
    this.body.setCollisionCallbackEnabled(true);
    this.collisionObs = this.body.getCollisionObservable().add((ev) => {
      const imp = (ev as unknown as { impulse?: number }).impulse ?? 0;
      if (imp > this.impact) this.impact = imp;
    });
    this.heading = yaw;
    this.wheels = this.spec.wheels.map(() => ({ compression: 0, contact: false, spin: 0, load: 0, hitY: 0, inHole: false }));
    this.currPos.copyFrom(pos);
    this.prevPos.copyFrom(pos);
    this.currRot.copyFrom(this.node.rotationQuaternion);
    this.prevRot.copyFrom(this.currRot);
    this.model.root.position.copyFrom(pos);
    this.model.root.rotationQuaternion = this.currRot.clone();
  }

  get position(): Vector3 {
    return this.currPos;
  }

  get rotation(): Quaternion {
    return this.currRot;
  }

  get yaw(): number {
    const f = this.dir(new Vector3(0, 0, 1));
    return Math.atan2(f.x, f.z);
  }

  get speed(): number {
    return Math.abs(this.forwardSpeed);
  }

  /** World direction of a local axis. */
  dir(local: Vector3): Vector3 {
    return local.applyRotationQuaternion(this.node.rotationQuaternion!);
  }

  toWorld(local: Vector3): Vector3 {
    return local.applyRotationQuaternion(this.node.rotationQuaternion!).addInPlace(this.node.position);
  }

  /**
   * Go over onto one side and stay there (an auto that has been hit or caught
   * a pothole): a short roll that slides it a little sideways, then it lies
   * on its side like a wreck until it is cleared away.
   */
  private fall: { t: number; from: Quaternion; to: Quaternion; p0: Vector3; p1: Vector3 } | null = null;
  /** Lying on its side: no wheels, no assists, no driving. */
  wrecked = false;
  layOnSide(side: 1 | -1): void {
    if (this.wrecked) return;
    const yaw = this.yaw;
    const from = this.node.rotationQuaternion!.clone();
    const to = Quaternion.RotationYawPitchRoll(yaw, 0, -side * Math.PI / 2);
    const right = new Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
    const p0 = this.node.position.clone();
    const p1 = p0.add(right.scale(side * (this.spec.halfWidth + 0.6)));
    p1.y = p0.y + this.spec.halfWidth * 0.6;
    this.fall = { t: 0, from, to, p0, p1 };
    this.wrecked = true;
    this.assistOff = 1e9;
    this.controls = { throttle: 0, steer: 0, handbrake: true };
  }

  fixedUpdate(dt: number): void {
    if (this.fall) {
      // Roll over in about half a second, easing in like it is toppling.
      const f = this.fall;
      f.t = Math.min(1, f.t + dt / 0.55);
      const k = f.t * f.t;
      this.node.rotationQuaternion!.copyFrom(Quaternion.Slerp(f.from, f.to, k));
      this.node.position.copyFrom(Vector3.Lerp(f.p0, f.p1, f.t));
      this.node.position.y = f.p0.y + Math.sin(f.t * Math.PI) * 0.35 + (f.p1.y - f.p0.y) * f.t;
      this.physics.teleport(this.body, this.node);
      this.body.setLinearVelocity(Vector3.Zero());
      this.body.setAngularVelocity(Vector3.Zero());
      if (f.t >= 1) this.fall = null;
      return;
    }
    if (this.wrecked) return;
    const spec = this.spec;
    const q = this.node.rotationQuaternion!;
    const up = UP.applyRotationQuaternion(q);
    const fwd = new Vector3(0, 0, 1).applyRotationQuaternion(q);
    const right = new Vector3(1, 0, 0).applyRotationQuaternion(q);
    this.body.getLinearVelocityToRef(this.lin);
    this.body.getAngularVelocityToRef(this.ang);
    const com = this.toWorld(new Vector3(...spec.com));
    const mass = spec.mass + (this.hasDriver ? 70 : 0);

    // ---- Assisted rotation first (yaw toward the bicycle-model rate, lean / anti-roll),
    // so the suspension and tyre impulses applied below act on top of it.
    {
      const vf = Vector3.Dot(this.lin, fwd);
      const c = this.controls;
      const speedFactor = 1 / (1 + Math.abs(vf) * (spec.twoWheeler ? 0.06 : 0.08));
      const targetSteer = (this.hasDriver ? c.steer : 0) * spec.steerMax * speedFactor;
      const ds = targetSteer - this.steerAngle;
      this.steerAngle += Math.sign(ds) * Math.min(Math.abs(ds), spec.steerRate * dt);
      // Yaw is measured and assisted about the WORLD vertical: on a leaning
      // two-wheeler, rotating about the tilted body axis would roll it further.
      const yawRateNow = this.ang.y;
      let yawRate = yawRateNow;
      if (this.grounded) {
        const desired = (vf * Math.tan(this.steerAngle)) / spec.wheelbase;
        yawRate = yawRateNow + (desired - yawRateNow) * Math.min(1, dt * 14);
      }
      // ---- Lean / anti-roll.
      const roll = Math.asin(Math.max(-1, Math.min(1, -right.y)));
      let rollRate = Vector3.Dot(this.ang, fwd);
      if (spec.twoWheeler) {
        const leanTarget = this.hasDriver || Math.abs(vf) > 1 ? Math.max(-0.6, Math.min(0.6, Math.atan((vf * yawRate) / 9.81))) : 0.08;
        rollRate = -(leanTarget - roll) * 9;
        if (Math.abs(roll) > 0.75) rollRate += roll * 10; // never lie down
      } else if (spec.wheels.length === 3) {
        // Three-wheelers have a narrow tripod and tip easily in a real slalom;
        // a firm self-righting assist keeps the game's autos on their wheels
        // (they still lean visibly, and two wheels may lift a little).
        const k = Math.abs(roll) > 0.3 ? 14 : Math.abs(roll) > 0.08 ? 7 : 2;
        rollRate = rollRate * (Math.abs(roll) > 0.08 ? 0.4 : 0.8) + roll * k;
      } else if (this.assistOff <= 0) {
        // Four-wheelers: firm anti-roll (stiff anti-roll bars). The old gentle
        // assist only woke at 10° of lean, so cars sat crooked and wallowed.
        const k = Math.abs(roll) > 0.25 ? 10 : Math.abs(roll) > 0.04 ? 5 : 1.5;
        rollRate = rollRate * (Math.abs(roll) > 0.04 ? 0.45 : 0.85) + roll * k;
      }
      // Recompose angular velocity: keep pitch, replace yaw/roll by assisted values.
      let pitchRate = Vector3.Dot(this.ang, new Vector3(fwd.z, 0, -fwd.x).normalize());
      if (!spec.twoWheeler && this.assistOff <= 0) {
        // A tripod also tips about the diagonal (front wheel to a rear wheel),
        // which shows up as pitch: hold the nose level too.
        const pitch = Math.asin(Math.max(-1, Math.min(1, fwd.y)));
        // Four-wheelers too: no hobby-horsing over every bump.
        if (Math.abs(pitch) > 0.06) pitchRate = pitchRate * 0.5 + pitch * (spec.wheels.length === 3 ? 8 : 6);
        else pitchRate *= 0.9;
      }
      if (spec.twoWheeler) {
        this.balance(dt, vf, yawRate, fwd);
      } else if (this.grounded || (spec.wheels.length === 3 && Math.abs(roll) > 0.2)) {
        const fwdFlat = new Vector3(fwd.x, 0, fwd.z).normalize();
        const rightFlat = new Vector3(fwdFlat.z, 0, -fwdFlat.x);
        const nv = rightFlat.scale(pitchRate).add(UP.scale(yawRate)).add(fwdFlat.scale(rollRate));
        this.body.setAngularVelocity(nv);
      }
      this.body.getAngularVelocityToRef(this.ang);
    }
    // ---- Suspension
    let contacts = 0, driveContacts = 0, totalLoad = 0, mudWheels = 0;
    spec.wheels.forEach((w, i) => {
      const st = this.wheels[i]!;
      const rayLen = spec.suspRest + w.r;
      const mount = this.toWorld(new Vector3(w.x, w.y, w.z));
      const end = mount.subtract(up.scale(spec.suspRest + w.r));
      const hit = this.physics.raycast(mount, end, Group.STATIC | Group.PROP, this.body);
      if (hit && hit.hitNormalWorld.y > 0.3) {
        const dist = Vector3.Distance(mount, hit.hitPointWorld);
        const comp = rayLen - dist;
        const rate = (comp - st.compression) / dt;
        st.compression = comp;
        const f = Math.max(0, spec.suspK * comp + spec.suspC * rate);
        st.load = Math.min(f, mass * 9.81 * 3);
        st.contact = true;
        st.hitY = hit.hitPointWorld.y;
        this.body.applyImpulse(up.scale(st.load * dt), mount);
        // Road condition: a pothole gives the wheel a sharp kick as it drops in and out.
        const surf = this.surface?.(hit.hitPointWorld.x, hit.hitPointWorld.z) ?? null;
        const hole = surf?.kind === "pothole";
        if (hole !== st.inHole) {
          st.inHole = hole;
          const vf = Math.abs(Vector3.Dot(this.lin, new Vector3(0, 0, 1).applyRotationQuaternion(q)));
          if (vf > 1.5) {
            const k = Math.min(1, vf / 12) * mass * (spec.twoWheeler ? 1.1 : 0.9) / spec.wheels.length;
            this.body.applyImpulse(up.scale(hole ? -k * 0.6 : k * 1.4), mount);
            this.impact = Math.max(this.impact, k * 2);
          }
        }
        if (surf?.kind === "mud") mudWheels++;
        contacts++;
        if (w.drive) driveContacts++;
        totalLoad += st.load;
      } else {
        st.compression = 0;
        st.contact = false;
        st.load = 0;
      }
    });
    this.grounded = contacts > 0;
    this.mud = mudWheels / spec.wheels.length;

    // ---- Longitudinal: brake before reverse.
    const vf = Vector3.Dot(this.lin, fwd);
    const vl = Vector3.Dot(this.lin, right);
    this.forwardSpeed = vf;
    const c = this.controls;
    let drive = 0, brake = 0;
    if (!this.hasDriver) {
      brake = 1;
    } else if (c.throttle > 0.05) {
      if (vf < -0.4) brake = 1;
      else drive = c.throttle;
      this.reversing = false;
    } else if (c.throttle < -0.05) {
      // Hold S: brake to a stop first, then reverse after a short pause.
      if (vf > 0.4) { brake = 1; this.brakeHold = 0; }
      else {
        this.brakeHold += dt;
        if (spec.reverseMax > 0 && this.brakeHold > 0.25) { drive = c.throttle; this.reversing = true; }
        else brake = 1;
      }
    } else {
      this.brakeHold = 0;
    }
    if (c.handbrake) brake = Math.max(brake, 0.8);
    this.load = Math.abs(drive);
    if (this.grounded) {
      const groundFwd = fwd.subtract(UP.scale(Vector3.Dot(fwd, UP))).normalize();
      let fx = 0;
      if (drive > 0 && driveContacts > 0) {
        const r = vf / (spec.maxSpeed * this.powerBonus);
        fx += spec.engineForce * this.powerBonus * drive * Math.max(0, 1 - r * r);
      } else if (drive < 0 && driveContacts > 0) {
        const r = -vf / spec.reverseMax;
        fx += spec.engineForce * 0.6 * drive * Math.max(0, 1 - r * r);
      }
      // Rolling resistance and air drag (mud: heavy drag and wheel-spin).
      fx -= vf * (18 + this.mud * mass * 0.35) + vf * Math.abs(vf) * 0.9;
      if (this.mud > 0) fx *= 1 - this.mud * 0.25;
      let impulse = fx * dt;
      if (brake > 0) {
        const bmax = spec.brakeForce * this.brakeBonus * brake * dt;
        const stop = mass * Math.abs(vf);
        impulse -= Math.sign(vf) * Math.min(bmax, stop);
      }
      // Traction limit from wheel loads.
      const mu = 1.1;
      const tl = mu * Math.max(totalLoad, mass * 4) * dt;
      impulse = Math.max(-tl, Math.min(tl, impulse));
      this.body.applyImpulse(groundFwd.scale(impulse), com);

      // ---- Lateral grip.
      const grip = spec.grip * this.gripBonus * (c.handbrake ? 0.35 : 1) * (1 - this.mud * 0.45);
      let lat = -vl * mass * grip;
      const llim = 1.3 * Math.max(totalLoad, mass * 4) * dt;
      lat = Math.max(-llim, Math.min(llim, lat));
      this.body.applyImpulse(right.scale(lat), com.add(up.scale(-0.05)));
    }

    // Parked: settle completely to avoid creeping.
    if (!this.hasDriver && this.grounded && this.lin.lengthSquared() < 0.04) {
      // Parked: bleed off horizontal creep with an impulse (keeps suspension impulses intact).
      const h = new Vector3(this.lin.x, 0, this.lin.z);
      this.body.applyImpulse(h.scale(-0.95 * mass), com);
    }
    // Stuck / flipped detection for the recover prompt.
    //
    // This used to require !grounded, so it only ever caught a vehicle
    // beached on something. Wedge yourself against a parked rehri or a
    // handcart — which is most of how you get stuck in a bazaar — and the
    // wheels are still on the road, so the game decided you were fine: no
    // "press R" prompt, and R itself refused to do anything. You sat there
    // with the throttle wide open and no way out but to get off and walk.
    const shoving = this.hasDriver && Math.abs(c.throttle) > 0.5 && Math.abs(vf) < 0.2;
    if (up.y < 0.3 || shoving) this.stuckTime += dt;
    else this.stuckTime = 0;
  }

  /**
   * Two-wheeler assisted model: steer a commanded heading at the (grip-limited)
   * bicycle-model rate, lean into turns at the balance angle, follow terrain
   * pitch from the wheel contacts, and drive the body's angular velocity
   * toward that orientation. Collisions still push the body; the commanded
   * heading is clamped near the real one so walls win.
   */
  private balance(dt: number, vf: number, yawRate: number, fwd: Vector3): void {
    const actualYaw = Math.atan2(fwd.x, fwd.z);
    if (!this.hasDriver && Math.abs(vf) < 0.5) this.heading = actualYaw;
    else this.heading += yawRate * dt;
    let dh = Math.atan2(Math.sin(this.heading - actualYaw), Math.cos(this.heading - actualYaw));
    dh = Math.max(-0.25, Math.min(0.25, dh));
    this.heading = actualYaw + dh;
    const leanTarget = this.hasDriver || Math.abs(vf) > 1 ? Math.max(-0.6, Math.min(0.6, Math.atan((vf * yawRate) / 9.81))) : 0.04;
    this.lean += (leanTarget - this.lean) * Math.min(1, dt * 8);
    // Terrain pitch from the front/rear contact heights (nose-up is negative X rotation).
    let pitch = 0;
    const f = this.wheels[0]!, r = this.wheels[1]!;
    if (f.contact && r.contact) pitch = -Math.atan2(f.hitY - r.hitY, this.spec.wheelbase);
    else {
      const e = new Vector3();
      this.node.rotationQuaternion!.toEulerAnglesToRef(e);
      pitch = e.x * 0.9; // airborne: hold current pitch, damped
    }
    const target = Quaternion.RotationYawPitchRoll(this.heading, pitch, -this.lean);
    const cur = this.node.rotationQuaternion!;
    const err = target.multiply(Quaternion.Inverse(cur));
    if (err.w < 0) err.scaleInPlace(-1);
    const angle = 2 * Math.acos(Math.min(1, err.w));
    const sinH = Math.sqrt(Math.max(1e-9, 1 - err.w * err.w));
    const axis = new Vector3(err.x / sinH, err.y / sinH, err.z / sinH);
    const k = this.grounded ? 12 : 4;
    const w = angle > 1e-4 ? axis.scale(angle * k) : new Vector3();
    w.y += yawRate * (this.grounded ? 1 : 0.3);
    this.body.setAngularVelocity(w);
  }

  /** Called after the physics step: capture state for interpolation and wheel visuals. */
  postStep(dt: number): void {
    this.prevPos.copyFrom(this.currPos);
    this.prevRot.copyFrom(this.currRot);
    this.currPos.copyFrom(this.node.position);
    this.currRot.copyFrom(this.node.rotationQuaternion!);
    this.spec.wheels.forEach((w, i) => {
      const st = this.wheels[i]!;
      st.spin += (this.forwardSpeed / w.r) * dt;
    });
  }

  syncVisual(alpha: number): void {
    const r = this.model.root;
    Vector3.LerpToRef(this.prevPos, this.currPos, alpha, r.position);
    Quaternion.SlerpToRef(this.prevRot, this.currRot, alpha, r.rotationQuaternion!);
    this.model.steer.rotation.y = this.steerAngle * (this.spec.steerVisual ?? 1);
    this.spec.wheels.forEach((w, i) => {
      const st = this.wheels[i]!;
      const n = this.model.wheels[i]!;
      const ext = st.contact ? this.spec.suspRest - st.compression : this.spec.suspRest;
      n.position.set(w.x, w.y - ext, w.z);
      n.rotation.set(st.spin, w.steer ? this.steerAngle : 0, 0);
    });
  }

  /** Put the vehicle upright at a position (recovery / load). */
  placeAt(pos: Vector3, yaw: number): void {
    const q = Quaternion.RotationYawPitchRoll(yaw, 0, 0);
    this.fall = null;
    this.wrecked = false;
    this.assistOff = 0;
    this.node.position.copyFrom(pos);
    this.node.rotationQuaternion!.copyFrom(q);
    this.physics.teleport(this.body, this.node);
    this.heading = yaw;
    this.lean = 0;
    this.body.setLinearVelocity(Vector3.Zero());
    this.body.setAngularVelocity(Vector3.Zero());
    this.currPos.copyFrom(pos);
    this.prevPos.copyFrom(pos);
    this.currRot.copyFrom(q);
    this.prevRot.copyFrom(q);
    this.steerAngle = 0;
    this.stuckTime = 0;
  }

  consumeImpact(): number {
    const i = this.impact;
    this.impact = 0;
    return i;
  }

  dispose(): void {
    this.collisionObs?.remove();
    this.body.dispose();
    this.node.dispose();
    this.model.root.dispose();
  }
}
