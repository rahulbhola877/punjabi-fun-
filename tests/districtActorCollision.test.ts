import { describe, expect, it } from "vitest";
import { canMoveDistrictActor, DISTRICT_ACTOR_RADIUS, moveDistrictPlayer, moveDistrictWalker } from "../src/alternate/districtActorCollision";
import { JAPAN_WORLD } from "../src/alternate/japanMap";
import { CHINA_WORLD } from "../src/alternate/chinaMap";

const gap = DISTRICT_ACTOR_RADIUS * 2;
const ground = () => 0;
const open = () => true;

describe("district actor collision", () => {
  it("stops slow-frame running at a named actor while preserving interaction range and retreat", () => {
    for (const [npc, range] of [[JAPAN_WORLD.shopkeeper, 2.2], [CHINA_WORLD.host, 2.5]] as const) {
      const target = { ...npc, y: 0 }, p = { x: npc.x - 3, y: 0, z: npc.z };
      for (let i = 0; i < 10; i++) moveDistrictPlayer(p,1,0,6,0.25,[target],open,ground);
      const distance = Math.hypot(p.x-target.x,p.z-target.z);
      expect(distance).toBeGreaterThanOrEqual(gap - 1e-8);
      expect(distance).toBeLessThan(range);
      const before = p.x;
      moveDistrictPlayer(p,-1,0,6,0.25,[target],open,ground);
      expect(p.x).toBeLessThan(before);
    }
  });
  it("slides on an oblique approach without entering a body", () => {
    const npc = {x:0,y:0,z:0}, p = {x:-1,y:0,z:-0.3};
    for (let i=0;i<10;i++) {
      moveDistrictPlayer(p,1,0.2,6,0.2,[npc],open,ground);
      expect(Math.hypot(p.x,p.z)).toBeGreaterThanOrEqual(gap - 1e-8);
    }
    // Either side is valid: progress beyond the body is the actual requirement.
    expect(p.x).toBeGreaterThan(1);
  });
  it("stops a moving walker at the hero and resumes when the hero retreats or the route reverses", () => {
    const walker={x:0,y:0,z:-2}, hero={x:0,y:0,z:0};
    moveDistrictWalker(walker,1,3,[hero],ground,open);
    expect(walker.z).toBeLessThanOrEqual(-gap + 1e-8);
    const stopped=walker.z;
    moveDistrictWalker(walker,stopped-0.5,0.5,[hero],ground,open);
    expect(walker.z).toBeLessThan(stopped);
    hero.z=2;
    moveDistrictWalker(walker,2,1,[hero],ground,open);
    expect(walker.z).toBeGreaterThan(stopped);
  });
  it("ignores self, respects vertical separation and permits escape from an existing overlap", () => {
    const a={x:0,y:0,z:0}, b={x:0.1,y:0,z:0};
    expect(canMoveDistrictActor(a,0.1,0,0,[a])).toBe(true);
    expect(canMoveDistrictActor({...a,y:2},0.1,2,0,[b])).toBe(true);
    expect(canMoveDistrictActor(a,-0.1,0,0,[b])).toBe(true);
    expect(canMoveDistrictActor(a,0.05,0,0,[b])).toBe(false);
    expect(canMoveDistrictActor(a,0.2,0,0,[b])).toBe(false);
  });
  it("rejects a full crossing and grazing chord even when both endpoints are clear", () => {
    const npc={x:0,y:0,z:0};
    expect(canMoveDistrictActor({x:-2,y:0,z:0},2,0,0,[npc])).toBe(false);
    expect(canMoveDistrictActor({x:-0.025,y:0,z:gap-0.0001},0.025,0,gap-0.0001,[npc])).toBe(false);
    expect(canMoveDistrictActor({x:-2,y:0,z:gap},2,0,gap,[npc])).toBe(true);
  });
  it("keeps a sliding player clear of a second actor and adjacent static geometry", () => {
    const actors=[{x:0,y:0,z:0},{x:0,y:0,z:-1.5}], p={x:-2,y:0,z:-0.3};
    const free=(x:number,z:number) => x < 0.4 && z > -0.8;
    for(let i=0;i<30;i++) {
      const before={...p};
      moveDistrictPlayer(p,1,0.2,6,0.25,actors,free,ground);
      expect(free(p.x,p.z)).toBe(true);
      expect(Math.hypot(p.x-before.x,p.z-before.z)).toBeLessThanOrEqual(1.5+1e-8);
      for(const other of actors) expect(Math.hypot(p.x-other.x,p.z-other.z)).toBeGreaterThanOrEqual(gap-1e-8);
    }
    const before={...p};
    moveDistrictPlayer(p,-1,0,6,0.25,actors,free,ground);
    expect(p.x).toBeLessThan(before.x);
  });
  it("stops two approaching walkers and permits both to reverse without swapping sides", () => {
    const a={x:0,y:0,z:-2}, b={x:0,y:0,z:2}, actors=[a,b];
    for(let i=0;i<20;i++) {
      moveDistrictWalker(a,2,0.25,actors,ground,open);
      moveDistrictWalker(b,-2,0.25,actors,ground,open);
      expect(b.z-a.z).toBeGreaterThanOrEqual(gap-1e-8);
    }
    const before=b.z-a.z;
    moveDistrictWalker(a,-2,0.25,actors,ground,open);
    moveDistrictWalker(b,2,0.25,actors,ground,open);
    expect(b.z-a.z).toBeGreaterThan(before);
  });
  it("stops a walker at a stationary NPC and at thin static geometry", () => {
    const walker={x:0,y:0,z:-2}, npc={x:0,y:0,z:0}, hero={x:20,y:0,z:20};
    moveDistrictWalker(walker,4,6,[npc,hero],ground,open);
    expect(walker.z).toBeLessThanOrEqual(-gap+1e-8);
    walker.z=-2;
    moveDistrictWalker(walker,4,6,[hero],ground,(_x,z) => z < -0.5 || z > -0.3);
    expect(walker.z).toBeLessThan(-0.5+1e-8);
    const before=walker.z;
    moveDistrictWalker(walker,4,0.2,[hero],ground,open);
    expect(walker.z-before).toBeCloseTo(0.2,8);
  });
  it("retains frame-rate independent input speed, analog magnitude and background-time clipping", () => {
    const travel=(fps:number,dx:number,dz:number) => {
      const p={x:0,y:0,z:0};
      for(let i=0;i<fps;i++) moveDistrictPlayer(p,dx,dz,6,1/fps,[],open,ground);
      return Math.hypot(p.x,p.z);
    };
    expect(travel(5,0,1)).toBeCloseTo(6,8);
    expect(travel(5,1,1)).toBeCloseTo(travel(60,0,1),8);
    expect(travel(5,0,0.5)).toBeCloseTo(3,8);
    const p={x:0,y:0,z:0};
    moveDistrictPlayer(p,1,0,6,12,[],open,ground);
    expect(p.x).toBeCloseTo(0.3,8);
    for(const dt of [0,-1,NaN,Infinity]) expect(moveDistrictPlayer(p,1,0,6,dt,[],open,ground)).toBe(false);
  });
});
