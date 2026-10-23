import type { Appearance } from "../characters/HumanBuilder";
import type { KitLook } from "../characters/KitHuman";
import type { Archetype } from "../kit/rig";
import { getOutfit, outfitsFor, type OutfitDef } from "../kit/outfits";

/** Kit skin tones from fair to dark, matched to the old bodies' tones. */
const KIT_SKIN = ["#e3b48a", "#d29a6a", "#c68a5a", "#b57a4c", "#a06a40", "#8a5632"];

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

function lum(hex: string): number {
  const n = parseInt(hex.slice(1, 7), 16);
  return ((n >> 16) & 255) * 0.3 + ((n >> 8) & 255) * 0.59 + (n & 255) * 0.11;
}

/** Weighted pick: [outfit id, weight] pairs, chosen by the person's hash. */
function pick(h: number, opts: Array<[string, number]>): string {
  const total = opts.reduce((s, o) => s + o[1], 0);
  let x = ((h >>> 8) % 1000) / 1000 * total;
  for (const [id, w] of opts) { x -= w; if (x < 0) return id; }
  return opts[opts.length - 1]![0];
}

function archetypeOf(a: Appearance): Archetype {
  if (a.age === "child") return a.sex === "f" ? "girl" : "boy";
  if (a.age === "elder") return a.sex === "f" ? "aunty" : "uncle";
  return a.sex === "f" ? "female" : "male";
}

/** Outfit for a man or boy, following what the old body wore (turban → a Sikh look, kurta → kurta...). */
function maleOutfit(a: Appearance, arch: Archetype, h: number, police: boolean): string {
  if (police) return a.headwear === "turban" ? "police" : "police_cap";
  if (arch === "boy") {
    if (a.headwear === "patka" || a.headwear === "turban") return pick(h, [["school", 3], ["student", 2], ["kabaddi", 1], ["kurta_pajama", 1]]);
    return pick(h, [["school_plain", 3], ["street_casual", 3], ["church_m", 1], ["diwali_kurta", 1], ["eid_kurta", 1]]);
  }
  const elder = arch === "uncle";
  if (a.apron) return "dhaba";
  if (a.headwear === "turban") {
    if (a.top === "shirt" || a.top === "tshirt") return a.bottom === "trousers" && !elder ? "business" : pick(h, [["farmer", 2], ["kurta_pajama", 2]]);
    return elder ? pick(h, [["kurta_pajama", 3], ["winter_uncle", 2], ["farmer", 2], ["sewadar", 1], ["festive", 1]])
      : pick(h, [["kurta_pajama", 5], ["farmer", 2], ["sewadar", 1], ["festive", 1], ["bhangra", 0.5]]);
  }
  if (a.headwear === "patka") return arch === "male" ? pick(h, [["student", 3], ["kabaddi", 1]]) : "kurta_pajama";
  if (a.headwear === "cap") return pick(h, [["netaji", 1], ["pagri_farmer", 2], ["eid_kurta", 2]]);
  if (a.top === "kurta" || a.top === "vest") {
    return elder ? pick(h, [["pandit", 2], ["pagri_farmer", 2], ["netaji", 1], ["imam", 1], ["diwali_kurta", 2]])
      : pick(h, [["diwali_kurta", 3], ["eid_kurta", 2], ["pagri_farmer", 2]]);
  }
  return elder ? pick(h, [["office_casual", 3], ["church_m", 1]]) : pick(h, [["office_casual", 3], ["street_casual", 3], ["church_m", 1]]);
}

/** Outfit for a woman or girl: suits mostly, sarees and kurtis now and then. */
function femaleOutfit(a: Appearance, arch: Archetype, h: number): string {
  if (arch === "girl") {
    if (a.top === "kameez") return pick(h, [["school_f", 3], ["patiala_suit", 1], ["giddha", 1], ["sewadar_f", 1], ["eid_suit", 1], ["church_f", 0.5]]);
    return pick(h, [["college_f", 2], ["casual_f", 2], ["school_f", 2]]);
  }
  if (arch === "aunty") {
    if (a.top !== "kameez") return pick(h, [["saree", 2], ["winter_aunty", 1]]);
    return pick(h, [["village_f", 3], ["patiala_suit", 2], ["winter_aunty", 2], ["sewadar_f", 1], ["diwali_suit", 1], ["eid_suit", 1], ["saree", 1], ["church_f", 0.5]]);
  }
  if (a.top !== "kameez") return a.bottom === "trousers" ? pick(h, [["business_f", 1], ["casual_f", 2]]) : pick(h, [["casual_f", 2], ["college_f", 2]]);
  return pick(h, [["patiala_suit", 4], ["village_f", 2], ["diwali_suit", 1], ["eid_suit", 1], ["saree", 1], ["sewadar_f", 1], ["church_f", 0.5]]);
}

/**
 * A kit look for one of the old-style residents: the archetype from age and
 * sex, an outfit from every community chosen to match what they wore
 * (turbans stay Sikh, suits stay suits) and their own colours wherever the
 * outfit lets the colour be changed. The same person always gets the same look.
 */
export function kitLookFor(id: string, a: Appearance, police = false, seated = false): KitLook {
  const arch = archetypeOf(a);
  const h = hash(id);
  let outfit = a.sex === "f" ? femaleOutfit(a, arch, h) : maleOutfit(a, arch, h, police);
  // A saree's stiff skirt balloons over the knees on a chair: seated women wear a suit.
  if (seated && (outfit === "saree" || outfit === "bridal")) outfit = arch === "aunty" ? "village_f" : "patiala_suit";
  let o: OutfitDef | undefined = getOutfit(outfit);
  if (!o || !o.for.includes(arch)) { o = outfitsFor(arch)[0]!; outfit = o.id; }
  const tweak = new Set(o?.tweak ?? []);
  // The old tones run a little lighter than the kit's: match by brightness.
  const sl = lum(a.skin);
  const skin = KIT_SKIN[Math.max(0, Math.min(KIT_SKIN.length - 1, Math.round((200 - sl) / 21)))]!;
  const colors: KitLook["colors"] = { skin };
  if (arch !== "uncle" && arch !== "aunty") colors.hair = a.hairColor;
  // Every third person keeps the outfit's own colours: they are the designer's best combinations.
  if (h % 3 !== 0) {
    if (tweak.has("top")) colors.top = a.topColor;
    if (tweak.has("bottom") && a.bottom !== "jeans" && a.bottom !== "trousers") colors.bottom = a.bottomColor;
    if (tweak.has("head") && a.headColor && (a.headwear === "turban" || a.headwear === "patka")) colors.head = a.headColor;
    if (tweak.has("dupatta") && a.dupatta) colors.dupatta = a.dupatta;
  }
  return { archetype: arch, outfit, colors };
}

/** Key for reusing a built body: same archetype, outfit and colours. */
export function kitLookKey(l: KitLook): string {
  return `${l.archetype}|${l.outfit}|${JSON.stringify(l.colors ?? {})}`;
}
