import { Vector3, type Scene } from "../babylon";
import type { Appearance } from "../characters/HumanBuilder";
import { randomAppearance } from "../characters/appearances";
import type { KitLook } from "../characters/KitHuman";
import type { Crowd, Resident, ResidentDef } from "../crowds/Crowd";
import { HOME, perch, type Shot, type Spot } from "../world/home";
import { BODIES } from "../kit/rig";
import { openHouseAt } from "../world/openHouses";
import { Rng } from "../render/textures";
import { CHANNEL_NAMES, HomeTv, type Channel } from "./HomeTv";

export interface HomeHost {
  scene: Scene;
  crowd: Crowd;
  playerPos(): Vector3;
  /** The hero's name (what the family calls him). */
  hero(): string;
  dialogue(who: string, text: string, options: Array<{ label: string; value: string }>): Promise<string>;
  toast(msg: string, kind?: "info" | "warn" | "money", ms?: number): void;
  /** Health back (all at once, or a bit per second while sitting). */
  heal(amount: number): void;
  reward(money: number, rep: number): void;
  /** Seat the player at a spot, or stand them up at a point. */
  sitPlayer(at: Spot): void;
  standPlayer(x: number, z: number, yaw: number): void;
  /** Hold the camera on a fixed shot, or hand it back (null). */
  holdCamera(shot: Shot | null): void;
  /** A home-cooked plate in hand, eaten over a few seconds; or a cup of chah. */
  eatMeal(): void;
  drinkChah(): void;
  /** What is in the bag. */
  bagHas(id: string): boolean;
  bagTake(id: string): void;
  routeTo(x: number, z: number, label: string): void;
  fade(on: boolean, text?: string): Promise<void>;
  /** The TV's sound, a bar at a time (call every frame while it is on). */
  tvSound(channel: Channel, pos: Vector3): void;
  hour(): number;
  setHour(h: number): void;
  /** The saved home record: the game day and what was done on which day. */
  data(): Record<string, number>;
  persist(): void;
}

type Who = "papa" | "mummy" | "bebe" | "simran";
interface Member { who: Who; def: ResidentDef; seat: () => Spot; sit: boolean; lines: string[] }

const LINES: Record<Who, string[]> = {
  papa: ["Kamm kiddan chal reha, puttar?", "Bullet di service karva laee? Chain dheeli si.", "Petrol phir vadh gaya, dhyaan naal chalayi.", "Paise sambhal ke rakhi, puttar."],
  mummy: ["Helmet paa ke jaayi, sun reha ae?", "Aaj tere layi kheer banayi ae!", "Sabzi wale nu paise de aayi si?", "Kapde dhote ne, chhatt te sukaun paa de."],
  bebe: ["Saade vele Bullet sirf thanedar kol hundi si!", "Viah kado karvauna ae? Kudi labh laini ae!", "Waheguru tainu chadhdi kala vich rakhe.", "Mere goday dukhde ne, dawai lai aayi."],
  simran: ["Veere, kal mainu college chhad aayi!", "Veere, ik selfie lai lao!", "Veere, Bullet te gedi laa ke aaiye?", "Mera phone recharge karva de na!"],
};

/** What Papa ji (and the rest) say about what is on. */
const TV_LINES: Record<Channel, Array<[Who, string]>> = {
  news: [["papa", "Eh dekh, phir mehngai! Kithe jaaye bandaa?"], ["papa", "Eh netaa saare ikko jehe ne."], ["bebe", "Meeh pauna ae? Changa ae, fasal layi."], ["papa", "Ludhiane navi sadak? Dekhange, kado bandi ae!"]],
  cricket: [["papa", "Chakk de! Chauka!"], ["papa", "Oye, eh ki shot si? Out ho jaana si!"], ["simran", "Papa, Kohli da century hou?"], ["papa", "Bas ik wicket hor, phir match saada!"]],
  songs: [["simran", "Eh mera favourite gaana ae!"], ["bebe", "Eh ki gaana? Saade vele Kuldeep Manak hunda si!"], ["simran", "Veere, bhangra paa!"], ["papa", "Awaaz ghatt kar, puttar."]],
  gurbani: [["bebe", "Waheguru, Waheguru..."], ["papa", "Sachkhand Sri Harmandir Sahib ton sidha. Sukoon milda."], ["bebe", "Ik vaari Amritsar mattha tekan chalange."], ["mummy", "Kirtan lagga ae, shor na paao."]],
};

/** Meal times: from, to (hours), and what it is called. */
const MEALS: Array<[number, number, string]> = [[7, 9.5, "breakfast"], [13, 14.5, "lunch"], [20, 21.5, "dinner"]];
export function mealAt(h: number): number {
  return MEALS.findIndex(([a, b]) => h >= a && h < b);
}

/**
 * The hero's family at home in Sant Nagar: Papa ji on the sofa (the news is
 * on in the evening), Mummy ji at the chulha, Bebe ji (his gran) and his
 * little sister Simran in the armchairs. They greet him by name when he walks
 * in and follow him with their eyes; at breakfast, lunch and dinner Mummy ji
 * calls him to the table; on the sofa the TV goes on and Papa ji has
 * opinions; Bebe ji blesses him (and slips him a note once a day); Simran
 * sends him to the kiryana for a cold drink; and at night he sleeps in his
 * own bed till the gurbani from the gurdwara wakes him. Coming home saves
 * the game. They are only in the world while you are near the house.
 */
export class Home {
  private family: Array<{ m: Member; r: Resident }> = [];
  private rng = new Rng(9090);
  /** What is going on: nothing special, watching TV on the sofa, a meal, asleep. */
  mode: "idle" | "sofa" | "meal" | "sleep" = "idle";
  private t = 0;
  private lineT = 0;
  private inside = false;
  private chahT = 0;
  private savedT = 0;
  private lastHour: number;
  /** Who is talking (looks at you rather than at the TV) and for how long. */
  private talker: Resident | null = null;
  private talkT = 0;
  private tv: HomeTv | null = null;
  /** On the sofa: seconds left on the family (then back to the TV). */
  private famShotT = 0;

  constructor(private host: HomeHost) {
    this.lastHour = host.hour();
  }

  private get day(): number {
    return this.host.data().day ?? 0;
  }

  private members(): Member[] {
    const H = HOME!;
    const look = (seed: number, o: Partial<Appearance>): Appearance => ({ ...randomAppearance(seed), ...o });
    const kit = (k: KitLook) => k;
    const def = (id: string, name: string, l: Appearance, k: KitLook): ResidentDef => ({ id, name, role: "seated", x: 0, z: 0, yaw: 0, indoor: true, look: l, kitLook: k });
    return [
      {
        who: "papa", sit: true, seat: () => H.sofa[0]!, lines: LINES.papa,
        def: def("home_papa", "Papa ji", look(31, { sex: "m", age: "adult", height: 1.76, top: "kurta", topColor: "#e8e2d2", bottom: "pajama", bottomColor: "#ece6d6", headwear: "turban", headColor: "#f2f2f2", beard: "full", hairColor: "#8a8680" }),
          kit({ archetype: "male", outfit: "kurta_pajama", colors: { skin: "#b57a4c", hair: "#8a8680", top: "#e8e2d2", bottom: "#ece6d6", head: "#f2f2f2" } })),
      },
      {
        who: "mummy", sit: false, seat: () => H.kitchen, lines: LINES.mummy,
        def: def("home_mummy", "Mummy ji", look(32, { sex: "f", age: "adult", height: 1.6, top: "kameez", topColor: "#8e4a5a", bottom: "salwar", bottomColor: "#e9dccb", dupatta: "#d8b56a", headwear: "none", hair: "bun", beard: "none" }),
          kit({ archetype: "female", outfit: "patiala_suit", colors: { skin: "#c68a5a", hair: "#2a1a10", top: "#8e4a5a", bottom: "#e9dccb", dupatta: "#d8b56a" } })),
      },
      {
        who: "bebe", sit: true, seat: () => H.armchairs[0]!, lines: LINES.bebe,
        def: def("home_bebe", "Bebe ji", look(33, { sex: "f", age: "elder", height: 1.52, top: "kameez", topColor: "#efe9dc", bottom: "salwar", bottomColor: "#efe9dc", dupatta: "#ffffff", headwear: "none", hair: "bun", hairColor: "#e9e6df", beard: "none" }),
          kit({ archetype: "aunty", outfit: "village_f", colors: { top: "#efe9dc", bottom: "#efe9dc", dupatta: "#ffffff" } })),
      },
      {
        who: "simran", sit: true, seat: () => H.armchairs[1]!, lines: LINES.simran,
        def: def("home_simran", "Simran", look(34, { sex: "f", age: "child", height: 1.42, top: "kameez", topColor: "#5e8fb8", bottom: "salwar", bottomColor: "#f2ede4", headwear: "none", hair: "braid", beard: "none" }),
          kit({ archetype: "girl", outfit: "college_f", colors: { top: "#5e8fb8", hair: "#1b120c" } })),
      },
    ];
  }

  /** Where someone's eyes go: whoever is talking, the TV while it is on, or you while you are in the house. */
  private lookFor(r: Resident): Vector3 | null {
    const p = this.host.playerPos();
    if (this.talker && this.talker !== r && this.talkT > 0) return this.talker.pos.clone();
    if (this.mode === "sofa" && this.tv?.on) return this.talker === r && this.talkT > 0 ? p.clone() : new Vector3(HOME!.tv.x, 1.1, HOME!.tv.z);
    if (this.inside && Math.hypot(p.x - r.pos.x, p.z - r.pos.z) < 9) return p.clone();
    return null;
  }

  /** Put someone at a spot: seated (sofa, chair) or standing (the chulha). */
  private placeAt(r: Resident, seat: Spot, sit: boolean): void {
    const b = r.kitLook ? BODIES[r.kitLook.archetype] : null;
    const s = sit && b ? perch(seat, 0.43 * b.legK * b.s) : seat;
    r.role = sit ? "seated" : "keeper";
    r.pose = sit ? "sit" : "stand";
    r.y = sit ? s.y : undefined;
    r.yaw = s.yaw;
    r.facing = s.yaw;
    this.host.crowd.place(r, s.x, s.z);
    r.home.set(s.x, r.pos.y, s.z);
    // Stay put, keep facing the seat's way (Mummy ji turns round to you), and look at what matters.
    r.brain = (rr, dt) => {
      rr.vel.setAll(0);
      const t = this.lookFor(rr);
      rr.lookTarget = t;
      const want = !sit && t && this.inside ? Math.atan2(t.x - rr.pos.x, t.z - rr.pos.z) : s.yaw;
      rr.facing += Math.atan2(Math.sin(want - rr.facing), Math.cos(want - rr.facing)) * (1 - Math.exp(-dt * 4));
    };
  }

  private spawn(): void {
    for (const m of this.members()) {
      const s = m.seat();
      const r = this.host.crowd.spawn({ ...m.def, role: m.sit ? "seated" : "keeper", x: s.x, z: s.z, y: m.sit ? s.y : undefined, yaw: s.yaw });
      this.placeAt(r, s, m.sit);
      this.family.push({ m, r });
    }
    this.tv ??= new HomeTv(this.host.scene, HOME!.tv);
  }

  private despawn(): void {
    for (const f of this.family) if (this.host.crowd.residents.includes(f.r)) this.host.crowd.remove(f.r);
    this.family = [];
    this.mode = "idle";
    this.tv?.set(false);
  }

  private get(who: Who): Resident | undefined {
    return this.family.find((f) => f.m.who === who)?.r;
  }

  /** Someone says something (and gets everyone's eyes for a moment). */
  private say(who: Who, line: string, gesture: "talk" | "laugh" | "greet" | "wave" | "cheer" | "point" = "talk", delay = 0): void {
    const go = () => {
      const r = this.get(who);
      if (!r || !this.host.crowd.residents.includes(r)) return;
      this.host.crowd.say(r, line);
      r.anim.play(gesture, 2.2);
      this.talker = r;
      this.talkT = 2.4;
    };
    if (delay > 0) setTimeout(go, delay); else go();
  }

  /** Back to where everyone usually is. */
  private settle(): void {
    for (const f of this.family) this.placeAt(f.r, f.m.seat(), f.m.sit);
  }

  update(dt: number): void {
    if (!HOME) return;
    const h = this.host.hour(), data = this.host.data();
    // A new day when the clock goes round midnight.
    if (h < this.lastHour - 12) data.day = (data.day ?? 0) + 1;
    this.lastHour = h;
    const p = this.host.playerPos();
    const d = Math.hypot(p.x - HOME.house.host.x, p.z - HOME.house.host.z);
    if (!this.family.length && d < 60) this.spawn();
    else if (this.family.length && d > 95 && this.mode === "idle") this.despawn();
    if (!this.family.length) return;
    this.chahT = Math.max(0, this.chahT - dt);
    this.savedT = Math.max(0, this.savedT - dt);
    this.talkT -= dt;
    this.tv?.update(dt);
    if (this.tv?.on) this.host.tvSound(this.tv.channel, new Vector3(HOME.tv.x, HOME.tv.y, HOME.tv.z));
    // Papa ji has the evening news on; and on the sofa it is always on.
    this.tv?.set(this.mode === "sofa" || (this.mode === "idle" && h >= 19 && h < 22));
    const inside = openHouseAt(p.x, p.z)?.id === HOME.house.id;
    if (inside && !this.inside && this.mode === "idle") this.welcome();
    this.inside = inside;
    // Food's ready: Mummy ji calls you in (once a meal), if you are home or near it.
    const meal = mealAt(h);
    if (meal >= 0 && this.mode === "idle" && d < 35 && data[`meal${meal}`] !== this.day && data[`call${meal}`] !== this.day) {
      data[`call${meal}`] = this.day;
      const name = this.host.hero();
      this.say("mummy", meal === 0 ? `${name}! Nashta tayyar ae, aaja puttar!` : meal === 1 ? `${name}! Roti kha lai, aaja!` : `${name}! Raat di roti tayyar ae, sab aa jao!`, "wave");
      this.host.toast(`🍽️ Mummy ji is calling you for ${MEALS[meal]![2]}: come to the dining table at home.`, "info", 5000);
    }
    if (this.mode === "idle" || this.mode === "sleep") return;
    this.t += dt;
    this.lineT -= dt;
    if (this.mode === "sofa") {
      this.host.heal(6 * dt);
      if (this.lineT <= 0 && this.tv) {
        this.lineT = this.rng.range(4.5, 7);
        const [who, line] = this.rng.next() < 0.75 ? this.rng.pick(TV_LINES[this.tv.channel]) : (() => { const f = this.rng.pick(this.family); return [f.m.who, this.rng.pick(f.m.lines)] as [Who, string]; })();
        this.say(who, line, this.rng.next() < 0.3 ? "laugh" : "talk");
        // Cut to the family while someone talks, then back to the screen.
        if (this.famShotT <= 0) this.host.holdCamera(HOME.sofaShot);
        this.famShotT = 3.2;
      }
      if (this.famShotT > 0) { this.famShotT -= dt; if (this.famShotT <= 0) this.host.holdCamera(HOME.tvShot); }
    } else if (this.mode === "meal") {
      if (this.lineT <= 0) {
        this.lineT = this.rng.range(3, 4.5);
        if (this.rng.next() < 0.35) this.say("mummy", this.rng.pick(["Hor roti lai, garam ae!", "Daal vich makhan paavaan?", "Achaar vi lai, nimbu da ae.", "Kheer baad vich, pehlan roti!"]));
        else this.say(this.rng.pick(["papa", "bebe", "simran"] as const), this.rng.pick(["Wah, Mummy ji, kamaal!", "Sarson da saag? Wah ji wah!", "Ik roti hor, bas aakhri!", "Pet bhar gaya, par dil nahi bhareya!"]));
      }
      // Everyone at the table keeps eating.
      for (const f of this.family) if (f.r.pose === "sit" && f.r.anim.currentGesture === "none") f.r.anim.play("eat", 3.6);
      if (this.t > 12) this.endMeal();
    }
  }

  /** Walking in: everyone greets you by name, one after another, and the game is saved. */
  private welcome(): void {
    const name = this.host.hero(), h = this.host.hour();
    const late = h >= 22 || h < 5;
    this.say("mummy", late ? `Aa gaya ${name}? Inni raat! Roti garam kar dyan?` : `Aa gaya mera ${name}! Haath dho lai.`, "greet");
    this.say("papa", late ? "Kitthe reh gaya si? Phone taan chukk liya kar." : `Aa ${name} puttar, kiddan?`, "wave", 1400);
    this.say("bebe", `Jeonda reh, ${name}!`, "greet", 2800);
    this.say("simran", "Veere aa gaya! Mere layi ki leyaaya?", "wave", 4200);
    if (this.savedT <= 0) {
      this.savedT = 90;
      this.host.persist();
      this.host.toast("🏠 Ghar aa gaye — game saved.", "info", 2500);
    }
  }

  interactions(): Array<{ id: string; pos: Vector3; radius: number; label: string; run: () => void | Promise<void> }> {
    const out: Array<{ id: string; pos: Vector3; radius: number; label: string; run: () => void | Promise<void> }> = [];
    if (!HOME || !this.family.length) return out;
    const p = this.host.playerPos();
    if (this.mode === "sofa") {
      out.push({ id: "home_tv", pos: p, radius: 99, label: "TV: change channel or get up", run: () => this.sofaMenu() });
      return out;
    }
    if (this.mode !== "idle") return out;
    const H = HOME, data = this.host.data(), day = this.day, h = this.host.hour();
    const at = (r: Resident | undefined) => (r ? new Vector3(r.pos.x, 0, r.pos.z) : null);
    out.push({ id: "home_sofa", pos: new Vector3(H.sofaFront.x, 0, H.sofaFront.z), radius: 1.5, label: "Sit and watch TV with Papa ji", run: () => this.startSofa() });
    const meal = mealAt(h);
    if (meal >= 0 && data[`meal${meal}`] !== day) out.push({ id: "home_meal", pos: new Vector3(H.tableSide.x, 0, H.tableSide.z), radius: 1.8, label: `Eat ${MEALS[meal]![2]} with the family`, run: () => this.startMeal(meal) });
    else if (this.chahT <= 0) out.push({ id: "home_chah", pos: new Vector3(H.tableSide.x, 0, H.tableSide.z), radius: 1.8, label: "Ask Mummy ji for chah", run: () => this.chah() });
    const bebe = at(this.get("bebe"));
    if (bebe) out.push({ id: "home_bebe", pos: bebe, radius: 1.5, label: data.bless !== day ? "Touch Bebe ji's feet (ashirwad)" : "Talk to Bebe ji", run: () => this.bebe() });
    const sim = at(this.get("simran"));
    if (sim) {
      const asked = data.errand === day && data.errandDone !== day;
      const label = asked && this.host.bagHas("colddrink") ? "Give Simran the cold drink" : asked ? "Talk to Simran (cold drink?)" : "Talk to Simran";
      out.push({ id: "home_simran", pos: sim, radius: 1.5, label, run: () => this.simran() });
    }
    const night = h >= 20 || h < 5;
    out.push({ id: "home_bed", pos: new Vector3(H.bedSide.x, 0, H.bedSide.z), radius: 1.5, label: night ? "Sleep till morning" : "Lie down and rest (2 hours)", run: () => this.sleep(night) });
    return out;
  }

  get busy(): boolean {
    return this.mode !== "idle";
  }

  private startSofa(): void {
    const H = HOME!;
    this.mode = "sofa";
    this.t = 0;
    this.lineT = 3;
    this.host.sitPlayer(H.sofa[2]!);
    this.host.holdCamera(H.sofaShot);
    this.famShotT = 3;
    this.tv?.set(true);
    this.say("papa", `Aa baith, ${this.host.hero()}. ${this.tv ? CHANNEL_NAMES[this.tv.channel] : "TV"} lagga ae.`);
  }

  private async sofaMenu(): Promise<void> {
    const tv = this.tv;
    const v = await this.host.dialogue("Papa ji", tv ? `On the TV: ${CHANNEL_NAMES[tv.channel]}.` : "Ki dekhna ae?", [
      { label: "Change the channel", value: "next" },
      { label: "Keep watching", value: "stay" },
      { label: "Get up", value: "up" },
    ]);
    if (v === "next" && tv) {
      const c = tv.next();
      this.lineT = 4;
      this.famShotT = 0;
      this.host.holdCamera(HOME!.tvShot);
      this.say(c === "cricket" || c === "news" ? "papa" : c === "songs" ? "simran" : "bebe", c === "cricket" ? "Haan! Match laa, score ki ae?" : c === "news" ? "Khabran laa, dekhiye ki hoeya." : c === "songs" ? "Yay, gaane! Awaaz uchi karo!" : "Waheguru... changa keeta, puttar.", "cheer");
    } else if (v === "up") this.endSofa();
  }

  private endSofa(): void {
    const H = HOME!;
    this.mode = "idle";
    this.host.holdCamera(null);
    this.host.standPlayer(H.sofaFront.x, H.sofaFront.z, H.sofa[2]!.yaw);
    this.host.persist();
  }

  /** Bebe ji's blessing; the first time each day, a note pressed into your hand. */
  private bebe(): void {
    const data = this.host.data(), name = this.host.hero();
    if (data.bless !== this.day) {
      data.bless = this.day;
      this.say("bebe", `Jeonda reh, ${name}! Waheguru mehar kare. Eh lai, kujh khaa lai.`, "greet");
      this.host.reward(50, 1);
      this.host.heal(30);
      this.host.persist();
    } else {
      this.say("bebe", this.rng.pick([...LINES.bebe, `Sada sukhi reh, ${name}.`]), "talk");
    }
  }

  /** Simran's errand: a cold drink from Lali's kiryana in the bazaar. */
  private async simran(): Promise<void> {
    const data = this.host.data(), day = this.day;
    if (data.errand === day && data.errandDone !== day) {
      if (this.host.bagHas("colddrink")) {
        this.host.bagTake("colddrink");
        data.errandDone = day;
        this.say("simran", "Thank you veere! Tu duniya da best veer ae!", "cheer");
        this.say("papa", "Shabaash puttar! Eh lai, tera inaam.", "talk", 1800);
        setTimeout(() => this.host.reward(40, 2), 1800);
        this.host.persist();
      } else {
        this.say("simran", "Veere, meri cold drink? Lali di dukaan, bazaar vich!", "point");
        this.routeKiryana();
      }
      return;
    }
    if (data.errandDone === day) { this.say("simran", this.rng.pick(LINES.simran), "laugh"); return; }
    const v = await this.host.dialogue("Simran", "Veere, ik kamm karoge? Bahut garmi ae... kiryane ton ik thandi cold drink lai aao na! Lali di dukaan, bazaar vich.", [
      { label: "Haan, hune lai ke aaunda haan", value: "yes" },
      { label: "Baad vich, Simran", value: "no" },
    ]);
    if (v !== "yes") { this.say("simran", "Hmph! Theek ae...", "talk"); return; }
    data.errand = day;
    this.say("simran", "Yay! Jaldi aayi veere!", "cheer");
    this.host.toast("Errand: buy a cold drink (₹20) at Lali General Store, the kiryana in the bazaar, and bring it to Simran.", "info", 6000);
    this.routeKiryana();
  }

  private routeKiryana(): void {
    const k = this.host.crowd.get("keeper_kiryana");
    if (k) this.host.routeTo(k.pos.x, k.pos.z, "Lali General Store (kiryana)");
  }

  private chah(): void {
    this.chahT = 120;
    this.say("mummy", this.rng.pick(["Lai, garam garam chah. Adrak paayi ae.", "Chah te naal biscuit vi lai.", "Bas ik cup! Raat nu neend nahi aundi."]), "talk");
    this.host.drinkChah();
  }

  /** Bed: sleep through the night (or rest two hours by day), wake to the gurbani from the gurdwara. */
  private async sleep(night: boolean): Promise<void> {
    const H = HOME!, data = this.host.data();
    this.mode = "sleep";
    this.host.sitPlayer(H.bed);
    if (night) this.say("mummy", `So ja ${this.host.hero()}, kal savere uthna ae.`);
    await this.host.fade(true, night ? "Sleeping..." : "Resting...");
    const h = this.host.hour();
    const wake = night ? 6.5 : (h + 2) % 24;
    if (wake < h) data.day = (data.day ?? 0) + 1;
    this.host.setHour(wake);
    this.lastHour = wake;
    this.host.heal(1000);
    this.settle();
    const rested = night && data.slept !== this.day;
    if (rested) { data.slept = this.day; this.host.reward(0, 1); }
    this.host.standPlayer(H.bedSide.x, H.bedSide.z, H.bed.yaw);
    this.mode = "idle";
    this.host.persist();
    await this.host.fade(false);
    this.host.toast(night ? "Good morning! 06:30, health full, game saved. Gurbani is playing at the gurdwara." : "Rested two hours: health full, game saved.", "money", 5000);
    if (night) this.say("mummy", "Uth ja! Chah bani payi ae, thandi ho jaugi!", "talk", 1200);
  }

  private async startMeal(meal: number): Promise<void> {
    const H = HOME!;
    const v = await this.host.dialogue("Mummy ji", meal === 0 ? "Nashta tayyar ae! Aloo de paranthe, makhan te dahi. Baith ja!" : meal === 1 ? "Roti tayyar ae! Daal, sabzi, garam phulke. Baith ja!" : "Raat di roti! Sarson da saag, makki di roti, kheer vi ae. Sab nu bulaundi aan.", [
      { label: "Haan ji, bahut bhukh lagi ae!", value: "eat" },
      { label: "Baad vich, Mummy ji", value: "later" },
    ]);
    if (v !== "eat") { this.say("mummy", "Changa, par bhukha na rahi!"); return; }
    this.host.data()[`meal${meal}`] = this.day;
    this.mode = "meal";
    this.t = 0;
    this.lineT = 2;
    // Papa ji, Bebe ji and Simran sit at the table; Mummy ji serves standing at its side.
    const seats = H.dining;
    (["papa", "bebe", "simran"] as const).forEach((who, i) => { const r = this.get(who); if (r) { this.placeAt(r, seats[i]!, true); r.anim.play("eat", 3.6); } });
    const mum = this.get("mummy");
    if (mum) {
      const s = seats[3]!;
      this.placeAt(mum, { x: H.tableSide.x, y: s.y, z: H.tableSide.z, yaw: Math.atan2((seats[0]!.x + seats[3]!.x) / 2 - H.tableSide.x, (seats[0]!.z + seats[3]!.z) / 2 - H.tableSide.z) }, false);
      mum.anim.play("talk", 2);
    }
    this.host.sitPlayer(seats[3]!);
    this.host.eatMeal();
  }

  private endMeal(): void {
    const H = HOME!;
    this.mode = "idle";
    this.settle();
    this.host.standPlayer(H.tableSide.x, H.tableSide.z, H.dining[3]!.yaw + Math.PI);
    this.host.persist();
  }

  /** Probe: who is home and what is going on. */
  state(): { mode: string; tv: string | null; family: Array<{ id: string; x: number; z: number; pose: string; look: string | null }> } {
    return {
      mode: this.mode, tv: this.tv?.on ? this.tv.channel : null,
      family: this.family.map((f) => ({ id: f.r.id, x: +f.r.pos.x.toFixed(2), z: +f.r.pos.z.toFixed(2), pose: f.r.pose, look: f.r.lookTarget ? `${f.r.lookTarget.x.toFixed(1)},${f.r.lookTarget.z.toFixed(1)}` : null })),
    };
  }
}
