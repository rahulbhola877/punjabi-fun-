import { describe, expect, it } from "vitest";
import { StandardMaterial } from "../../src/babylon";
import { FIXED_DT } from "../../src/app/config";
import { CANAL } from "../../src/world/region";
import { SandboxProps } from "../../src/world/SandboxProps";
import type { Materials } from "../../src/render/Materials";
import { makeWorld, v3 } from "./harness";

describe("dynamic props in canal water", () => {
  it("a wooden crate floats, drifts downstream and remains physically kickable", async () => {
    const midZ = (CANAL.z0 + CANAL.z1) / 2;
    const w = await makeWorld(c => c.add(0, CANAL.bedY - 0.5, midZ, 100, 1, 100), 0);
    const mat = new StandardMaterial("propTest", w.scene);
    const props = new SandboxProps({ scene: w.scene, physics: w.physics, mats: { get: () => mat } as unknown as Materials, caster: { addCaster: () => {}, removeCaster: () => {} } });
    try {
      let splashes = 0;
      props.onSplash = () => splashes++;
      props.place(0, midZ, 0, false, CANAL.waterY + 0.3);
      for (let i = 0; i < 360; i++) { props.fixedUpdate(FIXED_DT); w.physics.step(FIXED_DT); }
      const at = props.positions()[0]!;
      expect(splashes).toBeGreaterThanOrEqual(1);
      expect(at.y).toBeGreaterThan(CANAL.waterY - 0.4);
      expect(at.y).toBeLessThan(CANAL.waterY);
      expect(at.x).toBeGreaterThan(1.5);
      expect(at.y).toBeGreaterThan(CANAL.bedY + 1);
      expect(props.kick(v3(at.x - 0.6, 0, at.z), v3(1, 0, 0))).toBe(1);
      for (let i = 0; i < 120; i++) { props.fixedUpdate(FIXED_DT); w.physics.step(FIXED_DT); }
      expect(props.positions()[0]!.x).toBeGreaterThan(at.x + 1.5);
    } finally { props.clear(); w.scene.dispose(); }
  });
});
