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
  it.each([0, 1, 2])("gives safeda variant %s a single closed, slender opaque crown instead of dangling alpha cards", variant => {
    const { wood, leaf, cards } = treeTemplate("safeda", variant);
    expect(cards.vertexCount).toBe(0);
    expect(leaf.indices.length / 3).toBeLessThanOrEqual(220);
    expect(wood.indices.length / 3 + leaf.indices.length / 3).toBeLessThan(500);
    const ys = leaf.positions.filter((_, i) => i % 3 === 1);
    const xs = leaf.positions.filter((_, i) => i % 3 === 0);
    expect(Math.max(...ys) - Math.min(...ys)).toBeGreaterThan(6.5);
    expect(Math.max(...xs) - Math.min(...xs)).toBeLessThan(3.8);
    // Every edge belongs to two triangles: this is one capped canopy shell,
    // with no detached leaf planes, missing underside or floating components.
    const edges = new Map<string, number>(), adjacent = new Map<number, Set<number>>();
    for (let i = 0; i < leaf.indices.length; i += 3) for (let j = 0; j < 3; j++) {
      const a = leaf.indices[i + j]!, b = leaf.indices[i + (j + 1) % 3]!;
      const edge = a < b ? `${a}:${b}` : `${b}:${a}`;
      edges.set(edge, (edges.get(edge) ?? 0) + 1);
      if (!adjacent.has(a)) adjacent.set(a, new Set());
      adjacent.get(a)!.add(b);
    }
    expect([...edges.values()].every(n => n === 2)).toBe(true);
    const visited = new Set<number>(), pending = [0];
    while (pending.length) { const n = pending.pop()!; if (visited.has(n)) continue; visited.add(n); pending.push(...adjacent.get(n)!); }
    expect(visited.size).toBe(leaf.vertexCount);
    // The trunk runs through the canopy, with its base planted on the ground.
    expect(Math.min(...wood.positions.filter((_, i) => i % 3 === 1))).toBeCloseTo(0, 1);
    expect(Math.max(...wood.positions.filter((_, i) => i % 3 === 1))).toBeGreaterThan(Math.max(...ys) - 0.6);
  });
  it.each(["mango", "shisham", "neem", "kikar", "pine", "safeda"] as const)("keeps %s below 500 triangles without individual alpha-card leaves", kind => {
    for (const variant of [0, 1, 2]) {
      const tree = treeTemplate(kind, variant);
      expect(tree.cards.vertexCount).toBe(0);
      expect((tree.wood.indices.length + tree.leaf.indices.length) / 3).toBeLessThanOrEqual(500);
      expect(tree.leaf.positions.every(Number.isFinite)).toBe(true);
    }
  });
  it("retains distinct low broad mango, umbrella kikar and tall slender safeda silhouettes", () => {
    const ratio = (kind: Parameters<typeof treeTemplate>[0]) => {
      const tree = treeTemplate(kind, 0);
      const vertices = [...tree.wood.positions, ...tree.leaf.positions];
      const x = vertices.filter((_, i) => i % 3 === 0), y = vertices.filter((_, i) => i % 3 === 1);
      return (Math.max(...y) - Math.min(...y)) / (Math.max(...x) - Math.min(...x));
    };
    expect(ratio("safeda")).toBeGreaterThan(ratio("mango") * 3);
    expect(ratio("kikar")).toBeLessThan(ratio("mango"));
    expect(ratio("neem")).toBeLessThan(ratio("shisham"));
  });
  it("uses the complete source lowpoly tree at the central canal while keeping the existing collider footprint", () => {
    const engine = new NullEngine(), scene = new Scene(engine), collision = new StaticColliderBuilder();
    try {
      const kit = new Kit(scene, {} as never, {} as never, collision);
      const decor = new CountryDecor();
      decor.addTree(kit, "safeda", -100, 157.5, 1, 0, 0);
      expect(decor.count).toBe(1);
      const tree = kit.g("lowpolyNature");
      expect(tree.vertexCount).toBeGreaterThan(0);
      expect(tree.indices.length / 3).toBeLessThanOrEqual(500);
      expect(kit.g("plant").vertexCount).toBe(0);
      expect(kit.g("tunyardLeaves").vertexCount).toBe(0);
      expect(collision.boxes).toHaveLength(1);
      expect(collision.boxes[0]).toMatchObject({ cx: -100, cy: 1.2, cz: 157.5, sx: 0.44, sy: 2.4, sz: 0.44 });
    } finally { scene.dispose(); engine.dispose(); }
  });
  it.each([[-5.3, 7.8, 3], [5.3, -42.8, 4], [5.3, 42.5, 8], [-5.3, -57, 6]])(
    "keeps guarded bazaar tree at %s,%s outside both facade and traffic lane", (x, z, seed) => {
      const engine = new NullEngine(), scene = new Scene(engine), collision = new StaticColliderBuilder();
      try {
        const kit = new Kit(scene, {} as never, {} as never, collision);
        streetTree(kit, x, z, CURB_H, "neem", seed, true);
        kit.frame(x, z, 0, CURB_H);
        for (const key of ["lowpolyNature"] as const) {
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
