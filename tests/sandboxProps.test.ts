import { describe, expect, it } from "vitest";
import { court } from "../src/minigames/Kabaddi";
import { isOpenGround } from "../src/world/layout";
import { KICK_IMPULSE, KICK_REACH, SANDBOX_SPOTS, kickStrength } from "../src/world/SandboxProps";

const feet = { x: 0, z: 0 };
const ahead = { x: 0, z: 1 };

describe("a kick on a sandbox prop", () => {
  it("pushes what is at your toes hardest, and what is at the edge of reach less", () => {
    const near = kickStrength(feet, ahead, { x: 0, z: 0.2 });
    const far = kickStrength(feet, ahead, { x: 0, z: KICK_REACH - 0.1 });
    expect(near).toBeGreaterThan(far);
    expect(far).toBeGreaterThan(0);
    expect(near).toBeLessThanOrEqual(KICK_IMPULSE);
  });

  it("reaches nothing beyond its reach, nothing behind you, and nothing well off to the side", () => {
    expect(kickStrength(feet, ahead, { x: 0, z: KICK_REACH + 0.1 })).toBe(0);
    expect(kickStrength(feet, ahead, { x: 0, z: -0.5 })).toBe(0);
    expect(kickStrength(feet, ahead, { x: 1.4, z: 0.2 })).toBe(0);
  });
});

describe("the village's sandbox", () => {
  it("lies on open ground, every corner of every prop, and clear of the kabaddi court", () => {
    const c = court();
    for (const s of SANDBOX_SPOTS) {
      const x = c.cx + s.dx, z = c.cz + s.dz;
      expect(Math.hypot(s.dx, s.dz), `prop at ${x}, ${z} is too near the court`).toBeGreaterThan(c.r + 2);
      for (const [cx, cz] of [[-0.5, -0.5], [0.5, -0.5], [-0.5, 0.5], [0.5, 0.5]]) {
        expect(isOpenGround(x + cx!, z + cz!), `prop corner at ${x + cx!}, ${z + cz!}`).toBe(true);
      }
    }
  });
});
