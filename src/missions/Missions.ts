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
  persist(reason: string): void;
  roadGraph: NavGraph;
}

export interface Objective { title: string; detail: string; target: Vector3 | null; markerColor?: string }

export interface DeliveryDest { id: string; poi: keyof typeof POIS; who: string; whoName: string; order: string; thanks: string }

export const DESTINATIONS: DeliveryDest[] = [
  { id: "tailor", poi: "tailor", who: "masterji", whoName: "Masterji", order: "two aloo parathas with white butter", thanks: "Right on time — like a well-stitched hem. Shabaash!" },
  { id: "fruit", poi: "fruit", who: "pammi", whoName: "Pammi", order: "a sweet lassi and chole bhature", thanks: "Oho, still cold! The lassi, I mean. You're quick!" },
  { id: "cycle", poi: "cycleShop", who: "sohal", whoName: "Sohal", order: "rajma chawal, extra onions", thanks: "Fuel for a champion. One day we race, you and me!" },
  { id: "courtyard", poi: "courtyard", who: "mrsKaur", whoName: "Mrs. Kaur", order: "sarson da saag with makki di roti", thanks: "Just like my mother made. Well… almost. Jeonda reh!" },
  { id: "laneHouse", poi: "laneHouse", who: "gill", whoName: "Gill uncle", order: "kadhi chawal — less salt, he insists", thanks: "Less salt? Hmm. Fine. Tell Bhola it was good." },
  { id: "chemist", poi: "chemist", who: "chemist", whoName: "Dr. Sehgal", order: "dal makhani and two butter rotis", thanks: "Prescription filled! Thank you, thank you." },
  { id: "workshop", poi: "workshop", who: "gurnam", whoName: "Gurnam", order: "a second tiffin for the night shift", thanks: "You again? My favourite courier. Keep the change!" },
];

export interface ActiveJob {
  dest: DeliveryDest;
  elapsed: number;
  par: number;
  limit: number;
  condition: number;
  routeLen: number;
}

export const INTRO = { MEET: 0, PICKUP: 1, RIDE: 2, DELIVER: 3, DONE: 999 } as const;

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
      case INTRO.PICKUP: return { title: "Collect the tiffin", detail: "Pick up the steel tiffin from the kitchen pass at the back of the dhaba.", target: P("dhabaPickup") };
      case INTRO.RIDE: return { title: "Find a ride", detail: "Hop on the mint scooter by the dhaba — or the green auto-rickshaw just south of it.", target: new Vector3(-3.0, 0, -31.5) };
      case INTRO.DELIVER: return { title: "Deliver to Gurnam Motor Works", detail: "Follow the gold route north. Big bumps and crashes spill the dal!", target: P("workshop") };
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
        await h.dialogue("bhola", "Oye, <b>Sat Sri Akal</b> ji! A new face in Ranggarh — and just in time!", [{ label: "Sat Sri Akal, Bhola ji. What's the rush?", value: "n" }]);
        h.residentGesture("bhola", "talk");
        await h.dialogue("bhola", "My delivery boy Kaka ran off to his cousin's wedding in Ludhiana. And Gurnam at the workshop hasn't eaten since sunrise. A hungry mechanic is bad for the whole bazaar!", [{ label: "How can I help?", value: "n" }]);
        await h.dialogue("bhola", "Grab the tiffin from the kitchen pass — steel one, red knot. Then take my nephew's scooter outside. Or the auto, if you like an audience!", [{ label: "On it!", value: "n" }]);
        this.setStage(INTRO.PICKUP);
        return;
      }
      if (this.stage < INTRO.DONE) {
        const msg = this.stage === INTRO.PICKUP ? "The tiffin is on the kitchen pass, at the back. Go, go!" : "Gurnam is waiting! The workshop is up the bazaar, on the right.";
        await h.dialogue("bhola", msg, [{ label: "Okay!", value: "n" }]);
        return;
      }
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
    const pool = DESTINATIONS.filter((d) => d.id !== this.lastDest);
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
    this.job = { dest, elapsed: 0, par, limit: par * 2.2, condition: 100, routeLen: r.len };
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
    if (this.stage === INTRO.RIDE) this.setStage(INTRO.DELIVER);
  }

  /** Is the player at a delivery point they can hand over at? */
  deliveryHere(): { label: string; run: () => Promise<void> } | null {
    const pos = this.host.playerPos();
    const vs = this.host.vehicleSpeed();
    const slow = vs === null || vs < 2.5;
    if (this.stage === INTRO.DELIVER) {
      const p = POIS.workshop!;
      if (Math.hypot(pos.x - p.x, pos.z - p.z) < 3.6 && slow) return { label: "Hand the tiffin to Gurnam", run: () => this.finishIntro() };
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
      h.residentGesture("gurnam", "cheer");
      const spill = this.introCondition < 60 ? " Half of it is on your shirt, but I'll take it." : "";
      await h.dialogue("gurnam", `Finally! Bhola's dal makhani — the only fuel I trust.${spill}`, [{ label: "Enjoy!", value: "n" }]);
      h.reward(200, 10);
      h.sting("big");
      await h.dialogue("gurnam", "Here's ₹200 for the trouble. And a secret: I do paint jobs and brake work. Come back with some money and I'll make your ride sing.", [{ label: "Deal!", value: "n" }]);
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
      const pay = payFor(j.routeLen, time, j.par, j.condition);
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
    const dmg = Math.max(0, dv - 1.6) * 9;
    if (dmg <= 0) return;
    if (this.job) {
      this.job.condition = Math.max(0, this.job.condition - dmg);
      if (dmg > 6) this.host.toast(`Splash! Food condition ${Math.round(this.job.condition)}%`, "warn", 1800);
    } else if (this.stage === INTRO.DELIVER) {
      this.introCondition = Math.max(0, this.introCondition - dmg);
      if (dmg > 6) this.host.toast("Careful — the dal is sloshing!", "warn", 1800);
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
