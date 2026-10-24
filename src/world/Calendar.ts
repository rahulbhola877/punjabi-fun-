/**
 * The year of the game. One game day is one calendar day of `home.day`; a year is squeezed to 48 days (twelve
 * desi months of four days) so that a player who keeps playing sees the fields change and the festivals come round.
 * Day 0 is the first of Katak, late October: the paddy is ripe, Diwali is three days off.
 */

export type Season = "harvest-kharif" | "sowing" | "winter" | "spring" | "harvest-rabi" | "summer" | "monsoon";

export const MONTHS = ["Katak", "Maghar", "Poh", "Magh", "Phagan", "Chet", "Vaisakh", "Jeth", "Harh", "Sawan", "Bhadon", "Assu"] as const;
export const MONTH_DAYS = 4;
export const YEAR_DAYS = MONTHS.length * MONTH_DAYS;

export interface Festival { id: string; name: string; month: number; dom: number; blurb: string }

/** The six festivals of the year, each on one game day. */
export const FESTIVALS: Festival[] = [
  { id: "diwali", name: "Diwali", month: 0, dom: 3, blurb: "Diyas on every roof, sweets, fireworks after dark." },
  { id: "gurpurab", name: "Gurpurab", month: 1, dom: 0, blurb: "Nagar kirtan from the gurdwara; langar for everyone." },
  { id: "lohri", name: "Lohri", month: 2, dom: 3, blurb: "Bonfires in the galis at dusk; dhol, rewri and popcorn." },
  { id: "holi", name: "Hola Mohalla", month: 5, dom: 0, blurb: "Colours in the bazaar; the akhada shows its strength." },
  { id: "baisakhi", name: "Baisakhi", month: 6, dom: 0, blurb: "The wheat is cut. Bhangra at the mela." },
  { id: "teeyan", name: "Teeyan", month: 9, dom: 1, blurb: "Swings in the neem, girls in phulkari, gidha in the courtyard." },
];

export interface GameDate {
  /** Days since the start of the game. */
  day: number;
  /** 0-based year. */
  year: number;
  /** 0 to 11, index into MONTHS. */
  month: number;
  /** Day of the month, 0 to 3. */
  dom: number;
  name: string;
  season: Season;
  festival: Festival | null;
}

export function seasonOf(month: number): Season {
  switch (month) {
    case 0: return "harvest-kharif";
    case 1: return "sowing";
    case 2: case 3: return "winter";
    case 4: case 5: return "spring";
    case 6: return "harvest-rabi";
    case 7: case 8: return "summer";
    default: return "monsoon";
  }
}

export function dateOf(day: number): GameDate {
  const d = Math.max(0, Math.floor(day));
  const inYear = d % YEAR_DAYS;
  const month = Math.floor(inYear / MONTH_DAYS), dom = inYear % MONTH_DAYS;
  return {
    day: d, year: Math.floor(d / YEAR_DAYS), month, dom, name: MONTHS[month]!, season: seasonOf(month),
    festival: FESTIVALS.find((f) => f.month === month && f.dom === dom) ?? null,
  };
}

/** The next festival on or after this day, and how many days away it is. */
export function nextFestival(day: number): { festival: Festival; inDays: number } {
  const d = Math.max(0, Math.floor(day));
  for (let i = 0; i < YEAR_DAYS; i++) {
    const f = dateOf(d + i).festival;
    if (f) return { festival: f, inDays: i };
  }
  return { festival: FESTIVALS[0]!, inDays: 0 };
}

/** "3 Katak" for the HUD. */
export function dateLabel(day: number): string {
  const g = dateOf(day);
  return `${g.dom + 1} ${g.name}`;
}

// ---------------------------------------------------------------- Fields

export type CropName = "wheat" | "sarson" | "sugarcane" | "paddy" | "fodder" | "fallow";

/** What a plot grows in the cold season (rabi) and the wet one (kharif). */
const ROTATION: Record<CropName, { rabi: CropName; kharif: CropName }> = {
  wheat: { rabi: "wheat", kharif: "paddy" },
  sarson: { rabi: "sarson", kharif: "paddy" },
  paddy: { rabi: "wheat", kharif: "paddy" },
  fodder: { rabi: "fodder", kharif: "fodder" },
  sugarcane: { rabi: "sugarcane", kharif: "sugarcane" },
  fallow: { rabi: "fallow", kharif: "fallow" },
};

/** Growth by month of the rabi crop (sown in Maghar, cut in Vaisakh) and the kharif one (planted in Harh, cut in Katak). */
const RABI_GROW: Array<number | null> = [null, null, 0.3, 0.55, 0.8, 1, null, null, null, null, null, null];
const KHARIF_GROW: Array<number | null> = [1, null, null, null, null, null, null, null, 0.25, 0.5, 0.8, 1];
const CANE_GROW = [0.8, 0.85, 0.9, 0.95, 1, 1, 0.3, 0.4, 0.55, 0.65, 0.75, 0.8];

export interface FieldNow {
  /** What stands in the field (fallow when it is bare, whatever the plot grows). */
  crop: CropName;
  /** 0 just up, 1 full height and ripe. */
  grow: number;
  /** The month's work: the crop is cut, so only stubble is left. */
  bare: boolean;
}

/** What a plot of this crop looks like in this month (0 to 11). The Vaisakh dom-0 days still show the ripe wheat: Baisakhi is the cutting. */
export function fieldNow(base: CropName, month: number, dom = 3): FieldNow {
  const m = ((month % 12) + 12) % 12;
  if (base === "fallow") return { crop: "fallow", grow: 0, bare: true };
  if (base === "sugarcane") return { crop: "sugarcane", grow: CANE_GROW[m]!, bare: false };
  const rot = ROTATION[base];
  const rabi = RABI_GROW[m], kharif = KHARIF_GROW[m];
  if (m === 6 && dom < 1) return { crop: rot.rabi, grow: 1, bare: false };
  if (rabi !== null && rabi !== undefined) return { crop: rot.rabi, grow: rabi, bare: false };
  if (kharif !== null && kharif !== undefined) return { crop: rot.kharif, grow: kharif, bare: false };
  return { crop: "fallow", grow: 0, bare: true };
}
