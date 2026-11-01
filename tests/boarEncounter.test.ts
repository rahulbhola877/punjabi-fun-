import { describe, expect, it } from "vitest";
import { BOAR_HOME, BoarEncounter } from "../src/animals/boarEncounter";

describe("ridge boar encounter", () => {
  it("is opt-in and never attacks while waiting", () => {
    const b = new BoarEncounter(), player = { x: BOAR_HOME.x, z: BOAR_HOME.z - 3 };
    expect(b.update(10, player)).toBeNull();
    expect(b.start({ x: 0, z: 0 })).toBe(false);
    expect(b.start(player)).toBe(true);
  });
  it("charges with a cooldown, and leaving its range ends the fight", () => {
    const b = new BoarEncounter(), player = { x: BOAR_HOME.x, z: BOAR_HOME.z - 3 };
    b.start(player);
    expect(b.update(1, player)).toBe("hitPlayer");
    expect(b.update(0.1, player)).toBeNull();
    expect(b.update(0.1, null)).toBe("escaped");
    expect(b.phase).toBe("waiting");
  });
  it("requires three facing, separated strikes and cannot attack after retreat", () => {
    const b = new BoarEncounter(), player = { x: BOAR_HOME.x, z: BOAR_HOME.z - 1.5 };
    b.start(player);
    expect(b.strike(player, Math.PI)).toBeNull();
    expect(b.health).toBe(3);
    expect(b.strike(player, 0)).toBe("hit");
    expect(b.health).toBe(2);
    b.strike(player, 0); expect(b.health).toBe(2);
    b.update(0.8, player); b.strike(player, 0);
    b.update(0.8, player); expect(b.strike(player, 0)).toBe("repelled");
    expect(b.phase).toBe("retreating");
    expect(b.update(6, player)).toBeNull();
    expect(b.phase).toBe("done");
    expect(b.start(player)).toBe(false);
  });
  it("honors completed state across reload", () => {
    const b = new BoarEncounter();
    b.reset(true);
    expect(b.phase).toBe("done");
    expect(b.start(BOAR_HOME)).toBe(false);
  });
  it("allows aimed shots from range but rejects shots outside the cone", () => {
    const b = new BoarEncounter(), near = { x: BOAR_HOME.x, z: BOAR_HOME.z - 3 };
    b.start(near);
    const distant = { x: BOAR_HOME.x, z: BOAR_HOME.z - 15 };
    expect(b.shoot(distant, Math.PI)).toBeNull();
    expect(b.shoot(distant, 0)).toBe("hit");
    expect(b.health).toBe(2);
  });
});
