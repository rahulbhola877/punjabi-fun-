import { describe, expect, it, vi } from "vitest";
import { Vector3 } from "../src/babylon";
import { Game } from "../src/app/Game";
import { countryFolk } from "../src/crowds/countryFolk";

describe("bus-stand story contacts stream at their own locations", () => {
  it.each(["conductor", "balwant"])("selects and loads %s near their location under a limited crowd budget", (id) => {
    const source = countryFolk().groups;
    const groups = source.filter((g) => g.defs.some((d) => d.id === id));
    expect(groups).toHaveLength(1);
    const group = groups[0]!, contact = group.defs[0]!;
    expect(group.defs).toHaveLength(1);
    expect(group).toMatchObject({ x: contact.x, z: contact.z });
    expect(contact.contact).toBe(true);

    const game = Object.create(Game.prototype) as any;
    game.folk = source.map((g) => ({ ...g, live: [] }));
    game.folkT = 0; game.folkOrder = []; game.folkWanted = new Set(); game.keptCache = new Map();
    game.crowdScale = 0.25;
    game.playerPos = () => new Vector3(contact.x, 0, contact.z);
    game.festivals = { active: null }; game.combat = { fights: new Map(), release: vi.fn() };
    const spawned: string[] = [];
    game.crowd = { spawn: (def: { id: string }) => { spawned.push(def.id); return { id: def.id }; }, remove: vi.fn() };
    game.errors = [];
    for (let i = 0; i < 20 && !spawned.includes(id); i++) game.updateFolk(0.1);
    expect(spawned).toContain(id);
    expect(game.errors).toEqual([]);
  });
});
