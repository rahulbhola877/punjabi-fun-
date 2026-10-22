/** Things residents sell. Effects are applied by the game (see Game.buy). */
export type ItemKind = "buff" | "warmth" | "perk" | "outfit" | "food";

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

const C = (id: string, label: string, part: ShopItem["part"], color: string, cost: number): ShopItem =>
  ({ id, label, cost, kind: "outfit", part, color, note: "Changes your look — saved with your game" });

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
