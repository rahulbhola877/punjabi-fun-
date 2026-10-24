import { DISTRICTS, DISTRICT_NAME, districtTier, type District } from "./Prices";
import { nextFestival } from "../world/Calendar";

/**
 * The books of the day. Money in and out by what it was for, reputation earned in each district, and the tiffin
 * round; at half past nine every night the "Din di kamai" screen reads them out. Saved as `save.econ`.
 */

export interface DayBook {
  /** The game day these figures are for. */
  day: number;
  inc: Record<string, number>;
  out: Record<string, number>;
  /** Reputation earned today, by district. */
  rep: Record<string, number>;
  tiffins: number;
  late: number;
}

export interface EconFile {
  today: DayBook;
  /** The last day closed without its summary being read (shown on waking). */
  last: DayBook | null;
  /** Reputation with each district, all told. */
  districtRep: Record<string, number>;
  /** The day the summary was last shown. */
  shown: number;
  /** Tiffin customers served on this day. */
  tiffinDay: number;
  tiffinDone: string[];
  /** Last month Simran's fees were paid (the month number since day 0), and the last year the roof was mended. */
  feesPaid: number;
  roofYear: number;
}

export const emptyBook = (day: number): DayBook => ({ day, inc: {}, out: {}, rep: {}, tiffins: 0, late: 0 });
export const emptyEcon = (day = 0): EconFile => ({ today: emptyBook(day), last: null, districtRep: {}, shown: -1, tiffinDay: -1, tiffinDone: [], feesPaid: -1, roofYear: -1 });

const num = (v: unknown, lo: number, hi: number, d = 0): number => (typeof v === "number" && Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : d);
const rec = (v: unknown, hi: number): Record<string, number> => {
  const o: Record<string, number> = {};
  if (typeof v === "object" && v !== null) for (const [k, x] of Object.entries(v)) if (/^[a-z0-9_]{1,24}$/i.test(k) && typeof x === "number" && Number.isFinite(x)) o[k] = Math.max(-hi, Math.min(hi, x));
  return o;
};
const book = (v: unknown, day: number): DayBook => {
  const b = (typeof v === "object" && v !== null ? v : {}) as Record<string, unknown>;
  return { day: Math.floor(num(b.day, 0, 1e6, day)), inc: rec(b.inc, 1e8), out: rec(b.out, 1e8), rep: rec(b.rep, 1e5), tiffins: Math.floor(num(b.tiffins, 0, 1e5)), late: Math.floor(num(b.late, 0, 1e5)) };
};

/** Untrusted JSON to a usable file (older saves have none). */
export function sanitizeEcon(v: unknown, day = 0): EconFile {
  if (typeof v !== "object" || v === null) return emptyEcon(day);
  const o = v as Record<string, unknown>;
  const ids = Array.isArray(o.tiffinDone) ? o.tiffinDone.filter((s): s is string => typeof s === "string" && /^[a-z0-9_]{1,24}$/i.test(s)).slice(0, 20) : [];
  return {
    today: book(o.today, day), last: o.last ? book(o.last, day) : null, districtRep: rec(o.districtRep, 1e5),
    shown: Math.floor(num(o.shown, -1, 1e6, -1)), tiffinDay: Math.floor(num(o.tiffinDay, -1, 1e6, -1)), tiffinDone: ids,
    feesPaid: Math.floor(num(o.feesPaid, -1, 1e6, -1)), roofYear: Math.floor(num(o.roofYear, -1, 1e6, -1)),
  };
}

export class Ledger {
  constructor(public f: EconFile) {}

  /** A new game day: close the old book and open a fresh one. Returns true if the day changed. */
  roll(day: number): boolean {
    if (this.f.today.day === day) return false;
    // Keep the closed book for the morning only if the player never saw its summary.
    this.f.last = this.f.shown >= this.f.today.day ? null : this.f.today;
    this.f.today = emptyBook(day);
    return true;
  }

  earn(kind: string, amount: number): void {
    if (amount > 0) this.f.today.inc[kind] = (this.f.today.inc[kind] ?? 0) + amount;
  }
  spend(kind: string, amount: number): void {
    if (amount > 0) this.f.today.out[kind] = (this.f.today.out[kind] ?? 0) + amount;
  }
  repGain(district: District, amount: number): void {
    if (!amount) return;
    this.f.today.rep[district] = (this.f.today.rep[district] ?? 0) + amount;
    this.f.districtRep[district] = Math.max(0, (this.f.districtRep[district] ?? 0) + amount);
  }
  rep(district: District): number { return this.f.districtRep[district] ?? 0; }
  tier(district: District) { return districtTier(this.rep(district)); }

  static total(r: Record<string, number>): number { return Object.values(r).reduce((a, b) => a + b, 0); }
}

const KIND_LABEL: Record<string, string> = {
  delivery: "Bhola's deliveries", tiffin: "Mummy ji's tiffins", tips: "Tips", post: "Money order", other: "Other",
  khana: "Khana-peena", fuel: "Petrol", workshop: "Gurnam's workshop", shopping: "Shopping", chaipaani: "Chai-paani to the police",
  ingredients: "Tiffin ingredients", family: "Family (fees, repairs)", daan: "Daan and shagan",
  fines: "Jurmana te jhagde", lost: "Jeb ton gaye", travel: "Bus-auto kiraya", sawari: "Auto sawari", home: "Ghar da inaam",
};
export const kindLabel = (k: string): string => KIND_LABEL[k] ?? k;

/** The rows of the "Din di kamai" screen. */
export function summaryRows(b: DayBook, f: EconFile, pocket: number, bank: number, day: number): Array<[string, string]> {
  const rows: Array<[string, string]> = [];
  const inc = Ledger.total(b.inc), out = Ledger.total(b.out);
  for (const [k, v] of Object.entries(b.inc).sort((a, c) => c[1] - a[1])) rows.push([kindLabel(k), `+₹${Math.round(v)}`]);
  if (!Object.keys(b.inc).length) rows.push(["Kamai", "kuch nahi — kal zaroor"]);
  for (const [k, v] of Object.entries(b.out).sort((a, c) => c[1] - a[1])) rows.push([kindLabel(k), `−₹${Math.round(v)}`]);
  rows.push(["Aaj di bachat", `${inc - out >= 0 ? "+" : "−"}₹${Math.abs(Math.round(inc - out))}`]);
  rows.push(["Pocket / bank", `₹${pocket} / ₹${bank}`]);
  if (b.tiffins) rows.push(["Tiffins pahunche", `${b.tiffins}${b.late ? ` (${b.late} late)` : ""}`]);
  for (const d of DISTRICTS) if (b.rep[d]) rows.push([`${DISTRICT_NAME[d]}: izzat`, `+${b.rep[d]} · ${districtTier(f.districtRep[d] ?? 0).name}`]);
  const nf = nextFestival(day + 1);
  rows.push(["Kal", nf.inDays === 0 ? `${nf.festival.name}!` : `${nf.festival.name} ${nf.inDays + 1} din baad`]);
  return rows;
}
