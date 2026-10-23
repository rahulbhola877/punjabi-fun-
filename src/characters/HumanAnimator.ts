import { Quaternion, Space, Vector3 } from "../babylon";
import { B, BONE_COUNT, type BuiltHuman } from "./HumanBuilder";

export type BasePose = "stand" | "sit" | "ride" | "drive" | "down";
export type Gesture =
  | "none" | "talk" | "wave" | "startled" | "greet" | "point" | "work" | "cheer" | "eat"
  // Fighting and arguing.
  | "punch" | "punchL" | "slap" | "hit" | "guard" | "shove" | "lathi" | "argue" | "dizzy"
  | "kick" | "knee" | "brick"
  // Baraat bhangra: arms up, shoulders bouncing.
  | "bhangra"
  // A good laugh at the gossip: head back, shoulders shaking.
  | "laugh";

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
  /** Holding a chhatri up in the right hand. */
  umbrella?: boolean;
  /** Flying a patang: right hand up on the string, tugging; left holds the charkhi. */
  kite?: boolean;
  /** Carrying a flag or a nishan upright in the right hand (processions). */
  pole?: boolean;
  /** Beating a dhol slung across the belly: both forearms swing at the skins. */
  dhol?: boolean;
  /** In deep water: crawl when moving, tread water when still (kit bodies). */
  swim?: boolean;
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
  private kiteT = Math.random() * 6;
  private t = Math.random() * 10;
  private gesture: Gesture = "none";
  private gestureT = 0;
  private gestureDur = 0;
  private hipsY = 0;
  private lastPose: BasePose = "stand";
  /** Seconds of slower blending after falling down or getting up. */
  private slowBlend = 0;
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

  /** Seconds left of the current gesture (0 when none). */
  get gestureLeft(): number {
    return this.gesture === "none" ? 0 : Math.max(0, this.gestureDur - this.gestureT);
  }

  /** Run the gesture clock only, while someone else's body is drawn for this person. */
  tick(dt: number): void {
    if (this.gesture === "none") return;
    this.gestureT += dt;
    if (this.gestureT >= this.gestureDur) this.gesture = "none";
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

    if (inp.pose !== this.lastPose) {
      if (inp.pose === "down" || this.lastPose === "down") this.slowBlend = 0.7;
      this.lastPose = inp.pose;
    }
    if (inp.pose === "down") {
      // Flat on the back (knocked out): the hips tip the whole body over.
      this.set(B.hips, -1.5, 0, 0.05 * Math.sin(t * 0.7));
      this.set(B.thighL, 0.05, 0, -0.12);
      this.set(B.thighR, 0.0, 0, 0.16);
      this.set(B.shinL, 0.15, 0, 0);
      this.set(B.shinR, 0.35, 0, 0);
      this.set(B.uArmL, -0.2, 0, -1.25);
      this.set(B.uArmR, -0.1, 0, 1.4);
      this.set(B.fArmL, -0.3, 0, 0);
      this.set(B.fArmR, -0.5, 0, 0);
      this.set(B.head, 0.1, 0.35 * Math.sin(t * 0.8), 0);
      hipsBob = 0.16 - this.h.rest[0]!.y;
    } else if (inp.pose === "stand") {
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
      // Tiffin carried by its handle in the right hand: arm slightly out and
      // forward so the carrier clears the leg, with a small pendulum sway.
      const sway = 0.05 * Math.sin(this.phase) * walk;
      this.set(B.uArmR, -0.12 + sway, 0, 0.2 + 0.05 * run);
      this.set(B.fArmR, -0.28 - 0.2 * run, 0, 0);
      this.set(B.handR, 0.1, 0, -0.15);
    }

    if (inp.umbrella && inp.pose === "stand") {
      // Chhatri held up beside the head: elbow in front, forearm upright.
      this.set(B.uArmR, -0.45, 0, 0.3);
      this.set(B.fArmR, -1.7, 0, 0);
      this.set(B.handR, 0, 0, 0);
    }

    if (inp.pole && inp.pose === "stand") {
      this.set(B.uArmR, -0.5, 0, 0.32);
      this.set(B.fArmR, -1.55, 0, 0);
      this.set(B.handR, 0, 0, 0);
    }

    if (inp.dhol && inp.pose === "stand") {
      // Dagga in the right hand on the bass skin, tihli in the left on the
      // treble: the two hands alternate in the bhangra chaal.
      this.kiteT += dt;
      const a = Math.max(0, Math.sin(this.kiteT * 13)), b = Math.max(0, Math.sin(this.kiteT * 13 + Math.PI));
      this.set(B.uArmR, -0.55 - 0.25 * a, 0, 0.35);
      this.set(B.fArmR, -1.1 + 0.5 * a, 0, 0);
      this.set(B.uArmL, -0.5 - 0.2 * b, 0, -0.35);
      this.set(B.fArmL, -1.2 + 0.4 * b, 0, 0);
    }

    if (inp.kite && inp.pose === "stand") {
      this.kiteT += dt;
      const tug = Math.max(0, Math.sin(this.kiteT * 2.3)) * 0.35;
      this.set(B.uArmR, -1.25 - tug, 0, 0.25);
      this.set(B.fArmR, -0.55 + tug, 0, 0);
      this.set(B.uArmL, -0.55, 0, -0.25);
      this.set(B.fArmL, -1.3, 0, 0);
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
        case "laugh":
          this.add(B.head, -0.16 + 0.05 * Math.sin(g * 15), 0, 0, w);
          this.add(B.chest, -0.06 + 0.04 * Math.sin(g * 15), 0, 0, w);
          this.mix(B.uArmL, -0.25, 0, -0.15, w * 0.6);
          this.mix(B.fArmL, -1.2, 0, 0, w * 0.6);
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
        case "guard":
          // Fists up, chin tucked, bouncing on the toes.
          this.mix(B.uArmL, -0.85, 0, 0.42, w);
          this.mix(B.uArmR, -0.85, 0, -0.42, w);
          this.mix(B.fArmL, -2.1, 0, 0, w);
          this.mix(B.fArmR, -2.1, 0, 0, w);
          this.add(B.spine, 0.12 * w, 0, 0);
          this.add(B.head, 0.12 * w, 0, 0);
          hipsBob += -0.03 * w + 0.015 * Math.sin(g * 9) * w;
          break;
        case "punch":
        case "punchL": {
          // Wind up, snap the fist out, recover.
          const L = this.gesture === "punchL";
          const f = g / Math.max(0.01, this.gestureDur);
          const ext = f < 0.3 ? 0 : f < 0.55 ? (f - 0.3) / 0.25 : Math.max(0, 1 - (f - 0.55) / 0.45);
          const ua = L ? B.uArmL : B.uArmR, fa = L ? B.fArmL : B.fArmR, sd = L ? -1 : 1;
          this.mix(ua, -0.9 - 0.65 * ext, 0, sd * (0.4 - 0.36 * ext), w);
          this.mix(fa, -2.0 + 1.9 * ext, 0, 0, w);
          this.mix(L ? B.uArmR : B.uArmL, -0.85, 0, -sd * 0.42, w);
          this.mix(L ? B.fArmR : B.fArmL, -2.1, 0, 0, w);
          this.add(B.chest, 0, -sd * (0.35 * ext - 0.12), 0, w);
          this.add(B.spine, 0.1 * w + 0.12 * ext * w, -sd * 0.2 * ext * w, 0);
          break;
        }
        case "slap": {
          // The famous Punjabi "chapet": a big open-hand roundhouse.
          const f = g / Math.max(0.01, this.gestureDur);
          const sw = f < 0.35 ? 0 : Math.min(1, (f - 0.35) / 0.2);
          this.mix(B.uArmR, -0.7 - 0.6 * sw, 0, 1.4 - 1.8 * sw, w);
          this.mix(B.fArmR, -0.6 + 0.4 * sw, 0, 0, w);
          this.mix(B.handR, 0, 0, 0.6 - sw, w);
          this.add(B.chest, 0, (0.5 - 1.0 * sw) * w, 0);
          this.add(B.spine, 0.08 * w, (0.25 - 0.5 * sw) * w, 0);
          break;
        }
        case "hit":
          // Rocked back by a blow.
          this.mix(B.uArmL, -0.5, 0, -1.0, w);
          this.mix(B.uArmR, -0.5, 0, 1.0, w);
          this.mix(B.fArmL, -0.6, 0, 0, w);
          this.mix(B.fArmR, -0.6, 0, 0, w);
          this.add(B.spine, -0.3 * w, 0.15 * Math.sin(g * 20) * w, 0);
          this.add(B.head, -0.35 * w, 0.2 * w, 0.15 * w);
          break;
        case "shove":
          this.mix(B.uArmL, -1.35, 0, 0.2, w);
          this.mix(B.uArmR, -1.35, 0, -0.2, w);
          this.mix(B.fArmL, -0.25 - 0.4 * Math.max(0, 1 - g * 5), 0, 0, w);
          this.mix(B.fArmR, -0.25 - 0.4 * Math.max(0, 1 - g * 5), 0, 0, w);
          this.add(B.spine, 0.22 * w, 0, 0);
          break;
        case "kick": {
          // Front kick off the right leg, arms thrown out for balance.
          const f = g / Math.max(0.01, this.gestureDur);
          const ext = f < 0.25 ? f / 0.25 * 0.35 : f < 0.5 ? 0.35 + (f - 0.25) / 0.25 * 0.65 : Math.max(0, 1 - (f - 0.5) / 0.5);
          this.mix(B.thighR, -1.5 * ext, 0, 0, w);
          this.mix(B.shinR, 0.9 - 1.5 * ext, 0, 0, w);
          this.mix(B.footR, -0.35 * ext, 0, 0, w);
          this.mix(B.thighL, 0.18 * ext, 0, 0, w);
          this.mix(B.uArmL, -1.0 - 0.5 * ext, 0, -0.8, w);
          this.mix(B.uArmR, -0.8, 0, 0.9, w);
          this.add(B.spine, -0.3 * ext * w, 0, 0);
          hipsBob += -0.06 * ext * w;
          break;
        }
        case "knee": {
          // Close-quarters knee: drive it up into the midriff.
          const f = g / Math.max(0.01, this.gestureDur);
          const up = f < 0.35 ? f / 0.35 : Math.max(0, 1 - (f - 0.35) / 0.65);
          this.mix(B.thighR, -1.9 * up, 0, 0.12 * up, w);
          this.mix(B.shinR, 1.9 * up, 0, 0, w);
          this.mix(B.uArmL, -1.5 * up - 0.4, 0, -0.35, w);
          this.mix(B.uArmR, -1.5 * up - 0.4, 0, 0.35, w);
          this.mix(B.fArmL, -1.1, 0, 0, w);
          this.mix(B.fArmR, -1.1, 0, 0, w);
          this.add(B.spine, 0.28 * up * w, 0, 0);
          hipsBob += 0.05 * up * w;
          break;
        }
        case "brick": {
          // Both hands overhead on something heavy, then down hard.
          const f = g / Math.max(0.01, this.gestureDur);
          const dn = f < 0.45 ? 0 : Math.min(1, (f - 0.45) / 0.25);
          this.mix(B.uArmR, -2.9 + 2.1 * dn, 0, 0.25, w);
          this.mix(B.uArmL, -2.8 + 2.0 * dn, 0, -0.25, w);
          this.mix(B.fArmR, -0.7 + 0.5 * dn, 0, 0, w);
          this.mix(B.fArmL, -0.7 + 0.5 * dn, 0, 0, w);
          this.add(B.spine, (-0.22 + 0.5 * dn) * w, 0, 0);
          this.add(B.head, (-0.15 + 0.3 * dn) * w, 0, 0);
          break;
        }
        case "lathi": {
          // Police baton: raise overhead, bring it down.
          const f = g / Math.max(0.01, this.gestureDur);
          const dn = f < 0.4 ? 0 : Math.min(1, (f - 0.4) / 0.2);
          this.mix(B.uArmR, -2.8 + 1.8 * dn, 0, 0.3, w);
          this.mix(B.fArmR, -0.5 + 0.3 * dn, 0, 0, w);
          this.add(B.spine, (-0.1 + 0.3 * dn) * w, 0, 0);
          break;
        }
        case "argue":
          // Finger-wagging, hand on hip, chest puffed out.
          this.mix(B.uArmR, -1.25 + 0.15 * Math.sin(g * 7), 0, 0.25, w);
          this.mix(B.fArmR, -0.35 - 0.3 * Math.max(0, Math.sin(g * 7)), 0, 0, w);
          this.mix(B.uArmL, 0.15, 0, -0.55, w);
          this.mix(B.fArmL, -1.6, 0, 0, w);
          this.add(B.spine, -0.1 * w, 0, 0);
          this.add(B.head, 0.12 * Math.sin(g * 6) * w, 0.15 * Math.sin(g * 2.5) * w, 0);
          break;
        case "dizzy":
          // Seeing stars after getting up.
          this.add(B.spine, 0.12 * Math.sin(g * 3) * w, 0, 0.12 * Math.cos(g * 3) * w);
          this.add(B.head, 0.2 * Math.sin(g * 3.5) * w, 0, 0.25 * Math.cos(g * 3.5) * w);
          this.mix(B.uArmL, -0.3, 0, -0.5, w);
          this.mix(B.uArmR, -0.3, 0, 0.5, w);
          break;
        case "eat":
          // Dish held at the chest in the left hand, right hand to the mouth and back.
          this.mix(B.uArmL, -0.5, 0, 0.3, w);
          this.mix(B.fArmL, -1.5, 0, 0, w);
          this.mix(B.uArmR, -0.55 - 0.25 * Math.max(0, Math.sin(g * 3)), 0, -0.3, w);
          this.mix(B.fArmR, -1.6 - 0.6 * Math.max(0, Math.sin(g * 3)), 0, 0, w);
          this.add(B.head, (0.1 - 0.08 * Math.max(0, Math.sin(g * 3))) * w, 0, 0);
          break;
        case "bhangra": {
          // One arm high, the other out, swapping on the beat; shoulders bounce.
          const sw = Math.sin(g * 4.2), hi = sw > 0 ? 1 : 0;
          this.mix(B.uArmR, -0.3, 0, hi ? 2.7 : 1.3, w);
          this.mix(B.uArmL, -0.3, 0, hi ? -1.3 : -2.7, w);
          this.mix(B.fArmR, -0.4 - 0.3 * Math.abs(sw), 0, 0, w);
          this.mix(B.fArmL, -0.4 - 0.3 * Math.abs(sw), 0, 0, w);
          this.add(B.head, 0.08 * Math.sin(g * 8.4), 0.12 * sw, 0, w);
          hipsBob += 0.06 * Math.abs(Math.sin(g * 8.4)) * w;
          break;
        }
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
    this.slowBlend = Math.max(0, this.slowBlend - dt);
    const rate = 1 - Math.exp(-dt * (this.slowBlend > 0 ? 6 : 16));
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
