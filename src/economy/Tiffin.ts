import { Vector3 } from "../babylon";
import { POIS } from "../world/layout";
import type { District } from "./Prices";
import type { Ledger } from "./Ledger";

/**
 * Mummy ji's tiffin business. Every morning the neighbourhood's regulars have ordered their lunch: from ten
 * o'clock Mummy ji hands you the packed dabbas (you pay for the ingredients), and each customer wants theirs in
 * the lunch rush, between half past eleven and a quarter to two. On time earns the price and a tip, late earns
 * less, and a tiffin still in your hand at half past two has gone cold. The more a district knows you, the more
 * regulars it sends.
 */

export interface TiffinCustomer {
  id: string;
  poi: keyof typeof POIS;
  who: string;
  whoName: string;
  district: District;
  order: string;
  thanks: string;
}

export const TIFFIN_CUSTOMERS: TiffinCustomer[] = [
  { id: "tailor", poi: "tailor", who: "masterji", whoName: "Masterji", district: "ranggarh", order: "parathas with white butter", thanks: "Mummy ji de haath da swaad! Tell her the kurta is free next time." },
  { id: "fruit", poi: "fruit", who: "pammi", whoName: "Pammi", district: "ranggarh", order: "rajma chawal and lassi", thanks: "Oho, garam hai abhi! Mummy ji nu salaam." },
  { id: "cycle", poi: "cycleShop", who: "sohal", whoName: "Sohal", district: "ranggarh", order: "kadhi chawal", thanks: "Fuel for a champion. One day we race!" },
  { id: "chemist", poi: "chemist", who: "chemist", whoName: "Dr. Sehgal", district: "ranggarh", order: "dal, roti and a little sabzi", thanks: "Doctor ka parhez: Mummy ji da khana, roz!" },
  { id: "workshop", poi: "workshop", who: "gurnam", whoName: "Gurnam", district: "ranggarh", order: "two aloo parathas, extra achaar", thanks: "Best lunch on this road. Keep the change!" },
  { id: "courtyard", poi: "courtyard", who: "mrsKaur", whoName: "Mrs. Kaur", district: "ranggarh", order: "a light khichdi", thanks: "Jeonda reh, puttar. Mummy di sakhi hun taan puri khushi!" },
  { id: "laneHouse", poi: "laneHouse", who: "gill", whoName: "Gill uncle", district: "ranggarh", order: "dal makhani, less salt", thanks: "Hmm. Salt theek ae. Chalo, sabaash." },
  { id: "sarpanch", poi: "sarpanch", who: "sarpanch", whoName: "Sarpanch ji", district: "kotli", order: "chole and four rotis", thanks: "Meeting hunde hi pait vich aag! Shukriya." },
  { id: "jarnail", poi: "jarnail", who: "jarnail", whoName: "Jarnail Singh", district: "road", order: "sarson da saag, makki di roti", thanks: "Khet vich asli swaad. Mummy nu dassi!" },
  { id: "sherDhaba", poi: "sherDhaba", who: "sukhi", whoName: "Sukhi Bhaji", district: "road", order: "rajma, roti, achaar", thanks: "Sher Singh nu na dassi, par eh us ton vadhiya ae!" },
];

export const TIFFIN = {
  price: 60, tip: 25, cost: 22,
  /** Mummy ji hands out the dabbas between these hours. */
  collectFrom: 10, collectTo: 13,
  /** The lunch rush: tips are for tiffins that arrive in it. */
  windowFrom: 11.5, windowTo: 13.75,
  /** A tiffin still carried at this hour has gone cold. */
  giveUp: 14.5,
  perTrip: 4,
} as const;

function hash(n: number): number {
  let h = Math.imul(n ^ 0x9e3779b9, 2654435761);
  h ^= h >>> 15; h = Math.imul(h, 2246822519); h ^= h >>> 13;
  return h >>> 0;
}

/** Today's regulars: six to ten of them, in a different mix each day; the districts that know you send more. */
export function ordersFor(day: number, repTier: (d: District) => number): TiffinCustomer[] {
  const bonus = Math.min(4, (["ranggarh", "kotli", "road", "nawan", "ludhiana"] as District[]).reduce((a, d) => a + repTier(d), 0));
  const n = Math.min(TIFFIN_CUSTOMERS.length, 6 + bonus);
  return [...TIFFIN_CUSTOMERS].sort((a, b) => hash(day * 131 + a.id.length * 17 + a.id.charCodeAt(0)) - hash(day * 131 + b.id.length * 17 + b.id.charCodeAt(0)) || a.id.localeCompare(b.id)).slice(0, n);
}

export type Arrival = { kind: "early" | "ontime" | "late"; pay: number; tip: number };

/** What a tiffin earns when it arrives at this hour in this condition (0 to 100); tipMul is the data-recharge perk and reputation. */
export function settle(hour: number, condition: number, tipMul = 1): Arrival {
  const care = 0.5 + Math.max(0, Math.min(100, condition)) / 200;
  if (hour < TIFFIN.windowFrom - 0.5) return { kind: "early", pay: Math.round((TIFFIN.price * care) / 5) * 5, tip: 0 };
  if (hour <= TIFFIN.windowTo) return { kind: "ontime", pay: Math.round((TIFFIN.price * care) / 5) * 5, tip: Math.round((TIFFIN.tip * care * tipMul) / 5) * 5 };
  return { kind: "late", pay: Math.round((TIFFIN.price * 0.8 * care) / 5) * 5, tip: 0 };
}

/** The batch to pick up: the first `n` of today's open orders, visited nearest first from `from`. */
export function routeOf(orders: TiffinCustomer[], from: { x: number; z: number }): TiffinCustomer[] {
  const left = [...orders], out: TiffinCustomer[] = [];
  let at = from;
  while (left.length) {
    let bi = 0, bd = Infinity;
    left.forEach((c, i) => { const p = POIS[c.poi]!, d = Math.hypot(p.x - at.x, p.z - at.z); if (d < bd) { bd = d; bi = i; } });
    const [c] = left.splice(bi, 1);
    out.push(c!);
    at = POIS[c!.poi]!;
  }
  return out;
}

export interface TiffinHost {
  ledger: Ledger;
  hour(): number;
  day(): number;
  playerPos(): Vector3;
  vehicleSpeed(): number | null;
  money(): number;
  /** Take money out of the pocket for ingredients (false when there is not enough). */
  charge(amount: number, kind: string): boolean;
  /** Pay the player, with reputation in the district they delivered in. */
  earn(money: number, tip: number, rep: number, district: District): void;
  setCarrying(on: boolean): void;
  toast(msg: string, kind?: "info" | "warn" | "money", ms?: number): void;
  dialogue(who: string, text: string, options: Array<{ label: string; value: string }>): Promise<string>;
  sting(kind: "small" | "big" | "fail"): void;
  residentSay(id: string, text: string): void;
  residentGesture(id: string, g: "greet" | "talk" | "cheer" | "wave"): void;
  warm?(who: string, amount: number): void;
  tipMultiplier(): number;
  spillFactor(): number;
  /** Is a delivery for Bhola, or a sawari, already on? */
  otherJob(): boolean;
  repTier(d: District): number;
  persist(reason: string): void;
}

interface Batch { stops: TiffinCustomer[]; condition: number }

export class TiffinRun {
  batch: Batch | null = null;
  private busy = false;

  constructor(private host: TiffinHost) {}

  /** Today's orders not yet served. */
  open(): TiffinCustomer[] {
    const f = this.host.ledger.f, day = this.host.day();
    if (f.tiffinDay !== day) { f.tiffinDay = day; f.tiffinDone = []; }
    const served = new Set(f.tiffinDone);
    const carried = new Set(this.batch?.stops.map((s) => s.id) ?? []);
    return ordersFor(day, (d) => this.host.repTier(d)).filter((c) => !served.has(c.id) && !carried.has(c.id));
  }

  /** Mummy ji's counter. */
  interaction(): { label: string; run: () => void } | null {
    const h = this.host.hour();
    if (this.batch) return { label: "Mummy ji: your tiffins are packed, go deliver them!", run: () => this.host.toast("Dabbe tere hath vich ne — lunch rush ton pehlan pahunchao!", "info", 3000) };
    const left = this.open();
    if (!left.length) return { label: "Mummy ji: no more tiffin orders today", run: () => this.host.toast("Aaj de saare dabbe ja chuke ne. Kal hor aunge.", "info", 3000) };
    if (h < TIFFIN.collectFrom) return { label: `Mummy ji: tiffins ready at ${TIFFIN.collectFrom}:00 (${left.length} orders)`, run: () => this.host.toast(`Mummy ji: ${left.length} dabbe banane ne, das vaje tak tayyar!`, "info", 3000) };
    if (h >= TIFFIN.collectTo) return { label: "Mummy ji: the lunch rush is over", run: () => this.host.toast("Lunch da vela nikal gaya. Kal savere!", "info", 3000) };
    return { label: `Take today's tiffins from Mummy ji (${left.length} orders, ₹${TIFFIN.cost} of ingredients each)`, run: () => void this.collect() };
  }

  private async collect(): Promise<void> {
    const h = this.host;
    if (this.busy || this.batch) return;
    if (h.otherJob()) { h.toast("Pehlan chalda kamm khatam kar.", "warn", 2500); return; }
    this.busy = true;
    try {
      const left = this.open();
      const afford = Math.floor(h.money() / TIFFIN.cost);
      const n = Math.min(TIFFIN.perTrip, left.length, afford);
      if (n <= 0) { h.toast(`Ingredients de layi ₹${TIFFIN.cost} chahide ne.`, "warn", 3000); return; }
      const route = routeOf(left, h.playerPos()).slice(0, n);
      // The nearest few go first, but Mummy ji sets them out in the order she cooked them.
      const names = route.map((c) => c.whoName).join(", ");
      const v = await h.dialogue("mummy", `Lai puttar, <b>${n} dabbe</b> bann ge: ${names}. Ingredients da ₹${n * TIFFIN.cost} lagga. Lunch rush ${TIFFIN.windowFrom | 0}:30 ton ${TIFFIN.windowTo | 0}:45 tak — time te pahunchana, tip milegi!`, [
        { label: `Take them (₹${n * TIFFIN.cost})`, value: "take" },
        { label: "Not now", value: "no" },
      ]);
      if (v !== "take") return;
      if (!h.charge(n * TIFFIN.cost, "ingredients")) return;
      this.batch = { stops: route, condition: 100 };
      h.setCarrying(true);
      h.residentGesture("home_mummy", "wave");
      h.residentSay("home_mummy", "Helmet paa ke jaayi, te dabbe seedhe rakhi!");
      h.toast(`🍱 ${n} tiffins in hand. First stop: ${route[0]!.whoName}.`, "money", 3500);
      h.persist("tiffin");
    } finally {
      this.busy = false;
    }
  }

  /** The next stop, while a batch is on. */
  next(): TiffinCustomer | null { return this.batch?.stops[0] ?? null; }

  objective(): { title: string; detail: string; target: Vector3 } | null {
    const c = this.next();
    if (!c || !this.batch) return null;
    const p = POIS[c.poi]!;
    return { title: `Tiffin → ${c.whoName}`, detail: `${c.order}. ${this.batch.stops.length} left in hand. Lunch rush ${TIFFIN.windowFrom | 0}:30 to ${TIFFIN.windowTo | 0}:45.`, target: new Vector3(p.x, 0, p.z) };
  }

  deliveryHere(): { label: string; run: () => Promise<void> } | null {
    const c = this.next();
    if (!c) return null;
    const pos = this.host.playerPos(), p = POIS[c.poi]!, vs = this.host.vehicleSpeed();
    if (Math.hypot(pos.x - p.x, pos.z - p.z) < 3.4 && (vs === null || vs < 2.5)) return { label: `Hand the tiffin to ${c.whoName}`, run: () => this.deliver() };
    return null;
  }

  private async deliver(): Promise<void> {
    const b = this.batch, h = this.host;
    if (!b || this.busy) return;
    this.busy = true;
    try {
      const c = b.stops.shift()!;
      const a = settle(h.hour(), b.condition, h.tipMultiplier());
      h.residentGesture(c.who, "greet");
      h.sting(a.kind === "ontime" ? "small" : "small");
      const f = h.ledger.f;
      f.tiffinDone.push(c.id);
      h.ledger.f.today.tiffins++;
      if (a.kind === "late") h.ledger.f.today.late++;
      h.earn(a.pay, a.tip, a.kind === "ontime" ? 2 : 1, c.district);
      h.warm?.(c.who, a.kind === "ontime" ? 1.5 : 0.5);
      const note = a.kind === "ontime" ? `Time te! Tip ₹${a.tip}.` : a.kind === "early" ? "Abhi taan bhookh nahi lagi, par rakh lainda haan." : "Thoda late ho gaya, puttar. Chalo, theek ae.";
      await h.dialogue(c.who, `${c.thanks} <i>${note}</i>`, [{ label: a.kind === "ontime" ? "Enjoy your meal!" : "Sorry ji!", value: "n" }]);
      if (!b.stops.length) {
        this.batch = null;
        h.setCarrying(false);
        h.toast("🍱 Saare dabbe pahunch gaye. Mummy ji kol hor ne? Check kar.", "money", 3500);
      } else h.toast(`Next: ${b.stops[0]!.whoName}`, "info", 2500);
      h.persist("tiffin");
    } finally {
      this.busy = false;
    }
  }

  /** A jolt spills the food; the pay shrinks with it. */
  onJolt(dv: number): void {
    if (!this.batch) return;
    const dmg = Math.max(0, dv - 1.6) * 7 * this.host.spillFactor();
    if (dmg <= 0) return;
    this.batch.condition = Math.max(0, this.batch.condition - dmg);
    if (dmg > 6) this.host.toast(`Dabbe hil gaye! Condition ${Math.round(this.batch.condition)}%`, "warn", 1800);
  }

  /** Cold tiffins: past half past two the customers have eaten. */
  update(): void {
    if (!this.batch) return;
    if (this.host.hour() >= TIFFIN.giveUp && this.host.hour() < 20) this.spoil("Lunch da vela nikal gaya: dabbe thande ho gaye.");
  }

  spoil(why: string): void {
    if (!this.batch) return;
    const left = this.batch.stops.length;
    this.batch = null;
    this.host.setCarrying(false);
    this.host.sting("fail");
    this.host.toast(`🥶 ${why} (${left} tiffin${left === 1 ? "" : "s"} wasted)`, "warn", 4500);
    this.host.persist("tiffin");
  }

  /** Cancel a batch (the player gave it up). */
  abandon(): void { if (this.batch) this.spoil("Tiffins wapas rakh ditte."); }
}
