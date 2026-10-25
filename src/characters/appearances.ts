import type { KitLook } from "./KitHuman";
import { STOCKY } from "../kit/rig";
import { Rng } from "../render/textures";
import type { Appearance } from "./HumanBuilder";

export const SKIN_TONES = ["#e9bd98", "#dba57f", "#c98c64", "#b67651", "#9e6343", "#835036"];

/** Named residents. All characters, names and looks are original. */
export const NAMED: Record<string, Appearance> = {
  bhola: {
    sex: "m", height: 1.74, build: 1.25, skin: "#c98c64", age: "adult", top: "kurta", topColor: "#f4efe3", topTrim: "#e2d6bd",
    sleeves: "long", bottom: "pajama", bottomColor: "#ede7da", headwear: "turban", headColor: "#1f3b73", hair: "short",
    hairColor: "#2a211b", beard: "full", shoes: "jutti", shoeColor: "#6b3a1e", apron: "#c0392b", kara: true,
  },
  gurnam: {
    sex: "f", height: 1.66, build: 1.05, skin: "#b67651", age: "adult", top: "shirt", topColor: "#2f4f6f", sleeves: "short",
    bottom: "trousers", bottomColor: "#3b3f45", headwear: "none", hair: "bun", hairColor: "#17110d", beard: "none",
    shoes: "sneaker", shoeColor: "#5d4037", kara: true,
  },
  pammi: {
    sex: "f", height: 1.6, build: 1.12, skin: "#c98c64", age: "adult", top: "kameez", topColor: "#b0216a", topTrim: "#f2c94c",
    sleeves: "long", bottom: "salwar", bottomColor: "#f2c94c", headwear: "none", hair: "braid", hairColor: "#1b120c",
    beard: "none", dupatta: "#f2c94c", shoes: "jutti", shoeColor: "#a33b20",
  },
  masterji: {
    sex: "m", height: 1.68, build: 0.92, skin: "#dba57f", age: "elder", top: "vest", vest: "#5d4037", topColor: "#f0ead8",
    sleeves: "long", bottom: "pajama", bottomColor: "#ece6d6", headwear: "none", hair: "short", hairColor: "#bdb8b0",
    beard: "mustache", tape: "#e6c229", shoes: "chappal", shoeColor: "#3e2723",
  },
  sohal: {
    sex: "m", height: 1.8, build: 1.0, skin: "#b67651", age: "adult", top: "tshirt", topColor: "#c62828", sleeves: "short",
    bottom: "jeans", bottomColor: "#2c3e64", headwear: "turban", headColor: "#f57c00", hair: "short", hairColor: "#1b120c",
    beard: "full", shoes: "sneaker", shoeColor: "#eeeeee", kara: true,
  },
};

/** Selectable player looks. */
export const PLAYER_LOOKS: Array<{ id: string; label: string; blurb: string; look: Appearance; kit: KitLook }> = [
  {
    id: "jaggi", label: "Jaggi — red dastar, kurta, vest and jeans",
    blurb: "Ranggarh born, Bullet-mad, never says no to a sawari.",
    kit: { archetype: "male", outfit: "sardaar", colors: { skin: "#c68a5a" }, build: STOCKY },
    look: {
      sex: "m", height: 1.78, build: 1.02, skin: "#b67651", age: "adult", top: "shirt", topColor: "#e9e4d8", sleeves: "long",
      bottom: "jeans", bottomColor: "#2f4a72", headwear: "turban", headColor: "#ef8f1b", hair: "short", hairColor: "#18110c",
      beard: "full", shoes: "sneaker", shoeColor: "#d9d9d9", kara: true,
    },
  },
  {
    id: "rinku", label: "Rinku — hoodie and jeans",
    blurb: "Delivery boy with big plans and a bigger mouth.",
    kit: { archetype: "male", outfit: "street_casual", colors: { skin: "#c68a5a", top: "#3f7d4f" } },
    look: {
      sex: "m", height: 1.72, build: 0.95, skin: "#dba57f", age: "adult", top: "kurta", topColor: "#3f7d4f", topTrim: "#2f5e3b",
      sleeves: "long", bottom: "pajama", bottomColor: "#f1ece0", headwear: "none", hair: "short", hairColor: "#22180f",
      beard: "stubble", shoes: "jutti", shoeColor: "#5a2d16",
    },
  },
];

const KURTA = ["#f4efe3", "#d9e4ef", "#e9d8a6", "#c8d6c0", "#efe2d0", "#bcd2e8", "#f0d9c4", "#c9b6d9"];
const SUIT = ["#b0216a", "#e65100", "#00897b", "#6a1b9a", "#c62828", "#1565c0", "#f9a825", "#2e7d32", "#ad1457", "#5d4037"];
const TURBAN = ["#1f3b73", "#ef8f1b", "#c62828", "#f3f3f3", "#111111", "#6a1b9a", "#00695c", "#d81b60", "#f9a825", "#3949ab"];
const PANTS = ["#2c3e64", "#3b3f45", "#5d4e3a", "#2f4a72", "#4a4a4a", "#6d5c46"];
const TEE = ["#c62828", "#283593", "#2e7d32", "#f9a825", "#6d4c41", "#455a64", "#ad1457", "#ffffff"];

/** Generates a varied, plausible bazaar resident. */
export function randomAppearance(seed: number): Appearance {
  const r = new Rng(seed);
  const f = r.next() < 0.45;
  const ageRoll = r.next();
  const age: Appearance["age"] = ageRoll < 0.12 ? "child" : ageRoll < 0.3 ? "elder" : "adult";
  const height = age === "child" ? r.range(1.15, 1.4) : f ? r.range(1.52, 1.7) : r.range(1.64, 1.86);
  const build = age === "child" ? r.range(0.85, 1.0) : r.range(0.86, 1.28);
  const skin = r.pick(SKIN_TONES);
  const greyHair = age === "elder" ? r.pick(["#cfcac2", "#9e9890", "#e8e4dc"]) : r.pick(["#16100b", "#22180f", "#2e2116", "#3a2a1c"]);
  if (f) {
    const traditional = r.next() < 0.72;
    const suit = r.pick(SUIT);
    return {
      sex: "f", height, build, skin, age, sleeves: traditional ? "long" : r.next() < 0.5 ? "short" : "long",
      top: traditional ? "kameez" : r.next() < 0.5 ? "tshirt" : "shirt",
      topColor: traditional ? suit : r.pick(TEE), topTrim: r.pick(["#f5d06f", "#ffffff", "#e0a96d", suit]),
      bottom: traditional ? "salwar" : "jeans", bottomColor: traditional ? r.pick(["#f6efe0", suit, "#f2c94c", "#d7ccc8"]) : r.pick(PANTS),
      headwear: "none", hair: r.pick(["braid", "bun", "long"] as const), hairColor: greyHair, beard: "none",
      dupatta: traditional || r.next() < 0.2 ? r.pick(["#f28c28", "#f2c94c", "#ffffff", "#e91e63", "#4fc3f7", "#aed581"]) : undefined,
      shoes: r.pick(["jutti", "chappal", "sneaker"] as const), shoeColor: r.pick(["#8e2b1f", "#3e2723", "#d4a52a", "#212121"]),
    };
  }
  const sikh = r.next() < 0.62;
  const traditional = r.next() < 0.6;
  const kids = age === "child";
  return {
    sex: "m", height, build, skin, age,
    top: traditional ? (r.next() < 0.25 ? "vest" : "kurta") : r.pick(["shirt", "tshirt"] as const),
    topColor: traditional ? r.pick(KURTA) : r.pick(TEE), vest: r.pick(["#5d4037", "#263238", "#4e342e", "#1b5e20"]),
    sleeves: traditional ? "long" : r.next() < 0.5 ? "short" : "long",
    bottom: traditional ? "pajama" : r.pick(["jeans", "trousers"] as const),
    bottomColor: traditional ? r.pick(["#f1ece0", "#e8e2d4", "#ddd6c6"]) : r.pick(PANTS),
    headwear: sikh ? (kids ? "patka" : "turban") : r.next() < 0.15 ? "cap" : "none", headColor: r.pick(TURBAN),
    hair: age === "elder" && !sikh && r.next() < 0.4 ? "bald" : "short", hairColor: greyHair,
    beard: kids ? "none" : sikh ? "full" : r.pick(["mustache", "stubble", "none", "mustache"] as const),
    shoes: r.pick(["jutti", "chappal", "sneaker"] as const), shoeColor: r.pick(["#5a2d16", "#3e2723", "#212121", "#795548"]),
    kara: sikh,
  };
}

/** A Punjab Police constable: khaki, turban, lathi-ready. */
export function constableLook(seed: number): Appearance {
  return { ...randomAppearance(3000 + seed * 7), sex: "m", age: "adult", top: "shirt", topColor: "#b59a62", topTrim: "#b59a62", sleeves: "short", bottom: "trousers", bottomColor: "#a88c58", headwear: "turban", headColor: seed % 2 ? "#1a237e" : "#b71c1c", beard: "full", shoes: "sneaker", shoeColor: "#212121", height: 1.78, build: 1.15, dupatta: undefined };
}
