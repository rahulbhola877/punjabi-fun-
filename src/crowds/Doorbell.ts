import { Quaternion, TransformNode, Vector3 } from "../babylon";
import type { Scene } from "../babylon";
import { GeoBuilder, rgb } from "../render/GeoBuilder";
import type { Materials } from "../render/Materials";
import { randomAppearance } from "../characters/appearances";
import type { Appearance } from "../characters/HumanBuilder";
import type { Mesh } from "../babylon";
import { houseToWorld, type HouseBell } from "../world/openHouses";
import { familyOf } from "./cast";
import type { Crowd, Resident } from "./Crowd";
import type { Speaker, VoiceWhen } from "../audio/VoiceDirector";

/**
 * The bell by the gate. Every colony house has one. You ring it; a chime sounds inside; a moment later the front
 * door opens, someone comes out across the yard to the gate, answers, and goes back in, and the door shuts. The
 * families that know yours greet you by name (and remember it); the others ask who it is. At night nobody comes
 * (a voice from a window sends you off), and sometimes the house is simply empty.
 */

export interface DoorbellHost {
  scene: Scene;
  mats: Materials;
  crowd: Crowd;
  playerPos(): Vector3;
  /** Game hour of the day. */
  hour(): number;
  ring(pos: Vector3): void;
  toast(msg: string): void;
  /** A person who knows you answers your greeting (People.ts): by name, hour and warmth. */
  greet(r: Resident): void;
  /** A recorded line through the voice map: the words of the clip that played, or null when none did. */
  say(when: VoiceWhen, sp: Speaker): string | null;
}

type Stage = "ringing" | "opening" | "coming" | "talking" | "going" | "closing";

interface Visit {
  h: HouseBell;
  stage: Stage;
  t: number;
  r: Resident | null;
  /** Where they stand to talk, and the door's middle, world. */
  gate: Vector3;
  door: Vector3;
  family: boolean;
}

const UNKNOWN_LINES = [
  "Kaun ae, ji? Ki gal ae?", "Haanji, ki chahida?", "Kiss nu milna ae, puttar?", "Sadde ghar kuj nahi chahida, ji.",
  "Paaji, galat ghar aa gaye ho shayad.", "Ruko, ruko… haanji, boliye?",
];
const SIESTA_LINES = ["Oh ho, dupehar nu sau rahe haan! Baad vich aana.", "Hai rabba, ajj vi araam nahi! Kaun ae?"];
const NIGHT_LINES = ["Eni raat nu kaun ae? Subah aana, puttar!", "Raat bahut ho gayi, kal aao, ji.", "Sab sau gaye ne, subah gal karange."];
const EMPTY = "🔔 Kisi ne darwaza nahi khola. Shayad ghar vich koi nahi.";

const DOOR_W = 1.15, DOOR_H = 2.25;

export class Doorbell {
  private visit: Visit | null = null;
  private pivot: TransformNode;
  private leaf: TransformNode;
  private dark: Mesh;
  private n = 0;
  private cool = 0;

  constructor(private host: DoorbellHost) {
    this.pivot = new TransformNode("doorPivot", host.scene);
    this.leaf = new TransformNode("doorLeaf", host.scene);
    this.leaf.parent = this.pivot;
    const wood = host.mats.get("wood");
    const g = new GeoBuilder(1);
    // The leaf hangs from the hinge edge and reaches along +x; panels and a handle.
    g.boxMinMax(0, 0, -0.03, DOOR_W, DOOR_H, 0.03, rgb("#6b4a2b"));
    g.boxMinMax(0.1, 0.15, 0.03, DOOR_W - 0.1, 1.0, 0.045, rgb("#5a3d23"));
    g.boxMinMax(0.1, 1.15, 0.03, DOOR_W - 0.1, DOOR_H - 0.15, 0.045, rgb("#5a3d23"));
    g.boxMinMax(DOOR_W - 0.16, 1.0, 0.045, DOOR_W - 0.1, 1.08, 0.075, rgb("#c9a227"));
    const lm = g.toMesh("doorLeafMesh", host.scene, wood);
    lm.parent = this.leaf;
    lm.isPickable = false;
    const d = new GeoBuilder(1);
    d.boxMinMax(0, 0, -0.02, DOOR_W, DOOR_H, 0.0, [1, 1, 1]);
    this.dark = d.toMesh("doorDark", host.scene, host.mats.get("dark"));
    this.dark.parent = this.pivot;
    this.dark.isPickable = false;
    this.pivot.setEnabled(false);
  }

  get busy(): boolean { return !!this.visit; }

  /** Ring this house's bell. */
  ring(h: HouseBell): void {
    if (this.visit) { this.host.toast("Ruko zara, koi darwaze te aa reha ae."); return; }
    if (this.cool > 0) return;
    this.cool = 2;
    const bellPos = new Vector3(h.bell.x, 1.5, h.bell.z);
    this.host.ring(bellPos);
    const f = { ox: h.ox, oz: h.oz, rot: h.rot };
    const gateU = h.gateU;
    const g = houseToWorld(f, gateU, -0.75), dr = h.frontDoor;
    this.visit = { h, stage: "ringing", t: 0, r: null, gate: new Vector3(g.x, 0, g.z), door: new Vector3(dr.x, 0, dr.z), family: !!familyOf(h.id) };
  }

  /** Nobody comes to the door at night or (now and then) in the afternoon rest hour: a voice from a window instead. */
  private line(): { when: VoiceWhen; text: string } | null {
    const hr = this.host.hour();
    if (hr >= 22.5 || hr < 5.5) return { when: "doorbell-night", text: NIGHT_LINES[this.n++ % NIGHT_LINES.length]! };
    if (hr >= 13.5 && hr < 15.5 && this.n++ % 2 === 0) return { when: "doorbell-siesta", text: SIESTA_LINES[this.n % SIESTA_LINES.length]! };
    return null;
  }

  /** The window voice: a recording if the map has one for some man, woman or elder, else the written line. */
  private windowVoice(v: Visit, night: { when: VoiceWhen; text: string }): string {
    const pos = new Vector3(v.door.x, 1.7, v.door.z);
    const groups = ["any-elder", "any-woman", "any-man"].sort(() => Math.random() - 0.5);
    for (const group of groups) {
      const words = this.host.say(night.when, { group, pos });
      if (words) return words;
    }
    return night.text;
  }

  /** Move the door leaf: 0 shut, 1 wide open (outward). */
  private setDoor(h: HouseBell, open: number): void {
    this.pivot.setEnabled(open > 0.01);
    const f = { ox: h.ox, oz: h.oz, rot: h.rot };
    const hinge = houseToWorld(f, h.doorU, -h.yd + 0.06);
    this.pivot.position.set(hinge.x, h.plinth, hinge.z);
    this.pivot.rotation.set(0, h.rot, 0);
    this.leaf.rotation.set(0, -open * 1.75, 0);
  }

  private spawnAnswerer(v: Visit): Resident {
    const seed = [...v.h.id].reduce((a, c) => a * 31 + c.charCodeAt(0), 7) % 9000 + 21000;
    const base: Appearance = randomAppearance(seed);
    const fam = familyOf(v.h.id);
    const female = fam ? seed % 3 !== 0 : seed % 5 < 3;
    const elder = seed % 4 === 0;
    const look: Appearance = female
      ? { ...base, sex: "f", age: elder ? "elder" : "adult", top: "kameez", bottom: "salwar", beard: "none", headwear: "none", hair: "bun", dupatta: ["#ffd54f", "#ef9a9a", "#b2dfdb", "#f8bbd0"][seed % 4]!, height: 1.55 + (seed % 5) * 0.02 }
      : { ...base, sex: "m", age: elder ? "elder" : "adult", top: "kurta", bottom: "pajama", headwear: seed % 2 ? "turban" : "none" };
    const id = `bell_${v.h.id}_${this.n++}`;
    const r = this.host.crowd.spawn({
      id, name: fam ? `${fam.surname} ${female ? (elder ? "bebe" : "aunty") : "uncle"}` : female ? "Aunty ji" : "Uncle ji", role: "chatter",
      look, x: v.door.x, z: v.door.z, yaw: v.h.rot, indoor: true,
    });
    return r;
  }

  private steer(r: Resident, to: Vector3, dt: number, speed: number): boolean {
    const dx = to.x - r.pos.x, dz = to.z - r.pos.z, d = Math.hypot(dx, dz);
    if (d < 0.15) { r.vel.scaleInPlace(Math.exp(-dt * 8)); return true; }
    r.vel.set((dx / d) * speed, 0, (dz / d) * speed);
    r.facing = Math.atan2(dx, dz);
    return false;
  }

  update(dt: number): void {
    this.cool = Math.max(0, this.cool - dt);
    const v = this.visit;
    if (!v) return;
    v.t += dt;
    const p = this.host.playerPos();
    const far = Math.hypot(p.x - v.h.bell.x, p.z - v.h.bell.z) > 40;
    if (far) { this.finish(v); return; }
    switch (v.stage) {
      case "ringing": {
        if (v.t < 2.6) break;
        const night = this.line();
        const empty = !v.family && (this.n++ * 7 + v.h.id.length) % 5 === 0;
        if (night) { this.host.toast(`🏠 Andar ton aawaz: "${this.windowVoice(v, night)}"`); this.visit = null; break; }
        if (empty) { this.host.toast(EMPTY); this.visit = null; break; }
        v.stage = "opening"; v.t = 0;
        v.r = this.spawnAnswerer(v);
        v.r.brain = () => undefined;
        break;
      }
      case "opening": {
        this.setDoor(v.h, Math.min(1, v.t / 0.8));
        if (v.t >= 0.9) { v.stage = "coming"; v.t = 0; const r = v.r!; r.brain = (rr, dt2) => { this.steer(rr, v.gate, dt2, 1.25); }; }
        break;
      }
      case "coming": {
        const r = v.r!;
        if (!r || !this.host.crowd.residents.includes(r)) { this.finish(v); break; }
        // Out of the doorway before it shuts behind them: keep the door open while they cross the yard.
        if (Math.hypot(r.pos.x - v.gate.x, r.pos.z - v.gate.z) < 0.35 || v.t > 9) {
          v.stage = "talking"; v.t = 0;
          r.brain = (rr, dt2) => { rr.vel.scaleInPlace(Math.exp(-dt2 * 8)); rr.facing = Math.atan2(this.host.playerPos().x - rr.pos.x, this.host.playerPos().z - rr.pos.z); rr.lookTarget = this.host.playerPos().clone(); };
          r.anim.play("greet", 1.6);
          if (v.family) this.host.greet(r);
          else if (!this.host.say("doorbell-stranger", r)) this.host.crowd.say(r, UNKNOWN_LINES[this.n++ % UNKNOWN_LINES.length]!);
        }
        break;
      }
      case "talking": {
        // Stay for a while, or until the player walks off.
        const gone = Math.hypot(p.x - v.h.bell.x, p.z - v.h.bell.z) > 6;
        if (v.t > (v.family ? 14 : 8) || (gone && v.t > 2)) {
          v.stage = "going"; v.t = 0;
          const r = v.r!;
          r.brain = (rr, dt2) => { this.steer(rr, v.door, dt2, 1.3); };
        }
        break;
      }
      case "going": {
        const r = v.r!;
        if (!r || !this.host.crowd.residents.includes(r) || Math.hypot(r.pos.x - v.door.x, r.pos.z - v.door.z) < 0.5 || v.t > 10) {
          if (r && this.host.crowd.residents.includes(r)) this.host.crowd.remove(r);
          v.r = null; v.stage = "closing"; v.t = 0;
        }
        break;
      }
      case "closing": {
        this.setDoor(v.h, Math.max(0, 1 - v.t / 0.8));
        if (v.t >= 0.9) { this.setDoor(v.h, 0); this.visit = null; }
        break;
      }
    }
  }

  private finish(v: Visit): void {
    if (v.r && this.host.crowd.residents.includes(v.r)) this.host.crowd.remove(v.r);
    this.setDoor(v.h, 0);
    this.visit = null;
  }

  dispose(): void {
    if (this.visit) this.finish(this.visit);
    this.pivot.dispose();
  }
}

void Quaternion;
