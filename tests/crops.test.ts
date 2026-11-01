import { describe, expect, it } from "vitest";
import { NullEngine, Scene, StandardMaterial, Vector3 } from "../src/babylon";
import { GeoBuilder } from "../src/render/GeoBuilder";
import type { Materials } from "../src/render/Materials";
import { buildCropCards, buildSeasonCover, CropStreamer, cropShape } from "../src/world/crops";
import { fieldNow } from "../src/world/Calendar";
import { PLOTS } from "../src/world/region";
import { farmLandmark } from "../src/world/farmCorner";

describe("crop plants", () => {
  it("every cropped field builds a ribbon of plants within a vertex budget; fallow builds nothing", () => {
    let total = 0, worst = 0;
    for (const p of PLOTS) {
      const g = new GeoBuilder(1);
      const n = buildCropCards(g, p, false);
      if (p.crop === "fallow") { expect(n).toBe(0); continue; }
      expect(n, p.id).toBeGreaterThan(0);
      expect(g.indices.length % 3).toBe(0);
      expect(Math.max(...g.indices)).toBeLessThan(g.vertexCount);
      total += n; worst = Math.max(worst, n);
    }
    // The world has about a thousand fields; the near ones only are ever made (CropStreamer).
    expect(worst).toBeLessThan(9000);
    expect(total).toBeGreaterThan(100000);
  });
  it("the Low preset has fewer, longer rows", () => {
    const p = PLOTS.find((q) => q.crop === "wheat")!;
    const a = new GeoBuilder(1), b = new GeoBuilder(1);
    expect(buildCropCards(b, p, true)).toBeLessThan(buildCropCards(a, p, false) / 2);
    expect(cropShape("sugarcane", false).height).toBeGreaterThan(cropShape("wheat", false).height);
    expect(cropShape("paddy", false).height).toBeGreaterThan(0.75);
  });
  it("keeps the rotated paddy within the field vertex budget", () => {
    for (const p of PLOTS.filter((plot) => plot.crop === "wheat" || plot.crop === "sarson")) {
      const g = new GeoBuilder(1);
      const n = buildCropCards(g, p, false, fieldNow(p.crop, 0, 0));
      expect(n, p.id).toBeLessThan(9000);
    }
  });
  it("leaves the bases of farm landmarks free of crop cards", () => {
    const plots = PLOTS.filter((p) => p.crop !== "fallow" && farmLandmark(p));
    expect(plots.length).toBeGreaterThan(0);
    for (const p of plots) {
      const landmark = farmLandmark(p)!;
      const g = new GeoBuilder(1);
      buildCropCards(g, p, false);
      for (let i = 0; i < g.indices.length; i += 3) {
        const vertices = g.indices.slice(i, i + 3).map((index) => ({ x: g.positions[index * 3]!, z: g.positions[index * 3 + 2]! }));
        const intersects = Math.min(...vertices.map((v) => v.x)) < landmark.x + 2.3 && Math.max(...vertices.map((v) => v.x)) > landmark.x - 2.3 &&
          Math.min(...vertices.map((v) => v.z)) < landmark.z + 2.3 && Math.max(...vertices.map((v) => v.z)) > landmark.z - 2.3;
        expect(intersects, p.id).toBe(false);
      }
    }
  });
  it("shows a low-cost seasonal ground cover only when crop rotation changes the plot", () => {
    const p = PLOTS.find((q) => q.crop === "wheat")!;
    const riceSeason = fieldNow("wheat", 0, 0), wheatSeason = fieldNow("wheat", 5, 0);
    expect(riceSeason.crop).toBe("paddy");
    const rice = new GeoBuilder(5), wheat = new GeoBuilder(5), bare = new GeoBuilder(5);
    buildSeasonCover(rice, p, riceSeason); buildSeasonCover(wheat, p, wheatSeason);
    buildSeasonCover(bare, p, { crop: "fallow", grow: 0, bare: true });
    expect(rice.vertexCount).toBeGreaterThan(0);
    expect(rice.vertexCount).toBeLessThan(200);
    expect(wheat.vertexCount).toBe(0); expect(bare.vertexCount).toBe(0);
    for (let i = 0; i < rice.positions.length; i += 3) {
      expect(rice.positions[i]).toBeGreaterThan(p.x0);
      expect(rice.positions[i]).toBeLessThan(p.x1);
      expect(rice.positions[i + 1]).toBeCloseTo(0.006);
      expect(rice.positions[i + 2]).toBeGreaterThan(p.z0);
      expect(rice.positions[i + 2]).toBeLessThan(p.z1);
    }
  });
  it("releases the rotated ground along with its crop and on a season change", () => {
    const engine = new NullEngine(), scene = new Scene(engine), material = new StandardMaterial("test", scene);
    const p = PLOTS.find((q) => q.crop === "wheat")!;
    const streamer = new CropStreamer(scene, { get: () => material } as unknown as Materials, [p]);
    const centre = new Vector3((p.x0 + p.x1) / 2, 0, (p.z0 + p.z1) / 2);
    streamer.update(centre);
    expect(scene.getMeshByName(`crop_cover_${p.id}`)).not.toBeNull();
    expect(scene.getMeshByName(`crop_cover_${p.id}`)!.visibility).toBe(1);
    streamer.update(new Vector3(p.x1 + streamer.range - 17.5, 0, centre.z));
    expect(scene.getMeshByName(`crop_cover_${p.id}`)!.visibility).toBeCloseTo(0.5);
    streamer.setDate(5, 0);
    expect(scene.getMeshByName(`crop_cover_${p.id}`)).toBeNull();
    streamer.update(centre);
    expect(scene.getMeshByName(`crop_${p.id}`)).not.toBeNull();
    expect(scene.getMeshByName(`crop_cover_${p.id}`)).toBeNull();
    streamer.setDate(0, 0); streamer.update(centre);
    expect(scene.getMeshByName(`crop_cover_${p.id}`)).not.toBeNull();
    streamer.update(new Vector3(100000, 0, 100000));
    expect(scene.getMeshByName(`crop_cover_${p.id}`)).toBeNull();
    streamer.clear(); scene.dispose(); engine.dispose();
  });
});
