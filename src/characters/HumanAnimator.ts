import { Quaternion, Space, Vector3 } from "@babylonjs/core";
import { B, BONE_COUNT, type BuiltHuman } from "./HumanBuilder";

export type BasePose = "stand" | "sit" | "ride" | "drive";
export type Gesture = "none" | "talk" | "wave" | "startled" | "greet" | "point" | "work" | "cheer";

export interface AnimInput {
  /** Horizontal speed in m/s. */
  speed: number;
  grounded: boolean;
  pose: BasePose;
  carry: boolean;
  /** Head yaw relative to the body (radians). */
  lookYaw: number;
  /** Optional steering input for riders (-1..1). */
  steer?: number;
}

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

/**
 * Procedural animation: each frame computes a target pose from locomotion,
 * base pose and an optional timed gesture, then eases the current pose toward
 * it. No keyframe assets are needed and transitions are always smooth.
 */
export class HumanAnimator {
  private cur = new Float32Array(BONE_COUNT * 3);
  private tgt = new Float32Array(BONE_COUNT * 3);
  private phase = 0;
  private t = Math.random() * 10;
  private gesture: Gesture = "none";
  private gestureT = 0;
  private gestureDur = 0;
  private hipsY = 0;
  private q = new Quaternion();
  private v = new Vector3();
  /** Fires when a foot plants (for footstep sounds). */
  onFootstep: ((strength: number) => void) | null = null;
  private lastStepSign = 0;
  /** Personal rhythm so crowds do not move in lockstep. */
  readonly tempo = 0.92 + Math.random() * 0.16;

  constructor(private h: BuiltHuman) {}

  play(g: Gesture, duration: number): void {
    this.gesture = g;
    this.gestureT = 0;
    this.gestureDur = duration;
  }

  get currentGesture(): Gesture {
    return this.gesture;
  }

  private set(bone: number, x: number, y: number, z: number): void {
    this.tgt[bone * 3] = x;
    this.tgt[bone * 3 + 1] = y;
    this.tgt[bone * 3 + 2] = z;
  }

  private add(bone: number, x: number, y: number, z: number, w = 1): void {
    this.tgt[bone * 3] += x * w;
    this.tgt[bone * 3 + 1] += y * w;
    this.tgt[bone * 3 + 2] += z * w;
  }

  update(dt: number, inp: AnimInput): void {
    this.t += dt;
    this.tgt.fill(0);
    const t = this.t;
    const sp = inp.pose === "stand" ? inp.speed : 0;
    const walk = clamp(sp / 1.4, 0, 1);
    const run = clamp((sp - 2.6) / 2.4, 0, 1);
    const stride = 0.72 + run * 0.45;
    this.phase += (dt * sp / stride) * Math.PI * this.tempo;
    const s = Math.sin(this.phase), c = Math.cos(this.phase);
    let hipsBob = 0;

    if (inp.pose === "stand") {
      if (inp.grounded) {
        const A = 0.42 * walk + 0.32 * run;
        const K = 0.6 * walk + 0.75 * run;
        this.set(B.thighL, -A * s - 0.05 * run, 0, -0.02);
        this.set(B.thighR, A * s - 0.05 * run, 0, 0.02);
        const kL = K * Math.pow(Math.max(0, c), 1.4) + 0.06 * walk;
        const kR = K * Math.pow(Math.max(0, -c), 1.4) + 0.06 * walk;
        this.set(B.shinL, kL, 0, 0);
        this.set(B.shinR, kR, 0, 0);
        this.set(B.footL, -(-A * s + kL) * 0.45, 0, 0);
        this.set(B.footR, -(A * s + kR) * 0.45, 0, 0);
        hipsBob = -0.022 * (walk + run) * Math.abs(c) + 0.01 * walk;
        this.set(B.hips, 0, 0.1 * s * walk, 0.03 * c * walk);
        this.set(B.spine, 0.03 * walk + 0.12 * run, -0.06 * s * walk, 0);
        this.set(B.chest, 0.01 * Math.sin(t * 1.5), -0.1 * s * walk, -0.02 * c * walk);
        const arm = 0.32 * walk + 0.5 * run;
        this.set(B.uArmL, arm * s, 0, -0.09 - 0.05 * run);
        this.set(B.uArmR, -arm * s, 0, 0.09 + 0.05 * run);
        this.set(B.fArmL, -0.15 - 0.18 * walk - 0.95 * run + Math.min(0, arm * s) * 0.4, 0, 0);
        this.set(B.fArmR, -0.15 - 0.18 * walk - 0.95 * run + Math.min(0, -arm * s) * 0.4, 0, 0);
        // Idle weight shift and breathing.
        const idle = 1 - walk;
        this.add(B.hips, 0, 0, 0.025 * Math.sin(t * 0.6), idle);
        this.add(B.uArmL, 0, 0, -0.015 * Math.sin(t * 1.5), idle);
        this.add(B.uArmR, 0, 0, 0.015 * Math.sin(t * 1.5), idle);
        // Footstep events at heel strike.
        const sign = Math.sign(s);
        if (walk > 0.2 && sign !== this.lastStepSign && sign !== 0) {
          this.lastStepSign = sign;
          this.onFootstep?.(0.5 + run * 0.5);
        }
      } else {
        // Airborne: tuck legs slightly, arms out for balance.
        this.set(B.thighL, -0.7, 0, -0.05);
        this.set(B.thighR, -0.25, 0, 0.05);
        this.set(B.shinL, 1.0, 0, 0);
        this.set(B.shinR, 0.5, 0, 0);
        this.set(B.uArmL, -0.3, 0, -0.75);
        this.set(B.uArmR, -0.3, 0, 0.75);
        this.set(B.fArmL, -0.5, 0, 0);
        this.set(B.fArmR, -0.5, 0, 0);
        this.set(B.spine, 0.08, 0, 0);
      }
    } else if (inp.pose === "sit") {
      this.set(B.thighL, -1.5, 0, -0.06);
      this.set(B.thighR, -1.5, 0, 0.06);
      this.set(B.shinL, 1.45, 0, 0);
      this.set(B.shinR, 1.45, 0, 0);
      this.set(B.footL, 0.05, 0, 0);
      this.set(B.footR, 0.05, 0, 0);
      this.set(B.spine, 0.06 + 0.02 * Math.sin(t * 1.3), 0, 0);
      this.set(B.uArmL, -0.45, 0, -0.06);
      this.set(B.uArmR, -0.45, 0, 0.06);
      this.set(B.fArmL, -0.95, 0, 0);
      this.set(B.fArmR, -0.95, 0, 0);
    } else {
      const drive = inp.pose === "drive";
      const steer = inp.steer ?? 0;
      this.set(B.thighL, drive ? -1.45 : -1.2, 0, -0.1);
      this.set(B.thighR, drive ? -1.45 : -1.2, 0, 0.1);
      this.set(B.shinL, drive ? 1.25 : 1.05, 0, 0);
      this.set(B.shinR, drive ? 1.25 : 1.05, 0, 0);
      this.set(B.footL, drive ? 0.15 : 0.2, 0, 0);
      this.set(B.footR, drive ? 0.15 : 0.2, 0, 0);
      this.set(B.spine, 0.14, 0, 0);
      this.set(B.chest, 0.05, steer * 0.12, 0);
      // Hands on the handlebar; steering pushes one arm and pulls the other.
      this.set(B.uArmL, -1.0 - steer * 0.12, 0, 0.18);
      this.set(B.uArmR, -1.0 + steer * 0.12, 0, -0.18);
      this.set(B.fArmL, -0.42, 0, 0);
      this.set(B.fArmR, -0.42, 0, 0);
      this.set(B.handL, 0.2, 0, -0.3);
      this.set(B.handR, 0.2, 0, 0.3);
    }

    if (inp.carry && inp.pose === "stand") {
      // Holding a tiffin/parcel in front at waist height.
      this.set(B.uArmL, -0.5, 0, 0.18);
      this.set(B.uArmR, -0.5, 0, -0.18);
      this.set(B.fArmL, -1.15, 0, 0);
      this.set(B.fArmR, -1.15, 0, 0);
      this.set(B.handL, 0, 0, -0.5);
      this.set(B.handR, 0, 0, 0.5);
    }

    // Timed gestures layered on top.
    if (this.gesture !== "none") {
      this.gestureT += dt;
      const k = Math.min(1, this.gestureT / 0.2, (this.gestureDur - this.gestureT) / 0.25);
      const w = clamp(k, 0, 1);
      const g = this.gestureT;
      switch (this.gesture) {
        case "talk":
          this.mix(B.uArmR, -0.35, 0, 0.25 + 0.1 * Math.sin(g * 3), w);
          this.mix(B.fArmR, -1.1 + 0.3 * Math.sin(g * 5.5), 0.3 * Math.sin(g * 4), 0, w);
          this.mix(B.uArmL, -0.15 + 0.12 * Math.sin(g * 2.3), 0, -0.2, w * 0.7);
          this.mix(B.fArmL, -0.6 - 0.25 * Math.sin(g * 3.7), 0, 0, w * 0.7);
          this.add(B.head, 0.06 * Math.sin(g * 4.2), 0.1 * Math.sin(g * 1.7), 0, w);
          break;
        case "wave":
          this.mix(B.uArmR, -0.3, 0, 2.5, w);
          this.mix(B.fArmR, -0.2, 0, 0.45 * Math.sin(g * 11), w);
          break;
        case "greet":
          // Palms joined at the chest (Sat Sri Akal / namaste).
          this.mix(B.uArmL, -0.45, 0, 0.42, w);
          this.mix(B.uArmR, -0.45, 0, -0.42, w);
          this.mix(B.fArmL, -1.75, 0, 0, w);
          this.mix(B.fArmR, -1.75, 0, 0, w);
          this.mix(B.handL, 0, 0, -0.9, w);
          this.mix(B.handR, 0, 0, 0.9, w);
          this.add(B.head, 0.2 * w, 0, 0);
          this.add(B.spine, 0.12 * w, 0, 0);
          break;
        case "startled":
          this.mix(B.uArmL, -0.8, 0, -1.25, w);
          this.mix(B.uArmR, -0.8, 0, 1.25, w);
          this.mix(B.fArmL, -1.3, 0, 0, w);
          this.mix(B.fArmR, -1.3, 0, 0, w);
          this.add(B.spine, -0.22 * w, 0, 0);
          this.add(B.head, -0.15 * w, 0, 0);
          break;
        case "point":
          this.mix(B.uArmR, -1.45, 0, 0.1, w);
          this.mix(B.fArmR, -0.1, 0, 0, w);
          break;
        case "work":
          this.mix(B.uArmL, -0.75 + 0.15 * Math.sin(g * 2.5), 0, 0.15, w);
          this.mix(B.uArmR, -0.75 + 0.15 * Math.sin(g * 2.5 + 2), 0, -0.15, w);
          this.mix(B.fArmL, -0.7 + 0.2 * Math.sin(g * 3.1), 0, 0, w);
          this.mix(B.fArmR, -0.7 + 0.2 * Math.sin(g * 2.9 + 1), 0, 0, w);
          this.add(B.spine, 0.18 * w, 0, 0);
          this.add(B.head, 0.2 * w, 0, 0);
          break;
        case "cheer":
          this.mix(B.uArmL, -0.2, 0, -2.6 + 0.2 * Math.sin(g * 9), w);
          this.mix(B.uArmR, -0.2, 0, 2.6 - 0.2 * Math.sin(g * 9), w);
          this.mix(B.fArmL, -0.3, 0, 0, w);
          this.mix(B.fArmR, -0.3, 0, 0, w);
          hipsBob += 0.04 * Math.abs(Math.sin(g * 9)) * w;
          break;
      }
      if (this.gestureT >= this.gestureDur) this.gesture = "none";
    }

    // Head look, limited and shared with the neck.
    const look = clamp(inp.lookYaw, -1.2, 1.2);
    this.add(B.neck, 0, look * 0.35, 0);
    this.add(B.head, 0.02 * Math.sin(t * 0.9), look * 0.65, 0);

    // Ease toward the target (critically damped-ish exponential smoothing).
    const rate = 1 - Math.exp(-dt * 16);
    for (let i = 0; i < this.cur.length; i++) this.cur[i]! += (this.tgt[i]! - this.cur[i]!) * rate;
    this.hipsY += (hipsBob - this.hipsY) * rate;
    this.apply();
  }

  private mix(bone: number, x: number, y: number, z: number, w: number): void {
    const i = bone * 3;
    this.tgt[i] = this.tgt[i]! * (1 - w) + x * w;
    this.tgt[i + 1] = this.tgt[i + 1]! * (1 - w) + y * w;
    this.tgt[i + 2] = this.tgt[i + 2]! * (1 - w) + z * w;
  }

  private apply(): void {
    const bones = this.h.bones;
    for (let i = 0; i < BONE_COUNT; i++) {
      Quaternion.RotationYawPitchRollToRef(this.cur[i * 3 + 1]!, this.cur[i * 3]!, this.cur[i * 3 + 2]!, this.q);
      bones[i]!.setRotationQuaternion(this.q, Space.LOCAL);
    }
    const r = this.h.rest[0]!;
    this.v.set(r.x, r.y + this.hipsY, r.z);
    bones[0]!.setPosition(this.v, Space.LOCAL);
  }
}
