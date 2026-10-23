import { Vector3 } from "../babylon";
import type { Appearance } from "../characters/HumanBuilder";
import { randomAppearance } from "../characters/appearances";
import type { KitLook } from "../characters/KitHuman";
import type { Crowd, Resident, ResidentDef } from "../crowds/Crowd";
import { HOME, type Spot } from "../world/home";
import { openHouseAt } from "../world/openHouses";
import { Rng } from "../render/textures";

export interface HomeHost {
  crowd: Crowd;
  playerPos(): Vector3;
  dialogue(who: string, text: string, options: Array<{ label: string; value: string }>): Promise<string>;
  toast(msg: string, kind?: "info" | "warn" | "money", ms?: number): void;
  /** Health back (per second while sitting, or all at once). */
  heal(amount: number): void;
  /** Seat the player at a spot, or stand them up at a point. */
  sitPlayer(at: Spot): void;
  standPlayer(x: number, z: number, yaw: number): void;
  /** A home-cooked plate in hand, eaten over a few seconds. */
  eatMeal(): void;
  hour(): number;
  setHour(h: number): void;
  persist(): void;
}

interface Member { def: ResidentDef; seatDay: () => Spot; lines: string[] }

const FAMILY_LINES = {
  papa: ["Kamm kiddan chal reha, puttar?", "Bullet di service karva laee? Chain dheeli si.", "Petrol phir vadh gaya, dhyaan naal chalayi.", "Akhbaar vich likhya, Ludhiane navi sadak banugi. Dekhange!", "Paise sambhal ke rakhi, puttar."],
  mummy: ["Roti kha ke jaayi, bhukha na jaayi!", "Aaj tere layi kheer banayi ae!", "Helmet paa ke jaayi, sun reha ae?", "Sabzi wale nu paise de aayi si?", "Kapde dhote ne, chhatt te sukaun paa de."],
  bebe: ["Jeonda reh mera puttar!", "Saade vele Bullet sirf thanedar kol hundi si!", "Viah kado karvauna ae? Kudi labh laini ae!", "Waheguru tainu chadhdi kala vich rakhe.", "Mere goday dukhde ne, dawai lai aayi."],
  simran: ["Veere, kal mainu college chhad aayi!", "Mummy, veer ne phir meri chocolate kha layi!", "Veere, ik selfie lai lao!", "Veere, Bullet te gedi laa ke aaiye?", "Mera phone recharge karva de na!"],
};

/**
 * The hero's family at home in Sant Nagar: Papa ji on the sofa with the
 * paper, Mummy ji at the chulha, Bebe ji (his gran) and his little sister
 * Simran in the armchairs. Walk in and they greet you; sit with them on the
 * sofa and they chat (health comes back, and late at night you can sleep till
 * morning); at the dining table Mummy ji serves roti and everyone sits down to
 * eat together. They are only in the world while you are near the house.
 */
export class Home {
  private family: Array<{ m: Member; r: Resident }> = [];
  private rng = new Rng(9090);
  /** What is going on: nothing special, chatting on the sofa, a meal. */
  mode: "idle" | "sofa" | "meal" = "idle";
  private t = 0;
  private lineT = 0;
  private inside = false;
  private mealCool = 0;

  constructor(private host: HomeHost) {}

  private members(): Member[] {
    const H = HOME!;
    const look = (seed: number, o: Partial<Appearance>): Appearance => ({ ...randomAppearance(seed), ...o });
    const kit = (k: KitLook) => k;
    return [
      {
        def: {
          id: "home_papa", name: "Papa ji", role: "seated", x: 0, z: 0, yaw: 0,
          look: look(31, { sex: "m", age: "adult", height: 1.76, top: "kurta", topColor: "#e8e2d2", bottom: "pajama", bottomColor: "#ece6d6", headwear: "turban", headColor: "#f2f2f2", beard: "full", hairColor: "#8a8680" }),
          kitLook: kit({ archetype: "male", outfit: "kurta_pajama", colors: { skin: "#b57a4c", hair: "#8a8680", top: "#e8e2d2", bottom: "#ece6d6", head: "#f2f2f2" } }),
          lines: FAMILY_LINES.papa,
        },
        seatDay: () => H.sofa[0]!, lines: FAMILY_LINES.papa,
      },
      {
        def: {
          id: "home_mummy", name: "Mummy ji", role: "keeper", x: 0, z: 0, yaw: 0,
          look: look(32, { sex: "f", age: "adult", height: 1.6, top: "kameez", topColor: "#8e4a5a", bottom: "salwar", bottomColor: "#e9dccb", dupatta: "#d8b56a", headwear: "none", hair: "bun", beard: "none" }),
          kitLook: kit({ archetype: "female", outfit: "patiala_suit", colors: { skin: "#c68a5a", hair: "#2a1a10", top: "#8e4a5a", bottom: "#e9dccb", dupatta: "#d8b56a" } }),
          lines: FAMILY_LINES.mummy,
        },
        seatDay: () => H.kitchen, lines: FAMILY_LINES.mummy,
      },
      {
        def: {
          id: "home_bebe", name: "Bebe ji", role: "seated", x: 0, z: 0, yaw: 0,
          look: look(33, { sex: "f", age: "elder", height: 1.52, top: "kameez", topColor: "#efe9dc", bottom: "salwar", bottomColor: "#efe9dc", dupatta: "#ffffff", headwear: "none", hair: "bun", hairColor: "#e9e6df", beard: "none" }),
          kitLook: kit({ archetype: "aunty", outfit: "village_f", colors: { top: "#efe9dc", bottom: "#efe9dc", dupatta: "#ffffff" } }),
          lines: FAMILY_LINES.bebe,
        },
        seatDay: () => H.armchairs[0]!, lines: FAMILY_LINES.bebe,
      },
      {
        def: {
          id: "home_simran", name: "Simran", role: "seated", x: 0, z: 0, yaw: 0,
          look: look(34, { sex: "f", age: "child", height: 1.42, top: "kameez", topColor: "#5e8fb8", bottom: "salwar", bottomColor: "#f2ede4", headwear: "none", hair: "braid", beard: "none" }),
          kitLook: kit({ archetype: "girl", outfit: "college_f", colors: { top: "#5e8fb8", hair: "#1b120c" } }),
          lines: FAMILY_LINES.simran,
        },
        seatDay: () => H.armchairs[1]!, lines: FAMILY_LINES.simran,
      },
    ];
  }

  /** Put someone at a spot: seated (sofa, chair) or standing (the chulha). */
  private placeAt(r: Resident, s: Spot, sit: boolean): void {
    r.role = sit ? "seated" : "keeper";
    r.pose = sit ? "sit" : "stand";
    r.y = sit ? s.y : undefined;
    r.yaw = s.yaw;
    r.facing = s.yaw;
    r.brain = null;
    this.host.crowd.place(r, s.x, s.z);
    r.home.set(s.x, r.pos.y, s.z);
  }

  private spawn(): void {
    const H = HOME!;
    for (const m of this.members()) {
      const s = m.seatDay();
      const sit = m.def.role === "seated";
      const r = this.host.crowd.spawn({ ...m.def, indoor: true, x: s.x, z: s.z, y: sit ? s.y : undefined, yaw: s.yaw });
      this.placeAt(r, s, sit);
      this.family.push({ m, r });
    }
    void H;
  }

  private despawn(): void {
    for (const f of this.family) if (this.host.crowd.residents.includes(f.r)) this.host.crowd.remove(f.r);
    this.family = [];
    this.mode = "idle";
  }

  private get(id: string): Resident | undefined {
    return this.family.find((f) => f.m.def.id === id)?.r;
  }

  /** Back to where everyone usually is. */
  private settle(): void {
    for (const f of this.family) this.placeAt(f.r, f.m.seatDay(), f.m.def.role === "seated");
  }

  update(dt: number): void {
    if (!HOME) return;
    const p = this.host.playerPos();
    const d = Math.hypot(p.x - HOME.house.host.x, p.z - HOME.house.host.z);
    if (!this.family.length && d < 60) this.spawn();
    else if (this.family.length && d > 95 && this.mode === "idle") this.despawn();
    if (!this.family.length) return;
    this.mealCool = Math.max(0, this.mealCool - dt);
    // Walking in: Mummy ji (or whoever is nearest) greets you.
    const inside = openHouseAt(p.x, p.z)?.id === HOME.house.id;
    if (inside && !this.inside && this.mode === "idle") {
      const mum = this.get("home_mummy"), bebe = this.get("home_bebe");
      if (mum) { this.host.crowd.say(mum, this.host.hour() >= 20 || this.host.hour() < 5 ? "Aa gaya? Inni raat! Roti garam kar dyan?" : "Aa gaya mera puttar! Haath dho ke aa, roti tayyar ae."); mum.anim.play("greet", 1.6); mum.lookTarget = p.clone(); }
      if (bebe) setTimeout(() => { if (this.host.crowd.residents.includes(bebe)) { this.host.crowd.say(bebe, "Jeonda reh!"); bebe.anim.play("wave", 1.4); } }, 1500);
    }
    this.inside = inside;
    // Everyone looks your way while you are in the room with them.
    if (inside) for (const f of this.family) if (Math.hypot(f.r.pos.x - p.x, f.r.pos.z - p.z) < 6) f.r.lookTarget = p.clone();
    if (this.mode === "idle") return;
    this.t += dt;
    this.lineT -= dt;
    if (this.mode === "sofa") {
      this.host.heal(6 * dt);
      if (this.lineT <= 0) {
        this.lineT = this.rng.range(3.2, 5);
        const f = this.rng.pick(this.family);
        this.host.crowd.say(f.r, this.rng.pick(f.m.lines));
        f.r.anim.play(this.rng.next() < 0.7 ? "talk" : "laugh", 2.4);
        // Someone laughs along.
        const o = this.rng.pick(this.family);
        if (o !== f && this.rng.next() < 0.4) setTimeout(() => o.r.anim.play("laugh", 1.4), 1200);
      }
    } else if (this.mode === "meal") {
      if (this.lineT <= 0) {
        this.lineT = this.rng.range(3, 4.5);
        const mum = this.get("home_mummy");
        const pick = this.rng.next();
        const f = pick < 0.35 && mum ? { r: mum, line: this.rng.pick(["Hor roti lai, garam ae!", "Daal vich makhan paavaan?", "Achaar vi lai, nimbu da ae.", "Kheer baad vich, pehlan roti!"]) } : (() => { const g = this.rng.pick(this.family); return { r: g.r, line: this.rng.pick(["Wah, Mummy ji, kamaal!", "Sarson da saag? Wah ji wah!", "Ik roti hor, bas aakhri!", "Pet bhar gaya, par dil nahi bhareya!"]) }; })();
        this.host.crowd.say(f.r, f.line);
      }
      // Everyone at the table keeps eating.
      for (const f of this.family) if (f.r.pose === "sit" && f.r.anim.currentGesture === "none") f.r.anim.play("eat", 3.6);
      if (this.t > 12) this.endMeal();
    }
  }

  interactions(): Array<{ id: string; pos: Vector3; radius: number; label: string; run: () => void | Promise<void> }> {
    const out: Array<{ id: string; pos: Vector3; radius: number; label: string; run: () => void | Promise<void> }> = [];
    if (!HOME || !this.family.length) return out;
    const p = this.host.playerPos();
    if (this.mode === "sofa") {
      out.push({ id: "home_up", pos: p, radius: 99, label: "Get up", run: () => this.endSofa() });
      const h = this.host.hour();
      if (h >= 20 || h < 5) out.push({ id: "home_sleep", pos: p.add(new Vector3(0.01, 0, 0)), radius: 98, label: "Sleep till morning", run: () => this.sleep() });
      return out;
    }
    if (this.mode === "meal") return out;
    out.push({ id: "home_sofa", pos: new Vector3(HOME.sofaFront.x, 0, HOME.sofaFront.z), radius: 1.6, label: "Sit with the family", run: () => this.startSofa() });
    out.push({ id: "home_meal", pos: new Vector3(HOME.tableSide.x, 0, HOME.tableSide.z), radius: 1.8, label: this.mealCool > 0 ? "Sit at the table" : "Eat with the family", run: () => this.startMeal() });
    return out;
  }

  get busy(): boolean {
    return this.mode !== "idle";
  }

  private startSofa(): void {
    const H = HOME!;
    this.mode = "sofa";
    this.t = 0;
    this.lineT = 1;
    this.host.sitPlayer(H.sofa[2]!);
    const papa = this.get("home_papa");
    if (papa) { this.host.crowd.say(papa, "Aa baith, puttar. Kiddan?"); papa.anim.play("talk", 2); }
  }

  private endSofa(): void {
    const H = HOME!;
    this.mode = "idle";
    this.host.standPlayer(H.sofaFront.x, H.sofaFront.z, H.sofa[2]!.yaw);
    this.host.persist();
  }

  private async sleep(): Promise<void> {
    const H = HOME!;
    this.host.setHour(6.5);
    this.host.heal(1000);
    this.mode = "idle";
    this.host.standPlayer(H.sofaFront.x, H.sofaFront.z, H.sofa[2]!.yaw);
    this.host.toast("You sleep like a log. Good morning! Gurbani is playing at the gurdwara. (06:30, health full)", "money", 5000);
    const mum = this.get("home_mummy");
    if (mum) setTimeout(() => { if (this.host.crowd.residents.includes(mum)) { this.host.crowd.say(mum, "Uth ja! Chah bani payi ae, thandi ho jaugi!"); mum.anim.play("talk", 2); } }, 1200);
    this.host.persist();
  }

  private async startMeal(): Promise<void> {
    const H = HOME!;
    const mum = this.get("home_mummy");
    if (this.mealCool > 0) {
      // Just sitting down: Mummy ji still offers something.
      if (mum) this.host.crowd.say(mum, "Hune taan khaada si! Chal, kheer lai.");
    } else if (mum) {
      const v = await this.host.dialogue("Mummy ji", this.host.hour() >= 20 || this.host.hour() < 5 ? "Inni der? Chal, roti garam kar dindi aan. Baith ja." : "Roti tayyar ae! Daal makhani, sarson da saag, makki di roti. Baith ja, sab nu bulaundi aan.", [
        { label: "Haan ji, bahut bhukh lagi ae!", value: "eat" },
        { label: "Baad vich, Mummy ji", value: "later" },
      ]);
      if (v !== "eat") { this.host.crowd.say(mum, "Changa, par bhukha na rahi!"); return; }
    }
    this.mode = "meal";
    this.t = 0;
    this.lineT = 2;
    // Papa ji, Bebe ji and Simran sit at the table; Mummy ji serves standing at its side.
    const seats = H.dining;
    const order = ["home_papa", "home_bebe", "home_simran"];
    order.forEach((id, i) => { const r = this.get(id); if (r) { this.placeAt(r, seats[i]!, true); r.anim.play("eat", 3.6); } });
    if (mum) {
      const s = seats[3]!;
      // Beside the table, between the chairs, facing it.
      this.placeAt(mum, { x: H.tableSide.x, y: s.y, z: H.tableSide.z, yaw: Math.atan2((seats[0]!.x + seats[3]!.x) / 2 - H.tableSide.x, (seats[0]!.z + seats[3]!.z) / 2 - H.tableSide.z) }, false);
      mum.anim.play("talk", 2);
    }
    this.host.sitPlayer(seats[3]!);
    if (this.mealCool <= 0) this.host.eatMeal();
    this.mealCool = 240;
  }

  private endMeal(): void {
    const H = HOME!;
    this.mode = "idle";
    this.settle();
    this.host.standPlayer(H.tableSide.x, H.tableSide.z, H.dining[3]!.yaw + Math.PI);
    this.host.persist();
  }

  /** Probe: who is home and what is going on. */
  state(): { mode: string; family: Array<{ id: string; x: number; z: number; pose: string }> } {
    return { mode: this.mode, family: this.family.map((f) => ({ id: f.r.id, x: +f.r.pos.x.toFixed(2), z: +f.r.pos.z.toFixed(2), pose: f.r.pose })) };
  }
}
