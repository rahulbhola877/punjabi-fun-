import { describe, expect, it } from "vitest";
import { NullEngine, Scene, Vector3 } from "../src/babylon";
import { CanalSkipping, planStoneSkips, SKIPPING_LANDING } from "../src/missions/CanalSkipping";
import { CANAL, inCanal } from "../src/world/region";
import { newSave, validate } from "../src/save/schema";
import { countryFolk } from "../src/crowds/countryFolk";
import { isOpenGround } from "../src/world/layout";

describe("canal stone skipping", () => {
  it("requires aiming through the landing opening and keeps impacts on open water", () => {
    const straight = planStoneSkips(SKIPPING_LANDING, Math.PI);
    const diagonal = planStoneSkips(SKIPPING_LANDING, Math.PI + 0.65);
    expect(straight.length).toBeGreaterThan(1);
    expect(diagonal.length).toBeGreaterThan(straight.length);
    expect(diagonal.every(p => inCanal(p.x, p.z))).toBe(true);
    expect(planStoneSkips(SKIPPING_LANDING, 0)).toEqual([]);
    expect(planStoneSkips(SKIPPING_LANDING, Math.PI + 1.3)).toEqual([]);
    expect(planStoneSkips({ x: 200, z: 200 }, Math.PI)).toEqual([]);
  });
  it("counts visible impacts as they happen and ends only after the last bounce", () => {
    const engine = new NullEngine(), scene = new Scene(engine), hits: number[] = [], finished: number[] = [];
    const game = new CanalSkipping(scene, (_p, n) => hits.push(n), n => finished.push(n));
    const origin = new Vector3(SKIPPING_LANDING.x, 0, SKIPPING_LANDING.z);
    const expected = planStoneSkips(origin, Math.PI + 0.5).length;
    expect(game.start(origin, Math.PI + 0.5)).toBe(true);
    expect(game.start(origin, Math.PI)).toBe(false);
    expect(finished).toEqual([]);
    for (let i = 0; i < 50 && !hits.length; i++) game.update(0.05);
    const firstRing = scene.getMeshByName("skipRipple0")!;
    expect(firstRing.isEnabled()).toBe(true);
    expect(firstRing.position.y).toBeCloseTo(CANAL.waterY + 0.035);
    expect(firstRing.scaling.x).toBeGreaterThan(0.5);
    for (let i = 0; i < 120 && game.active; i++) game.update(0.05);
    expect(hits).toEqual(Array.from({ length: expected }, (_, i) => i + 1));
    expect(finished).toEqual([expected]);
    expect(game.active).toBe(false);
    game.dispose(); scene.dispose(); engine.dispose();
  });
  it("preserves the personal best through save validation", () => {
    const save = newSave("jaggi", { x: 0, z: 0, yaw: 0 }, []); save.bests.canalSkips = 6;
    expect(validate(save, ["jaggi"], { minX: -1000, maxX: 1000, minZ: -1000, maxZ: 1000 }).bests.canalSkips).toBe(6);
  });
  it("keeps the canal local walkable and clear of the throwing spot", () => {
    const amar = countryFolk().groups.find(group => group.id === "canalAmar")?.defs[0];
    expect(amar?.role).toBe("roamer");
    expect(amar?.lines?.some(line => line.includes("stone"))).toBe(true);
    expect(amar && isOpenGround(amar.x, amar.z)).toBe(true);
    expect(amar && Math.hypot(amar.x - SKIPPING_LANDING.x, amar.z - SKIPPING_LANDING.z)).toBeGreaterThan(3);
  });
});
