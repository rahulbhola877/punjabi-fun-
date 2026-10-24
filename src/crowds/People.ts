/**
 * The people who know the family. A resident def with a `known` tie is one of
 * them: a neighbour, a shop owner, a constable, an auto-wala. The registry
 * keeps one small file per person (how often you have met, how they feel
 * about you, which day you last met and which day they last gave you
 * something), saved with the game, and writes their greetings: by name, by
 * the time of day, and by how warm they are towards you.
 */

/** What a person is to the family; set on the resident def. */
export interface Known {
  /** In a few words: "Papa ji's old friend", "Mummy ji's sakhi from the gurdwara". */
  tie: string;
  /** The family member they ask after once they are friendly: "Papa ji", "Mummy ji", "Bebe ji" or "Simran". */
  asks?: string;
  /** Goods id they hand you (once a day) when they are a friend. */
  gift?: string;
}

export type Tier = "cold" | "known" | "friend" | "family";

export interface PersonFile {
  /** How warm they are: below 0 cold, 5 friend, 12 family. */
  rep: number;
  /** Meetings so far. */
  met: number;
  /** The game day of the last meeting that warmed them, and of the last gift (-1 = never). */
  day: number;
  gifted: number;
  /** Who they are, kept so the list of people can be shown without them being near. */
  name?: string;
  tie?: string;
}

export const FRIEND_AT = 5;
export const FAMILY_AT = 12;
const REP_MIN = -10, REP_MAX = 30;

export type Pick = (n: number) => number;

const LINES: Record<Tier, Record<"morning" | "day" | "evening" | "night", string[]>> = {
  cold: {
    morning: ["Hmph. {h}? Bol, ki chahida?", "Oye {h}, pichhli gall main bhulli nahi."],
    day: ["Hmph. {h}? Bol, ki chahida?", "Door hi rah {h}. Mood theek nahi.", "Oye {h}, pichhli gall main bhulli nahi."],
    evening: ["Hmph. Hun aaya ae? {h}, ghar jaa.", "Door hi rah {h}. Mood theek nahi."],
    night: ["Eni raat gaye {h}? Jaa ghar nu.", "Hmph. Raat nu vi chain nahi?"],
  },
  known: {
    morning: ["Sat Sri Akal {h}! Subah subah kithe chalya?", "Oye {h}, ajj jaldi uth gaya? Chah pee layi?", "Rab rakha {h} puttar! Din changa lang jaave."],
    day: ["Sat Sri Akal {h}! Kamm kaar kiwen chalda?", "Haanji {h}, sab theek-thaak? Garmi bahut ae ajj.", "Oye {h}! Kithon di aa rahi ae savaari?"],
    evening: ["Sat Sri Akal {h}! Hanera hon waala, ghar nu chal.", "Rab rakha {h}, ajj da din kiwen laga?", "Oye {h}, Mummy ji udeek dendi hongi."],
    night: ["Eni raat gaye kithe {h}? Dhyaan naal.", "Oye {h}! Raat nu bahar? Jaldi ghar jaa."],
  },
  friend: {
    morning: ["Aa gaya mera sher {h}! Baith, chah pee ke ja.", "Oye {h}! Tainu vekh ke din ban gaya."],
    day: ["Aa gaya mera sher {h}! Baith, chah pee ke ja.", "Oye {h}! Tainu vekh ke din ban gaya.", "{h} puttar, tu taan sadda apna hi ae."],
    evening: ["Aa {h}, baith jara. Din bhar di thakaan lah ja.", "{h} puttar, tu taan sadda apna hi ae."],
    night: ["Oye {h}! Inni raat? Aa, andar aa ja.", "{h}, raat bahut ho gayi, dhyaan naal ja."],
  },
  family: {
    morning: ["{h} puttar! Tu taan ghar da bacha ae. Chal, chah-paani karde haan.", "Oye wah {h}! Rabb tainu chadhdi kala vich rakhe."],
    day: ["Oye wah {h}! Rabb tainu chadhdi kala vich rakhe.", "Aa jaa {h}! Tere bina gali sooni lagdi si."],
    evening: ["{h} puttar! Tu taan ghar da bacha ae. Aa, roti kha ke jaayin.", "Aa jaa {h}! Tere bina gali sooni lagdi si."],
    night: ["{h} puttar, inni raat? Aa, andar so ja ajj.", "Oye {h}! Rabb rakha, ghar pahunch ke dass dayin."],
  },
};

const ASK: Record<string, string> = {
  "Papa ji": "Papa ji theek ne?",
  "Mummy ji": "Mummy ji nu meri Sat Sri Akal dassi.",
  "Bebe ji": "Bebe ji di tabiyat kiwen ae?",
  Simran: "Simran padhai kardi ae ke nahi?",
};

const GIFT_SAY: Record<string, string> = {
  biscuit: "Lai puttar, biscuit da packet rakh lai, chah naal kam aaunda.",
  bhujia: "Lai, namkeen rakh lai. Raste ch chabbi jaaiye.",
  colddrink: "Lai, thandi botal. Garmi bahut ae, ruk ke pee layi.",
};

export function partOfDay(hour: number): "morning" | "day" | "evening" | "night" {
  if (hour >= 5 && hour < 12) return "morning";
  if (hour >= 12 && hour < 17) return "day";
  if (hour >= 17 && hour < 21.5) return "evening";
  return "night";
}

export class People {
  files: Record<string, PersonFile> = {};

  constructor(saved?: Record<string, PersonFile>) {
    if (saved) for (const [id, f] of Object.entries(saved)) this.files[id] = { ...f };
  }

  file(id: string): PersonFile {
    return (this.files[id] ??= { rep: 0, met: 0, day: -1, gifted: -1 });
  }

  /** Remember who they are (set when you meet or please them). */
  label(id: string, name: string, tie: string): void {
    const f = this.file(id);
    f.name = name;
    f.tie = tie;
  }

  /** Everyone you have met or who has an opinion of you, warmest first. */
  list(): Array<{ id: string; name: string; tie: string; tier: Tier; rep: number; met: number }> {
    return Object.entries(this.files)
      .filter(([, f]) => f.name && (f.met > 0 || f.rep !== 0))
      .map(([id, f]) => ({ id, name: f.name!, tie: f.tie ?? "", tier: this.tier(id), rep: f.rep, met: f.met }))
      .sort((a, b) => b.rep - a.rep || (a.name < b.name ? -1 : 1));
  }

  tier(id: string): Tier {
    const r = this.files[id]?.rep ?? 0;
    return r < 0 ? "cold" : r >= FAMILY_AT ? "family" : r >= FRIEND_AT ? "friend" : "known";
  }

  /** Change how warm someone is. Says whether that moved them to another tier. */
  bump(id: string, delta: number): { tier: Tier; moved: boolean } {
    const before = this.tier(id);
    const f = this.file(id);
    f.rep = Math.max(REP_MIN, Math.min(REP_MAX, Math.round((f.rep + delta) * 100) / 100));
    const tier = this.tier(id);
    return { tier, moved: tier !== before };
  }

  /** You stopped and said Sat Sri Akal: counted, and the first meeting of a game day warms them a little. */
  meet(id: string, day: number): { tier: Tier; moved: boolean } {
    const f = this.file(id);
    f.met++;
    if (f.day === day) return { tier: this.tier(id), moved: false };
    f.day = day;
    return this.bump(id, 0.5);
  }

  /** What they say when you meet: by name, by the hour, by how warm they are. Friends ask after the family. */
  greet(id: string, k: Known, hero: string, hour: number, pick: Pick): string {
    const tier = this.tier(id);
    const list = LINES[tier][partOfDay(hour)];
    let line = list[pick(list.length)]!.replace(/\{h\}/g, hero);
    if ((tier === "friend" || tier === "family") && k.asks && ASK[k.asks]) line += " " + ASK[k.asks];
    return line;
  }

  /** A friend hands you something, once a game day. */
  giftToday(id: string, k: Known, day: number): { item: string; say: string } | null {
    if (!k.gift || this.tier(id) === "cold" || this.tier(id) === "known") return null;
    const f = this.file(id);
    if (f.gifted === day) return null;
    f.gifted = day;
    return { item: k.gift, say: GIFT_SAY[k.gift] ?? "Lai puttar, eh rakh lai." };
  }

  /** The line shown when someone becomes a friend (or family), or goes cold. */
  static tierNote(name: string, tier: Tier): string {
    return tier === "friend" ? `${name} ajj ton tera yaar ban gaya.`
      : tier === "family" ? `${name} tainu apna samajhda ae, ghar da bacha.`
      : tier === "cold" ? `${name} tere naal naraaz ae.`
      : `${name} te sab theek ae.`;
  }

  /** For the save: rounded, and only people who matter. */
  toJSON(): Record<string, PersonFile> {
    const out: Record<string, PersonFile> = {};
    for (const [id, f] of Object.entries(this.files)) {
      if (f.met === 0 && f.rep === 0 && f.gifted < 0) continue;
      out[id] = { rep: Math.round(f.rep * 100) / 100, met: f.met, day: f.day, gifted: f.gifted, ...(f.name ? { name: f.name, tie: f.tie } : {}) };
    }
    return out;
  }
}
