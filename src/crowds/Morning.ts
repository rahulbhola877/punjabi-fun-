import { Color3, MeshBuilder, StandardMaterial, Vector3, type Mesh, type Scene } from "../babylon";
import { randomAppearance } from "../characters/appearances";
import { B } from "../characters/HumanBuilder";
import type { Gesture } from "../characters/HumanAnimator";
import { colonyLife } from "../world/colonySeats";
import { isOpenGround } from "../world/layout";
import { SITES, type Site } from "../world/region";
import { Rng } from "../render/textures";
import type { NavGraph } from "../world/nav";
import type { Crowd, Resident } from "./Crowd";

type Job = "jog" | "brush" | "datun" | "gargle" | "stretch";

interface Early { r: Resident; job: Job; prop: Mesh | null; t: number }

/** Gurdwaras and mandirs: where the morning music comes from. */
export const SHRINES: Site[] = SITES.filter((s) => s.kind === "gurdwara" || s.kind === "mandir");

const SPIT = ["Khhrr… thoo!", "Aaahh, taaza!", "Kulli kar layi."];

/**
 * Colony mornings: from first light until about half past eight, people near
 * the player are out — joggers in the galis, uncles chewing a neem datun or
 * brushing at the gate, someone gargling with a steel lota and spitting in the
 * naali, a few stretching in the park. They appear out of view (or a fair
 * way off) like the gossip circles, and go home when the morning is over.
 */
export class Morning {
  private folk: Early[] = [];
  private rng = new Rng(5151);
  private spawnT = 1;
  private n = 0;
  /** How many at once (from the graphics preset). */
  max = 6;
  private mats: Record<string, StandardMaterial> = {};
  private walks: Array<{ x: number; z: number; g?: NavGraph; park?: Site }> | null = null;

  constructor(private scene: Scene, private crowd: Crowd) {}

  /** Is it morning-routine time (hour of day)? */
  static isMorning(h: number): boolean {
    return h >= 5.5 && h < 8.75;
  }

  /** Gurbani from the gurdwaras at amrit vela, aarti at the mandirs at dawn and dusk: how loud (0..1) at this hour. */
  static shrineLevel(kind: "gurbani" | "aarti", h: number): number {
    const ramp = (a: number, b: number) => Math.max(0, Math.min(1, (h - a) / 0.25, (b - h) / 0.25));
    return kind === "gurbani" ? ramp(4.5, 7.75) : Math.max(ramp(6, 7), ramp(18.5, 19.25));
  }

  private spots() {
    if (!this.walks) {
      this.walks = [];
      for (const l of colonyLife()) for (const w of l.walks) this.walks.push({ x: w.x, z: w.z, g: l.graph });
      for (const s of SITES) if (s.kind === "colonyPark" || s.kind === "park") {
        for (let i = 0; i < 4; i++) this.walks.push({ x: s.x0 + (s.x1 - s.x0) * (0.25 + (i % 2) * 0.5), z: s.z0 + (s.z1 - s.z0) * (0.3 + Math.floor(i / 2) * 0.4), park: s });
      }
    }
    return this.walks;
  }

  private mat(name: string, c: string, metal = false): StandardMaterial {
    let m = this.mats[name];
    if (!m) {
      m = new StandardMaterial(`morning_${name}`, this.scene);
      m.diffuseColor = Color3.FromHexString(c);
      m.specularColor = metal ? new Color3(0.8, 0.8, 0.8) : new Color3(0.1, 0.1, 0.1);
      this.mats[name] = m;
    }
    return m;
  }

  /** What is in their hand: a toothbrush, a neem twig, a steel lota. */
  private makeProp(job: Job): Mesh | null {
    if (job === "brush") {
      const m = MeshBuilder.CreateBox(`brush${this.n}`, { width: 0.012, height: 0.17, depth: 0.012 }, this.scene);
      const head = MeshBuilder.CreateBox(`brushHead${this.n}`, { width: 0.016, height: 0.03, depth: 0.02 }, this.scene);
      head.parent = m; head.position.set(0, 0.085, 0.008); head.material = this.mat("bristle", "#f4f4f4");
      m.material = this.mat("brushHandle", "#2f7fd0");
      return m;
    }
    if (job === "datun") {
      const m = MeshBuilder.CreateCylinder(`datun${this.n}`, { diameter: 0.012, height: 0.18, tessellation: 5 }, this.scene);
      m.material = this.mat("neem", "#7a5a34");
      return m;
    }
    if (job === "gargle") {
      const m = MeshBuilder.CreateCylinder(`lota${this.n}`, { diameterTop: 0.07, diameterBottom: 0.09, height: 0.11, tessellation: 12 }, this.scene);
      m.material = this.mat("steel", "#c9ccd0", true);
      return m;
    }
    return null;
  }

  /** Keep the prop in the right hand of whichever body is drawn (kit up close, the old one far off). */
  private holdProp(e: Early): void {
    const p = e.prop;
    if (!p) return;
    const body = e.r.kit ? e.r.kit.h : e.r.human;
    if (p.parent !== body.mesh) {
      p.attachToBone(body.bones[B.handR]!, body.mesh);
      if (e.job === "gargle") { p.position.set(0, -0.09, 0.05); p.rotation.set(0, 0, 0); }
      else { p.position.set(0, -0.08, 0.03); p.rotation.set(1.3, 0, 0); }
    }
  }

  private spawn(p: Vector3, inView: (x: number, z: number) => boolean): void {
    const all = this.spots();
    const cand = all.filter((s) => {
      const d = Math.hypot(s.x - p.x, s.z - p.z);
      return d > 12 && d < 50 && (!inView(s.x, s.z) || d > 30) && !this.folk.some((f) => Math.hypot(f.r.home.x - s.x, f.r.home.z - s.z) < 6);
    });
    if (!cand.length) return;
    const s = this.rng.pick(cand);
    if (!isOpenGround(s.x, s.z)) return;
    const roll = this.rng.next();
    const job: Job = s.park ? (roll < 0.5 ? "stretch" : "jog") : roll < 0.35 ? "jog" : roll < 0.6 ? "brush" : roll < 0.8 ? "datun" : "gargle";
    const a = randomAppearance(20000 + this.n * 13);
    const elder = job === "datun" || (job === "stretch" && roll < 0.35);
    const look = { ...a, age: elder ? "elder" as const : a.age === "child" ? "adult" as const : a.age, sex: job === "datun" ? "m" as const : a.sex };
    if (look.sex === "f") { look.headwear = "none"; look.beard = "none"; }
    const yaw = this.rng.range(-Math.PI, Math.PI);
    const r = this.crowd.spawn({
      id: `morning${this.n++}`, name: look.sex === "f" ? (look.age === "elder" ? "Bebe ji" : "Aunty ji") : look.age === "elder" ? "Uncle ji" : "Neighbour",
      // Joggers run the colony's galis, or laps of the park (as roamers inside its fence).
      role: job !== "jog" ? "keeper" : s.park ? "roamer" : "walker", look, x: s.x, z: s.z, yaw, graph: s.g,
      wander: job === "jog" && s.park ? { x0: s.park.x0 + 3, x1: s.park.x1 - 3, z0: s.park.z0 + 3, z1: s.park.z1 - 3 } : undefined,
      lines: job === "jog" ? ["Good morning ji!", "Do chakkar hor!"] : job === "datun" ? ["Neem di datun, daandan layi best!"] : ["Sat Sri Akal, puttar!"],
    });
    // Roamers amble at 0.8 of their speed, so park joggers get a little more.
    if (job === "jog") r.speed = this.rng.range(2.6, 3.2) * (s.park ? 1.25 : 1);
    const e: Early = { r, job, prop: this.makeProp(job), t: 0 };
    if (job !== "jog") {
      const gesture: Gesture = job === "datun" ? "brush" : job;
      r.brain = (rr, dt) => {
        rr.vel.scaleInPlace(Math.exp(-dt * 8));
        e.t += dt;
        if (rr.anim.currentGesture === "none") rr.anim.play(gesture, 6);
        // Now and then the gargler spits into the naali.
        if (job === "gargle" && e.t > 9 && rr.bubbleCooldown <= 0) { e.t = 0; this.crowd.say(rr, this.rng.pick(SPIT)); }
      };
    }
    this.folk.push(e);
  }

  private remove(e: Early): void {
    e.prop?.dispose();
    if (this.crowd.residents.includes(e.r)) this.crowd.remove(e.r);
    this.folk.splice(this.folk.indexOf(e), 1);
  }

  update(dt: number, hour: number, rain: number, p: Vector3, inView: (x: number, z: number) => boolean): void {
    const on = Morning.isMorning(hour) && rain < 0.3;
    this.spawnT -= dt;
    if (on && this.spawnT <= 0) {
      this.spawnT = 2.5;
      if (this.folk.length < this.max) this.spawn(p, inView);
    }
    for (const e of [...this.folk]) {
      if (!this.crowd.residents.includes(e.r)) { this.remove(e); continue; }
      const d = Math.hypot(e.r.pos.x - p.x, e.r.pos.z - p.z);
      if (d > 95 || (!on && !inView(e.r.pos.x, e.r.pos.z))) { this.remove(e); continue; }
      this.holdProp(e);
    }
  }

  dispose(): void {
    for (const e of [...this.folk]) this.remove(e);
  }

  /** Probe. */
  state(): Array<{ id: string; job: Job; x: number; z: number }> {
    return this.folk.map((e) => ({ id: e.r.id, job: e.job, x: Math.round(e.r.pos.x), z: Math.round(e.r.pos.z) }));
  }
}
