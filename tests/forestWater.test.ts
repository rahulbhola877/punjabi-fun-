import { describe, expect, it } from "vitest";
import { advanceForestWater, forestWaterStage } from "../src/missions/ForestWater";
import { newSave, validate } from "../src/save/schema";

describe("ranger's spring", () => {
  it.each([[4, 6], [5, 7]])("saves the chosen outlet (%i) and completes only once", (outlet, completed) => {
    const save = newSave("preet", { x: 0, z: 0, yaw: 0 }, []);
    expect(advanceForestWater(save.home, 0, outlet)).toBe(false);
    for (const [from, to] of [[0, 1], [1, 2], [2, 3], [3, outlet]]) expect(advanceForestWater(save.home, from!, to!)).toBe(true);
    const restored = validate(JSON.parse(JSON.stringify(save)), ["preet"], { minX: -1000, maxX: 1000, minZ: -2000, maxZ: 2000 });
    expect(forestWaterStage(restored.home)).toBe(outlet);
    expect(advanceForestWater(restored.home, outlet, completed)).toBe(true);
    expect(advanceForestWater(restored.home, outlet, completed)).toBe(false);
    expect(forestWaterStage(restored.home)).toBe(completed);
  });
  it("rejects invalid or skipped stages", () => {
    expect(forestWaterStage({ forestWaterStage: 80 })).toBe(0);
    expect(advanceForestWater({}, 0, 3)).toBe(false);
    expect(advanceForestWater({ forestWaterStage: 3 }, 3, 6)).toBe(false);
  });
});

describe("world progress persistence", () => {
  it("preserves independent destination progress through save validation", () => {
    const save = newSave("preet", { x: 0, z: 0, yaw: 0 }, []);
    Object.assign(save.home, { japanTeaStage: 2, japanParkStage: 3, chinaStoryStage: 1, chinaFishingComplete: 1, spaceStoryStage: 2, spaceExpeditionStage: 3, oasisWaterOpen: 1 });
    const restored = validate(JSON.parse(JSON.stringify(save)), ["preet"], { minX: -1000, maxX: 1000, minZ: -2000, maxZ: 2000 });
    expect(restored.home).toMatchObject(save.home);
  });
});

it("restores the obstruction and chosen water outlet from saved progress", async () => {
  const { NullEngine, Scene, StandardMaterial } = await import("../src/babylon");
  const { ForestWaterProps } = await import("../src/missions/ForestWater");
  const engine = new NullEngine(), scene = new Scene(engine);
  const material = new StandardMaterial("test", scene);
  const props = new ForestWaterProps(scene, { get: () => material } as unknown as import("../src/render/Materials").Materials);
  const enabled = (name: string) => scene.getMeshByName(name)?.isEnabled();
  props.sync({ forestWaterStage: 2 });
  expect(enabled("forest_water_log_0")).toBe(true);
  expect(enabled("forest_spring_water")).toBe(false);
  props.sync({ forestWaterStage: 6 });
  expect(enabled("forest_water_log_0")).toBe(false);
  expect(enabled("forest_spring_water")).toBe(true);
  expect(enabled("forest_pool_water")).toBe(true);
  expect(enabled("forest_hillside_water")).toBe(false);
  props.sync({ forestWaterStage: 7 });
  expect(enabled("forest_pool_water")).toBe(false);
  expect(enabled("forest_hillside_water")).toBe(true);
  scene.dispose(); engine.dispose();
});
