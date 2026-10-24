/**
 * Who knows the family. This is the one table that gives the named people their
 * name and their tie (what they are to Papa ji, Mummy ji, Bebe ji and Simran),
 * applied to a resident when it is spawned (`dress`). The neighbours' families
 * and the families in other parts of town are picked from the real open
 * houses, by distance from the family home.
 */
import type { ResidentDef } from "./Crowd";
import type { Known } from "./People";
import { randomAppearance } from "../characters/appearances";
import type { Appearance } from "../characters/HumanBuilder";
import { OPEN_HOUSES } from "../world/openHouses";
import { HOME_ID } from "../world/home";

interface Entry extends Known {
  name?: string;
  /** The look is random: pick one of this sex, so the name fits the person. */
  sex?: "m" | "f";
  /** The hours they are about. */
  shift?: [number, number];
}

const BY_ID: Record<string, Entry> = {
  // The bazaar: Bhola's dhaba and the shops the family uses.
  bhola: { tie: "Bhola Singh, your boss and Papa ji's old yaar", asks: "Papa ji", gift: "colddrink" },
  cook: { tie: "Kaku, Bhole da cook; Bebe ji likes his adrak waali chah", asks: "Bebe ji", gift: "biscuit" },
  gurnam: { tie: "Gurnam, the mechanic who keeps your Bullet running", asks: "Papa ji", gift: "bhujia" },
  pammi: { tie: "Pammi, whose kinnow Bebe ji buys every week", asks: "Bebe ji", gift: "biscuit" },
  masterji: { tie: "Masterji, who stitches Mummy ji's suits", asks: "Mummy ji" },
  sohal: { tie: "Sohal, who sold Simran her cycle", asks: "Simran", gift: "colddrink" },
  mrsKaur: { tie: "Mrs. Kaur, Mummy ji's sakhi from the gurdwara", asks: "Mummy ji", gift: "biscuit" },
  gill: { tie: "Gill uncle, Papa ji's old friend from the lane", asks: "Papa ji", gift: "bhujia" },
  chemist: { tie: "Dr. Sehgal, Bebe ji's doctor", asks: "Bebe ji" },
  keeper_kiryana: { name: "Lali uncle", sex: "m", shift: [8.5, 21], tie: "Lali uncle, whose store Mummy ji's ration comes from", asks: "Mummy ji", gift: "biscuit" },
  keeper_sweets: { name: "Halwai Harbans", sex: "m", shift: [8, 22.5], tie: "Harbans, whose ladoos are for every family occasion", asks: "Bebe ji", gift: "bhujia" },
  keeper_hardware: { name: "Bansal ji", sex: "m", shift: [9, 20.5], tie: "Bansal ji, who fixed the gate for Papa ji", asks: "Papa ji" },
  keeper_phone: { name: "Tony", sex: "m", shift: [10, 21], tie: "Tony of the phone shop, who does Simran's recharge", asks: "Simran", gift: "colddrink" },
  keeper_textile: { name: "Sethi ji", sex: "m", shift: [9.5, 20.5], tie: "Sethi ji, who sells Mummy ji her cloth", asks: "Mummy ji" },
  chatA: { name: "Sharma uncle", sex: "m", shift: [8, 20.5], tie: "Papa ji's neighbour from the old days", asks: "Papa ji" },
  chatB: { name: "Bajwa uncle", sex: "m", shift: [8, 20.5], tie: "Papa ji's neighbour from the old days", asks: "Papa ji" },
  beat0: { name: "Constable Ranjit", tie: "Constable Ranjit, who knows Papa ji from the chowki", asks: "Papa ji" },
  beat1: { name: "Constable Pargat", tie: "Constable Pargat, who knows Papa ji from the chowki", asks: "Papa ji" },
  clerk_bank: { name: "Anand sahib", sex: "m", shift: [9.5, 16.5], tie: "Anand sahib, the bank manager who keeps Papa ji's pension account", asks: "Papa ji" },
  clerk_post: { name: "Dhillon ji", sex: "m", shift: [9, 17], tie: "Dhillon ji, the postmaster, who knows every letter that comes to the family", asks: "Bebe ji", gift: "biscuit" },
  // Other parts of the district.
  mobileWala: { tie: "Pinka of Hello Mobile Zone, Chaura Bazaar; Bhola's phone man", asks: "Simran", gift: "colddrink" },
  sarpanch: { tie: "Sarpanch Hardev Singh of Pind Kotli, Papa ji's friend from the panchayat", asks: "Papa ji", gift: "bhujia" },
  conductor: { tie: "Bittu, the bus conductor who knows you from the Ludhiana run" },
  munshi: { tie: "Munshi ji of the mandi, who sells Papa ji's kanak", asks: "Papa ji" },
  balwant: { tie: "Havaldar Balwant of the Ranggarh chowki, Papa ji's friend", asks: "Papa ji" },
  ticketwala: { tie: "Raju of Raj Talkies, who keeps Simran's film tickets", asks: "Simran" },
  pumpwala: { name: "Lakhwinder", tie: "Lakhwinder at the petrol pump, who fills the Bullet" },
};

const AUTO_NAMES = ["Gurmeet", "Billu", "Sukhdev", "Kala", "Pappu"];

/** Neighbours' and distant families, by house: picked from the open houses once. */
const FAMILIES = (() => {
  const out = new Map<string, { surname: string; near: boolean }>();
  const home = OPEN_HOUSES.find((h) => h.id === HOME_ID);
  if (!home) return out;
  const hx = (home.rect.x0 + home.rect.x1) / 2, hz = (home.rect.z0 + home.rect.z1) / 2;
  const dist = (h: (typeof OPEN_HOUSES)[number]) => Math.hypot((h.rect.x0 + h.rect.x1) / 2 - hx, (h.rect.z0 + h.rect.z1) / 2 - hz);
  const others = OPEN_HOUSES.filter((h) => h.id !== HOME_ID).sort((a, b) => dist(a) - dist(b) || (a.id < b.id ? -1 : 1));
  ["Sharma", "Dhillon", "Bajwa", "Grewal"].forEach((s, i) => { if (others[i]) out.set(others[i]!.id, { surname: s, near: true }); });
  // Families further out: farthest-point picks, at least 120 m from the home and from each other.
  const chosen: Array<{ x: number; z: number }> = [{ x: hx, z: hz }];
  for (const s of ["Randhawa", "Sandhu", "Kang", "Bedi", "Mann"]) {
    let best: (typeof OPEN_HOUSES)[number] | null = null, bs = 120;
    for (const h of others) {
      if (out.has(h.id)) continue;
      const x = (h.rect.x0 + h.rect.x1) / 2, z = (h.rect.z0 + h.rect.z1) / 2;
      const d = Math.min(...chosen.map((c) => Math.hypot(c.x - x, c.z - z)));
      if (d > bs) { bs = d; best = h; }
    }
    if (!best) break;
    chosen.push({ x: (best.rect.x0 + best.rect.x1) / 2, z: (best.rect.z0 + best.rect.z1) / 2 });
    out.set(best.id, { surname: s, near: false });
  }
  return out;
})();

/** The surname of the family that lives in an open house, if it is one of the families that know you. */
export function familyOf(houseId: string): { surname: string; near: boolean } | undefined {
  return FAMILIES.get(houseId);
}

function hashOf(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/**
 * Ordinary street folk go home for the night: between about nine and midnight, back between half past
 * five and eight. Children are in by dusk, and the school's children and staff keep school hours. The named, the shopkeepers, the police, the sellers and the
 * people in a procession keep their own hours (or none).
 */
export function withNightShift(d: ResidentDef): ResidentDef {
  // School hours: the uniformed children and the staff are there from about half past seven until three.
  if (!d.shift && d.look.age === "child" && d.look.topColor === "#f5f5f5" && d.look.bottomColor === "#1a237e") {
    const h = hashOf(d.id);
    return { ...d, shift: [7.5 + (h % 3) * 0.25, 14.8 + (h % 4) * 0.25] };
  }
  if (!d.shift && /^teacher\d+$/.test(d.id)) return { ...d, shift: [7.4, 15.2] };
  if (!d.shift && /^cook\d+$/.test(d.id)) return { ...d, shift: [7.8, 14.6] };
  if (d.shift || d.contact || d.known || d.shop || d.callKind || d.faction || d.indoor || d.kite || d.pole || d.dhol || d.onRoof || d.role === "keeper" || d.role === "seated") return d;
  const h = hashOf(d.id);
  if (d.role === "child") return { ...d, shift: [7.5, 18 + (h % 4) * 0.5] };
  return { ...d, shift: [5.5 + (h % 5) * 0.5, 21.3 + (h % 6) * 0.55] };
}

/** A random look that is already the wanted sex stays; otherwise the nearest seed that is, grown up. */
function lookOfSex(look: Appearance, id: string, sex: "m" | "f"): Appearance {
  if (look.sex === sex && look.age !== "child") return look;
  let seed = 0;
  for (let i = 0; i < id.length; i++) seed = (seed * 31 + id.charCodeAt(i)) | 0;
  for (let i = 0; i < 80; i++) {
    const a = randomAppearance(Math.abs(seed) % 9000 + 20000 + i * 17);
    if (a.sex === sex && a.age !== "child") return a;
  }
  return { ...look, sex, age: "adult" };
}

/** Give a resident its name and tie, if it is one of the people who know the family. */
export function dress(d: ResidentDef): ResidentDef {
  if (d.known) return d;
  const e = BY_ID[d.id];
  if (e) { const { name, sex, shift, ...known } = e; return { ...d, name: name ?? d.name, look: sex ? lookOfSex(d.look, d.id, sex) : d.look, known, shift }; }
  // The bazaar's walkers go home between nine at night and midnight, and are back between six and eight.
  // The two kids from the courtyard are in by dusk.
  if (/^walker\d+$/.test(d.id)) {
    const h = hashOf(d.id);
    return { ...d, shift: [6 + (h % 4) * 0.7, 21 + (h % 5) * 0.8] };
  }
  if (/^kid\d+$/.test(d.id)) return { ...d, shift: [8, 18.5] };
  if (d.id.startsWith("autowala")) {
    let h = 0;
    for (let i = 0; i < d.id.length; i++) h = (h * 31 + d.id.charCodeAt(i)) | 0;
    const name = AUTO_NAMES[Math.abs(h) % AUTO_NAMES.length]!;
    return { ...d, name: `${name} auto-wala`, known: { tie: `${name}, the auto-wala who knows Papa ji`, asks: "Papa ji" } };
  }
  if (d.id.startsWith("nurse")) return { ...d, name: "Sister Jaspreet", known: { tie: "Sister Jaspreet at the hospital, who looks after Bebe ji", asks: "Bebe ji" } };
  if (/^(home|gate|bell)_/.test(d.id)) {
    const f = FAMILIES.get(/^[a-z]+_([A-Za-z]+\d+)/.exec(d.id)?.[1] ?? "");
    if (f) {
      const elder = d.look.age === "elder";
      const who = elder ? "bebe" : "aunty";
      return {
        ...d,
        name: `${f.surname} ${who}`,
        known: f.near
          ? { tie: `${f.surname} aunty's family, your neighbours; Mummy ji's sakhis`, asks: "Mummy ji", gift: elder ? "biscuit" : "bhujia" }
          : { tie: `The ${f.surname} family, Papa ji's old friends from his working days`, asks: "Papa ji", gift: elder ? "biscuit" : undefined },
      };
    }
  }
  return d;
}
