import { describe, expect, it } from "vitest";
import { canMoveDistrictActor, DISTRICT_ACTOR_RADIUS, moveDistrictWalker } from "../src/alternate/districtActorCollision";
import { moveInDistrict } from "../src/alternate/districtMovement";
import { JAPAN_WORLD } from "../src/alternate/japanMap";
import { CHINA_WORLD } from "../src/alternate/chinaMap";

const gap = DISTRICT_ACTOR_RADIUS * 2;
const ground = () => 0;

describe("district actor collision", () => {
  it("stops slow-frame running at a named actor while preserving interaction range and retreat", () => {
    for (const [npc, range] of [[JAPAN_WORLD.shopkeeper, 2.2], [CHINA_WORLD.host, 2.5]] as const) {
      const target = { ...npc, y: 0 }, p = { x: npc.x - 3, y: 0, z: npc.z };
      for (let i = 0; i < 10; i++) moveInDistrict(p, 1, 0, 6, 0.25, (x,z) => canMoveDistrictActor(p,x,0,z,[target]));
      const distance = Math.hypot(p.x-target.x,p.z-target.z);
      expect(distance).toBeGreaterThanOrEqual(gap - 1e-8);
      expect(distance).toBeLessThan(range);
      const before = p.x;
      moveInDistrict(p,-1,0,6,0.25,(x,z) => canMoveDistrictActor(p,x,0,z,[target]));
      expect(p.x).toBeLessThan(before);
    }
  });
  it("slides on an oblique approach without entering a body", () => {
    const npc = {x:0,y:0,z:0}, p = {x:-1,y:0,z:-0.3};
    for (let i=0;i<10;i++) {
      moveInDistrict(p,1,0.2,6,0.2,(x,z) => canMoveDistrictActor(p,x,0,z,[npc]));
      expect(Math.hypot(p.x,p.z)).toBeGreaterThanOrEqual(gap - 1e-8);
    }
    expect(p.z).toBeGreaterThan(0.3);
  });
  it("stops a moving walker at the hero and resumes when the hero retreats or the route reverses", () => {
    const walker={x:0,y:0,z:-2}, hero={x:0,y:0,z:0};
    moveDistrictWalker(walker,3,hero,ground);
    expect(walker.z).toBeLessThanOrEqual(-gap + 1e-8);
    const stopped=walker.z;
    moveDistrictWalker(walker,-0.5,hero,ground);
    expect(walker.z).toBeLessThan(stopped);
    hero.z=2;
    moveDistrictWalker(walker,1,hero,ground);
    expect(walker.z).toBeGreaterThan(stopped);
  });
  it("ignores self, respects vertical separation and permits escape from an existing overlap", () => {
    const a={x:0,y:0,z:0}, b={x:0.1,y:0,z:0};
    expect(canMoveDistrictActor(a,0.1,0,0,[a])).toBe(true);
    expect(canMoveDistrictActor(a,0.1,2,0,[b])).toBe(true);
    expect(canMoveDistrictActor(a,-0.1,0,0,[b])).toBe(true);
    expect(canMoveDistrictActor(a,0.05,0,0,[b])).toBe(false);
  });
});
