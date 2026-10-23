import { Vector3, type Scene } from "../babylon";
import type { Appearance } from "../characters/HumanBuilder";
import { randomAppearance } from "../characters/appearances";
import { colonyLife } from "../world/colonySeats";
import { isOpenGround } from "../world/layout";
import { zoneAt } from "../world/zones";
import { Rng } from "../render/textures";
import type { Crowd, Resident } from "./Crowd";

/** What the aunties say at the gate. Gossip, never names anyone real. */
const AUNTY_LINES = [
  "Sharma ji di kudi Canada chali gayi, suneya?",
  "Ehna di nuh taan saara din phone te hi rehndi ae!",
  "Kal phir light gayi si, inverter vi jawaab de gaya.",
  "Kaam wali ajj phir nahi aayi. Chhutti te chhutti!",
  "Gill sahib de munde da rishta pakka — kudi Ludhiane di ae.",
  "Sabzi wala tamatar assi rupaye kilo dinda si!",
  "Batra'an ne navi gaddi lai — saari kishtaan te!",
  "Kitty party is vaari mere ghar ae, aaoge na?",
  "Saamne wali taan har gal vich nakk ghusaundi ae!",
  "Mere munde nu IELTS vich saade sat bands aaye!",
  "Doodh wala paani milaunda ae, main aap vekheya!",
  "Viah te lehnga pachas hazaar da si, par fit nahi aaya!",
];
const AUNTY_REPLIES = ["Haaye, sach?", "Mainu taan pehlan hi pata si!", "Chal jhooth!", "Rabb di saunh?", "Ni ehna da taan eho haal ae!", "Hor suna, hor!", "Hai main mar jaavan!"];
/** Uncles on the corner: prices, pensions, sons abroad, the state of the roads. */
const UNCLE_LINES = [
  "Petrol phir mehnga ho gaya, hun cycle hi chalauni pau.",
  "Mera munda Canada ton aa reha agle mahine.",
  "Sarkaar kuchh nahi kardi, sadkaan vekh lo!",
  "Kal match vekheya? Aakhri over vich kamaal ho gaya!",
  "Pension da kam phir latak gaya. Babu kehnda kal aao.",
  "Gali di naali kado pakki hougi? Har saal vaada!",
  "Saade vele ghee shudh hunda si, hun sab milavat!",
  "Doctor kehnda khand band karo — jalebi kive chhaddiye?",
  "Plot de rate dugne ho gaye, Model Town vich.",
  "Is vaari kanak da bhaa changa milu?",
];
const VILLAGE_LINES = [
  "Tubewell di motor phir sad gayi.",
  "Majh ne ajj doodh ghatt ditta, garmi bahut ae.",
  "Sarpanch ne phirni pakki karauni si, kitthe gayi?",
  "Mandi vich jhone di boli kado shuru?",
  "Nehar vich paani aaya ke nahi?",
];
const UNCLE_REPLIES = ["Haan ji, bilkul!", "Eh taan sahi gal ae.", "Chhaddo ji, kise ne nahi sunni.", "Oye hoye!", "Gal taan theek ae.", "Hun ki kariye?", "Rabb rakha!"];
const ROW_START = ["Eh gal tu meri nuh baare keh rahi si?!", "Mainu sunaa ke keh reha ae?!", "Oye, zubaan sambhal ke!", "Hun tu mainu sikhaunga?!"];
const ROW_GASP = ["Hai, ki ho gaya?!", "Oye bas karo, bas!", "Chalo chalo, ghare chalo!", "Hun taan tamasha banuga!"];

type Kind = "aunties" | "uncles" | "elders" | "lads";

interface Circle {
  kind: Kind;
  village: boolean;
  members: Resident[];
  centre: Vector3;
  t: number;
  nextLine: number;
  last: Resident | null;
  /** Seconds of chat (with the player near) before it boils over; Infinity = a friendly one. */
  fightAt: number;
  fought: boolean;
}

/**
 * Colony and mohalla life: little standing circles of two to four people
 * near the player — aunties at a gate, uncles on the corner, bapus by the
 * phirni — chatting with talk gestures and speech bubbles. Now and then one
 * of them says the wrong thing and it turns into a proper gali jhagda
 * (handed to Jhagde). Circles appear out of view or a fair way off, and go
 * when the player has left them behind.
 */
export class Gossip {
  private rng = new Rng(6161);
  private circles: Circle[] = [];
  private spawnT = 2;
  private n = 0;
  /** Circles at once (set from the graphics preset). */
  max = 3;
  /** Hands two people over to start a quarrel; false if one is already on. */
  quarrel: (a: Resident, b: Resident) => boolean = () => false;
  private spots: Array<{ x: number; z: number; village: boolean }> | null = null;

  constructor(private scene: Scene, private crowd: Crowd) {}

  private allSpots() {
    if (!this.spots) {
      this.spots = [];
      for (const l of colonyLife()) for (const w of l.walks) this.spots.push({ x: w.x, z: w.z, village: l.colony.kind === "village" });
    }
    return this.spots;
  }

  private inView(x: number, z: number): boolean {
    const cam = this.scene.activeCamera;
    if (!cam) return false;
    const f = cam.getDirection(Vector3.Forward());
    const dx = x - cam.position.x, dz = z - cam.position.z, d = Math.hypot(dx, dz) || 1;
    return (dx * f.x + dz * f.z) / (d * (Math.hypot(f.x, f.z) || 1)) > 0.3;
  }

  private look(kind: Kind, i: number, seed: number): Appearance {
    const a = randomAppearance(seed);
    if (kind === "aunties" || (kind === "elders" && i % 2 === 1)) {
      return {
        ...a, sex: "f", age: kind === "elders" || seed % 3 === 0 ? "elder" : "adult", top: "kameez",
        topColor: ["#ad1457", "#00695c", "#6a1b9a", "#ef6c00", "#283593", "#c62828", "#2e7d32"][seed % 7]!,
        bottom: "salwar", bottomColor: ["#f6efe0", "#f2c94c", "#d7ccc8"][seed % 3]!, dupatta: ["#ffd54f", "#ef9a9a", "#b2dfdb", "#f8bbd0", "#ffffff"][seed % 5]!,
        hair: "bun", headwear: "none", beard: "none", height: 1.54 + (seed % 5) * 0.025,
      };
    }
    const elder = kind !== "lads";
    return { ...a, sex: "m", age: elder ? "elder" : "adult", beard: a.headwear === "turban" ? "full" : a.beard, height: 1.68 + (seed % 6) * 0.025 };
  }

  /** Start a circle at a spot; `fightIn` seconds until it boils over (Infinity: it stays friendly). */
  private spawn(x: number, z: number, village: boolean, fightIn: number): Circle | null {
    const roll = this.rng.next();
    const kind: Kind = village ? (roll < 0.4 ? "aunties" : roll < 0.75 ? "elders" : roll < 0.9 ? "uncles" : "lads")
      : roll < 0.55 ? "aunties" : roll < 0.8 ? "uncles" : roll < 0.9 ? "elders" : "lads";
    const n = kind === "elders" ? 2 : this.rng.int(2, kind === "aunties" ? 4 : 3);
    const ring = n === 2 ? 0.62 : 0.78;
    const a0 = this.rng.range(0, Math.PI * 2);
    const pts: Array<[number, number, number]> = [];
    for (let i = 0; i < n; i++) {
      const a = a0 + (i / n) * Math.PI * 2;
      const px = x + Math.sin(a) * ring, pz = z + Math.cos(a) * ring;
      if (!isOpenGround(px, pz)) return null;
      pts.push([px, pz, a + Math.PI]);
    }
    const members = pts.map(([px, pz, yaw], i) => {
      const look = this.look(kind, i, 12000 + this.n * 7 + i * 3);
      const name = look.sex === "f" ? (look.age === "elder" ? "Bebe ji" : "Aunty ji") : look.age === "elder" ? (village ? "Bapu ji" : "Uncle ji") : "Neighbour";
      return this.crowd.spawn({ id: `gossip${this.n++}`, name, role: "chatter", look, x: px, z: pz, yaw, lines: kind === "aunties" ? ["Aao ji, tusi vi suno!", "Sat Sri Akal puttar!"] : ["Kiddan puttar?", "Sab theek?"] });
    });
    const c: Circle = { kind, village, members, centre: new Vector3(x, 0, z), t: 0, nextLine: this.rng.range(0.5, 2), last: null, fightAt: fightIn, fought: false };
    this.circles.push(c);
    return c;
  }

  private remove(c: Circle): void {
    for (const r of c.members) if (this.crowd.residents.includes(r) && !r.brain) this.crowd.remove(r);
    this.circles.splice(this.circles.indexOf(c), 1);
  }

  /** Someone near the player in a colony or pind: a new circle where it will not pop up in plain sight. */
  private trySpawn(p: Vector3): void {
    const all = this.allSpots();
    const cand: Array<{ x: number; z: number; village: boolean; s: number }> = [];
    for (const s of all) {
      const d = Math.hypot(s.x - p.x, s.z - p.z);
      if (d < 12 || d > 48) continue;
      if (this.circles.some((c) => Math.hypot(c.centre.x - s.x, c.centre.z - s.z) < 16)) continue;
      const seen = this.inView(s.x, s.z);
      // Out of sight is best; in sight only when it is far enough to not be noticed appearing.
      if (seen && d < 32) continue;
      cand.push({ ...s, s: (seen ? 20 : 0) + Math.abs(d - 22) + this.rng.next() * 8 });
    }
    cand.sort((a, b) => a.s - b.s);
    for (const s of cand.slice(0, 5)) {
      // Off the walk line a little, onto the open ground by the gate.
      if (this.spawn(s.x, s.z, s.village, this.rng.next() < 0.4 ? this.rng.range(18, 40) : Infinity)) return;
    }
  }

  update(dt: number, p: Vector3): void {
    this.spawnT -= dt;
    if (this.spawnT <= 0) {
      this.spawnT = 3;
      if (this.circles.length < this.max) this.trySpawn(p);
    }
    for (const c of [...this.circles]) {
      c.members = c.members.filter((r) => this.crowd.residents.includes(r));
      const d = Math.hypot(c.centre.x - p.x, c.centre.z - p.z);
      if (!c.members.length || d > 110 || (d > 70 && !this.inView(c.centre.x, c.centre.z))) { this.remove(c); continue; }
      const free = c.members.filter((r) => !r.brain && r.pose === "stand");
      if (d > 45 || free.length < 2) continue;
      c.t += dt;
      // Boil over: the last two to speak fall out, the rest gasp and watch.
      if (!c.fought && c.t > c.fightAt && d < 35) {
        const a = c.last && free.includes(c.last) ? c.last : free[0]!;
        const b = free.find((r) => r !== a)!;
        if (this.quarrel(a, b)) {
          c.fought = true;
          this.crowd.say(b, this.rng.pick(ROW_START));
          const w = free.find((r) => r !== a && r !== b);
          if (w) setTimeout(() => { if (this.crowd.residents.includes(w)) { this.crowd.say(w, this.rng.pick(ROW_GASP)); w.anim.play("point", 1.5); } }, 1800);
          continue;
        }
        c.fightAt = c.t + 15;
      }
      if (c.fought) continue;
      c.nextLine -= dt;
      if (c.nextLine > 0) continue;
      c.nextLine = this.rng.range(2.6, 4.4);
      const who = this.rng.pick(free.filter((r) => r !== c.last).length ? free.filter((r) => r !== c.last) : free);
      const women = who.look.sex === "f";
      // After someone's news, a reply; otherwise fresh news.
      const reply = c.last && this.rng.next() < 0.45;
      const news = women ? AUNTY_LINES : c.village && this.rng.next() < 0.5 ? VILLAGE_LINES : UNCLE_LINES;
      this.crowd.say(who, this.rng.pick(reply ? (women ? AUNTY_REPLIES : UNCLE_REPLIES) : news));
      who.anim.play("talk", this.rng.range(2, 3));
      c.last = who;
      // Someone has a laugh at it.
      const other = free.find((r) => r !== who && r.anim.currentGesture === "none");
      if (other && this.rng.next() < 0.35) setTimeout(() => other.anim.play("laugh", 1.4), 900);
    }
  }

  /** Put a circle 8–14 m in front of the player now (T menu); it boils over soon if `fight`. */
  force(p: Vector3, fwd: Vector3, fight: boolean): Vector3 | null {
    for (let k = 0; k < 24; k++) {
      const d = 8 + (k % 4) * 2, a = ((k >> 2) - 2.5) * 0.35;
      const x = p.x + (fwd.x * Math.cos(a) - fwd.z * Math.sin(a)) * d, z = p.z + (fwd.z * Math.cos(a) + fwd.x * Math.sin(a)) * d;
      const c = this.spawn(x, z, zoneAt(x, z).kind === "village", fight ? 9 : Infinity);
      if (c) return c.centre;
    }
    return null;
  }

  /** Probe: the circles now. */
  state(): Array<{ kind: Kind; x: number; z: number; n: number; t: number; fightAt: number; fought: boolean; ids: string[] }> {
    return this.circles.map((c) => ({ kind: c.kind, x: Math.round(c.centre.x), z: Math.round(c.centre.z), n: c.members.length, t: Math.round(c.t), fightAt: c.fightAt, fought: c.fought, ids: c.members.map((r) => r.id) }));
  }
}
