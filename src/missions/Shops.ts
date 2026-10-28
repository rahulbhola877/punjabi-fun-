/** Things residents sell. Effects are applied by the game (see Game.buy). */
export type ItemKind = "buff" | "warmth" | "perk" | "outfit" | "food" | "goods";

/** What you hold while you eat it. */
export type FoodProp = "thali" | "glass" | "kulhad" | "dona" | "jalebi" | "ganna" | "kulfi" | "fruit";

export interface ShopItem {
  id: string;
  label: string;
  cost: number;
  kind: ItemKind;
  note: string;
  /** buff: sprint multiplier bonus and duration (s); warmth: seconds. */
  value?: number;
  duration?: number;
  /** food: health back, what it is served in, and what you say. */
  heal?: number;
  prop?: FoodProp;
  yum?: string;
  /** outfit: which part and colour. */
  part?: "top" | "head" | "drape" | "bottom";
  color?: string;
  /** goods: eaten later from the bag (it has heal/prop/yum) rather than given away. */
  snack?: boolean;
  /** A snack that gives you superpowers for a while when eaten (Superpower.ts). */
  power?: boolean;
}

export interface ShopDef { keeper: string; name: string; greeting: string; items: ShopItem[] }

/** Something to eat or drink there and then: health back, maybe a burst of energy. */
const F = (id: string, label: string, cost: number, heal: number, prop: FoodProp, yum: string, buff?: [number, number]): ShopItem =>
  ({ id, label, cost, kind: "food", heal, prop, yum, value: buff?.[0], duration: buff?.[1],
    note: `+${heal} health${buff ? `, +${Math.round(buff[0] * 100)}% sprint for ${buff[1] >= 120 ? `${buff[1] / 60} min` : `${buff[1]} s`}` : ""}` });

/** What the carts sell (by goods); the sabzi cart has nothing to eat on the spot. */
export const REHRI_FOOD: Record<string, { name: string; greeting: string; items: ShopItem[] }> = {
  chaat: {
    name: "Gol-gappe di rehri", greeting: "Gol gappe, tikki, papdi chaat — khatta ya meetha?",
    items: [
      F("golgappe", "Gol gappe (6, with imli pani)", 20, 12, "dona", "Sii-haa! Teekha ae, par swaad ae!"),
      F("tikki", "Aloo tikki chaat", 30, 20, "dona", "Garam garam tikki, dahi te chutney naal!"),
      F("papdi", "Papdi chaat", 30, 18, "dona", "Wah, dahi bhalla vargi!"),
    ],
  },
  ganna: {
    name: "Ganne da ras", greeting: "Taaza ras, nimbu-adrak paa ke!",
    items: [F("rasglass", "Ganne da ras (glass)", 20, 10, "glass", "Thanda thanda, jaan aa gayi!", [0.2, 90])],
  },
  fruit: {
    name: "Phal di rehri", greeting: "Kinnow, kela, amrood — mitthe ne!",
    items: [
      F("kela", "Banana", 10, 6, "fruit", "Kela kha ke chaal tez!", [0.1, 60]),
      F("amrood", "Amrood with chaat masala", 15, 8, "fruit", "Kurkura te namkeen!"),
    ],
  },
};

/** Something to carry home: it goes in your bag (B) and can be given to someone as a gift. */
const G = (id: string, label: string, cost: number): ShopItem =>
  ({ id, label, cost, kind: "goods", note: "Goes in your bag (B) — give it to someone" });
/** A packet to eat later, from the bag. */
const P = (id: string, label: string, cost: number, heal: number, prop: FoodProp, yum: string): ShopItem =>
  ({ id, label, cost, kind: "goods", snack: true, heal, prop, yum, note: `Goes in your bag (B) — eat it later, +${heal} health` });

const C = (id: string, label: string, part: ShopItem["part"], color: string, cost: number): ShopItem =>
  ({ id, label, cost, kind: "outfit", part, color, note: "Changes your look — saved with your game" });

/** Kiryana goods at today's prices. */
const KIRYANA: ShopItem[] = [
  G("atta", "Chakki atta, 10 kg bag", 420), G("dal", "Arhar dal, 1 kg", 160), G("ghee", "Desi ghee, 1 litre tin", 650),
  G("tel", "Kachi ghani sarson da tel, 1 litre", 185), G("cheeni", "Cheeni, 1 kg", 46), G("chaipatti", "Chai patti, 250 g", 130),
  P("biscuit", "Biscuit packet", 10, 5, "dona", "Chai naal biscuit — bachpan yaad aa gaya!"),
  P("bhujia", "Namkeen bhujia, 200 g", 55, 8, "dona", "Kurkuri bhujia!"),
  P("colddrink", "Cold drink, 250 ml", 20, 6, "glass", "Thandi thandi — garmi gaayab!"),
];
/** Mobile accessories. */
const MOBILE: ShopItem[] = [
  G("cover", "Phone cover (Punjabi print)", 199), G("guard", "Tempered glass screen guard", 99), G("earphones", "Earphones with mic", 299),
  G("charger", "Fast charger with cable", 449), G("powerbank", "Power bank, 10000 mAh", 999),
];
/** Cloth: suits, khes and Ludhiana woollens. */
const CLOTH: ShopItem[] = [
  G("suitcloth", "Unstitched cotton suit (3 piece)", 850), G("pagg", "Mulmul turban cloth, 5 m", 350), G("parna", "Cotton parna", 120),
  G("khes", "Handloom khes", 650), G("shawl", "Woollen shawl (Ludhiana)", 1200), G("sweater", "Knitted sweater", 750), G("socks", "Woollen socks, 3 pairs", 150),
];

export const SHOPS: ShopDef[] = [
  {
    keeper: "cook", name: "Bhole Da Dhaba kitchen", greeting: "Garam chai, thandi lassi!",
    items: [
      F("parantha", "Aloo parantha, makhan te dahi", 60, 40, "thali", "Makhan wala parantha — rooh khush ho gayi!", [0.1, 120]),
      F("chole", "Chole bhature", 70, 50, "thali", "Bhature phulle hoye, chole teekhe — wah!"),
      F("saag", "Makki di roti, sarson da saag", 80, 60, "thali", "Saag te makki — asli Punjab!", [0.15, 120]),
      F("thali", "Dal makhani, roti, salad", 70, 55, "thali", "Ghar varga khana!"),
      F("lassi", "Sweet lassi (with malai)", 50, 15, "glass", "Malai maar ke lassi — ah!", [0.3, 120]),
      F("chai", "Cutting chai", 15, 5, "kulhad", "Kadak chai!", [0.1, 60]),
    ],
  },
  {
    keeper: "keeper_kiryana", name: "Lali General Store", greeting: "Atta, dal, ghee — and snacks for couriers!",
    items: [
      F("chana", "Bhuna chana (snack)", 15, 8, "dona", "Kurkure chane!", [0.15, 90]),
      ...KIRYANA,
      { id: "wrap", label: "Tiffin wrap cloth", cost: 60, kind: "perk", note: "Permanent: −25% food spills" },
    ],
  },
  {
    keeper: "keeper_sweets", name: "Mithi Hatti", greeting: "Garam jalebi, fresh pinni!",
    items: [
      F("jalebi", "Garam jalebi", 30, 10, "jalebi", "Garam jalebi, ras naal bhari!", [0.25, 90]),
      F("samosa", "Samosa with chutney", 15, 15, "dona", "Garam samosa — mooh sarr gaya, par mazaa aa gaya!"),
      F("gulabjamun", "Gulab jamun (2)", 25, 12, "dona", "Mitthe gulab jamun!", [0.1, 60]),
      F("kulfi", "Matka kulfi", 30, 10, "kulfi", "Thandi kulfi — garmi gaayab!"),
      { ...P("laddoo", "Desi ghee laddoo (dabba)", 80, 5, "dona", "Ghee wala laddoo! Hun ud sakda ae!"), power: true, note: "Goes in your bag (B) — eat it for thirty seconds of superpowers" },
      { id: "pinni", label: "Pinni for the customer", cost: 40, kind: "warmth", value: 15, note: "+15 s food warmth on your next delivery" },
    ],
  },
  {
    keeper: "pammi", name: "Pammi Fruit & Sabzi", greeting: "Kinnow from Abohar, sweet as gur!",
    items: [
      { id: "kinnow", label: "Kinnow", cost: 20, kind: "warmth", value: 10, note: "+10 s food warmth on your next delivery" },
      F("banana", "Banana", 10, 6, "fruit", "Kela kha ke chaal tez!", [0.1, 60]),
    ],
  },
  {
    keeper: "chemist", name: "Sehat Chemist", greeting: "Stay hydrated, puttar.",
    items: [
      { id: "glucose", label: "Glucose drink", cost: 25, kind: "buff", value: 0.2, duration: 120, note: "+20% sprint speed for 2 min" },
      { id: "firstaid", label: "First-aid kit", cost: 80, kind: "perk", note: "Permanent: hard landings on foot never spill the food" },
    ],
  },
  {
    keeper: "keeper_phone", name: "Ranggarh Mobile", greeting: "Recharge? Covers? Screen guard?",
    items: [
      { id: "data", label: "Data recharge (customers can find you)", cost: 49, kind: "perk", note: "Permanent: customers tip +10%" },
      ...MOBILE,
    ],
  },
  {
    keeper: "keeper_hardware", name: "Dhillon Hardware", greeting: "Paints, pipes, tools — what do you need?",
    items: [
      { id: "bungee", label: "Bungee cords for your rack", cost: 90, kind: "perk", note: "Permanent: −50% food spills while riding" },
    ],
  },
  {
    keeper: "sohal", name: "Sohal Cycle Store", greeting: "A good chain and a good heart!",
    items: [
      { id: "bell", label: "Brass cycle bell for your scooter", cost: 30, kind: "perk", note: "Your scooter horn becomes a cheerful bell (residents still move)" },
    ],
  },
  {
    keeper: "keeper_textile", name: "Kapda Ghar", greeting: "Suits, dupattas, turbans — colours of Punjab!",
    items: [
      C("head_saffron", "Saffron turban / patka", "head", "#ef8f1b", 80),
      C("head_royal", "Royal blue turban / patka", "head", "#1f3b73", 80),
      C("head_pink", "Rani pink turban / patka", "head", "#d81b60", 80),
      C("drape_phulkari", "Phulkari dupatta", "drape", "#f2a01e", 90),
      C("drape_green", "Parrot-green dupatta", "drape", "#7cb342", 90),
      ...CLOTH,
    ],
  },
  {
    keeper: "masterji", name: "Masterji Tailors", greeting: "Measure twice, cut once!",
    items: [
      C("top_white", "Crisp white kurta / kameez", "top", "#f4efe3", 150),
      C("top_maroon", "Maroon kurta / kameez", "top", "#7b1f2f", 150),
      C("top_mustard", "Mustard-field kurta / kameez", "top", "#e0a92a", 150),
      C("bottom_navy", "Navy pajama / salwar", "bottom", "#2c3e64", 120),
    ],
  },
];

/**
 * What the signed shops of Nawan Shehar and Ludhiana sell, by their sign.
 * Their keepers stand behind the counter (see cityShops); a sign not listed
 * here (tyres, salon, hotel, machine tools) has no menu.
 */
export const TRADE: Record<string, { name: string; greeting: string; items: ShopItem[] }> = {
  cMithai: { name: "Khurana Mithai Bhandar", greeting: "Garam jalebi, taazi pinni — dabba pack karaan?", items: [
    F("jalebi", "Garam jalebi", 30, 10, "jalebi", "Garam jalebi, ras naal bhari!", [0.25, 90]),
    F("samosa", "Samosa with chutney", 15, 15, "dona", "Garam samosa — mooh sarr gaya, par mazaa aa gaya!"),
    F("gulabjamun", "Gulab jamun (2)", 25, 12, "dona", "Mitthe gulab jamun!", [0.1, 60]),
    G("pinnibox", "Pinni, 1 kg box", 480), G("kajubox", "Kaju katli, 500 g box", 550), G("ladoo", "Besan ladoo, 1 kg box", 420),
  ] },
  cMobile: { name: "Hello Mobile Zone", greeting: "Cover, charger, recharge — sab milda!", items: MOBILE },
  cCloth: { name: "Punjab Cloth House", greeting: "Suit, pagg, khes — rang hi rang!", items: [...CLOTH.slice(0, 4),
    C("drape_phulkari", "Phulkari dupatta", "drape", "#f2a01e", 90), C("head_royal", "Royal blue turban / patka", "head", "#1f3b73", 80)] },
  lHosiery: { name: "Sharma Hosiery", greeting: "Ludhiane di hosiery — export quality!", items: [CLOTH[5]!, CLOTH[6]!, G("vest", "Cotton baniyan, 2 pack", 180), G("thermal", "Thermal inner set", 450)] },
  lKnit: { name: "Punjab Knitwear", greeting: "Haath da bunneya sweater, pure wool!", items: [CLOTH[5]!, G("cardigan", "Cardigan", 950), G("muffler", "Woollen muffler", 250), CLOTH[6]!] },
  lShawl: { name: "Chaura Bazaar Shawl Ghar", greeting: "Shawl, loi, khes — sardi aun waali ae!", items: [CLOTH[4]!, G("loi", "Woollen loi (men's shawl)", 1500), CLOTH[3]!, C("drape_phulkari", "Phulkari dupatta", "drape", "#f2a01e", 90)] },
  cLassi: { name: "Malai Lassi Corner", greeting: "Malai maar ke lassi, ik glass ya do?", items: [
    F("lassi", "Sweet lassi (with malai)", 50, 15, "glass", "Malai maar ke lassi — ah!", [0.3, 120]),
    F("namkeenlassi", "Namkeen lassi", 40, 12, "glass", "Jeera paa ke — pet theek!"),
    F("kulfi", "Matka kulfi", 30, 10, "kulfi", "Thandi kulfi — garmi gaayab!"),
  ] },
  cDhaba: { name: "Pehlwan Dhaba", greeting: "Tandoori roti, dal makhani — baitho ji!", items: [
    F("thali", "Dal makhani, roti, salad", 70, 55, "thali", "Ghar varga khana!"),
    F("parantha", "Aloo parantha, makhan te dahi", 60, 40, "thali", "Makhan wala parantha — rooh khush ho gayi!", [0.1, 120]),
    F("chai", "Cutting chai", 15, 5, "kulhad", "Kadak chai!", [0.1, 60]),
  ] },
  cMedical: { name: "Jeevan Medical Hall", greeting: "Dawai, ORS, bandage — dasso ji.", items: [
    { id: "glucose", label: "Glucose drink", cost: 25, kind: "buff", value: 0.2, duration: 120, note: "+20% sprint speed for 2 min" },
    F("ors", "ORS packet in water", 22, 20, "glass", "Namkeen paani — jaan aa gayi!"),
    G("balm", "Pain balm", 45), G("bandage", "Crepe bandage", 120),
  ] },
  cElectro: { name: "Lucky Electronics", greeting: "Pankha, press, LED — guarantee naal!", items: [
    G("led", "LED bulb, 9 W", 99), G("press", "Electric iron (press)", 750), G("fan", "Table fan", 1450), G("torch", "Rechargeable torch", 299),
  ] },
  cJewel: { name: "Sona Jewellers", greeting: "Kara, mundri, jhumke — shuddh chaandi!", items: [
    G("kara", "Steel kara", 150), G("silverkara", "Silver kara", 2200), G("jhumke", "Silver jhumke", 1800),
  ] },
  cBooks: { name: "Vidya Book Depot", greeting: "Kaapi, pen, akhbaar — sab ethe!", items: [
    G("akhbaar", "Punjabi akhbaar (today's paper)", 5), G("copy", "Notebook, 200 pages", 60), G("kaida", "Gurmukhi kaida", 60), G("pens", "Pens, 5 pack", 50),
  ] },
};

/** Every goods item, by id (for the bag). */
export function goodsItem(id: string): ShopItem | undefined {
  for (const it of [...SHOPS, ...Object.values(TRADE)].flatMap((q) => q.items)) if (it.id === id && it.kind === "goods") return it;
  return undefined;
}
