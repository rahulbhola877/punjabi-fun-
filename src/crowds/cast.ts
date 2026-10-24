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

interface Entry extends Known { name?: string; /** The look is random: pick one of this sex, so the name fits the person. */ sex?: "m" | "f" }

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
  keeper_kiryana: { name: "Lali uncle", sex: "m", tie: "Lali uncle, whose store Mummy ji's ration comes from", asks: "Mummy ji", gift: "biscuit" },
  keeper_sweets: { name: "Halwai Harbans", sex: "m", tie: "Harbans, whose ladoos are for every family occasion", asks: "Bebe ji", gift: "bhujia" },
  keeper_hardware: { name: "Bansal ji", sex: "m", tie: "Bansal ji, who fixed the gate for Papa ji", asks: "Papa ji" },
  keeper_phone: { name: "Tony", sex: "m", tie: "Tony of the phone shop, who does Simran's recharge", asks: "Simran", gift: "colddrink" },
  keeper_textile: { name: "Sethi ji", sex: "m", tie: "Sethi ji, who sells Mummy ji her cloth", asks: "Mummy ji" },
  chatA: { name: "Sharma uncle", sex: "m", tie: "Papa ji's neighbour from the old days", asks: "Papa ji" },
  chatB: { name: "Bajwa uncle", sex: "m", tie: "Papa ji's neighbour from the old days", asks: "Papa ji" },
  beat0: { name: "Constable Ranjit", tie: "Constable Ranjit, who knows Papa ji from the chowki", asks: "Papa ji" },
  beat1: { name: "Constable Pargat", tie: "Constable Pargat, who knows Papa ji from the chowki", asks: "Papa ji" },
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
  if (e) { const { name, sex, ...known } = e; return { ...d, name: name ?? d.name, look: sex ? lookOfSex(d.look, d.id, sex) : d.look, known }; }
  if (d.id.startsWith("autowala")) {
    let h = 0;
    for (let i = 0; i < d.id.length; i++) h = (h * 31 + d.id.charCodeAt(i)) | 0;
    const name = AUTO_NAMES[Math.abs(h) % AUTO_NAMES.length]!;
    return { ...d, name: `${name} auto-wala`, known: { tie: `${name}, the auto-wala who knows Papa ji`, asks: "Papa ji" } };
  }
  if (d.id.startsWith("nurse")) return { ...d, name: "Sister Jaspreet", known: { tie: "Sister Jaspreet at the hospital, who looks after Bebe ji", asks: "Bebe ji" } };
  if (d.id.startsWith("home_")) {
    const f = FAMILIES.get(d.id.slice(5));
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
