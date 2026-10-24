import { Vector3, MeshBuilder, Mesh, TransformNode, type Scene, type AbstractMesh } from "../babylon";
import { Vector4 } from "@babylonjs/core/Maths/math.vector";
import type { Crowd, Resident } from "../crowds/Crowd";
import type { Materials, MatKey } from "../render/Materials";
import type { SignAtlas } from "../render/Signs";
import { GeoBuilder, rgb } from "../render/GeoBuilder";
import type { Vehicle } from "../vehicles/Vehicle";
import type { VehicleType } from "../vehicles/specs";
import type { Speaker, VoiceWhen } from "../audio/VoiceDirector";
import { constableLook } from "../characters/appearances";
import { Rng } from "../render/textures";

/**
 * Police posts: nakas (a checkpoint across a main road — striped barricades,
 * a jeep and a bike parked on the verge, constables waving cars over for
 * their papers) and chowkis (a small roadside police booth with a couple of
 * constables on a bench). The constables are real police residents, so if
 * there is trouble nearby they are the first to come over.
 */

export interface PostDef {
  id: string;
  label: string;
  x: number;
  z: number;
  /** The road runs north-south ("ns") or east-west ("ew"). */
  axis: "ns" | "ew";
  /** Half the road's width. */
  halfW: number;
  /** A checkpoint across the road (otherwise just the chowki booth). */
  naka: boolean;
  /** Which side of the road the booth and the vehicles stand on (+1 / -1). */
  side: 1 | -1;
}

export const POSTS: PostDef[] = [
  { id: "nakaGtWest", label: "G.T. Road naka (towards Ludhiana)", x: -205, z: -160, axis: "ew", halfW: 7, naka: true, side: 1 },
  { id: "nakaGtEast", label: "G.T. Road naka (towards Nawan Shehar)", x: 150, z: -160, axis: "ew", halfW: 7, naka: true, side: -1 },
  { id: "nakaKotli", label: "Kotli Road naka (before Pind Kotli)", x: 0, z: 205, axis: "ns", halfW: 4, naka: true, side: 1 },
  { id: "chowkiTown", label: "Ranggarh police chowki (Kotli Road)", x: 0, z: 72, axis: "ns", halfW: 4, naka: false, side: -1 },
];

export interface PostsHost {
  scene: Scene;
  mats: Materials;
  signs: SignAtlas;
  crowd: Crowd;
  playerPos(): Vector3;
  /** The vehicle the player is driving, if any. */
  playerVehicle(): Vehicle | null;
  spawnVehicle(id: string, type: VehicleType, x: number, z: number, yaw: number, paint: string): Vehicle;
  despawnVehicle(v: Vehicle): void;
  /** Plays the recording the voice map gives: the words of that take, or null for silence. */
  speak(when: VoiceWhen, who: Speaker): string | null;
  dialogue(who: string, text: string, options: Array<{ label: string; value: string }>): Promise<string>;
  toast(msg: string, kind?: "info" | "warn" | "money"): void;
  pay(amount: number): boolean;
  /** Report trouble to the police (driving straight through a naka). */
  crime(kind: string): void;
  addCaster(m: AbstractMesh): void;
  busy(): boolean;
}

export interface PostInteraction { id: string; pos: Vector3; radius: number; label: string; run: () => void | Promise<void> }

interface Live {
  def: PostDef;
  cops: Resident[];
  vehicles: Vehicle[];
  /** The player has been dealt with on this pass (reset once they are well away). */
  handled: boolean;
  shouted: boolean;
  stopT: number;
}

const DUTY_LINES = ["Kaagaz poore rakheya karo!", "Helmet kithe ae?", "Dheere chalo, ji!", "Naka laga ae, side te lao!", "Chah da time ho gaya…"];
const TALK_LINES = [
  "Ki gal ae, puttar? Sab theek?",
  "Saari dihaadi khade haan, chah taan pila de koi!",
  "Raat nu naka double hunda ae, dhyaan rakhin.",
  "Gaddi chalaunde vele phone nahi, samjheya?",
];

export class Posts {
  private live = new Map<string, Live>();
  private rng = new Rng(7272);
  private n = 0;

  constructor(private host: PostsHost) {}

  /** Build the barricades and booths (static, cheap: kept for the whole game). */
  init(): void {
    for (const d of POSTS) this.buildProps(d);
  }

  /** World point from a post's local frame (x across the road, z along it). */
  private at(d: PostDef, lx: number, lz: number): Vector3 {
    return d.axis === "ns" ? new Vector3(d.x + lx, 0, d.z + lz) : new Vector3(d.x + lz, 0, d.z - lx);
  }
  private yawOf(d: PostDef): number {
    return d.axis === "ns" ? 0 : Math.PI / 2;
  }

  private buildProps(d: PostDef): void {
    const root = new TransformNode(`post_${d.id}`, this.host.scene);
    root.position.set(d.x, 0, d.z);
    root.rotation.y = this.yawOf(d);
    const parts = new Map<MatKey, GeoBuilder>();
    const g = (m: MatKey) => { let b = parts.get(m); if (!b) { b = new GeoBuilder(0.5); parts.set(m, b); } return b; };
    const RED = rgb("#c62828"), WHITE = rgb("#f5f5f5"), BLUE = rgb("#1e3a8a"), YEL = rgb("#fdd835"), DARK = rgb("#2b2b2b");
    // A Punjab Police barricade: steel frame, red-white panel, a little sign.
    const barricade = (x: number, z: number, w: number) => {
      for (const sx of [-1, 1]) g("metal").box(x + sx * (w / 2 - 0.05), 0.5, z, 0.06, 1.0, 0.06, DARK);
      for (const sx of [-1, 1]) g("metal").box(x + sx * (w / 2 - 0.05), 0.02, z, 0.08, 0.04, 0.6, DARK);
      const k = Math.max(3, Math.round(w / 0.35));
      for (let i = 0; i < k; i++) g("paint").box(x - w / 2 + (i + 0.5) * (w / k), 0.72, z, w / k, 0.34, 0.04, i % 2 ? WHITE : RED);
      g("paint").box(x, 0.42, z, w - 0.1, 0.06, 0.03, YEL);
    };
    const cone = (x: number, z: number) => {
      g("paint").cylinder(x, 0, z, 0.16, 0.03, 0.55, 10, rgb("#ff6d00"));
      g("paint").cylinder(x, 0.24, z, 0.1, 0.08, 0.1, 10, WHITE, false);
      g("rubber").box(x, 0.015, z, 0.36, 0.03, 0.36, DARK);
    };
    if (d.naka) {
      // Staggered across the road so traffic has to slow and weave through.
      barricade(-d.halfW * 0.5, -5, 1.6);
      barricade(d.halfW * 0.5, 5, 1.6);
      barricade(0, 0, 1.4);
      for (const sx of [-1, 1]) barricade(sx * (d.halfW + 0.5), 0, 2.2);
      for (const z of [-9.6, -7.2, 7.2, 9.6]) cone(0, z);
    }
    // The chowki booth (every post has one; at a naka it is the shelter).
    const bx = d.side * (d.halfW + 4.6), bz = d.naka ? 9 : 0;
    g("plaster").boxMinMax(bx - 1.4, 0, bz - 1.4, bx + 1.4, 2.6, bz + 1.4, WHITE);
    g("paint").boxMinMax(bx - 1.42, 1.9, bz - 1.42, bx + 1.42, 2.15, bz + 1.42, BLUE);
    g("paint").boxMinMax(bx - 1.42, 0, bz - 1.42, bx + 1.42, 0.3, bz + 1.42, RED);
    g("metal").boxMinMax(bx - 1.7, 2.6, bz - 1.7, bx + 1.7, 2.72, bz + 1.7, rgb("#5d6b7a"));
    // Door and window toward the road.
    const fx = bx - d.side * 1.41;
    g("dark").boxMinMax(fx - 0.01, 0.3, bz - 0.4, fx + 0.01, 2.0, bz + 0.4, [0.25, 0.2, 0.15]);
    g("glass").boxMinMax(fx - 0.012, 1.1, bz + 0.6, fx + 0.012, 1.7, bz + 1.2, rgb("#9ab"));
    for (const sz of [-1, 1]) g("emissive").box(bx, 2.82, bz + sz * 0.18, 0.2, 0.12, 0.3, sz < 0 ? [1, 0.12, 0.1] : [0.15, 0.3, 1]);
    // Bench and a plastic chair outside: where the constables actually are.
    g("wood").box(bx - d.side * 2.3, 0.45, bz + 2.2, 0.45, 0.06, 1.6, rgb("#6d4c41"));
    for (const sz of [-1, 1]) g("wood").box(bx - d.side * 2.3, 0.22, bz + 2.2 + sz * 0.7, 0.4, 0.44, 0.06, rgb("#5d4037"));
    g("paint").box(bx - d.side * 2.4, 0.42, bz - 2.2, 0.45, 0.05, 0.45, rgb("#eeeeee"));
    g("paint").box(bx - d.side * 2.2, 0.68, bz - 2.2, 0.05, 0.5, 0.45, rgb("#eeeeee"));
    for (const [m, b] of parts) {
      if (b.isEmpty()) continue;
      const mesh = b.toMesh(`post_${d.id}_${m}`, this.host.scene, this.host.mats.get(m));
      mesh.parent = root;
      mesh.isPickable = false;
      mesh.receiveShadows = true;
      this.host.addCaster(mesh);
    }
    // The board over the door.
    const uv = this.host.signs.get(d.naka ? "naka" : "chowkiTown");
    const w = 2.6, h = w / uv.aspect;
    const sign = MeshBuilder.CreatePlane(`post_${d.id}_sign`, { width: w, height: h, frontUVs: new Vector4(uv.u0, uv.v0, uv.u1, uv.v1), backUVs: new Vector4(uv.u0, uv.v0, uv.u1, uv.v1), sideOrientation: Mesh.DOUBLESIDE }, this.host.scene);
    sign.material = this.host.signs.material;
    sign.parent = root;
    sign.position.set(fx - d.side * 0.03, 2.35 + h / 2, bz);
    sign.rotation.y = d.side > 0 ? Math.PI / 2 : -Math.PI / 2;
    sign.isPickable = false;
  }

  /** Bring a post to life when the player comes near; pack it up when they leave. */
  private wake(d: PostDef): Live {
    const L: Live = { def: d, cops: [], vehicles: [], handled: false, shouted: false, stopT: 0 };
    const yaw = this.yawOf(d);
    const bz = d.naka ? 9 : 0;
    // Constables: at a naka one stands on the centre line waving traffic over,
    // another at the road's edge — never in a lane, or the traffic queues for ever.
    const spots: Array<[number, number, number]> = d.naka
      ? [[0, -2.2, 0], [d.side * (d.halfW - 0.5), 3, 0], [d.side * (d.halfW + 2.3), bz + 2.2, -d.side]]
      : [[d.side * (d.halfW + 2.3), 2.2, -d.side], [d.side * (d.halfW + 2.4), -2.2, -d.side]];
    spots.forEach(([lx, lz, face], i) => {
      const p = this.at(d, lx, lz);
      const r = this.host.crowd.spawn({
        id: `${d.id}_cop${this.n++}`, name: "Havaldar", role: "keeper", faction: "police", tough: 1.4,
        look: constableLook(300 + this.n * 3 + i), x: p.x, z: p.z, yaw: yaw + (face ? (face > 0 ? Math.PI / 2 : -Math.PI / 2) : Math.PI),
        lines: [...DUTY_LINES],
      });
      this.host.crowd.say(r, this.rng.pick(DUTY_LINES));
      L.cops.push(r);
    });
    // A jeep and a bike on the verge.
    const vj = this.at(d, d.side * (d.halfW + 2.2), bz - 6), vb = this.at(d, d.side * (d.halfW + 1.6), bz - 1.5);
    L.vehicles.push(this.host.spawnVehicle(`${d.id}_jeep${this.n++}`, "jeep", vj.x, vj.z, yaw, "police"));
    L.vehicles.push(this.host.spawnVehicle(`${d.id}_bike${this.n++}`, "motorcycle", vb.x, vb.z, yaw + 0.3, "police"));
    return L;
  }

  private sleep(L: Live): void {
    for (const r of L.cops) if (this.host.crowd.residents.includes(r)) this.host.crowd.remove(r);
    const mine = this.host.playerVehicle();
    for (const v of L.vehicles) if (v !== mine) this.host.despawnVehicle(v);
  }

  fixedUpdate(dt: number): void {
    const p = this.host.playerPos();
    for (const d of POSTS) {
      const dist = Math.hypot(p.x - d.x, p.z - d.z);
      let L = this.live.get(d.id);
      if (!L && dist < 170) { L = this.wake(d); this.live.set(d.id, L); }
      if (L && dist > 240) { this.sleep(L); this.live.delete(d.id); continue; }
      if (L && d.naka) this.updateNaka(L, dt, p, dist);
    }
  }

  private updateNaka(L: Live, dt: number, p: Vector3, dist: number): void {
    const v = this.host.playerVehicle();
    if (dist > 45) { L.handled = false; L.shouted = false; L.stopT = 0; return; }
    if (!v || L.handled || this.host.busy()) return;
    const cop = L.cops.find((c) => this.host.crowd.residents.includes(c) && c.faction === "police" && c.pose === "stand");
    if (!cop) return;
    // "Gaddi rok! Side te laa!" — the one in the road waves you over.
    if (!L.shouted && dist < 32) {
      L.shouted = true;
      cop.lookTarget = p.clone();
      cop.anim.play("point", 1.5);
      // The jeep's loudspeaker: the words of the take that plays are the ones the cop is seen to say.
      const words = this.host.speak("police-patrol", { group: "police-jeep", pos: cop.pos });
      this.host.crowd.say(cop, words ?? "Gaddi rok! Side te laa!");
    }
    if (dist < 14 && v.speed < 1.5) {
      L.stopT += dt;
      if (L.stopT > 0.8) { L.handled = true; void this.papers(cop); }
    } else if (dist < 7 && v.speed > 9) {
      // Straight through the naka: that will be remembered at the chowki.
      L.handled = true;
      this.host.crowd.say(cop, "Oye! Rukk! Number note kar lo isda!");
      this.host.toast("You drove straight through the police naka!", "warn");
      this.host.crime("naka");
    }
  }

  /** Kaagaz dikhao: the naka conversation. */
  private async papers(cop: Resident): Promise<void> {
    cop.lookTarget = this.host.playerPos();
    const v = await this.host.dialogue("naka", "<i>(A constable taps the bonnet with his lathi.)</i><br>Gaddi side te laa. <b>Kaagaz dikhao</b> — licence, RC, insurance, pollution. Te helmet kithe ae?", [
      { label: "Ji, eh lao saare kaagaz", value: "ok" },
      { label: "Kaagaz ghar reh gaye ji…", value: "none" },
      { label: "Main Bhole da banda haan, ji!", value: "name" },
    ]);
    if (v === "ok") {
      this.host.crowd.say(cop, "Theek ae. Dheere chalaya kar. Ja!");
      return;
    }
    if (v === "name") {
      this.host.crowd.say(cop, this.rng.next() < 0.6 ? "Bhole da? Oh, dhaba wala! Ja ja, te rajma bhej deyin!" : "Bhola kaun? Kaagaz dikha!");
      return;
    }
    const w = await this.host.dialogue("naka", "Ghar reh gaye? Sab de ghar hi reh jaande ne! <b>₹500 da challan</b> kata, ya… <i>(looks at the sky)</i> chai-paani?", [
      { label: "Challan kat do ji (₹500)", value: "challan" },
      { label: "Chai-paani ₹100", value: "chai" },
      { label: "Bas ik vaari maaf kar do!", value: "beg" },
    ]);
    if (w === "challan") { this.host.pay(500); this.host.toast("Challan: ₹500. A receipt and everything!", "info"); this.host.crowd.say(cop, "Eh lai parchi. Agli vaari kaagaz naal!"); }
    else if (w === "chai") { this.host.pay(100); this.host.crowd.say(cop, "Chal, ja. Asi tainu dekheya hi nahi."); }
    else this.host.crowd.say(cop, this.rng.next() < 0.5 ? "Chal, aaj maaf. Kal kaagaz lai ke aayin!" : "Maafi? Ja, par gaddi dheere!");
  }

  /** On foot: a word with the constables. */
  interactions(): PostInteraction[] {
    const out: PostInteraction[] = [];
    for (const L of this.live.values()) {
      const c = L.cops.find((r) => this.host.crowd.residents.includes(r) && r.pose === "stand");
      if (!c) continue;
      out.push({ id: `post_${L.def.id}`, pos: c.pos, radius: 2.2, label: "Talk to the havaldar", run: () => { c.lookTarget = this.host.playerPos(); this.host.crowd.say(c, this.rng.pick(TALK_LINES)); } });
    }
    return out;
  }

  /** The nearest post to a point (for the "try an event" panel). */
  nearest(p: Vector3, naka: boolean): PostDef | null {
    let best: PostDef | null = null, bd = Infinity;
    for (const d of POSTS) {
      if (d.naka !== naka) continue;
      const dd = Math.hypot(p.x - d.x, p.z - d.z);
      if (dd < bd) { bd = dd; best = d; }
    }
    return best;
  }

  /** Where to stand to see a post: a little way down the road from it. */
  approach(d: PostDef): { x: number; z: number; yaw: number } {
    const a = this.at(d, d.side * (d.halfW + 1.5), -22);
    return { x: a.x, z: a.z, yaw: this.yawOf(d) };
  }
}
