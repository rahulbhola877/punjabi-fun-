import { describe, expect, it, vi } from "vitest";
import { Vector3 } from "../src/babylon";
import { Game } from "../src/app/Game";
import { gangDefeated, gangStage } from "../src/missions/GangStory";

function host() {
  const game = Object.create(Game.prototype) as any;
  const people: Record<string, { pos: Vector3 }> = {
    gurnam: { pos: new Vector3(10, 0, 10) }, conductor: { pos: new Vector3(20, 0, 20) }, balwant: { pos: new Vector3(30, 0, 30) },
  };
  let pos = Vector3.Zero();
  game.save = { flags: {}, home: {}, bag: {} };
  game.crowd = { get: (id: string) => people[id] };
  game.playerPos = () => pos;
  game.moveTo = (id: string) => { pos = people[id]!.pos.clone(); };
  game.missions = { job: null };
  game.tiffinRun = { objective: () => null };
  game.rides = { ride: null };
  game.combat = { inFight: false, playerDown: false };
  game.dialogue = vi.fn(async () => "leave");
  game.missionMoment = vi.fn(async () => {});
  game.persist = vi.fn(); game.reward = vi.fn(); game.warm = vi.fn();
  game.ui = { toast: vi.fn() };
  return game;
}

function deferred() {
  let resolve!: (answer: string) => void;
  const promise = new Promise<string>((done) => { resolve = done; });
  return { promise, resolve };
}

describe("Gurnam's investigation integration", () => {
  it("accepts the noncombat option and requires reaching both named people", async () => {
    const g = host(); g.dialogue.mockResolvedValueOnce("job").mockResolvedValueOnce("investigate");
    await g.talkGurnam();
    expect(gangStage(g.save.flags)).toBe("witness");
    expect(g.save.flags.pistol_owned).toBeUndefined();
    expect(g.persist).toHaveBeenCalledWith("gang_story");
    g.dialogue.mockClear();
    await g.talkGangWitness();
    expect(g.dialogue).not.toHaveBeenCalled();
    g.moveTo("conductor"); await g.talkGangWitness();
    expect(gangStage(g.save.flags)).toBe("police");
    expect(g.warm).toHaveBeenCalledWith("conductor", 1);
    await g.talkGangPolice();
    expect(gangStage(g.save.flags)).toBe("police");
    g.moveTo("balwant"); await g.talkGangPolice();
    expect(gangStage(g.save.flags)).toBe("return");
    expect(g.warm).toHaveBeenCalledWith("balwant", 1);
    await g.talkGurnam(); await g.talkGurnam();
    expect(gangStage(g.save.flags)).toBe("done");
    expect(g.reward).toHaveBeenCalledTimes(1);
    expect(g.reward).toHaveBeenCalledWith(500, 15, "other");
  });

  it("rechecks ownership after the pending offer", async () => {
    const g = host(), pending = deferred();
    g.dialogue.mockResolvedValueOnce("job").mockImplementationOnce(() => pending.promise);
    const talk = g.talkGurnam(); await Promise.resolve();
    g.missions.job = {}; pending.resolve("investigate"); await talk;
    expect(gangStage(g.save.flags)).toBe("available");
    expect(g.persist).not.toHaveBeenCalled();
  });

  it("ignores stale or duplicated NPC dialogue continuations", async () => {
    const g = host(), pending = deferred();
    Object.assign(g.save.flags, { crime_active: true, crime_investigate: true });
    g.moveTo("conductor"); g.dialogue.mockImplementationOnce(() => pending.promise);
    const first = g.talkGangWitness();
    await g.talkGangWitness(); pending.resolve("ok"); await first;
    expect(gangStage(g.save.flags)).toBe("police");
    expect(g.warm).toHaveBeenCalledTimes(1);
    g.moveTo("balwant"); await g.talkGangPolice(); await g.talkGangPolice();
    expect(g.warm).toHaveBeenCalledTimes(2);
  });

  it("keeps the legacy direct combat path and pays its existing completion once", async () => {
    const g = host(); g.dialogue.mockResolvedValueOnce("job").mockResolvedValueOnce("yes");
    await g.talkGurnam();
    expect(gangStage(g.save.flags)).toBe("confront");
    expect(g.save.flags.pistol_owned).toBe(true);
    expect(g.save.bag.pistol_ammo).toBe(12);
    expect(gangDefeated(g.save.flags, "busAdda")).toBe(true);
    await g.talkGurnam(); await g.talkGurnam();
    expect(g.reward).toHaveBeenCalledTimes(1);
    expect(g.save.flags.crime_complete).toBe(true);
  });
});
