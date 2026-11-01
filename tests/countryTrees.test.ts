import { describe, expect, it } from "vitest";
import { NullEngine, Scene } from "../src/babylon";
import { StaticColliderBuilder } from "../src/physics/Physics";
import { Kit } from "../src/world/Kit";
import { CountryDecor, treeTemplate } from "../src/world/country";
import { tree as streetTree } from "../src/world/props";
import { CURB_H, FRONTAGE, ROAD_HALF } from "../src/world/layout";
import "./primeWorldAssets";

describe("country tree structure", () => {
  it.each([
    ["mango", 2.0], ["shisham", 3.0], ["neem", 3.0], ["safeda", 9.5],
  ] as const)("grows %s branches above the trunk into its crown", (kind, height) => {
    const tree = treeTemplate(kind, 0);
    const ys = tree.wood.positions.filter((_, i) => i % 3 === 1);
    expect(Math.max(...ys)).toBeGreaterThan(height * 0.9 + 1);
    expect(tree.wood.positions.every(Number.isFinite)).toBe(true);
  });
  it("uses the complete connected tree at the central canal while keeping the existing collider footprint", () => {
    const engine = new NullEngine(), scene = new Scene(engine), collision = new StaticColliderBuilder();
    try {
      const kit = new Kit(scene, {} as never, {} as never, collision);
      const decor = new CountryDecor();
      decor.addTree(kit, "safeda", -100, 157.5, 1, 0, 0);
      expect(decor.count).toBe(1);
      const bark = kit.g("tunyardBark"), leaves = kit.g("tunyardLeaves");
      expect(bark.vertexCount).toBeGreaterThan(0);
      expect(leaves.vertexCount).toBeGreaterThan(0);
      expect(collision.boxes).toHaveLength(1);
      expect(collision.boxes[0]).toMatchObject({ cx: -100, cy: 1.2, cz: 157.5, sx: 0.44, sy: 2.4, sz: 0.44 });
      expect(bark.vertexCount + leaves.vertexCount + kit.g("tunyardMoss").vertexCount).toBeLessThan(4000);
    } finally { scene.dispose(); engine.dispose(); }
  });
  it.each([[-5.3, 7.8, 3], [5.3, -42.8, 4], [5.3, 42.5, 8], [-5.3, -57, 6]])(
    "keeps guarded bazaar tree at %s,%s outside both facade and traffic lane", (x, z, seed) => {
      const engine = new NullEngine(), scene = new Scene(engine), collision = new StaticColliderBuilder();
      try {
        const kit = new Kit(scene, {} as never, {} as never, collision);
        streetTree(kit, x, z, CURB_H, "neem", seed, true);
        kit.frame(x, z, 0, CURB_H);
        for (const key of ["tunyardBark", "tunyardMoss", "tunyardLeaves"] as const) {
          const positions = kit.g(key).positions;
          expect(positions.length).toBeGreaterThan(0);
          for (let i = 0; i < positions.length; i += 3) {
            expect(Math.abs(positions[i]!)).toBeGreaterThan(ROAD_HALF);
            expect(Math.abs(positions[i]!)).toBeLessThan(FRONTAGE);
          }
        }
      } finally { scene.dispose(); engine.dispose(); }
    });
});
