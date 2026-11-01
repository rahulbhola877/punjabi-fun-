import { Color3, MeshBuilder, StandardMaterial, TransformNode, Vector3, type Scene } from "../babylon";
import type { Animal } from "./Animals";

/** Pick an accessible throw along the camera direction, shortening or turning
 * it when the street is narrow. Both the ball and the dog need a clear route. */
export function findFetchTarget(
  player: { x: number; z: number }, dog: { x: number; z: number }, yaw: number,
  open: (x: number, z: number) => boolean,
  clear: (a: { x: number; z: number }, b: { x: number; z: number }) => boolean = () => true,
): { x: number; z: number } | null {
  if (!Number.isFinite(yaw)) return null;
  const lineOpen = (a: { x: number; z: number }, b: { x: number; z: number }) => {
    const steps = Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / 0.5);
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      if (!open(a.x + (b.x - a.x) * t, a.z + (b.z - a.z) * t)) return false;
    }
    return clear(a, b);
  };
  for (const turn of [0, Math.PI / 4, -Math.PI / 4, Math.PI / 2, -Math.PI / 2, Math.PI]) {
    const direction = yaw + turn;
    for (const distance of [8, 6, 4]) {
      const end = { x: player.x + Math.sin(direction) * distance, z: player.z + Math.cos(direction) * distance };
      if (lineOpen(player, end) && lineOpen(dog, end)) return end;
    }
  }
  return null;
}

/** A real thrown ball, a dog that chases it, and a return to the player. */
export class DogFetch {
  private ball: TransformNode;
  private phase: "idle" | "throw" | "fetch" | "return" = "idle";
  private elapsed = 0;
  private origin = new Vector3();
  private target = new Vector3();
  private owner = new Vector3();
  private total = 0;
  private completed = 0;
  constructor(private dog: Animal, scene: Scene, private notify: (text: string) => void, private bark: (at: Vector3) => void) {
    this.ball = new TransformNode("fetchBall", scene);
    const sphere = MeshBuilder.CreateSphere("fetchBallSurface", { diameter: 0.29, segments: 12 }, scene);
    const mat = new StandardMaterial("fetchBallRed", scene); mat.diffuseColor = Color3.FromHexString("#dd4e37"); mat.specularColor = new Color3(0.2, 0.2, 0.2);
    sphere.material = mat; sphere.parent = this.ball; sphere.isPickable = false;
    const stripe = MeshBuilder.CreateTorus("fetchBallStripe", { diameter: 0.291, thickness: 0.034, tessellation: 16 }, scene);
    const stripeMat = new StandardMaterial("fetchBallCream", scene); stripeMat.diffuseColor = Color3.FromHexString("#fff0c6");
    stripe.material = stripeMat; stripe.parent = this.ball; stripe.rotation.x = 0.5; stripe.isPickable = false;
    this.ball.setEnabled(false);
    this.dog.state = "stand"; this.dog.t = 120;
  }
  get active(): boolean { return this.phase !== "idle"; }
  snapshot(): { phase: string; completed: number; dog: { x: number; z: number }; ball: { x: number; y: number; z: number } } {
    return { phase: this.phase, completed: this.completed, dog: { x: this.dog.pos.x, z: this.dog.pos.z }, ball: { x: this.ball.position.x, y: this.ball.position.y, z: this.ball.position.z } };
  }
  start(player: Vector3, yaw: number, open: (x: number, z: number) => boolean, clear?: (a: { x: number; z: number }, b: { x: number; z: number }) => boolean): boolean {
    if (this.active) return false;
    const target = findFetchTarget(player, this.dog.pos, yaw, open, clear);
    if (!target) { this.notify("There isn't enough clear space to throw. Try from the lane."); return false; }
    this.origin.copyFromFloats(player.x, 1.2, player.z); this.target.copyFromFloats(target.x, 0.15, target.z);
    this.owner.copyFrom(player); this.elapsed = 0; this.total = 0; this.phase = "throw";
    this.dog.state = "stand"; this.dog.t = 4; this.dog.vel.setAll(0);
    this.ball.position.copyFrom(this.origin); this.ball.setEnabled(true);
    this.bark(this.dog.pos); this.notify("Sheru: fetch! Watch him bring the ball back."); return true;
  }
  cancel(message?: string): void {
    if (!this.active) return;
    this.phase = "idle"; this.ball.setEnabled(false);
    if (this.dog.state === "play") { this.dog.state = "stand"; this.dog.t = 20; this.dog.vel.setAll(0); }
    if (message) this.notify(message);
  }
  update(dt: number, player: Vector3, unavailable: boolean): void {
    if (!this.active) return;
    this.total += dt;
    if (unavailable || this.total > 25 || Vector3.Distance(player, this.owner) > 35) { this.cancel(); return; }
    if (this.phase === "throw") {
      if (this.dog.state === "flee") { this.cancel("Sheru got out of the way. Try again when the lane is clear."); return; }
      this.elapsed = Math.min(1, this.elapsed + dt / 0.85);
      const t = this.elapsed;
      this.ball.position.set(this.origin.x + (this.target.x - this.origin.x) * t, this.origin.y + (this.target.y - this.origin.y) * t + Math.sin(Math.PI * t) * 1.2, this.origin.z + (this.target.z - this.origin.z) * t);
      this.ball.rotation.x += dt * 12;
      if (t >= 1) { this.phase = "fetch"; this.dog.state = "play"; this.dog.goal.copyFrom(this.target); }
      return;
    }
    // If traffic sent the dog fleeing, don't override its safety response.
    if (this.dog.state !== "play") { this.cancel("Sheru got out of the way. Try again when the lane is clear."); return; }
    if (this.phase === "fetch" && Math.hypot(this.dog.pos.x - this.target.x, this.dog.pos.z - this.target.z) < 0.8) {
      this.phase = "return"; this.bark(this.dog.pos); this.notify("Sheru found it! Call him back by staying nearby.");
    }
    if (this.phase === "return") {
      this.dog.goal.copyFrom(player);
      // The head projects forward from the shoulders; keep the ball at the
      // muzzle rather than at the centre of the body.
      this.ball.position.set(this.dog.pos.x + Math.sin(this.dog.facing) * 0.72, 0.48, this.dog.pos.z + Math.cos(this.dog.facing) * 0.72);
      if (Math.hypot(this.dog.pos.x - player.x, this.dog.pos.z - player.z) < 1.7) {
        this.completed++; this.cancel(); this.bark(this.dog.pos); this.notify("Good dog, Sheru! Aim and throw again whenever you like.");
      }
    }
  }
}
