import { Vector3 } from "../babylon";
import type { SaveData, Medal } from "../save/schema";
import { POIS } from "../world/layout";
import type { NavGraph } from "../world/nav";

/** What missions need from the game, kept narrow to avoid coupling. */
export interface MissionHost {
  save: SaveData;
  playerPos(): Vector3;
  /** Speed of the player's vehicle, or null when on foot. */
  vehicleSpeed(): number | null;
  vehicleType(): string | null;
  setCarrying(on: boolean): void;
  dialogue(who: string, text: string, options: Array<{ label: string; value: string }>): Promise<string>;
  results(title: string, medal: string | null, rows: Array<[string, string]>, buttons: Array<{ label: string; value: string }>): Promise<string>;
  toast(msg: string, kind?: "info" | "warn" | "money", ms?: number): void;
  reward(money: number, rep: number): void;
  sting(kind: "small" | "big" | "fail"): void;
  residentSay(id: string, text: string): void;
  residentGesture(id: string, g: "greet" | "talk" | "cheer" | "wave"): void;
  /** A recorded line spoken by a resident (by id), if the clip exists. */
  voice(clip: string, who: string): void;
  persist(reason: string): void;
  roadGraph: NavGraph;
  /** Multiplier on food-spill damage from perks (1 = none). */
  spillFactor(): number;
  /** Tip multiplier from perks. */
  tipMultiplier(): number;
  /** Extra warmth seconds bought for the next delivery (consumed). */
  takeWarmthBonus(): number;
}

export interface Objective { title: string; detail: string; target: Vector3 | null; markerColor?: string }

export interface DeliveryDest { id: string; poi: keyof typeof POIS; who: string; whoName: string; order: string; thanks: string; far?: boolean }

export const DESTINATIONS: DeliveryDest[] = [
  { id: "tailor", poi: "tailor", who: "masterji", whoName: "Masterji", order: "two aloo parathas with white butter", thanks: "Right on time — like a well-stitched hem. Shabaash!" },
  { id: "fruit", poi: "fruit", who: "pammi", whoName: "Pammi", order: "a sweet lassi and chole bhature", thanks: "Oho, still cold! The lassi, I mean. You're quick!" },
  { id: "cycle", poi: "cycleShop", who: "sohal", whoName: "Sohal", order: "rajma chawal, extra onions", thanks: "Fuel for a champion. One day we race, you and me!" },
  { id: "courtyard", poi: "courtyard", who: "mrsKaur", whoName: "Mrs. Kaur", order: "sarson da saag with makki di roti", thanks: "Just like my mother made. Well… almost. Jeonda reh!" },
  { id: "laneHouse", poi: "laneHouse", who: "gill", whoName: "Gill uncle", order: "kadhi chawal — less salt, he insists", thanks: "Less salt? Hmm. Fine. Tell Bhola it was good." },
  { id: "chemist", poi: "chemist", who: "chemist", whoName: "Dr. Sehgal", order: "dal makhani and two butter rotis", thanks: "Prescription filled! Thank you, thank you." },
  { id: "workshop", poi: "workshop", who: "gurnam", whoName: "Gurnam", order: "a second tiffin for the night shift", thanks: "You again? My favourite courier. Keep the change!" },
  // ---- Beyond the bazaar walls (longer rides, bigger tips).
  { id: "sherDhaba", poi: "sherDhaba", who: "sukhi", whoName: "Sukhi Bhaji", order: "Bhola's dal — he says the highway dhaba's is too watery", thanks: "Shh! Don't tell Sher Singh. This is the real stuff!", far: true },
  { id: "jarnail", poi: "jarnail", who: "jarnail", whoName: "Jarnail Singh", order: "lunch for the whole family at the dera", thanks: "Khet vich roti — rabb di nemat! Have some lassi before you go.", far: true },
  { id: "sarpanch", poi: "sarpanch", who: "sarpanch", whoName: "Sarpanch ji", order: "chole kulche for the panchayat meeting", thanks: "The meeting will now be 50% shorter. Thank you, beta!", far: true },
  { id: "busAdda", poi: "busAdda", who: "conductor", whoName: "Conductor Bittu", order: "parathas, before the Ludhiana bus leaves", thanks: "Just in time! Oye driver, start karo!", far: true },
  { id: "mandi", poi: "mandi", who: "munshi", whoName: "Munshi ji", order: "a thermos of chai and pakoras for the boli", thanks: "Perfect. The bidding goes better with pakoras.", far: true },
  { id: "thana", poi: "thana", who: "balwant", whoName: "Havaldar Balwant", order: "rajma chawal — and 'something for chai'", thanks: "Very good. Now… about the chai-paani… just joking! Ha!", far: true },
  { id: "cinema", poi: "cinema", who: "ticketwala", whoName: "Raju (ticket-wala)", order: "samosas for the interval rush", thanks: "Interval in two minutes — you saved the show!", far: true },
  { id: "petrol", poi: "petrol", who: "pumpwala", whoName: "the pump attendant", order: "aloo paratha with extra achaar", thanks: "Full tank for my stomach! Shukriya!", far: true },
];

export interface ActiveJob {
  dest: DeliveryDest;
  elapsed: number;
  par: number;
  limit: number;
  condition: number;
  routeLen: number;
}

/**
 * The first job ("Pehla Kamm"): Bhola's phone has broken, so he sends you on
 * his nephew's scooter to Chaura Bazaar in Ludhiana for a new one — a ride
 * down the G.T. Road past everything the district has going on — and back.
 * PICKUP is a legacy stage from the old tiffin intro; saves on it resume at RIDE.
 */
export const INTRO = { MEET: 0, PICKUP: 1, RIDE: 2, DELIVER: 3, RETURN: 4, DONE: 999 } as const;

export function medalFor(time: number, par: number, condition: number): Medal {
  if (time <= par * 0.85 && condition >= 85) return "gold";
  if (time <= par * 1.15 && condition >= 60) return "silver";
  return "bronze";
}

const MEDAL_RANK: Record<Medal, number> = { gold: 3, silver: 2, bronze: 1 };

export function payFor(routeLen: number, time: number, par: number, condition: number): number {
  const base = 60 + routeLen * 0.6;
  const care = 0.5 + condition / 200;
  const speed = time <= par ? 1.25 : 1;
  return Math.round((base * care * speed) / 5) * 5;
}

/**
 * Intro sequence and the repeatable dhaba delivery job. All state that must
 * survive a reload lives in SaveData (introStage, medals, bests, stats).
 */
export class Missions {
  job: ActiveJob | null = null;
  private lastDest = "";
  /** Food condition during the intro (no failure, but feedback). */
  introCondition = 100;
  busy = false;

  constructor(private host: MissionHost) {}

  get stage(): number {
    return this.host.save.introStage;
  }

  private setStage(s: number): void {
    this.host.save.introStage = s;
    this.host.persist("mission");
  }

  objective(): Objective {
    const P = (k: keyof typeof POIS) => new Vector3(POIS[k]!.x, 0, POIS[k]!.z);
    switch (this.stage) {
      case INTRO.MEET: return { title: "Meet Bhola at his dhaba", detail: "Walk into <b>Bhole Da Dhaba</b> and talk to Bhola at the cash counter (<kbd>E</kbd>).", target: P("dhabaCounter") };
      case INTRO.PICKUP:
      case INTRO.RIDE: return { title: "Take the scooter", detail: "Bhola's nephew's mint scooter is parked by the dhaba.", target: new Vector3(-3.0, 0, -31.5) };
      case INTRO.DELIVER: return { title: "Chaura Bazaar, Ludhiana", detail: "Buy Bhola a new mobile at <b>Hello Mobile Zone</b>. Out of the south gate, west along the G.T. Road, then into Ludhiana.", target: P("mobileShop") };
      case INTRO.RETURN: return { title: "Bring Bhola his new phone", detail: "Back to <b>Bhole Da Dhaba</b> in Ranggarh bazaar.", target: P("dhabaCounter") };
    }
    if (this.job) {
      const j = this.job;
      return { title: `Deliver to ${j.dest.whoName}`, detail: `${j.dest.order} → <b>${POIS[j.dest.poi]!.label}</b>`, target: P(j.dest.poi) };
    }
    if (this.host.save.flags.deliveryFailed) return { title: "Try again", detail: "Return to Bhola for another delivery.", target: P("dhabaCounter") };
    return { title: "Free roam", detail: "Take delivery jobs from <b>Bhola</b>, or spend your earnings at <b>Gurnam's workshop</b>.", target: null };
  }

  /** Route length in metres along the road graph between two points. */
  routeLength(a: Vector3, b: Vector3): { len: number; pts: Array<{ x: number; z: number }> } {
    const g = this.host.roadGraph;
    const p = g.path(g.nearest(a.x, a.z), g.nearest(b.x, b.z));
    const pts = [{ x: a.x, z: a.z }, ...p.map((i) => ({ x: g.nodes[i]!.x, z: g.nodes[i]!.z })), { x: b.x, z: b.z }];
    let len = 0;
    for (let i = 1; i < pts.length; i++) len += Math.hypot(pts[i]!.x - pts[i - 1]!.x, pts[i]!.z - pts[i - 1]!.z);
    return { len, pts };
  }

  // ------------------------------------------------------------------ Talking

  async talkBhola(): Promise<void> {
    const h = this.host;
    if (this.busy) return;
    this.busy = true;
    try {
      if (this.stage === INTRO.MEET) {
        h.residentGesture("bhola", "greet");
        h.voice("bhola_chaura", "bhola");
        await h.dialogue("bhola", "Oye! <b>Chaure Bazaar jaana ae, mobile lain layi!</b> Mera phone thalle digg ke tutt gaya — screen de sau tukde!", [{ label: "Chaura Bazaar? Ludhiana wala?", value: "n" }]);
        h.residentGesture("bhola", "talk");
        await h.dialogue("bhola", "Haan ji! <b>Hello Mobile Zone</b>, Chaura Bazaar. Paise main de ditte ne, tu bas lai aa. Mere bhatije da scooter bahar khada ae — G.T. Road te seedha, Ludhiana nu.", [{ label: "Raste ch ki dhyan rakhan?", value: "n" }]);
        await h.dialogue("bhola", "Truck, autoan, majhan, aunty-jhagde — sab milu! Bach ke jaayin. Te shaam ton pehlan mudd aayin, customers mainu phone te labhde ne!", [{ label: "Chalo, nikalda haan!", value: "n" }]);
        this.setStage(INTRO.RIDE);
        return;
      }
      if (this.stage < INTRO.DONE && this.stage !== INTRO.RETURN) {
        const msg = this.stage === INTRO.DELIVER ? "Ludhiana, Chaura Bazaar! Hello Mobile Zone. G.T. Road te pachham val. Ja, ja!" : "Scooter bahar khada ae. Chaabi lagi hoi ae — ja!";
        await h.dialogue("bhola", msg, [{ label: "Okay!", value: "n" }]);
        return;
      }
      if (this.stage === INTRO.RETURN) { await this.finishIntro(); return; }
      if (this.job) {
        const v = await h.dialogue("bhola", `Why are you still here? ${this.job.dest.whoName} is waiting!`, [{ label: "Going!", value: "go" }, { label: "I can't — cancel the order", value: "cancel" }]);
        if (v === "cancel") this.abandon();
        return;
      }
      const dest = this.pickDest();
      const done = h.save.stats.deliveries;
      const intro = done === 0 ? "Now you're one of us! " : done > 5 ? "My star courier! " : "";
      h.residentGesture("bhola", "talk");
      const v = await h.dialogue("bhola", `${intro}Order up: <b>${dest.order}</b> for <b>${dest.whoName}</b> at ${POIS[dest.poi]!.label}. Hot food waits for no one!`, [
        { label: "Take the job", value: "take" },
        { label: "Not now", value: "no" },
      ]);
      if (v === "take") this.startJob(dest);
    } finally {
      this.busy = false;
    }
  }

  private pickDest(): DeliveryDest {
    // The first couple of jobs stay inside the bazaar; after that, a mix with the countryside.
    const early = this.host.save.stats.deliveries < 2;
    const far = !early && Math.random() < 0.55;
    const pool = DESTINATIONS.filter((d) => d.id !== this.lastDest && !!d.far === far);
    // Prefer destinations without a gold medal so the player sees variety.
    const fresh = pool.filter((d) => this.host.save.medals[`delivery_${d.id}`] !== "gold");
    const from = fresh.length ? fresh : pool;
    return from[Math.floor(Math.random() * from.length)]!;
  }

  startJob(dest: DeliveryDest): void {
    const h = this.host;
    const from = new Vector3(POIS.dhabaCounter!.x, 0, POIS.dhabaCounter!.z);
    const to = new Vector3(POIS[dest.poi]!.x, 0, POIS[dest.poi]!.z);
    const r = this.routeLength(from, to);
    const par = Math.round(r.len / 6.5 + 25);
    const bonus = h.takeWarmthBonus();
    this.job = { dest, elapsed: 0, par, limit: par * 2.2 + bonus, condition: 100, routeLen: r.len };
    if (bonus) h.toast(`+${bonus} s warmth from your snack for the customer!`);
    this.lastDest = dest.id;
    h.save.flags.deliveryFailed = false;
    h.setCarrying(true);
    h.toast(`Tiffin in hand. Par time ${par}s — keep it hot and steady!`);
  }

  abandon(): void {
    if (!this.job) return;
    this.job = null;
    this.host.setCarrying(false);
    this.host.toast("Order cancelled. Bhola will find someone else.", "warn");
  }

  async pickupIntro(): Promise<void> {
    if (this.stage !== INTRO.PICKUP) return;
    this.host.setCarrying(true);
    this.host.residentSay("cook", "Garam garam! Don't tilt it!");
    this.host.toast("Tiffin collected. Ride carefully — bumps spill the dal.");
    this.introCondition = 100;
    this.setStage(INTRO.RIDE);
  }

  /** Called when the player mounts a vehicle. */
  onMount(): void {
    if (this.stage === INTRO.RIDE || this.stage === INTRO.PICKUP) {
      this.setStage(INTRO.DELIVER);
      this.host.toast("Chaura Bazaar, Ludhiana: follow the gold route — south gate, then west on the G.T. Road.", "info", 4500);
    }
  }

  /** At Hello Mobile Zone: buy the phone. */
  async buyMobile(): Promise<void> {
    if (this.stage !== INTRO.DELIVER || this.busy) return;
    this.busy = true;
    const h = this.host;
    try {
      h.residentGesture("mobileWala", "greet");
      h.voice("mobile_shop", "mobileWala");
      await h.dialogue("mobileWala", "Aao ji, aao! <b>Naya model, kamaal da camera!</b> Bhole da phone? Haan ji, ohna ne phone te dass ditta si. Eh lo — pack kar ditta, nal cover muft!", [{ label: "Shukriya ji!", value: "n" }]);
      await h.dialogue("mobileWala", "Te sun — sim vi pa ditti ae. Raste ch scooter dheere chalaayin, phone navan ae, tu purana nahi!", [{ label: "Hahaha, theek ae!", value: "n" }]);
      h.setCarrying(true);
      h.sting("small");
      this.setStage(INTRO.RETURN);
      h.toast("Got Bhola's new phone. Now back to the dhaba — don't drop it!", "money", 3500);
    } finally {
      this.busy = false;
    }
  }

  /** Is the player at a delivery point they can hand over at? */
  deliveryHere(): { label: string; run: () => Promise<void> } | null {
    const pos = this.host.playerPos();
    const vs = this.host.vehicleSpeed();
    const slow = vs === null || vs < 2.5;
    if (this.stage === INTRO.DELIVER) {
      const p = POIS.mobileShop!;
      if (Math.hypot(pos.x - p.x, pos.z - p.z) < 4.5 && slow) return { label: "Buy Bhola's new mobile", run: () => this.buyMobile() };
    }
    if (this.job) {
      const p = POIS[this.job.dest.poi]!;
      if (Math.hypot(pos.x - p.x, pos.z - p.z) < 3.4 && slow) return { label: `Deliver to ${this.job.dest.whoName}`, run: () => this.finishJob() };
    }
    return null;
  }

  private async finishIntro(): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    const h = this.host;
    try {
      h.setCarrying(false);
      h.residentGesture("bhola", "cheer");
      h.voice("bhola_thanks", "bhola");
      const scratched = this.introCondition < 60 ? " Box thoda pichkeya hoya ae… koi na, phone theek ae!" : "";
      await h.dialogue("bhola", `<b>Wah mere sher!</b> Hun main vi status paavanga!${scratched}`, [{ label: "Hahaha! Mubarakan!", value: "n" }]);
      h.reward(200, 10);
      h.sting("big");
      await h.dialogue("bhola", "Eh lai ₹200 tera inaam. Hun tu mera delivery wala — dhabe dian deliveries mere ton lai. Te Gurnam di workshop ch scooter di service vi karva layin, bazaar de upar, sajje paase.", [{ label: "Pakka!", value: "n" }]);
      this.setStage(INTRO.DONE);
      h.toast("Unlocked: Dhaba delivery jobs (talk to Bhola)");
      h.toast("Unlocked: Gurnam's upgrades & paint (talk to Gurnam)");
    } finally {
      this.busy = false;
    }
  }

  private async finishJob(): Promise<void> {
    const j = this.job;
    if (!j || this.busy) return;
    this.busy = true;
    const h = this.host;
    try {
      this.job = null;
      h.setCarrying(false);
      h.residentGesture(j.dest.who, "greet");
      const time = j.elapsed;
      const medal = medalFor(time, j.par, j.condition);
      const pay = Math.round((payFor(j.routeLen, time, j.par, j.condition) * h.tipMultiplier()) / 5) * 5;
      const rep = medal === "gold" ? 5 : medal === "silver" ? 4 : 3;
      const key = `delivery_${j.dest.id}`;
      const prevBest = h.save.bests[key];
      const isPb = prevBest === undefined || time < prevBest;
      if (isPb) h.save.bests[key] = Math.round(time * 10) / 10;
      const prevMedal = h.save.medals[key];
      if (!prevMedal || MEDAL_RANK[medal] > MEDAL_RANK[prevMedal]) h.save.medals[key] = medal;
      h.save.stats.deliveries++;
      h.reward(pay, rep);
      h.sting(medal === "gold" ? "big" : "small");
      await h.dialogue(j.dest.who, j.dest.thanks, [{ label: "Enjoy your meal!", value: "n" }]);
      const v = await h.results("Delivery complete!", medal, [
        ["Time", `${time.toFixed(1)} s (par ${j.par} s)`],
        ["Food condition", `${Math.round(j.condition)}%`],
        ["Personal best", isPb ? `${time.toFixed(1)} s — NEW!` : `${prevBest!.toFixed(1)} s`],
        ["Pay", `₹${pay}`],
        ["Reputation", `+${rep}`],
      ], [{ label: "Back to work", value: "ok" }]);
      void v;
      h.persist("job");
    } finally {
      this.busy = false;
    }
  }

  /** Food condition loss from a crash (Δv in m/s) or a hard landing. */
  onJolt(dv: number): void {
    const dmg = Math.max(0, dv - 1.6) * 9 * this.host.spillFactor();
    if (dmg <= 0) return;
    if (this.job) {
      this.job.condition = Math.max(0, this.job.condition - dmg);
      if (dmg > 6) this.host.toast(`Splash! Food condition ${Math.round(this.job.condition)}%`, "warn", 1800);
    } else if (this.stage === INTRO.RETURN) {
      this.introCondition = Math.max(0, this.introCondition - dmg);
      if (dmg > 6) this.host.toast("Careful — Bhola's new phone is in your pocket!", "warn", 1800);
    }
  }

  fixedUpdate(dt: number): void {
    const j = this.job;
    if (!j) return;
    j.elapsed += dt;
    if (j.condition <= 0) void this.fail("The food spilled everywhere!");
    else if (j.elapsed >= j.limit) void this.fail("The food went cold.");
  }

  private async fail(reason: string): Promise<void> {
    if (!this.job || this.busy) return;
    this.busy = true;
    const h = this.host;
    try {
      this.job = null;
      h.setCarrying(false);
      h.save.stats.failed++;
      h.save.flags.deliveryFailed = true;
      h.sting("fail");
      await h.results("Delivery failed", "fail", [["What happened", reason], ["No harm done", "Bhola always has another order"]], [{ label: "OK", value: "ok" }]);
      h.persist("job-fail");
    } finally {
      this.busy = false;
    }
  }
}
