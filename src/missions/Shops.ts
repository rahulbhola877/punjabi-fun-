/** Things residents sell. Effects are applied by the game (see Game.buy). */
export type ItemKind = "buff" | "warmth" | "perk" | "outfit";

export interface ShopItem {
  id: string;
  label: string;
  cost: number;
  kind: ItemKind;
  note: string;
  /** buff: sprint multiplier bonus and duration (s); warmth: seconds. */
  value?: number;
  duration?: number;
  /** outfit: which part and colour. */
  part?: "top" | "head" | "drape" | "bottom";
  color?: string;
}

export interface ShopDef { keeper: string; name: string; greeting: string; items: ShopItem[] }

const C = (id: string, label: string, part: ShopItem["part"], color: string, cost: number): ShopItem =>
  ({ id, label, cost, kind: "outfit", part, color, note: "Changes your look — saved with your game" });

export const SHOPS: ShopDef[] = [
  {
    keeper: "cook", name: "Bhole Da Dhaba kitchen", greeting: "Garam chai, thandi lassi!",
    items: [
      { id: "lassi", label: "Sweet lassi", cost: 50, kind: "buff", value: 0.3, duration: 120, note: "+30% sprint speed for 2 min" },
      { id: "chai", label: "Cutting chai", cost: 15, kind: "buff", value: 0.1, duration: 60, note: "+10% sprint speed for 60 s" },
    ],
  },
  {
    keeper: "keeper_kiryana", name: "Lali General Store", greeting: "Atta, dal, ghee — and snacks for couriers!",
    items: [
      { id: "chana", label: "Bhuna chana (snack)", cost: 15, kind: "buff", value: 0.15, duration: 90, note: "+15% sprint speed for 90 s" },
      { id: "wrap", label: "Tiffin wrap cloth", cost: 60, kind: "perk", note: "Permanent: −25% food spills" },
    ],
  },
  {
    keeper: "keeper_sweets", name: "Mithi Hatti", greeting: "Garam jalebi, fresh pinni!",
    items: [
      { id: "jalebi", label: "Jalebi", cost: 30, kind: "buff", value: 0.25, duration: 90, note: "Sugar rush: +25% sprint speed for 90 s" },
      { id: "pinni", label: "Pinni for the customer", cost: 40, kind: "warmth", value: 15, note: "+15 s food warmth on your next delivery" },
    ],
  },
  {
    keeper: "pammi", name: "Pammi Fruit & Sabzi", greeting: "Kinnow from Abohar, sweet as gur!",
    items: [
      { id: "kinnow", label: "Kinnow", cost: 20, kind: "warmth", value: 10, note: "+10 s food warmth on your next delivery" },
      { id: "banana", label: "Banana", cost: 10, kind: "buff", value: 0.1, duration: 60, note: "+10% sprint speed for 60 s" },
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
