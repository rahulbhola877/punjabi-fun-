import type { AnimInput, Gesture } from "./HumanAnimator";
import type { KitHuman } from "./KitHuman";

/** Which kit clip plays for each of the game's gestures. */
const GESTURE_CLIP: Partial<Record<Gesture, string>> = {
  talk: "talk", wave: "wave", point: "point", cheer: "victory", eat: "eat", argue: "angry",
  punch: "punch", punchL: "punch", slap: "punch", lathi: "punch", shove: "punch", brick: "punch",
  kick: "kick", knee: "kick", guard: "block", hit: "hit_react", dizzy: "hit_react", startled: "hit_react",
  bhangra: "bhangra", work: "clap",
};

/**
 * Drives a KitHuman with the same calls the game makes on HumanAnimator:
 * locomotion from speed (idle / walk / run, played at the speed you move),
 * base poses (sit for seats and vehicles, die when knocked down, jump in the
 * air) and timed gestures mapped onto the kit's clips.
 */
export class KitAnimator {
  onFootstep: ((strength: number) => void) | null = null;
  private gesture: Gesture = "none";
  private gestureT = 0;
  private gestureDur = 0;
  private stepDist = 0;
  private clip = "";

  constructor(readonly h: KitHuman) {}

  play(g: Gesture, duration: number): void {
    this.gesture = g;
    this.gestureT = 0;
    this.gestureDur = duration;
    const clip = g === "greet" ? this.h.ch.greeting.clip : GESTURE_CLIP[g];
    if (clip) this.set(clip, 1, true);
  }

  private set(name: string, speed: number, restart = false): void {
    const ch = this.h.ch;
    if (name !== this.clip || restart) {
      ch.play(name, { restart, fade: 0.2 });
      this.clip = name;
    }
    const a = ch.actions.get(name);
    if (a) a.timeScale = speed;
  }

  update(dt: number, inp: AnimInput): void {
    if (this.gesture !== "none") {
      this.gestureT += dt;
      if (this.gestureT >= this.gestureDur || !GESTURE_CLIP[this.gesture] && this.gesture !== "greet") this.gesture = "none";
    }
    if (this.gesture === "none") {
      const ch = this.h.ch;
      if (inp.pose === "down") this.set("die", 1);
      // Hips stay where the game seats them (seat height = 0.92 * scale).
      else if (inp.pose === "ride") this.set("ride", 1);
      else if (inp.pose === "drive") this.set("drive", 1);
      else if (inp.pose !== "stand") this.set("seated", 1);
      else if (!inp.grounded) this.set("jump", 1);
      else if (inp.speed < 0.25) this.set("idle", 1);
      else {
        const walk = ch.speedFor("walk"), run = ch.speedFor("run");
        const clip = inp.speed > walk * 1.45 ? "run" : "walk";
        this.set(clip, Math.max(0.5, Math.min(1.8, inp.speed / (clip === "run" ? run : walk))));
        // A footstep every half stride.
        this.stepDist += inp.speed * dt;
        const stride = clip === "run" ? 1.15 : 0.72;
        if (this.stepDist > stride * this.h.scale) { this.stepDist = 0; this.onFootstep?.(clip === "run" ? 1 : 0.6); }
      }
    }
    this.h.sync(dt);
  }
}
