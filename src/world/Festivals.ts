import { BoxParticleEmitter, Color4, DynamicTexture, Matrix, Mesh, ParticleSystem, TransformNode, Vector3, type Scene } from "../babylon";
import { GeoBuilder, rgb, shade } from "../render/GeoBuilder";
import type { Materials } from "../render/Materials";
import { Rng } from "../render/textures";
import { dateOf, type Festival } from "./Calendar";
import { HOUSE_BELLS, houseToWorld } from "./openHouses";
import { SITES } from "./region";

/**
 * Six days in the year are not like the others, and the world shows it. Diwali: diyas on the doorsteps and fireworks
 * over the roofs. Gurpurab: the nagar kirtan goes round. Lohri: bonfires in the parks and by the chaupal, and the
 * neighbours round them. Hola Mohalla: gulal in the air at midday. Baisakhi: the mela at the kabaddi ground, with
 * stalls and a swing-wheel, and a baraat band on the roads. Teeyan: a swing in the neem and the girls at giddha.
 * Everything is built once, hidden, and shown only while its day and hours are on.
 */

/** The hours each festival's effects run (24 h clock). */
export const FEST_HOURS: Record<string, [number, number]> = {
  diwali: [17.5, 24], gurpurab: [8, 21], lohri: [17.5, 23.5], holi: [11, 18.5], baisakhi: [9, 21], teeyan: [10, 19],
};

/** Processions that go round on the day, and when they set off. */
export const FEST_PROCESSIONS: Record<string, Array<{ at: number; kind: "kirtan" | "baraat" }>> = {
  gurpurab: [{ at: 10.5, kind: "kirtan" }, { at: 16.5, kind: "kirtan" }],
  holi: [{ at: 13, kind: "kirtan" }],
  baisakhi: [{ at: 11, kind: "baraat" }, { at: 15.5, kind: "baraat" }],
};

export interface Live { festival: Festival; on: boolean }

/** Today's festival, if it is a festival day, and whether its hours are on. */
export function festivalNow(day: number, hour: number): Live | null {
  const f = dateOf(day).festival;
  if (!f) return null;
  const [a, b] = FEST_HOURS[f.id] ?? [8, 20];
  return { festival: f, on: hour >= a && hour < b };
}

export interface BonfireSpot { id: string; x: number; z: number }

/** Where the Lohri fires are lit: the middle of every colony park, and the chaupal's front. */
export function bonfireSpots(): BonfireSpot[] {
  const out: BonfireSpot[] = [];
  for (const s of SITES) if (s.kind === "colonyPark") out.push({ id: s.id, x: (s.x0 + s.x1) / 2, z: (s.z0 + s.z1) / 2 });
  const c = SITES.find((s) => s.id === "chaupal");
  if (c) out.push({ id: "chaupal", x: (c.x0 + c.x1) / 2, z: c.z0 + 17 });
  return out;
}

/** The mela: the kabaddi ground's centre. */
export function melaSpot(): { x: number; z: number; hx: number; hz: number } {
  const k = SITES.find((s) => s.id === "kabaddi")!;
  return { x: (k.x0 + k.x1) / 2, z: (k.z0 + k.z1) / 2, hx: (k.x1 - k.x0) / 2, hz: (k.z1 - k.z0) / 2 };
}

/** The swing in the village: under the big neem at the chaupal's back. */
export function swingSpot(): { x: number; z: number } {
  const c = SITES.find((s) => s.id === "chaupal")!;
  return { x: (c.x0 + c.x1) / 2 + 5.5, z: c.z0 + 4.5 };
}

export interface FestivalHost {
  scene: Scene;
  mats: Materials;
  playerPos(): Vector3;
  hour(): number;
  day(): number;
  /** Start a procession of this kind near the player; true if one set off. */
  procession(kind: "kirtan" | "baraat"): boolean;
  /** The sound of a rocket and its burst at a world point. */
  firework(pos: Vector3): void;
  toast(msg: string): void;
}

const GULAL = [[0.95, 0.2, 0.55], [0.98, 0.78, 0.15], [0.2, 0.75, 0.35], [0.25, 0.5, 0.95], [0.9, 0.3, 0.1]] as const;
const SPARK = [[1, 0.35, 0.3], [1, 0.8, 0.25], [0.45, 0.85, 1], [0.7, 0.5, 1], [0.5, 1, 0.55], [1, 0.55, 0.85]] as const;

function dotTexture(scene: Scene, name: string, soft: boolean): DynamicTexture {
  const t = new DynamicTexture(name, { width: 32, height: 32 }, scene, false);
  const c = t.getContext() as CanvasRenderingContext2D;
  const g = c.createRadialGradient(16, 16, 0, 16, 16, 16);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(soft ? 0.35 : 0.6, "rgba(255,255,255,0.7)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  c.fillStyle = g;
  c.fillRect(0, 0, 32, 32);
  t.update();
  t.hasAlpha = true;
  return t;
}

export class FestivalDirector {
  live: Live | null = null;
  private rng = new Rng(2024);
  private t = 0;
  private checkT = 0;
  private announced = "";
  private procDone = new Set<string>();

  // Diwali
  private diyaBase: Mesh;
  private diyaFlame: Mesh;
  private diyaMax = 96;
  private diyaT = 0;
  private sample: number[] = [];
  private fireworks: ParticleSystem[] = [];
  private fwT = 4;

  // Lohri
  private spots = bonfireSpots();
  private logs: Mesh[] = [];
  private fires: ParticleSystem[] = [];
  private fireAt: Vector3[] = [];
  private fireT = 0;
  private near: number[] = [];

  // Hola Mohalla
  private gulal: ParticleSystem;
  private gulalAt: Vector3;
  private gulalT = 0;

  // Baisakhi
  private mela: TransformNode;
  private wheel: TransformNode;

  // Teeyan
  private swing: TransformNode;
  private swingSeat: TransformNode;

  constructor(private host: FestivalHost) {
    const { scene, mats } = host;
    const soft = dotTexture(scene, "festSoft", true), hard = dotTexture(scene, "festHard", false);

    // Diyas: a clay saucer and a flame, thin-instanced on the doorsteps of the nearest houses.
    const base = new GeoBuilder(1);
    base.cylinder(0, 0, 0, 0.26, 0.17, 0.12, 8, rgb("#c0592f"), true);
    this.diyaBase = base.toMesh("diyaBase", scene, mats.get("matte"));
    const flame = new GeoBuilder(1);
    flame.cylinder(0, 0.12, 0, 0.1, 0.0, 0.3, 6, rgb("#ff8f00"), false);
    this.diyaFlame = flame.toMesh("diyaFlame", scene, mats.get("emissive"));
    for (const m of [this.diyaBase, this.diyaFlame]) { m.isPickable = false; m.alwaysSelectAsActiveMesh = true; m.setEnabled(false); m.thinInstanceSetBuffer("matrix", new Float32Array(16 * this.diyaMax), 16, false); m.thinInstanceCount = 0; }

    // Fireworks: three systems, each a burst from a point in the sky.
    for (let i = 0; i < 3; i++) {
      const ps = new ParticleSystem(`firework${i}`, 400, scene);
      ps.particleTexture = hard;
      ps.emitter = new Vector3(0, -100, 0);
      const box = new BoxParticleEmitter();
      box.minEmitBox = Vector3.Zero(); box.maxEmitBox = Vector3.Zero();
      box.direction1 = new Vector3(-1, -1, -1); box.direction2 = new Vector3(1, 1, 1);
      ps.particleEmitterType = box;
      ps.minEmitPower = 7; ps.maxEmitPower = 13;
      ps.minLifeTime = 1.1; ps.maxLifeTime = 2;
      ps.minSize = 0.9; ps.maxSize = 1.8;
      ps.gravity = new Vector3(0, -4.5, 0);
      ps.blendMode = ParticleSystem.BLENDMODE_ONEONE;
      ps.emitRate = 0;
      ps.start();
      this.fireworks.push(ps);
    }

    // Bonfires: a stack of logs on each spot, three fire systems moved to the nearest.
    for (const s of this.spots) {
      const g = new GeoBuilder(1);
      const wood = rgb("#5b3a24");
      for (let k = 0; k < 7; k++) {
        const a = (k / 7) * Math.PI * 2;
        g.boxMinMax(-0.09, 0.0, -0.9, 0.09, 0.18, 0.9, shade(wood, 0.85 + (k % 3) * 0.12));
        void a;
      }
      const m = g.toMesh(`logs_${s.id}`, scene, mats.get("wood"));
      m.position.set(s.x, 0.05, s.z);
      m.isPickable = false;
      m.setEnabled(false);
      this.logs.push(m);
    }
    for (let i = 0; i < 3; i++) {
      const ps = new ParticleSystem(`bonfire${i}`, 160, scene);
      ps.particleTexture = soft;
      const at = new Vector3(0, -50, 0);
      ps.emitter = at;
      const box = new BoxParticleEmitter();
      box.minEmitBox = new Vector3(-0.45, 0.1, -0.45); box.maxEmitBox = new Vector3(0.45, 0.4, 0.45);
      box.direction1 = new Vector3(-0.25, 1.4, -0.25); box.direction2 = new Vector3(0.25, 2.4, 0.25);
      ps.particleEmitterType = box;
      ps.minEmitPower = 0.8; ps.maxEmitPower = 1.6;
      ps.minLifeTime = 0.5; ps.maxLifeTime = 1.1;
      ps.minSize = 0.4; ps.maxSize = 1.0;
      ps.color1 = new Color4(1, 0.65, 0.12, 0.9); ps.color2 = new Color4(1, 0.35, 0.05, 0.8); ps.colorDead = new Color4(0.25, 0.04, 0, 0);
      ps.gravity = new Vector3(0, 1.2, 0);
      ps.blendMode = ParticleSystem.BLENDMODE_ONEONE;
      ps.emitRate = 0;
      ps.start();
      this.fires.push(ps);
      this.fireAt.push(at);
    }

    // Gulal: clouds of colour round the player at Hola Mohalla.
    this.gulalAt = new Vector3(0, 0, 0);
    const gp = new ParticleSystem("gulal", 260, scene);
    gp.particleTexture = soft;
    gp.emitter = this.gulalAt;
    const gb = new BoxParticleEmitter();
    gb.minEmitBox = new Vector3(-9, 0.4, -9); gb.maxEmitBox = new Vector3(9, 3.2, 9);
    gb.direction1 = new Vector3(-0.4, 0.5, -0.4); gb.direction2 = new Vector3(0.4, 1.2, 0.4);
    gp.particleEmitterType = gb;
    gp.minEmitPower = 0.3; gp.maxEmitPower = 0.9;
    gp.minLifeTime = 2.2; gp.maxLifeTime = 4;
    gp.minSize = 0.8; gp.maxSize = 2.0;
    gp.color1 = new Color4(0.95, 0.2, 0.55, 0.45); gp.color2 = new Color4(0.98, 0.78, 0.15, 0.45); gp.colorDead = new Color4(0.3, 0.5, 0.95, 0);
    gp.gravity = new Vector3(0, -0.05, 0);
    gp.blendMode = ParticleSystem.BLENDMODE_STANDARD;
    gp.emitRate = 0;
    gp.start();
    this.gulal = gp;

    // The mela: striped stalls round the ground's edge, flagpoles, and a swing-wheel in the middle.
    const m = melaSpot();
    this.mela = new TransformNode("mela", scene);
    this.mela.position.set(m.x, 0, m.z);
    const stalls = new GeoBuilder(1);
    const awn = ["#e53935", "#fbc02d", "#1e88e5", "#43a047", "#8e24aa", "#fb8c00"];
    for (let i = 0; i < 8; i++) {
      const side = i < 4 ? -1 : 1, x = -m.hx + 9 + (i % 4) * ((m.hx * 2 - 18) / 3), z = side * (m.hz - 5);
      stalls.boxMinMax(x - 1.7, 0, z - 1.0, x + 1.7, 0.95, z + 1.0, rgb("#8d6e4a"));
      for (let k = -1; k <= 1; k += 2) for (let j = -1; j <= 1; j += 2) stalls.boxMinMax(x + k * 1.6 - 0.05, 0, z + j * 0.9 - 0.05, x + k * 1.6 + 0.05, 2.5, z + j * 0.9 + 0.05, rgb("#5d4037"));
      for (let s = 0; s < 6; s++) stalls.boxMinMax(x - 1.8 + s * 0.6, 2.45 - s * 0.0, z - 1.1, x - 1.2 + s * 0.6, 2.6, z + 1.1, rgb(s % 2 ? "#fafafa" : awn[i % awn.length]!));
      stalls.boxMinMax(x - 1.4, 0.95, z - 0.5, x + 1.4, 1.35, z + 0.5, rgb(["#e8dcc0", "#f5c26b", "#c5e1a5", "#ffab91"][i % 4]!));
    }
    for (const x of [-m.hx + 3, 0, m.hx - 3]) {
      stalls.boxMinMax(x - 0.06, 0, -0.06, x + 0.06, 9, 0.06, rgb("#6d4c33"));
      stalls.boxMinMax(x + 0.06, 7.2, -0.04, x + 1.7, 8.8, 0.04, rgb("#ff8f00"));
    }
    const stallMesh = stalls.toMesh("melaStalls", scene, mats.get("fabric"));
    stallMesh.parent = this.mela; stallMesh.isPickable = false;
    this.wheel = new TransformNode("melaWheel", scene);
    this.wheel.parent = this.mela; this.wheel.position.set(0, 4.2, 0);
    const wg = new GeoBuilder(1);
    wg.boxMinMax(-0.15, -0.15, -0.15, 0.15, 0.15, 0.15, rgb("#37474f"));
    for (let a = 0; a < 6; a++) {
      const an = (a / 6) * Math.PI * 2, x = Math.cos(an) * 3.4, y = Math.sin(an) * 3.4;
      wg.boxMinMax(Math.min(0, x) - 0.05, Math.min(0, y) - 0.05, -0.05, Math.max(0, x) + 0.05, Math.max(0, y) + 0.05, 0.05, rgb("#78909c"));
      wg.boxMinMax(x - 0.45, y - 0.5, -0.45, x + 0.45, y + 0.0, 0.45, rgb(["#e53935", "#fbc02d", "#1e88e5", "#43a047", "#8e24aa", "#fb8c00"][a]!));
    }
    const wm = wg.toMesh("melaWheelMesh", scene, mats.get("paint"));
    wm.parent = this.wheel; wm.isPickable = false;
    const post = new GeoBuilder(1);
    post.boxMinMax(-0.15, -4.2, -1.4, 0.15, 0, -1.1, rgb("#455a64"));
    post.boxMinMax(-0.15, -4.2, 1.1, 0.15, 0, 1.4, rgb("#455a64"));
    const pm = post.toMesh("melaWheelPost", scene, mats.get("metal"));
    pm.parent = this.mela; pm.position.y = 4.2; pm.isPickable = false;
    this.mela.setEnabled(false);

    // The swing: two ropes from a branch and a plank, swinging gently.
    const sw = swingSpot();
    this.swing = new TransformNode("jhoola", scene);
    this.swing.position.set(sw.x, 3.6, sw.z);
    this.swingSeat = new TransformNode("jhoolaSeat", scene);
    this.swingSeat.parent = this.swing;
    const jg = new GeoBuilder(1);
    for (const x of [-0.35, 0.35]) jg.boxMinMax(x - 0.015, -3.1, -0.015, x + 0.015, 0, 0.015, rgb("#a1887f"));
    jg.boxMinMax(-0.45, -3.15, -0.15, 0.45, -3.07, 0.15, rgb("#6d4c33"));
    jg.boxMinMax(-0.47, -3.07, -0.16, 0.47, -3.0, 0.16, rgb("#e53935"));
    const jm = jg.toMesh("jhoolaMesh", scene, mats.get("wood"));
    jm.parent = this.swingSeat; jm.isPickable = false;
    this.swing.setEnabled(false);
  }

  /** Is a festival's evening on right now, and which? */
  get active(): Live | null { return this.live && this.live.on ? this.live : null; }

  update(dt: number): void {
    this.t += dt;
    if ((this.checkT -= dt) <= 0) { this.checkT = 1; this.refresh(); }
    const L = this.live;
    if (!L || !L.on) return;
    const p = this.host.playerPos();
    switch (L.festival.id) {
      case "diwali": this.updateDiwali(dt, p); break;
      case "lohri": this.updateLohri(dt, p); break;
      case "holi": this.updateGulal(dt, p); break;
      case "baisakhi": this.wheel.rotation.z += dt * 0.35; break;
      case "teeyan": this.swingSeat.rotation.z = Math.sin(this.t * 1.4) * 0.45; break;
    }
  }

  private refresh(): void {
    const day = this.host.day(), hour = this.host.hour();
    const L = festivalNow(day, hour);
    const was = this.live?.on ? this.live.festival.id : "";
    this.live = L;
    const id = L?.on ? L.festival.id : "";
    if (id !== was) this.switchTo(id);
    // Announce it once a festival's day starts to bite.
    if (L && this.announced !== `${day}:${L.festival.id}` && hour >= 6) {
      this.announced = `${day}:${L.festival.id}`;
      this.host.toast(`🎉 Aaj ${L.festival.name} ae! ${L.festival.blurb}`);
      this.procDone.clear();
    }
    // Processions on their hours (retried until one finds a road out of sight).
    if (L && L.on) {
      for (const pr of FEST_PROCESSIONS[L.festival.id] ?? []) {
        const key = `${day}:${pr.at}`;
        if (hour >= pr.at && hour < pr.at + 1.5 && !this.procDone.has(key)) { if (this.host.procession(pr.kind)) this.procDone.add(key); }
      }
    }
  }

  /** Show what the festival now on needs, and hide the rest. */
  private switchTo(id: string): void {
    const on = (m: Mesh | TransformNode, v: boolean) => m.setEnabled(v);
    on(this.diyaBase, id === "diwali"); on(this.diyaFlame, id === "diwali");
    if (id !== "diwali") { this.diyaBase.thinInstanceCount = 0; this.diyaFlame.thinInstanceCount = 0; }
    for (const m of this.logs) m.setEnabled(id === "lohri");
    if (id !== "lohri") for (const f of this.fires) f.emitRate = 0;
    if (id !== "holi") this.gulal.emitRate = 0;
    on(this.mela, id === "baisakhi");
    on(this.swing, id === "teeyan");
  }

  // ---- Diwali

  private updateDiwali(dt: number, p: Vector3): void {
    if ((this.diyaT -= dt) <= 0) { this.diyaT = 2.5; this.placeDiyas(p); }
    if ((this.fwT -= dt) <= 0) {
      this.fwT = 2.2 + this.rng.next() * 3.5;
      const a = this.rng.next() * Math.PI * 2, r = 45 + this.rng.next() * 90;
      this.burst(new Vector3(p.x + Math.cos(a) * r, 24 + this.rng.next() * 22, p.z + Math.sin(a) * r));
    }
  }

  /** Six diyas on the doorstep of each of the nearest houses (the gate side of every kothi). */
  private placeDiyas(p: Vector3): void {
    const near = HOUSE_BELLS.filter((h) => Math.abs(h.bell.x - p.x) < 130 && Math.abs(h.bell.z - p.z) < 130)
      .sort((a, b) => (a.bell.x - p.x) ** 2 + (a.bell.z - p.z) ** 2 - ((b.bell.x - p.x) ** 2 + (b.bell.z - p.z) ** 2)).slice(0, this.diyaMax / 6);
    const buf = new Float32Array(16 * this.diyaMax);
    let n = 0;
    for (const h of near) {
      const f = { ox: h.ox, oz: h.oz, rot: h.rot };
      // A row of six along the footpath in front of the gate, from one pillar to the other.
      const p0 = houseToWorld(f, h.gateU, 0);
      const gw = Math.hypot(h.bell.x - p0.x, h.bell.z - p0.z);
      for (let k = 0; k < 6; k++) {
        if (n >= this.diyaMax) break;
        const w = houseToWorld(f, h.gateU - 0.1 + ((gw + 0.2) * k) / 5, 0.7);
        Matrix.Translation(w.x, 0.14, w.z).copyToArray(buf, n * 16);
        n++;
      }
    }
    this.sample = [buf[12]!, buf[13]!, buf[14]!, near[0]?.bell.x ?? 0, near[0]?.bell.z ?? 0, near[0]?.plinth ?? 0];
    for (const m of [this.diyaBase, this.diyaFlame]) { m.thinInstanceSetBuffer("matrix", buf, 16, false); m.thinInstanceCount = n; m.thinInstanceRefreshBoundingInfo(false); }
  }

  /** One rocket bursting at `at` (also the probe's, to put one in front of a camera). */
  burst(at: Vector3): void {
    const ps = this.fireworks.find((s) => !s.manualEmitCount) ?? this.fireworks[0]!;
    const c = SPARK[Math.floor(this.rng.next() * SPARK.length)]!;
    const c2 = SPARK[Math.floor(this.rng.next() * SPARK.length)]!;
    ps.emitter = at;
    ps.color1 = new Color4(c[0], c[1], c[2], 1);
    ps.color2 = new Color4(c2[0], c2[1], c2[2], 1);
    ps.colorDead = new Color4(c[0], c[1], c[2], 0);
    ps.manualEmitCount = 160;
    this.host.firework(at);
  }

  // ---- Lohri

  /** Which bonfire spots are within reach (nearest first), for the interaction and the sound. */
  nearestFire(p: Vector3, within = 6): BonfireSpot | null {
    let best: BonfireSpot | null = null, bd = within;
    for (const s of this.spots) { const d = Math.hypot(s.x - p.x, s.z - p.z); if (d < bd) { bd = d; best = s; } }
    return best;
  }

  private updateLohri(dt: number, p: Vector3): void {
    if ((this.fireT -= dt) <= 0) {
      this.fireT = 1;
      this.near = this.spots.map((s, i) => ({ i, d: Math.hypot(s.x - p.x, s.z - p.z) })).filter((q) => q.d < 160).sort((a, b) => a.d - b.d).slice(0, this.fires.length).map((q) => q.i);
      this.fires.forEach((f, k) => {
        const i = this.near[k];
        if (i === undefined) { f.emitRate = 0; return; }
        const s = this.spots[i]!;
        this.fireAt[k]!.set(s.x, 0.15, s.z);
        f.emitRate = 70;
      });
    }
  }

  // ---- Hola Mohalla

  private updateGulal(dt: number, p: Vector3): void {
    this.gulalAt.set(p.x, 0, p.z);
    if ((this.gulalT -= dt) <= 0) {
      this.gulalT = 3;
      const c = GULAL[Math.floor(this.rng.next() * GULAL.length)]!, c2 = GULAL[Math.floor(this.rng.next() * GULAL.length)]!;
      this.gulal.color1 = new Color4(c[0], c[1], c[2], 0.45);
      this.gulal.color2 = new Color4(c2[0], c2[1], c2[2], 0.45);
      this.gulal.emitRate = 28;
    }
  }

  /** For the probe: what is lit and how much of it. */
  state(): Record<string, unknown> {
    return {
      live: this.live ? { id: this.live.festival.id, on: this.live.on } : null,
      diyas: this.diyaBase.thinInstanceCount, sample: this.sample, diyaEnabled: this.diyaBase.isEnabled(),
      fireworks: this.fireworks.map((f) => f.getActiveCount()),
      fires: this.fires.map((f) => f.emitRate), logs: this.logs.filter((m) => m.isEnabled()).length, mela: this.mela.isEnabled(), swing: this.swing.isEnabled(),
    };
  }

  dispose(): void {
    for (const ps of [...this.fireworks, ...this.fires, this.gulal]) ps.dispose();
    for (const m of [this.diyaBase, this.diyaFlame, ...this.logs]) m.dispose();
    this.mela.dispose(); this.swing.dispose();
  }
}
