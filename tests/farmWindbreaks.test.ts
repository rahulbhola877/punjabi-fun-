import { describe, expect, it } from "vitest";
import { windbreakForPlot } from "../src/world/farmWindbreaks";
import { onRoad, PLOTS } from "../src/world/region";

describe("farm windbreaks", () => {
  it("keeps sparse trees inside field edges and away from roads and corner features", () => {
    let count = 0;
    for (const plot of PLOTS) {
      const trees = windbreakForPlot(plot);
      expect(trees.length).toBeLessThanOrEqual(4);
      for (const tree of trees) {
        count++;
        expect(tree.x).toBeGreaterThan(plot.x0);
        expect(tree.x).toBeLessThan(plot.x1);
        expect(tree.z).toBeGreaterThan(plot.z0);
        expect(tree.z).toBeLessThan(plot.z1);
        expect(onRoad(tree.x, tree.z, 7)).toBeNull();
        const alongX = plot.x1 - plot.x0 >= plot.z1 - plot.z0;
        expect(alongX ? Math.min(tree.x - plot.x0, plot.x1 - tree.x) : Math.min(tree.z - plot.z0, plot.z1 - tree.z)).toBeGreaterThan(7);
      }
    }
    expect(count).toBeGreaterThan(0);
    expect(count).toBeLessThan(PLOTS.length);
  });
});
