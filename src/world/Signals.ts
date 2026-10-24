/**
 * Traffic signals at the main junctions of Nawan Shehar and Ludhiana. A cycle is 50 s: the road that has the
 * green keeps it 20 s, amber 3 s, then red until the other road has had its turn (so there are two seconds when
 * both are red). Two classes of junction start half a cycle apart, so the whole town is not green and red at once.
 * Cars (not the player's) stop at a line before the zebra; in a power cut the signals are dark and everyone
 * goes by nerve.
 */

export interface Junction { id: string; x: number; z: number; hw: number; cls: 0 | 1 }

export type Light = "green" | "amber" | "red";

export const CYCLE = 50;
const GREEN = 20, AMBER = 3;

/** The light a class of signal shows: class 1 is half a cycle behind class 0. */
export function classLight(cls: 0 | 1, t: number): Light {
  const tau = (((t + cls * CYCLE / 2) % CYCLE) + CYCLE) % CYCLE;
  return tau < GREEN ? "green" : tau < GREEN + AMBER ? "amber" : "red";
}

/** The light a junction shows for traffic along a road: "ns" runs along z, "ew" along x. */
export function axisLight(j: Junction, axis: "ns" | "ew", t: number): Light {
  const cls = axis === "ns" ? j.cls : ((1 - j.cls) as 0 | 1);
  return classLight(cls, t);
}

/** The class of signal head an axis uses (so it can share a material with the others of its class). */
export function axisClass(j: Junction, axis: "ns" | "ew"): 0 | 1 {
  return axis === "ns" ? j.cls : ((1 - j.cls) as 0 | 1);
}

/** Metres from the edge of the junction to the stop line (the zebra lies between). */
export const STOP_BACK = 4.6;
/** The zebra's depth, from the junction edge. */
export const ZEBRA = { from: 0.7, to: 3.7 };

const CITY_X = [300, 400], CITY_Z = [-80, 0, 70];
const LUDH_X = [-580, -470, -360], LUDH_Z = [-290, -195];

export const JUNCTIONS: Junction[] = [
  ...CITY_X.flatMap((x, i) => CITY_Z.map((z, k): Junction => ({ id: `city_${x}_${z}`, x, z, hw: 5, cls: ((i + k) % 2) as 0 | 1 }))),
  ...LUDH_X.flatMap((x, i) => LUDH_Z.map((z, k): Junction => ({ id: `ludh_${x}_${z}`, x, z, hw: 4.8, cls: ((i + k + 1) % 2) as 0 | 1 }))),
];

/**
 * How far ahead a car at `pos`, heading (fx, fz) at `speed`, must stop for a signal: the distance to the stop
 * line, or Infinity when it may go (green, or an amber it cannot stop for).
 */
export function signalAhead(pos: { x: number; z: number }, fx: number, fz: number, speed: number, t: number, junctions: Junction[] = JUNCTIONS): number {
  let best = Infinity;
  const ns = Math.abs(fz) >= Math.abs(fx);
  const s = ns ? Math.sign(fz) : Math.sign(fx);
  if (!s) return best;
  for (const j of junctions) {
    if (Math.abs(j.x - pos.x) > 45 || Math.abs(j.z - pos.z) > 45) continue;
    const lateral = ns ? Math.abs(pos.x - j.x) : Math.abs(pos.z - j.z);
    if (lateral > j.hw + 1) continue;
    const line = (ns ? j.z : j.x) - s * (j.hw + STOP_BACK);
    const along = ((ns ? pos.z : pos.x) - line) * -s;
    if (along < -0.5 || along > 40) continue;
    const light = axisLight(j, ns ? "ns" : "ew", t);
    if (light === "green") continue;
    if (light === "amber" && along < speed * speed / (2 * 3.5) + 1) continue;
    best = Math.min(best, along);
  }
  return best;
}
