import { describe, expect, it, vi } from "vitest";
import { Vector3 } from "../src/babylon";
import { Game } from "../src/app/Game";
import { dress } from "../src/crowds/cast";
import { countryFolk } from "../src/crowds/countryFolk";
import { canalChallengeState, recordCanalChallengeThrow } from "../src/missions/CanalChallenge";
import { newSave, validate } from "../src/save/schema";

function host() {
  const g = Object.create(Game.prototype) as any;
  const def = countryFolk().groups.find((group) => group.id === "canalAmar")!.defs[0]!;
  const amar = { ...dress(def), pos: new Vector3(def.x, 0, def.z) };
  g.save = newSave("preet", { x: 0, z: 0, yaw: 0 }, []);
  g.bookFor = null;
  g.crowd = { get: (id: string) => id === "canalAmar" ? amar : undefined };
  g.playerPos = () => amar.pos.clone();
  g.canalSkipping = { active: false };
  g.rides = { ride: null }; Object.defineProperty(g, "carrying", { value: false, writable: true });
  g.combat = { inFight: false, playerDown: false };
  g.cricket = { active: false }; g.kabaddi = { active: false };
  g.dialogue = vi.fn(async () => "no"); g.persist = vi.fn(); g.ui = { toast: vi.fn() };
  return g;
}
function deferred() {
  let resolve!: (answer: string) => void;
  const promise = new Promise<string>((done) => { resolve = done; });
  return { promise, resolve };
}

describe("Amar challenge host", () => {
  it.each([["3", 3], ["5", 5]] as const)("accepts target %s and persists it", async (answer, target) => {
    const g = host(); g.dialogue.mockResolvedValue(answer);
    await g.talkCanalAmar();
    expect(canalChallengeState(g.save.home)).toMatchObject({ stage: "throwing", target, throws: 0 });
    expect(g.persist).toHaveBeenCalledWith("canal_challenge");
  });

  it.each(["ride", "carry", "fight", "down", "cricket", "kabaddi", "throw"])("blocks starting during %s", async (activity) => {
    const g = host(); g.dialogue.mockResolvedValue("3");
    if (activity === "ride") g.rides.ride = {};
    if (activity === "carry") g.carrying = true;
    if (activity === "fight") g.combat.inFight = true;
    if (activity === "down") g.combat.playerDown = true;
    if (activity === "cricket") g.cricket.active = true;
    if (activity === "kabaddi") g.kabaddi.active = true;
    if (activity === "throw") g.canalSkipping.active = true;
    await g.talkCanalAmar();
    expect(canalChallengeState(g.save.home).stage).toBe("idle");
    expect(g.persist).not.toHaveBeenCalled();
  });

  it.each(["throw", "down"])("rechecks %s after the offer is opened", async (activity) => {
    const g = host(), pending = deferred(); g.dialogue.mockImplementationOnce(() => pending.promise);
    const talk = g.talkCanalAmar();
    if (activity === "throw") g.canalSkipping.active = true; else g.combat.playerDown = true;
    pending.resolve("5"); await talk;
    expect(canalChallengeState(g.save.home).stage).toBe("idle");
    expect(g.persist).not.toHaveBeenCalled();
  });

  it("cancels an unfinished round without granting relationship or losing records", async () => {
    const g = host(); g.dialogue.mockResolvedValueOnce("3"); await g.talkCanalAmar();
    recordCanalChallengeThrow(g.save.home, 2);
    g.dialogue.mockResolvedValueOnce("cancel"); await g.talkCanalAmar();
    expect(canalChallengeState(g.save.home)).toMatchObject({ stage: "idle", relationshipReceived: false });
    expect(g.save.people.canalAmar).toBeUndefined();
  });

  it("reports once and warms the actual dressed Amar across saved reloads", async () => {
    const g = host(); g.dialogue.mockResolvedValueOnce("5"); await g.talkCanalAmar();
    recordCanalChallengeThrow(g.save.home, 5);
    const saved = JSON.parse(JSON.stringify(g.save));
    g.save = validate(saved, ["preet"], { minX: -1000, maxX: 1000, minZ: -2000, maxZ: 2000 });
    expect(canalChallengeState(g.save.home).throws).toBe(1);
    recordCanalChallengeThrow(g.save.home, 1); recordCanalChallengeThrow(g.save.home, 3);
    await g.talkCanalAmar();
    expect(g.save.people.canalAmar).toMatchObject({ rep: 1, name: "Amar", tie: expect.stringContaining("canal") });
    expect(canalChallengeState(g.save.home)).toMatchObject({ stage: "idle", records: { 5: 5 }, relationshipReceived: true });
    g.save = validate(JSON.parse(JSON.stringify(g.save)), ["preet"], { minX: -1000, maxX: 1000, minZ: -2000, maxZ: 2000 });
    g.dialogue.mockResolvedValueOnce("3"); await g.talkCanalAmar();
    recordCanalChallengeThrow(g.save.home, 3); recordCanalChallengeThrow(g.save.home, 3); recordCanalChallengeThrow(g.save.home, 3);
    await g.talkCanalAmar();
    expect(g.save.people.canalAmar.rep).toBe(1);
  });
  it("migrates the long receipt key from the first released version", () => {
    const g = host(); g.save.home.canalChallengeRelationship = 1;
    const loaded = validate(JSON.parse(JSON.stringify(g.save)), ["preet"], { minX: -1000, maxX: 1000, minZ: -2000, maxZ: 2000 });
    expect(loaded.home.canalChallengeReceipt).toBe(1);
    expect(canalChallengeState(loaded.home).relationshipReceived).toBe(true);
  });
});
