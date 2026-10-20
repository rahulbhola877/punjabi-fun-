import { describe, expect, it } from "vitest";
import { Vector3 } from "../src/babylon";
import { LUDHIANA, ROADS, SITES, isOpenCountry, inRectR, defectAt } from "../src/world/region";
import { buildRoadGraph } from "../src/world/nav";
import { POIS, isOpenGround } from "../src/world/layout";
import { FAMOUS_PLACES, fare, placeAt } from "../src/missions/Travel";
import { countryFolk } from "../src/crowds/countryFolk";
import { Barkers } from "../src/crowds/Barkers";
import type { Crowd, Resident } from "../src/crowds/Crowd";
import type { AudioSystem } from "../src/audio/Audio";
import { PRESETS, QUALITIES } from "../src/app/quality";

describe("Ludhiana", () => {
  it("is on the road network, reachable from the bazaar", () => {
    const g = buildRoadGraph();
    const from = g.nearest(0, -60);
    for (const [x, z] of [[-441, -266], [-412, -343], [-527, -343]] as const) {
      const to = g.nearest(x, z, (n) => !!n.road);
      const path = g.path(from, to);
      expect(path.length, `no route to ${x},${z}`).toBeGreaterThan(2);
      // The route has to end near the target, not at some other road entirely.
      const end = g.nodes[path[path.length - 1]!]!;
      expect(Math.hypot(end.x - x, end.z - z)).toBeLessThan(60);
    }
  });

  it("has drop-off points clear of buildings and roads", () => {
    for (const k of ["ludhAdda", "ludhMandi", "ludhChowk", "ludhCinema"]) {
      const p = POIS[k]!;
      expect(isOpenCountry(p.x, p.z), `${k} is blocked`).toBe(true);
      expect(inRectR(LUDHIANA, p.x, p.z, 10), `${k} is outside the district`).toBe(true);
    }
  });

  it("has its own sites and plenty of potholed street to fall into", () => {
    const own = SITES.filter((s) => s.id.startsWith("ludh"));
    expect(own.length).toBeGreaterThanOrEqual(4);
    const streets = ROADS.filter((r) => r.id.startsWith("ludh"));
    expect(streets.length).toBeGreaterThanOrEqual(6);
    // Walk the length of the bazaar street; it should be a mess.
    let holes = 0;
    for (let z = -380; z < -200; z += 1.5) for (let x = -474; x <= -466; x += 1) if (defectAt(x, z)) { holes++; break; }
    expect(holes).toBeGreaterThan(4);
  });

  it("is populated, with sellers and touts who have something to shout", () => {
    // Ludhiana's people are spread over many small, locally-loaded groups.
    const gs = countryFolk().groups.filter((x) => x.id.startsWith("ludh"));
    expect(gs.length).toBeGreaterThan(4);
    const defs = gs.flatMap((g) => g.defs);
    expect(defs.length).toBeGreaterThan(50);
    const callers = defs.filter((d) => d.callKind);
    expect(callers.length).toBeGreaterThanOrEqual(10);
    for (const c of callers) expect(c.calls?.length, `${c.id} has no lines`).toBeGreaterThan(0);
    expect(callers.some((c) => c.callKind === "auto")).toBe(true);
    expect(callers.some((c) => c.callKind === "doodh")).toBe(true);
    expect(defs.filter((d) => d.faction === "police").length).toBeGreaterThanOrEqual(4);
  });

  it("packs the bazaar: standing in Chaura Bazaar loads a real crowd, not five people", () => {
    const gs = countryFolk().groups;
    // Everything that would be live standing on the main bazaar street.
    const ludh = gs.filter((g) => g.id.startsWith("ludh"));
    const live = ludh.filter((g) => Math.hypot(g.x - -470, g.z - -290) < g.radius).flatMap((g) => g.defs);
    const near = live.filter((d) => Math.hypot(d.x - -470, d.z - -290) < 35);
    expect(near.length, `only ${near.length} people within 35 m of Chaura Bazaar`).toBeGreaterThan(14);
    // And the whole district should not be resident at once.
    const all = ludh.flatMap((g) => g.defs);
    expect(live.length).toBeLessThan(all.length * 0.7);
  });
});

/** A caller standing at the origin with one line. */
function fakeCaller(id: string): Resident {
  return {
    id, name: id, role: "keeper", x: 0, z: 0, yaw: 0, look: { height: 1.7 } as Resident["look"],
    callKind: "sabzi", calls: ["Aaloo lo, pyaaz lo!"],
    pos: new Vector3(0, 0, 0), pose: "stand", brain: null,
    anim: { play: () => {} }, lookTarget: null,
  } as unknown as Resident;
}

describe("street calls", () => {
  function rig(n: number) {
    const said: string[] = [];
    const residents = Array.from({ length: n }, (_, i) => fakeCaller(`v${i}`));
    const crowd = { residents, say: (_r: Resident, t: string) => said.push(t) } as unknown as Crowd;
    const cries: string[] = [];
    const audio = { cry: (k: string) => cries.push(k), voice: () => {} } as unknown as AudioSystem;
    return { b: new Barkers(crowd, audio), said, cries };
  }

  it("stays quiet when the player is nowhere near", () => {
    const { b, said } = rig(6);
    for (let i = 0; i < 200; i++) b.update(0.1, new Vector3(500, 0, 500));
    expect(said).toHaveLength(0);
  });

  it("lets one seller call at a time, never in a constant stream", () => {
    const { b, said, cries } = rig(8);
    // Sixty seconds of standing in the middle of a busy market.
    for (let i = 0; i < 600; i++) b.update(0.1, new Vector3(0, 0, 0));
    expect(said.length).toBeGreaterThan(3);
    // A floor of ~2.2 s between calls caps a minute at well under 30.
    expect(said.length).toBeLessThan(28);
    // Sellers without a recording only show the bubble (no synthesised cry any more).
    expect(cries.length).toBe(0);
  });

  it("does not let the same seller shout over and over", () => {
    // One vendor, two minutes: his own silence window (16-34 s) rules.
    const { b, said } = rig(1);
    for (let i = 0; i < 1200; i++) b.update(0.1, new Vector3(0, 0, 0));
    expect(said.length).toBeLessThanOrEqual(8);
  });
});

describe("graphics presets", () => {
  it("get heavier at every step from low to ultra", () => {
    const order = QUALITIES.map((q) => PRESETS[q]!);
    expect(QUALITIES).toEqual(["low", "medium", "high", "ultra"]);
    for (let i = 1; i < order.length; i++) {
      const a = order[i - 1]!, b = order[i]!;
      expect(a.drawDistance, QUALITIES[i]).toBeLessThanOrEqual(b.drawDistance);
      expect(a.renderScale, QUALITIES[i]).toBeLessThanOrEqual(b.renderScale);
      expect(a.traffic.road, QUALITIES[i]).toBeLessThanOrEqual(b.traffic.road);
      expect(a.cityAutos, QUALITIES[i]).toBeLessThanOrEqual(b.cityAutos);
      expect(a.engines, QUALITIES[i]).toBeLessThanOrEqual(b.engines);
      expect(a.crowdScale, QUALITIES[i]).toBeLessThanOrEqual(b.crowdScale);
    }
    // Only the two phone presets cap the frame rate, and Low caps it hardest.
    expect(PRESETS.low.fpsCap).toBeGreaterThan(0);
    expect(PRESETS.low.fpsCap).toBeLessThan(PRESETS.medium.fpsCap);
    expect(PRESETS.high.fpsCap).toBe(0);
    expect(PRESETS.ultra.fpsCap).toBe(0);
  });
});

describe("bus and auto travel", () => {
  it("reaches every corner of the district, on open ground", () => {
    const areas = new Set(FAMOUS_PLACES.map((p) => p.area));
    for (const a of ["Ranggarh", "G.T. Road", "Nawan Shehar", "Ludhiana", "Pind Kotli"]) {
      expect(areas.has(a), `nowhere to travel in ${a}`).toBe(true);
    }
    for (const p of FAMOUS_PLACES) expect(isOpenGround(p.x, p.z), `${p.id} is blocked`).toBe(true);
  });

  it("charges more the further you go, and never nothing", () => {
    const bazaar = FAMOUS_PLACES.find((p) => p.id === "bazaar")!;
    const near = fare(bazaar.x, bazaar.z, FAMOUS_PLACES.find((p) => p.id === "dhabaGate")!);
    const far = fare(bazaar.x, bazaar.z, FAMOUS_PLACES.find((p) => p.id === "ludhMandi")!);
    expect(near).toBeGreaterThan(0);
    expect(far).toBeGreaterThan(near);
  });

  it("knows which place you are standing at", () => {
    const p = FAMOUS_PLACES.find((q) => q.id === "ludhChowk")!;
    expect(placeAt(p.x + 3, p.z - 2)?.id).toBe("ludhChowk");
    expect(placeAt(0, 0, 10)).toBeNull();
  });
});

describe("greetings and street chat", () => {
  it("passers-by greet you by voice, one at a time and not every second", () => {
    const said: string[] = [], played: string[] = [];
    const residents = Array.from({ length: 6 }, (_, i) => ({
      ...fakeCaller(`w${i}`), role: "walker", callKind: undefined, calls: undefined,
      look: { height: 1.7, sex: i % 2 ? "f" : "m", age: "adult" }, pos: new Vector3(i * 0.4, 0, 1),
    })) as unknown as Resident[];
    const crowd = { residents, say: (_r: Resident, t: string) => said.push(t) } as unknown as Crowd;
    const audio = {
      hasClip: () => true,
      callClip: (n: string) => played.push(n),
      presentClips: (names: string[]) => names,
      pickFresh: (_k: string, from: string[]) => from[0]!,
    } as unknown as AudioSystem;
    const b = new Barkers(crowd, audio);
    // A minute of strolling past the same six people.
    for (let i = 0; i < 600; i++) { b.update(0.1, new Vector3(0, 0, 0)); b.greet(0.1, new Vector3(0, 0, 0), 1.2); }
    expect(played.length).toBeGreaterThanOrEqual(3);
    // Each person greets once in that minute at most, and never two at once.
    expect(played.length).toBeLessThanOrEqual(6);
    expect(new Set(played.filter((p) => p.startsWith("greet_f"))).size).toBeGreaterThan(0);
    // Nobody greets someone racing past.
    const b2 = new Barkers(crowd, audio);
    const before = played.length;
    for (let i = 0; i < 300; i++) b2.greet(0.1, new Vector3(0, 0, 0), 12);
    expect(played.length).toBe(before);
  });
});
