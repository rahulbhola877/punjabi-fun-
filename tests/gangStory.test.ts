import { describe, expect, it, vi } from "vitest";
import { Vector3 } from "../src/babylon";
import type { Resident } from "../src/crowds/Crowd";
import { Pistol } from "../src/combat/Pistol";
import { finishGangStory, gangDefeated, gangStage, startGangStory } from "../src/missions/GangStory";
import { Jhagde, type JhagdeHost } from "../src/combat/Jhagde";

describe("bus-stand story", () => {
  it("advances only for the requested gang and pays out once, including after a saved reload", () => {
    const flags: Record<string, boolean> = {};
    expect(startGangStory(flags)).toBe(true);
    expect(startGangStory(flags)).toBe(false);
    expect(gangDefeated(flags, "ghantaGhar")).toBe(false);
    expect(gangDefeated(flags, "busAdda")).toBe(true);
    const reloaded = JSON.parse(JSON.stringify(flags)) as Record<string, boolean>;
    expect(gangStage(reloaded)).toBe("return");
    expect(finishGangStory(reloaded)).toBe(true);
    expect(finishGangStory(reloaded)).toBe(false);
    expect(gangStage(reloaded)).toBe("done");
  });

  it("retries only remaining gang members after the player is knocked out", () => {
    const alreadyBeaten = { pose: "stand" } as Resident;
    const down = { pose: "down" } as Resident;
    const remaining = { pose: "stand" } as Resident;
    const engage = vi.fn();
    const combat = { fights: new Map(), engage };
    const game = new Jhagde({ combat } as unknown as JhagdeHost);
    const internals = game as unknown as { gangs: Array<{ site: string; members: Resident[]; defeated: Set<Resident>; respawnT: number; tauntT: number }> };
    internals.gangs.push({ site: "busAdda", members: [alreadyBeaten, down, remaining], defeated: new Set([alreadyBeaten]), respawnT: 0, tauntT: 0 });
    expect(game.confront("busAdda")).toBe(true);
    expect(engage).toHaveBeenCalledTimes(1);
    expect(engage.mock.calls[0]![0]).toBe(remaining);
    expect(game.confront("missing")).toBe(false);
  });
});

describe("sidearm", () => {
  it("uses ammo and cooldown, skips children and blocked targets, and fires only toward the facing direction", () => {
    let ammo = 2, blocked = true, hits = 0, shots = 0;
    const adult = { pos: new Vector3(0, 0, 10), look: { age: "adult" }, pose: "stand", role: "chatter" } as unknown as Resident;
    const child = { pos: new Vector3(0, 0, 3), look: { age: "child" }, pose: "stand", role: "child" } as unknown as Resident;
    const behind = { pos: new Vector3(0, 0, -2), look: { age: "adult" }, pose: "stand", role: "chatter" } as unknown as Resident;
    const pistol = new Pistol({ ammo: () => ammo, consume: () => { ammo--; }, player: () => ({ pos: Vector3.Zero(), yaw: 0, down: false }), residents: () => [child, behind, adult], blocked: () => blocked, hit: () => { hits++; }, shot: () => { shots++; } });
    expect(pistol.fire()).toBe("cooldown");
    pistol.toggle();
    expect(pistol.fire()).toBe("shot");
    expect(pistol.fire()).toBe("cooldown");
    pistol.update(0.45); blocked = false;
    expect(pistol.fire()).toBe("hit");
    pistol.update(0.45);
    expect(pistol.fire()).toBe("empty");
    expect({ ammo, shots, hits }).toEqual({ ammo: 0, shots: 2, hits: 1 });
  });
});
