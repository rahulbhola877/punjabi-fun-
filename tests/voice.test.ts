import { describe, expect, it } from "vitest";
import { Vector3 } from "../src/babylon";
import { Barkers } from "../src/crowds/Barkers";
import type { Crowd, Resident } from "../src/crowds/Crowd";
import { VoiceDirector, priority } from "../src/audio/VoiceDirector";

/** The Dal Bazaar (x = 0, a market: it calls and greets): shops, carts and people in uniform 3 m off the road. */
function street(): Resident[] {
  const out: Resident[] = [];
  const add = (id: string, x: number, sex: "m" | "f", extra: Partial<Resident>) => out.push({
    id, name: id, role: "keeper", x: 3, z: x - 40, yaw: 0, pos: new Vector3(3, 0, x - 40), pose: "stand", brain: null,
    look: { height: 1.7, sex, age: "adult", beard: "none" }, anim: { play: () => {} }, lookTarget: null, ...extra,
  } as unknown as Resident);
  for (let i = 0; i < 6; i++) add(`keeper_${i}`, -50 + i * 20, i % 2 ? "f" : "m", { name: "Shopkeeper", shop: true });
  // Keepers by role, but no shop: they must never say "aao ji, sab kujh sasta".
  add("driver1", -40, "m", { name: "Angry driver" });
  add("naka1", -10, "m", { name: "Constable (naka)", faction: "police" });
  add("trucker1", 25, "m", { name: "Truck driver" });
  add("nurse1", 45, "f", { name: "Sister ji" });
  add("sabzi1", 0, "m", { name: "Sabzi wala", callKind: "sabzi", calls: ["Aaloo lo!"] });
  return out;
}

/** Move the player down the road at `speed` and collect every line played (with its time). */
function pass(speed: number, driving: boolean): Array<{ t: number; clip: string; who: Resident }> {
  const residents = street();
  const crowd = { residents, say: () => {} } as unknown as Crowd;
  const dir = new VoiceDirector();
  const b = new Barkers(crowd);
  const played: Array<{ t: number; clip: string; who: Resident }> = [];
  let t = 0;
  const p = new Vector3(0, 0, -110);
  b.speak = (w, r, from) => {
    const c = dir.pick(w, r, p, from, undefined, false, { driving, speed }, t);
    if (c) played.push({ t, clip: c, who: r });
    return c;
  };
  for (; p.z < 30; t += 0.1) {
    p.z += speed * 0.1;
    b.update(0.1, p);
    b.greet(0.1, p, speed);
  }
  return played;
}

describe("dialogue rules", () => {
  it("plays no street or shop lines while you drive past", () => {
    for (const v of [4, 8, 14]) expect(pass(v, true).map((q) => q.clip)).toEqual([]);
  });

  it("only real shopkeepers say shop lines, and street talk is spaced out", () => {
    // Walk the street a few times (fresh director each time).
    for (let k = 0; k < 4; k++) {
      const played = pass(1.4, false);
      expect(played.length, "walking the bazaar, someone should speak").toBeGreaterThan(0);
      for (const q of played) if (/^shop_/.test(q.clip)) expect(q.who.shop, `${q.who.id} said ${q.clip}`).toBe(true);
      for (let i = 1; i < played.length; i++) expect(played[i]!.t - played[i - 1]!.t).toBeGreaterThanOrEqual(8 - 1e-6);
    }
  });

  it("ranks the moments: talk and missions over fights over street talk", () => {
    expect(priority("talk")).toBe(3);
    expect(priority("mission-shop")).toBe(3);
    expect(priority("fight-start")).toBe(2);
    expect(priority("pass-by")).toBe(1);
    expect(priority("street-call")).toBe(1);
  });
});
