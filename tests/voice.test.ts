import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { Vector3 } from "../src/babylon";
import { Barkers } from "../src/crowds/Barkers";
import type { Crowd, Resident } from "../src/crowds/Crowd";
import { RULES, VoiceDirector, priority, type VoiceWhen } from "../src/audio/VoiceDirector";

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

describe("rain and flood reactions", () => {
  const person = (sex: "m" | "f", age: "adult" | "elder", extra: Partial<Resident> = {}) => ({
    id: `p${sex}${age}`, name: "Walker", role: "walker", pos: new Vector3(), look: { height: 1.7, sex, age, beard: "none" }, ...extra,
  } as unknown as Resident);
  it("has words for men, women, elders and auto-walas, never in the other sex's voice", () => {
    expect(VoiceDirector.words("rain-start", person("f", "adult"))).toBeTruthy();
    expect(VoiceDirector.words("rain-start", person("m", "adult"))).toBeTruthy();
    expect(VoiceDirector.words("flood", person("m", "elder"))).toBeTruthy();
    expect(VoiceDirector.words("flood", person("m", "adult", { callKind: "auto" } as Partial<Resident>))).toBeTruthy();
    for (let i = 0; i < 40; i++) expect(VoiceDirector.words("rain-start", person("f", "adult"))).not.toMatch(/pakode/);
  });

  it("has a recording on disk for every clip that is switched on", () => {
    for (const [clip, r] of Object.entries(RULES)) if (r.on) expect(existsSync(`public/audio/voice/${clip}.mp3`), clip).toBe(true);
  });

  it("has a line for each new moment, for the people who would say it", () => {
    const m = (w: VoiceWhen, sex: "m" | "f", age: "adult" | "elder" = "adult") => VoiceDirector.words(w, person(sex, age));
    for (const w of ["power-cut", "power-back", "rail-gate", "signal-jump"] as const) {
      expect(m(w, "m"), `${w} man`).toBeTruthy();
      expect(m(w, "f"), `${w} woman`).toBeTruthy();
    }
    expect(m("power-cut", "m", "elder")).toBeTruthy();
    expect(m("meet-friend", "m")).toBeTruthy();
    expect(m("meet-friend", "f")).toBeTruthy();
    expect(m("doorbell-stranger", "f")).toBeTruthy();
    expect(m("doorbell-stranger", "m")).toBeTruthy();
    expect(m("doorbell-family", "f")).toBeTruthy();
    expect(m("doorbell-family", "m", "elder")).toBeTruthy();
    for (const g of ["any-elder", "any-woman", "any-man"]) expect(VoiceDirector.fits({ group: g, pos: new Vector3() }, ["any-man", "any-woman", "any-elder"])).toBe(true);
  });

  it("lets the pump, bank and post staff and the player say theirs", () => {
    for (const [w, id] of [["pump-done", "pumpwala"], ["pump-arrive", "pumpwala"], ["bank-welcome", "clerk_bank"], ["bank-advice", "clerk_bank"], ["post-welcome", "clerk_post"]] as const) {
      const dir = new VoiceDirector();
      const clerk = person("m", "adult", { id, contact: true } as Partial<Resident>);
      expect(dir.pick(w, clerk, clerk.pos, undefined, undefined, true), w).toBeTruthy();
    }
    const dir = new VoiceDirector();
    const at = new Vector3();
    expect(dir.pick("fuel-out", { group: "player", pos: at }, at, undefined, undefined, true)).toMatch(/^v2_fuel_p/);
    expect(dir.pick("fuel-out", { group: "player-f", pos: at }, at, undefined, undefined, true)).toMatch(/^v2_fuel_q/);
  });
});
