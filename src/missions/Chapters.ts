/**
 * The story spine: four chapters, each a short list of things to do that the game can see for itself. Nothing here
 * is a script. A step is done when the state of the game says so (the intro finished, three tiffins served, a flag
 * the game raised when you reached a place or won a match), so a player who does the steps in a different order,
 * or did one long ago, loses nothing. A chapter is done when all its steps are, and pays once.
 */

export interface ChapterCtx {
  introStage: number;
  deliveries: number;
  tiffins: number;
  flags: Record<string, boolean>;
  home: Record<string, number>;
  rides: number;
  dangalWins: number;
  upgrades: number;
  feesPaid: number;
}

/** Where a step points the objective marker. */
export type StepTarget = { poi: string } | { resident: string } | { x: number; z: number } | null;

export interface Step { id: string; text: string; hint: string; done(c: ChapterCtx): boolean; target: StepTarget }

export interface Chapter {
  id: string;
  n: number;
  title: string;
  subtitle: string;
  blurb: string;
  steps: Step[];
  reward: { money: number; rep: number };
  /** What is said when it ends. */
  endLine: string;
  /** Not playable yet: shown, with its blurb, as coming. */
  locked?: boolean;
}

export const CHAPTERS: Chapter[] = [
  {
    id: "ch1", n: 1, title: "Pehla din", subtitle: "The first day",
    blurb: "The family, the Bullet, Mummy ji's tiffins and Bhola's first errand. It ends with Bebe ji's blessing.",
    reward: { money: 500, rep: 10 },
    endLine: "Bebe ji: Jeonda reh, puttar. Pehla din hi sohna gaya. Waheguru tainu chadhdi kala vich rakhe.",
    steps: [
      { id: "bless", text: "Touch Bebe ji's feet for her ashirwad", hint: "At home, Bebe ji sits by the sofa.", done: (c) => c.home.bless !== undefined, target: { resident: "home_bebe" } },
      { id: "intro", text: "Ride to Ludhiana for Bhola's new phone and bring it back", hint: "Bhola is at Bhole Da Dhaba in Ranggarh bazaar.", done: (c) => c.introStage >= 999, target: { poi: "dhabaCounter" } },
      { id: "tiffins", text: "Deliver three of Mummy ji's tiffins", hint: "Mummy ji hands them out at home between ten and one.", done: (c) => c.tiffins >= 3, target: { resident: "home_mummy" } },
      { id: "dinner", text: "Come home and eat dinner with the family", hint: "Mummy ji calls from half past seven.", done: (c) => c.home.meal2 !== undefined, target: { resident: "home_mummy" } },
    ],
  },
  {
    id: "ch2", n: 2, title: "Ludhiana", subtitle: "The big city",
    blurb: "Ghanta Ghar, Chaura Bazaar, a service for the Bullet, the rail crossing, and your first auto.",
    reward: { money: 800, rep: 12 },
    endLine: "Gurnam: Ludhiane di sadak nu jaan gaya ae ni tu? Hun kise nu bhi ditta jaa sakda ae lift.",
    steps: [
      { id: "chowk", text: "Ride to Ghanta Ghar chowk, Ludhiana", hint: "West along the G.T. Road, then into the city.", done: (c) => !!c.flags.v_ludhChowk, target: { x: -468, z: -266 } },
      { id: "bazaar", text: "Walk through Chaura Bazaar", hint: "The two galis behind the clock tower.", done: (c) => !!c.flags.v_ludhBazaar, target: { x: -415, z: -245 } },
      { id: "service", text: "Have the Bullet serviced: buy an upgrade or paint at Gurnam's", hint: "Gurnam Motor Works is on the bazaar's east side.", done: (c) => c.upgrades >= 1, target: { poi: "workshop" } },
      { id: "rail", text: "Cross the railway on the Kotli road", hint: "The phatak is south of the canal. Wait if the gates are down.", done: (c) => !!c.flags.c_rail, target: { x: 0, z: 560 } },
      { id: "auto", text: "Carry your first sawari in an auto", hint: "Take an auto from a stand and pick up a passenger.", done: (c) => c.rides >= 1, target: null },
    ],
  },
  {
    id: "ch3", n: 3, title: "Mela", subtitle: "The year of festivals",
    blurb: "Lohri, a dangal, tape-ball cricket in the gali, Simran's fees, and the kabaddi cup at the Baisakhi mela.",
    reward: { money: 2000, rep: 25 },
    endLine: "Sarpanch ji: Ajj da mela tera naam ban gaya, puttar! Kotli di pagri tere sir te.",
    steps: [
      { id: "lohri", text: "Warm your hands at a Lohri bonfire", hint: "Lohri is on the third of Poh, at dusk: the galis light up.", done: (c) => !!c.flags.c_lohri, target: null },
      { id: "dangal", text: "Win a dangal at Ustad Kartar's akhada", hint: "The akhada is in Pind Kotli; entry is a note.", done: (c) => c.dangalWins >= 1, target: { poi: "akhada" } },
      { id: "cricket", text: "Play tape-ball cricket with the kids", hint: "The park near home has stumps chalked on the wall.", done: (c) => !!c.flags.c_cricket, target: null },
      { id: "fees", text: "Pay Simran's school fees", hint: "At half past nine the day's book offers it.", done: (c) => c.feesPaid >= 1, target: { resident: "home_simran" } },
      { id: "kabaddi", text: "Win the kabaddi cup at the Baisakhi mela", hint: "The ground in Pind Kotli, on Baisakhi, the first of Vaisakh.", done: (c) => !!c.flags.c_kabaddi, target: { x: -122, z: 365 } },
    ],
  },
  {
    id: "ch4", n: 4, title: "Amritsar", subtitle: "Bebe ji's yatra",
    blurb: "Bebe ji's pilgrimage to Harmandir Sahib along the G.T. Road. Coming in a later version.",
    reward: { money: 0, rep: 0 }, endLine: "", steps: [], locked: true,
  },
];

export interface Progress {
  /** The chapter now being played, or null when all that can be played are done. */
  chapter: Chapter | null;
  /** The first step not yet done. */
  step: Step | null;
  done: number;
}

const doneFlag = (id: string) => `${id}_done`;
export const chapterDone = (flags: Record<string, boolean>, id: string): boolean => !!flags[doneFlag(id)];

/** Which chapter is on and what its next step is. */
export function progress(c: ChapterCtx): Progress {
  for (const ch of CHAPTERS) {
    if (ch.locked || chapterDone(c.flags, ch.id)) continue;
    const done = ch.steps.filter((s) => s.done(c)).length;
    return { chapter: ch, step: ch.steps.find((s) => !s.done(c)) ?? null, done };
  }
  return { chapter: null, step: null, done: 0 };
}

/** The chapter whose steps are all done but which has not been closed yet (it pays now), if any. */
export function finished(c: ChapterCtx): Chapter | null {
  const p = progress(c);
  return p.chapter && !p.step ? p.chapter : null;
}

export function markDone(flags: Record<string, boolean>, ch: Chapter): void {
  flags[doneFlag(ch.id)] = true;
}
