import { Vector3 } from "../babylon";
import type { Crowd, Resident, ResidentDef } from "../crowds/Crowd";
import type { Combat } from "./Combat";
import type { Traffic, TrafficCar } from "../traffic/Traffic";
import { randomAppearance } from "../characters/appearances";
import { Rng } from "../render/textures";
import { site } from "../world/region";
import type { SaveData } from "../save/schema";

/**
 * "Ladai-jhagde": the everyday drama of a Punjabi street. Neighbours argue
 * over nothing and come to shoving unless someone steps in; lafangas loiter
 * at the chowk looking for trouble; a bumped driver climbs out to give you a
 * piece of his mind; and at the village akhada, Ustad Kartar runs a dangal.
 */

export interface JhagdeHost {
  crowd: Crowd;
  combat: Combat;
  traffic: Traffic;
  save: SaveData;
  playerFeet(): Vector3 | null;
  playerPos(): Vector3;
  playerDriving(): boolean;
  dialogue(who: string, text: string, options: Array<{ label: string; value: string }>): Promise<string>;
  toast(msg: string, kind?: "info" | "warn" | "money"): void;
  reward(money: number, rep: number): void;
  pay(amount: number): boolean;
  voice(name: string, pos: Vector3): void;
  sting(kind: "small" | "big" | "fail"): void;
  busy(): boolean;
  persist(reason: string): void;
}

export interface JhagdaInteraction { id: string; pos: Vector3; radius: number; label: string; short: string; run: () => void | Promise<void> }

const TOPICS: Array<[string, string, string, string]> = [
  ["Tu meri gali vich apni majh kyon bannhi?", "Majh nu ki pata gali kihdi ae!", "Pichhle saal vi eho kitta si!", "Te tu meri kukkad chura ke khaada si!"],
  ["Mera scooter kihne thokeya?", "Main taan othe hi nahi si!", "Sab nu pata ae tu ulta chalaunda!", "Te tu horn vajaa vajaa ke kann paa dinda!"],
  ["Viah da card mainu kyon nahi aaya?", "Card taan bhejeya si, daakiye nu puchh!", "Daakiya tera saala ae!", "Te teri bhua da munda?!"],
  ["Cricket vich tu out si!", "Umpire meri side si, out nahi!", "Umpire tera bhra si!", "Te ball vi teri si — ghar lai gaya!"],
  ["Mere khet da paani tu modeya!", "Khaal sarkaari ae, tera nahi!", "Raat nu ki karda si othe?", "Taare ginda si, tenu ki?"],
];
/**
 * Gali-mohalla quarrels between the aunties: the loudest, longest-running and
 * least consequential fights in Punjab. Kept to the sort of insult that gets
 * shouted over a wall — "chudail", "kanjari", "fuddu" — not the real thing.
 */
const AUNTY_TOPICS: Array<[string, string, string, string]> = [
  ["Tera kachra phir mere darwaaze aage!", "Hai chudail, mera kachra pehchan di ae?", "Pehchan di haan! Teri shakal wangu bedhanga ae!", "Zubaan sambhal, kanjari, nahin taan jhaadu chalega!"],
  ["Tere munde ne mera gamla toda!", "Mera munda? Tera kutta phooldaan khaanda ae!", "Kutta mera nahi, tera jeth da ae!", "Hai ni, eh taan poora fuddu ho gia hai!"],
  ["Paani di tanki tu phir khaali kar ditti!", "Main naha ke aayi, chori taan nahi kiti!", "Do ghante naha ke? Majh vi ghatt nahaundi ae!", "Majh kehndi ae tenu? Ruk ja hun!"],
  ["Meri bakri da doodh tu vech ditta!", "Bakri teri si? Mainu taan sarkaari lagdi si!", "Hai hai! Chori te seena-zori!", "Bas kar ni, teri zubaan kaddh dyangi!"],
  ["Tu meri nuuh nu kyon bhadkaunDi ae?", "Nuuh teri, akal meri — ki karan?", "Apne ghar di sambhal pehlan!", "Mera ghar swarg ae, tera akhada ae!"],
];
const CALM_LINES = ["Chalo, chhaddo — lassi meri taraf ton!", "Gal khatam, jhapphi pao!"];
const AUNTY_CALM = ["Changa ji, chhadd de — par agli vaari dekh laingi!", "Tere kehn te chup haan, hor kuchh nahi!"];
/** Neighbours who gather to watch (and film) a street fight. */
const TAMASHA = ["Oh ho ho!", "Video banaa, video!", "Chhadd de bhaji, chhadd de!", "Ajj taan maza aa gaya!", "Koi police nu bulao!"];
const LAFANGA_TAUNTS = ["Ki dekh reha ae?", "Oye hero, idhar aa!", "Saanu chai pila!", "Bada smart banda ae!", "Naya ae shehar vich?", "Eh taan fuddu ho gia hai!", "Shakal dekhi ae apni?"];
/**
 * The black Safari with the tinted glass. Its driver does not apologise, does
 * not pay, and has a cousin in the police. The player's favourite enemy.
 */
const SAFARI_LINES = [
  "Kanjar da put, hun paise nai dene tere!",
  "Gaddi dekhi ae meri? Safari ae, Safari!",
  "Thane vich mera jeeja baitha ae, ja ke shikayat kar!",
  "Chal nikal, nahin taan tenu ithe hi dabba denge!",
];
const SAFARI_SORRY = [
  "Hun samajh aaya? Chal, nikal.",
  "Changa kita jo maafi mang li, nahin taan…",
];

interface Quarrel {
  a: Resident; b: Resident; t: number; stage: "gather" | "argue" | "shove" | "done";
  line: number; topic: number; spot: Vector3;
  /** Two women arguing over the gali get their own (much ruder) script. */
  aunty: boolean;
  /** Neighbours who have come out to watch. */
  crowd: Resident[];
  cheerT: number;
  /** Spawned on purpose (the first ride's roadside show): removed afterwards. */
  staged?: boolean;
}
interface Gang { site: string; members: Resident[]; defeated: Set<Resident>; respawnT: number; tauntT: number }
interface RoadRage { car: TrafficCar; driver: Resident | null; t: number; safari: boolean }
interface Dangal { round: number; foe: Resident | null; t: number; ring: { x: number; z: number; r: number } }

export class Jhagde {
  private rng = new Rng(4545);
  private quarrel: Quarrel | null = null;
  private nextQuarrel = 22;
  private gangs: Gang[] = [];
  private rage: RoadRage | null = null;
  dangal: Dangal | null = null;
  private n = 0;
  ustad: Resident | null = null;

  constructor(private host: JhagdeHost) {}

  /** Spawn the standing cast (lafangas, Ustad). */
  init(): void {
    for (const id of ["ghantaGhar", "busAdda"]) this.gangs.push({ site: id, members: [], defeated: new Set(), respawnT: 0, tauntT: 0 });
    const s = site("akhada");
    this.ustad = this.host.crowd.spawn({
      id: "ustad", name: "Ustad Kartar Pehlwan", role: "keeper", contact: true, x: s.x1 - 6, z: (s.z0 + s.z1) / 2 + 4, yaw: -Math.PI / 2,
      look: { ...randomAppearance(7007), sex: "m", age: "elder", top: "vest", vest: "#f2efe6", topColor: "#f2efe6", bottom: "pajama", bottomColor: "#e8a33c", headwear: "patka", headColor: "#e8a33c", beard: "full", height: 1.8, build: 1.35 },
      lines: ["Kushti jism naal nahi, dimaag naal hundi ae!", "Roz dand-baithak, roz doodh!"], faction: "wrestler", tough: 2,
    });
  }

  // ------------------------------------------------------------------ Quarrels

  private startQuarrel(): void {
    const p = this.host.playerFeet();
    if (!p) return;
    const ok = (r: Resident) => !r.brain && !r.contact && r.faction !== "police" && r.faction !== "lafanga" && r.look.age === "adult" && (r.role === "walker" || r.role === "roamer" || r.role === "chatter") && r.pose === "stand";
    const cands = this.host.crowd.residents.filter((r) => ok(r) && Math.hypot(r.pos.x - p.x, r.pos.z - p.z) < 30 && Math.hypot(r.pos.x - p.x, r.pos.z - p.z) > 6);
    if (cands.length < 2) return;
    const a = this.rng.pick(cands);
    // Half the time, look for another woman nearby first: street-aunty
    // quarrels are the ones worth stopping to watch.
    const wantAunty = a.look.sex === "f" && this.rng.next() < 0.75;
    let b: Resident | null = null, bd = Infinity;
    for (const r of cands) {
      if (r === a) continue;
      if (wantAunty && r.look.sex !== "f") continue;
      const d = Vector3.Distance(r.pos, a.pos);
      if (d < bd) { bd = d; b = r; }
    }
    if (!b) for (const r of cands) { if (r === a) continue; const d = Vector3.Distance(r.pos, a.pos); if (d < bd) { bd = d; b = r; } }
    if (!b || bd > 25) return;
    // Two grown women on the same gali argue to a different (ruder) script.
    const aunty = a.look.sex === "f" && b.look.sex === "f";
    const table = aunty ? AUNTY_TOPICS : TOPICS;
    const q: Quarrel = {
      a, b, t: 0, stage: "gather", line: 0, topic: this.rng.int(0, table.length - 1),
      spot: Vector3.Lerp(a.pos, b.pos, 0.5), aunty, crowd: [], cheerT: 3,
    };
    this.quarrel = q;
    for (const r of [a, b]) {
      r.brain = (rr, dt) => this.quarrelBrain(rr, dt, q);
    }
  }

  private quarrelBrain(r: Resident, dt: number, q: Quarrel): void {
    const other = r === q.a ? q.b : q.a;
    const sideSign = r === q.a ? -1 : 1;
    const dx = other.pos.x - r.pos.x, dz = other.pos.z - r.pos.z, d = Math.hypot(dx, dz) || 1;
    if (q.stage === "gather") {
      // Walk to face each other, a little over an arm's length apart.
      const tx = q.spot.x + sideSign * 0.9, tz = q.spot.z;
      const ex = tx - r.pos.x, ez = tz - r.pos.z, e = Math.hypot(ex, ez);
      if (e > 0.3) { r.vel.set((ex / e) * 1.8, 0, (ez / e) * 1.8); return; }
    }
    r.vel.scaleInPlace(Math.exp(-dt * 8));
    r.facing = Math.atan2(dx, dz);
    r.lookTarget = other.pos.clone();
    if (q.stage === "argue" && r.anim.currentGesture === "none") r.anim.play(this.rng.next() < 0.7 ? "argue" : "point", this.rng.range(1.5, 2.5));
    void d;
  }

  private updateQuarrel(dt: number): void {
    const q = this.quarrel;
    if (!q) return;
    q.t += dt;
    const p = this.host.playerFeet();
    const gone = !this.host.crowd.residents.includes(q.a) || !this.host.crowd.residents.includes(q.b);
    if (gone || (p && Vector3.Distance(p, q.spot) > 90)) { this.endQuarrel(false); return; }
    if (q.stage === "gather" && (q.t > 6 || Vector3.Distance(q.a.pos, q.b.pos) < 2.2)) { q.stage = "argue"; q.t = 0; }
    if (q.stage === "argue" || q.stage === "shove") this.gatherTamasha(q, dt);
    if (q.stage === "argue") {
      const lines = (q.aunty ? AUNTY_TOPICS : TOPICS)[q.topic]!;
      const filler = q.aunty
        ? ["Hor bol ni!", "Teri taan zubaan hi lambi ae!", "Chup kar, chudail!", "Saari gali jaandi ae tenu!", "Fuddu ho gayi ae tu taan!"]
        : ["Tu jaanda nahi main kaun haan?", "Hor bol!", "Oye bas kar!", "Tere vargey bade dekhe!", "Tu taan poora fuddu ho gia hai!"];
      if (q.t > q.line * 2.4 + 0.5 && q.line < 14) {
        const who = q.line % 2 ? q.b : q.a;
        this.host.crowd.say(who, q.line < lines.length ? lines[q.line]! : this.rng.pick(filler));
        who.anim.play(this.rng.next() < 0.6 ? "argue" : "point", 2);
        if (q.line === 0) this.host.voice(q.aunty ? "aunty_fight_1" : "quarrel_kaun", who.pos);
        q.line++;
      }
      if (q.t > 15) {
        q.stage = "shove";
        q.t = 0;
        // Aunty jhagde go further than a shove: jhaadu, dupatta, hair.
        const moves = q.aunty ? (["slap", "slap", "shove", "punch"] as const) : (["shove", "shove", "slap"] as const);
        if (q.aunty) this.host.voice("aunty_fight_2", q.a.pos);
        for (const [x, y] of [[q.a, q.b], [q.b, q.a]] as const) {
          this.host.combat.engage(x, { side: "neutral", target: y, moves: [...moves], power: q.aunty ? 0.55 : 0.35, speed: q.aunty ? 2.6 : 2 });
        }
      }
    } else if (q.stage === "shove" && q.t > (q.aunty ? 16 : 9)) this.endQuarrel(false);
  }

  /**
   * A street fight in Punjab is never private: neighbours drift over, form a
   * ring and offer commentary nobody asked for. They are borrowed from the
   * ordinary crowd and handed straight back when it is over.
   */
  private gatherTamasha(q: Quarrel, dt: number): void {
    q.cheerT -= dt;
    if (q.cheerT > 0) return;
    q.cheerT = this.rng.range(2.5, 5);
    if (q.crowd.length < 5) {
      const near = this.host.crowd.residents.find((r) =>
        !r.brain && r !== q.a && r !== q.b && !q.crowd.includes(r) && !r.contact &&
        r.faction !== "police" && r.pose === "stand" &&
        Vector3.Distance(r.pos, q.spot) < 16);
      if (near) {
        q.crowd.push(near);
        // The first one over always asks, and never gets an answer.
        if (q.crowd.length === 1) { this.host.crowd.say(near, "Ki ho gaya ji? Ki ho gaya?"); this.host.voice("ki_ho_gaya", near.pos); }
        // Stand in a loose ring and face the action.
        const a = q.crowd.length * 1.35;
        const tx = q.spot.x + Math.cos(a) * 2.6, tz = q.spot.z + Math.sin(a) * 2.6;
        near.brain = (r, d) => {
          const dx = tx - r.pos.x, dz = tz - r.pos.z, e = Math.hypot(dx, dz);
          if (e > 0.4) r.vel.set((dx / e) * 1.7, 0, (dz / e) * 1.7);
          else r.vel.scaleInPlace(Math.exp(-d * 8));
          r.facing = Math.atan2(q.spot.x - r.pos.x, q.spot.z - r.pos.z);
          r.lookTarget = q.spot.clone();
        };
      }
    }
    if (q.crowd.length && this.rng.next() < 0.6) {
      const w = this.rng.pick(q.crowd);
      this.host.crowd.say(w, this.rng.pick(TAMASHA));
      w.anim.play(this.rng.next() < 0.5 ? "cheer" : "talk", 1.6);
    }
  }

  /**
   * Put on a roadside aunty-jhagda at a spot (used on the first ride to
   * Ludhiana so the player sees one on the way). Returns false if busy.
   */
  stageAunties(x: number, z: number): boolean {
    if (this.quarrel) this.endQuarrel(false);
    const mk = (i: number) => {
      const base = randomAppearance(8800 + i * 17 + this.n);
      return this.host.crowd.spawn({
        id: `aunty${this.n++}`, name: "Aunty", role: "chatter", x: x + (i ? 1.0 : -1.0), z, yaw: i ? -Math.PI / 2 : Math.PI / 2,
        look: { ...base, sex: "f", age: i ? "elder" : "adult", top: "kameez", topColor: i ? "#6a1b9a" : "#ef6c00", bottom: "salwar", bottomColor: "#f6efe0", dupatta: i ? "#fdd835" : "#e91e63", headwear: "none", beard: "none", hair: "bun", height: 1.58 },
      });
    };
    const a = mk(0), b = mk(1);
    const q: Quarrel = { a, b, t: 0, stage: "gather", line: 0, topic: this.rng.int(0, AUNTY_TOPICS.length - 1), spot: new Vector3(x, 0, z), aunty: true, crowd: [], cheerT: 3, staged: true };
    this.quarrel = q;
    for (const r of [a, b]) r.brain = (rr, dt) => this.quarrelBrain(rr, dt, q);
    return true;
  }

  private endQuarrel(calmed: boolean): void {
    const q = this.quarrel;
    if (!q) return;
    this.quarrel = null;
    if (q.staged) setTimeout(() => { for (const r of [q.a, q.b]) { if (this.host.crowd.residents.includes(r)) { this.host.combat.release(r); this.host.crowd.remove(r); } } }, 25000);
    this.nextQuarrel = this.rng.range(35, 75);
    for (const r of q.crowd) { r.brain = null; r.wait = 1; }
    q.crowd = [];
    for (const r of [q.a, q.b]) {
      if (this.host.combat.fights.has(r)) this.host.combat.release(r);
      if (r.brain && !this.host.combat.fights.has(r)) r.brain = null;
      r.path = [];
      r.wait = 2;
    }
    if (calmed) { q.a.anim.play("greet", 1.6); q.b.anim.play("greet", 1.6); }
  }

  private async breakUp(): Promise<void> {
    const q = this.quarrel;
    if (!q) return;
    const lines = (q.aunty ? AUNTY_TOPICS : TOPICS)[q.topic]!;
    const v = await this.host.dialogue(q.aunty ? "aunties" : "neighbours", `<i>Two neighbours are at it again:</i><br>"${lines[0]}" — "${lines[1]}"`, [
      { label: "Oye, chhaddo! Lassi meri taraf ton (₹40)", value: "lassi" },
      { label: "Gal ki ae? Sun lainde aan…", value: "listen" },
      { label: "Tusi dono hi galat ho!", value: "both" },
    ]);
    if (v === "lassi") {
      if (this.host.pay(40)) {
        this.host.crowd.say(q.a, q.aunty ? AUNTY_CALM[0]! : CALM_LINES[0]!);
        this.host.crowd.say(q.b, q.aunty ? AUNTY_CALM[1]! : "Changa, changa… jhapphi pao!");
        this.host.reward(0, 6);
        this.host.save.stats.calmed++;
        this.endQuarrel(true);
      } else {
        this.host.toast("No money for lassi — they laugh and keep arguing.", "warn");
      }
    } else if (v === "listen") {
      const ok = this.rng.next() < 0.6;
      await this.host.dialogue("neighbours", ok ? "After ten minutes of listening, both realise they are cousins. Hugs all round!" : "You listened. Now all three of you are arguing. Wah!", [{ label: ok ? "Shabaash!" : "Hai rabba…", value: "n" }]);
      if (ok) { this.host.reward(0, 4); this.host.save.stats.calmed++; this.endQuarrel(true); }
    } else {
      // Blaming both: they team up against you!
      this.host.crowd.say(q.a, "Sanu galat kaun keh reha?! Khad, tainu dasda haan!");
      this.host.voice("khad_dasda", q.a.pos);
      const qa = q.a, qb = q.b;
      this.quarrel = null;
      this.nextQuarrel = this.rng.range(40, 90);
      for (const r of [qa, qb]) { r.brain = null; this.host.combat.engage(r, { side: "foe", target: "player", power: 0.8 }); }
    }
    this.host.persist("jhagda");
  }

  // ------------------------------------------------------------------ Lafangas

  private spawnGang(g: Gang): void {
    const s = site(g.site);
    const cx = (s.x0 + s.x1) / 2, cz = (s.z0 + s.z1) / 2;
    g.members = [];
    g.defeated.clear();
    for (let i = 0; i < 3; i++) {
      const look = randomAppearance(6100 + this.n * 31 + i);
      const def: ResidentDef = {
        id: `lafanga${this.n++}`, name: "Lafanga", role: "chatter", faction: "lafanga", tough: 1.1,
        x: cx + (i - 1) * 1.6 + (g.site === "busAdda" ? 0 : 6), z: cz + (g.site === "busAdda" ? -20 : -8) + (i % 2) * 1.2, yaw: i * 2.1,
        look: { ...look, sex: "m", age: "adult", top: this.rng.pick(["tshirt", "shirt"] as const), topColor: this.rng.pick(["#d81b60", "#1e88e5", "#212121", "#ff6f00"]), bottom: "jeans", bottomColor: "#1a237e", headwear: this.rng.next() < 0.5 ? "cap" : "patka", headColor: this.rng.pick(["#d32f2f", "#212121", "#fbc02d"]), beard: this.rng.pick(["none", "stubble", "mustache"] as const) },
      };
      g.members.push(this.host.crowd.spawn(def));
    }
  }

  private updateGangs(dt: number): void {
    const p = this.host.playerFeet() ?? this.host.playerPos();
    for (const g of this.gangs) {
      const s = site(g.site);
      const d = Math.hypot((s.x0 + s.x1) / 2 - p.x, (s.z0 + s.z1) / 2 - p.z);
      if (!g.members.length) {
        g.respawnT -= dt;
        if (g.respawnT <= 0 && d < 160 && d > 60) this.spawnGang(g);
        continue;
      }
      // Count knock-outs; when all three have been put down, the gang is beaten.
      for (const m of g.members) if (m.pose === "down") g.defeated.add(m);
      if (g.defeated.size >= g.members.length) {
        const ms = g.members;
        g.members = [];
        g.respawnT = 360;
        this.host.reward(60, 12);
        this.host.save.stats.fightsWon++;
        this.host.sting("big");
        this.host.toast("Lafangas sorted out! They dropped ₹60 running away. Ranggarh da sher!", "money");
        for (const m of ms) this.host.combat.engage(m, { side: "neutral", target: null, cool: 999, leave: true });
        setTimeout(() => { for (const m of ms) { this.host.combat.release(m); this.host.crowd.remove(m); } }, 15000);
        continue;
      }
      if (d > 250) { for (const m of g.members) { this.host.combat.release(m); this.host.crowd.remove(m); } g.members = []; g.respawnT = 0; continue; }
      g.tauntT -= dt;
      const pf = this.host.playerFeet();
      if (pf && g.tauntT <= 0) {
        const near = g.members.find((m) => !this.host.combat.fights.has(m) && Math.hypot(m.pos.x - pf.x, m.pos.z - pf.z) < 8);
        if (near) {
          g.tauntT = 7;
          this.host.crowd.say(near, this.rng.pick(LAFANGA_TAUNTS));
          near.lookTarget = pf.clone();
          near.anim.play("point", 1.5);
          if (this.rng.next() < 0.4) this.host.voice("lafanga_chai", near.pos);
        }
      }
    }
  }

  private async talkGang(g: Gang): Promise<void> {
    const v = await this.host.dialogue("lafanga", "Ki dekh reha ae, hero? Naya ae shehar vich? Saanu <b>chai pila</b>, nahin taan… <i>(cracks knuckles)</i>", [
      { label: "Lo ji, chai meri taraf ton (₹30)", value: "pay" },
      { label: "Chalo, nikal lo ithon!", value: "fight" },
      { label: "Main taan bas langh reha si…", value: "leave" },
    ]);
    if (v === "pay") {
      if (this.host.pay(30)) { for (const m of g.members) this.host.crowd.say(m, "Changa banda ae! Ja, aish kar!"); g.tauntT = 60; }
      else { this.host.toast("Empty pockets! They don't like that.", "warn"); this.gangFight(g); }
    } else if (v === "fight") this.gangFight(g);
    else for (const m of g.members) this.host.crowd.say(m, this.rng.pick(["Darr gaya!", "Hahaha!", "Ja ja!"]));
  }

  private gangFight(g: Gang): void {
    const first = g.members[0];
    if (first) { this.host.crowd.say(first, "Teri bhen di! Mere naal panga?"); this.host.voice("panga_bhen", first.pos); }
    g.members.forEach((m, i) => this.host.combat.engage(m, { side: "foe", target: "player", cd: 0.4 + i * 0.6 }));
  }

  isGangMember(r: Resident): boolean {
    return this.gangs.some((g) => g.members.includes(r));
  }

  // ------------------------------------------------------------------ Road rage

  /** The player's vehicle hit a traffic vehicle hard enough to annoy its driver. */
  bumped(car: TrafficCar): void {
    if (this.rage || car.police || !car.driver) return;
    car.ai.hold = true;
    // A jeep is a Safari, and a Safari's driver is a different animal.
    const safari = car.v.spec.type === "jeep" || this.rng.next() < 0.2;
    this.rage = { car, driver: null, t: 0, safari };
  }

  private updateRage(dt: number): void {
    const R = this.rage;
    if (!R) return;
    R.t += dt;
    const c = R.car;
    if (!this.host.traffic.cars.includes(c)) { this.rage = null; return; }
    const p = this.host.playerPos();
    if (!R.driver && R.t > 1.2 && c.v.speed < 1) {
      // Out he comes.
      this.host.traffic.dropDriver(c);
      const at = c.v.toWorld(new Vector3(c.v.spec.halfWidth + 0.8, 0, 0));
      R.driver = this.host.crowd.spawn({ id: `driver${this.n++}`, name: "Angry driver", role: "keeper", x: at.x, z: at.z, yaw: 0, look: randomAppearance(8000 + this.n), tough: 1.1 });
      R.driver.brain = (r, ddt) => {
        const tp = this.host.playerPos();
        const dx = tp.x - r.pos.x, dz = tp.z - r.pos.z, d = Math.hypot(dx, dz) || 1;
        r.facing = Math.atan2(dx, dz);
        if (d > 2.6) r.vel.set((dx / d) * 2.6, 0, (dz / d) * 2.6);
        else { r.vel.scaleInPlace(Math.exp(-ddt * 8)); if (r.anim.currentGesture === "none") r.anim.play("argue", 2); }
      };
      this.host.crowd.say(R.driver, R.safari ? SAFARI_LINES[0]! : this.rng.pick(["Oye! Andha ae?!", "Meri gaddi da nuksaan kaun bharega?", "Licence kithon lya? Mele ton?", "Tu taan poora fuddu ho gia hai!"]));
      this.host.voice(R.safari ? "safari_kanjar" : "rage_andha", R.driver.pos);
    }
    if (R.driver) {
      const d = Vector3.Distance(R.driver.pos, p);
      if (R.t > 4 && R.t % 3 < dt) this.host.crowd.say(R.driver, this.rng.pick(R.safari ? SAFARI_LINES : ["Paise kad!", "Hun bol!", "Utar thalle!", "Tere bapu nu dassanga!", "Fuddu ho gia hai tu!"]));
      // You drove off (or 40 s passed): he grumbles back to his car.
      if (d > 35 || R.t > 40) this.endRage();
    }
  }

  private endRage(): void {
    const R = this.rage;
    if (!R) return;
    this.rage = null;
    if (R.driver) {
      this.host.combat.release(R.driver);
      this.host.crowd.remove(R.driver);
    }
    if (this.host.traffic.cars.includes(R.car)) {
      if (!R.car.driver) this.host.traffic.release(R.car, true);
      else R.car.ai.hold = false;
    }
  }

  private async sorry(): Promise<void> {
    const R = this.rage;
    if (!R?.driver) return;
    const v = R.safari
      ? await this.host.dialogue("safari", "<i>(The tinted window comes down. Gold chain, no seatbelt.)</i><br><b>Kanjar da put, hun paise nai dene tere!</b> Gaddi dekhi ae meri? Chal, maafi mang te nikal.", [
        { label: "Maafi ji, galti ho gayi", value: "pay" },
        { label: "Paise tu dena ae, meri gaddi thokki ae!", value: "fight" },
        { label: "Safari ae, jahaaz nahi — hatt!", value: "fight" },
      ])
      : await this.host.dialogue("driver", "Oye! Dekh ke nahi chala sakda? Hun <b>nuksaan</b> kaun bharega?", [
        { label: "Maaf karo ji, ₹50 rakh lo", value: "pay" },
        { label: "Tu hi galat si!", value: "fight" },
      ]);
    // The Safari-wala wants the apology, not the money.
    if (v === "pay" && R.safari) {
      this.host.crowd.say(R.driver, this.rng.pick(SAFARI_SORRY));
      this.host.toast("Maafi mang li. Izzat ka sawaal tha.", "info");
      const d0 = R.driver;
      setTimeout(() => { if (this.rage?.driver === d0) this.endRage(); }, 2500);
    } else if (v === "pay" && this.host.pay(50)) {
      this.host.crowd.say(R.driver, "Changa… agli vaari dhyaan naal!");
      this.host.reward(0, 2);
      const d = R.driver;
      setTimeout(() => { if (this.rage?.driver === d) this.endRage(); }, 2500);
    } else {
      this.host.crowd.say(R.driver, "Khad, tainu dasda haan!");
      this.host.voice("khad_dasda", R.driver.pos);
      R.driver.brain = null;
      this.host.combat.engage(R.driver, { side: "foe", target: "player" });
    }
  }

  // ------------------------------------------------------------------ Dangal at the akhada

  private async talkUstad(): Promise<void> {
    const wins = this.host.save.stats.dangalWins;
    const v = await this.host.dialogue("ustad", `Akhade vich swagat ae, pehlwan! ${wins ? `Tu ${wins} vaari jitt chukka ae — ` : ""}Teen kushtiyan, teen pehlwan. Jo ring ton bahar gaya, oh haareya. Entry <b>₹20</b>.`, [
      { label: "Dangal shuru karo! (₹20)", value: "go" },
      { label: "Phir kade, Ustad ji", value: "no" },
    ]);
    if (v !== "go") return;
    if (!this.host.pay(20)) { this.host.toast("Ustad ji wants ₹20 entry.", "warn"); return; }
    this.host.voice("ustad_swagat", this.ustad!.pos);
    const s = site("akhada");
    this.dangal = { round: 0, foe: null, t: 0, ring: { x: (s.x0 + s.x1) / 2, z: (s.z0 + s.z1) / 2, r: 7 } };
    this.host.toast("Step into the ring! Knock your opponent down — don't leave the ring.", "info");
    this.nextBout();
  }

  private nextBout(): void {
    const D = this.dangal!;
    const names = ["Pappu Pehlwan", "Sheru Shaukeen", "Tinku Tank"];
    const look = randomAppearance(9100 + D.round * 17);
    D.foe = this.host.crowd.spawn({
      id: `pehlwan${this.n++}`, name: names[D.round]!, role: "keeper", faction: "wrestler", tough: 0.9 + D.round * 0.5,
      x: D.ring.x + 3, z: D.ring.z, yaw: -Math.PI / 2,
      look: { ...look, sex: "m", age: "adult", top: "vest", vest: "#f5f5f5", topColor: "#f5f5f5", bottom: "pajama", bottomColor: ["#c62828", "#1565c0", "#2e7d32"][D.round]!, headwear: "none", hair: "short", height: 1.75 + D.round * 0.05, build: 1.2 + D.round * 0.12 },
    });
    D.t = 0;
    this.host.crowd.say(D.foe, ["Aaja chhote!", "Meri pakad toh bach ke!", "Tinku Tank naal panga?"][D.round]!);
    this.host.combat.engage(D.foe, { side: "foe", target: "player", ring: D.ring, power: 0.8 + D.round * 0.3, speed: 3, moves: ["punch", "punchL", "shove", "slap"] });
  }

  private updateDangal(dt: number): void {
    const D = this.dangal;
    if (!D?.foe) return;
    D.t += dt;
    const p = this.host.playerFeet();
    const out = !p || Math.hypot(p.x - D.ring.x, p.z - D.ring.z) > D.ring.r + 1.2;
    const foeOut = Math.hypot(D.foe.pos.x - D.ring.x, D.foe.pos.z - D.ring.z) > D.ring.r + 1.2;
    if (this.host.combat.playerDown || (out && D.t > 3)) { void this.endDangal(false); return; }
    if (D.foe.pose === "down" || foeOut) {
      const prize = [100, 200, 400][D.round]!;
      this.host.reward(prize, 5 + D.round * 5);
      this.host.sting(D.round === 2 ? "big" : "small");
      const f = D.foe;
      D.foe = null;
      setTimeout(() => { this.host.combat.release(f); this.host.crowd.remove(f); }, 6000);
      D.round++;
      if (D.round >= 3) { void this.endDangal(true); return; }
      this.host.toast(`Bout ${D.round} won! +₹${prize}. Next pehlwan coming…`, "money");
      setTimeout(() => { if (this.dangal) this.nextBout(); }, 4000);
    }
  }

  private async endDangal(won: boolean): Promise<void> {
    const D = this.dangal;
    if (!D) return;
    this.dangal = null;
    if (D.foe) { this.host.combat.engage(D.foe, { side: "neutral", target: null, cool: 999, leave: true }); const f = D.foe; setTimeout(() => { this.host.combat.release(f); this.host.crowd.remove(f); }, 8000); }
    if (won) {
      this.host.save.stats.dangalWins++;
      this.host.save.stats.fightsWon++;
      await this.host.dialogue("ustad", "Shabaash, sher! Teen-de-teen! Ajj ton tu Kotli da <b>Rustam</b> ae. Doodh pi, te kal phir aa!", [{ label: "Dhanvaad, Ustad ji!", value: "n" }]);
    } else {
      await this.host.dialogue("ustad", "Koi gal nahi, puttar. Haar ton hi pehlwan banda ae. Roz dand-baithak kar, phir aa!", [{ label: "Ji, Ustad ji", value: "n" }]);
    }
    this.host.persist("dangal");
  }

  // ------------------------------------------------------------------ Hooks for the game

  interactions(): JhagdaInteraction[] {
    const out: JhagdaInteraction[] = [];
    const q = this.quarrel;
    if (q && (q.stage === "argue" || q.stage === "shove")) out.push({ id: "jhagda", pos: Vector3.Lerp(q.a.pos, q.b.pos, 0.5), radius: 3.2, label: "Break up the jhagda (bich-bachaav)", short: "Calm", run: () => this.breakUp() });
    for (const g of this.gangs) {
      if (!g.members.length || g.members.some((m) => this.host.combat.fights.get(m)?.side === "foe")) continue;
      const m = g.members[0]!;
      out.push({ id: `gang_${g.site}`, pos: m.pos, radius: 2.4, label: "Talk to the lafangas", short: "Talk", run: () => this.talkGang(g) });
    }
    if (this.rage?.driver && this.host.combat.fights.get(this.rage.driver)?.side !== "foe") out.push({ id: "sorry", pos: this.rage.driver.pos, radius: 3, label: "Apologise to the driver", short: "Sorry", run: () => this.sorry() });
    if (this.ustad && !this.dangal) out.push({ id: "ustad", pos: this.ustad.pos, radius: 2.2, label: "Talk to Ustad Kartar (dangal)", short: "Dangal", run: () => this.talkUstad() });
    return out;
  }

  fixedUpdate(dt: number): void {
    if (this.host.busy()) return;
    this.nextQuarrel -= dt;
    if (!this.quarrel && this.nextQuarrel <= 0) { this.nextQuarrel = 12; this.startQuarrel(); }
    this.updateQuarrel(dt);
    this.updateGangs(dt);
    this.updateRage(dt);
    this.updateDangal(dt);
  }
}
