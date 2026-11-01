import { randomAppearance } from "../characters/appearances";
import type { Appearance } from "../characters/HumanBuilder";
import type { ResidentDef } from "./Crowd";
import type { FolkGroup } from "./countryFolk";

/** A small, streamed neighbourhood population for the Canada-inspired set.
 * These characters use the game's existing animated human kit, which keeps
 * their speech, avoidance and crowd-budget behaviour consistent with the rest
 * of the game. Their short routes stay on the two clear Main Street sidewalks.
 */
const COATS = ["#824b49", "#3f6075", "#596a50", "#795a78", "#ab7754", "#486c70"] as const;
function winterLook(seed: number): Appearance {
  const look = randomAppearance(seed);
  return {
    ...look,
    age: "adult",
    height: look.age === "child" ? (look.sex === "f" ? 1.6 : 1.72) : look.height,
    top: "shirt", sleeves: "long", topColor: COATS[seed % COATS.length]!,
    bottom: "trousers", bottomColor: ["#373e48", "#544c49", "#374c57"][seed % 3]!,
  };
}

const neighbourLines = [
  ["The bakery smells wonderful when the snow starts.", "Take the walk along Main Street; the snow stays quiet there."],
  ["We just cleared the sidewalk. More snow is on its way!", "The little park looks lovely in the afternoon."],
  ["My cousins are visiting from Punjab next week.", "It is a good day for a hot cup of chai."],
  ["The airfield is just west of town.", "Welcome! Watch your step on the snowy paths."],
  ["I came out for a walk before it gets dark.", "The best conversations happen over something warm."],
  ["The road crew was out early clearing the street.", "A little snow never stops a good neighbourhood walk."],
] as const;

function walkers(side: "south" | "north", z: number, firstSeed: number): ResidentDef[] {
  const xs = [1084, 1122, 1160, 1198, 1236, 1274];
  return xs.map((x, i) => ({
    id: `canada_${side}_${i}`, name: i % 2 ? "Neighbour" : "Local resident", role: "roamer",
    look: winterLook(firstSeed + i), x, z, yaw: i % 2 ? Math.PI / 2 : -Math.PI / 2,
    // Split a long sidewalk into short overlapping stretches. Nobody wanders
    // into the road, across a facade, or through the arrival plaza.
    wander: { x0: Math.max(1080, x - 12), x1: Math.min(1280, x + 12), z0: z - 0.6, z1: z + 0.6 },
    lines: [...neighbourLines[i]!],
  }));
}

export function canadaFolk(): FolkGroup[] {
  return [
    {
      id: "canadaArrival", x: 1114, z: 1740, radius: 95,
      defs: [
        { id: "canada_guide", name: "Simran", role: "keeper", contact: true, look: winterLook(26100), x: 1116, z: 1740, yaw: Math.PI,
          lines: ["Welcome! Main Street is north along the path.", "The airfield counter can take you back whenever you are ready."] },
        { id: "canada_visitor", name: "Visitor", role: "chatter", look: winterLook(26101), x: 1123, z: 1740, yaw: -Math.PI / 2,
          lines: ["The snow makes everything feel so quiet.", "I am going for a walk along Main Street."] },
      ],
    },
    { id: "canadaSouthWalk", x: 1180, z: 1809, radius: 145, defs: walkers("south", 1809, 26200) },
    { id: "canadaNorthWalk", x: 1180, z: 1831, radius: 145, defs: walkers("north", 1831, 26300) },
  ];
}
