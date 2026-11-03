import { describe, expect, it } from "vitest";
import { DISTRICT_ACTOR_RADIUS, moveDistrictPlayer, moveDistrictWalker } from "../src/alternate/districtActorCollision";
import { canWalkJapan, JAPAN_WORLD } from "../src/alternate/japanMap";
import { canWalkChina, chinaHeight, CHINA_WORLD } from "../src/alternate/chinaMap";

const gap = DISTRICT_ACTOR_RADIUS * 2, flat = () => 0;
const canWalkChinaActor = (x:number,z:number) => canWalkChina(x,z,DISTRICT_ACTOR_RADIUS);
const japanPeople = [JAPAN_WORLD.shopkeeper,JAPAN_WORLD.resident,JAPAN_WORLD.neighbor,{x:1.8,z:-8}];
const chinaPeople = [CHINA_WORLD.host,CHINA_WORLD.artisan,CHINA_WORLD.musician,CHINA_WORLD.keeper,
  {x:25,z:-35},{x:-49,z:20},{x:-22,z:30},{x:-15,z:22}];

describe("authored district actors and interaction approaches", () => {
  it("keeps the China market pole solid while fitting the narrower NPC on its authored lane", () => {
    expect(canWalkChina(-15,24)).toBe(false);
    expect(canWalkChinaActor(-15,24)).toBe(true);
    expect(canWalkChinaActor(-15.03,24)).toBe(false);
    expect(canWalkChinaActor(-15.5,24)).toBe(false);
    expect(canWalkChina(-14.95,24)).toBe(true);
  });
  for(const [name,npc,dx,dz,range,free,height,people] of [
    ["Aiko",JAPAN_WORLD.shopkeeper,-1,0,2.2,canWalkJapan,flat,japanPeople],
    ["Ken",JAPAN_WORLD.resident,1,0,2.2,canWalkJapan,flat,japanPeople],
    ["Yuna",JAPAN_WORLD.neighbor,0,1,2.2,canWalkJapan,flat,japanPeople],
    ["Mei",CHINA_WORLD.host,0,1,2.5,canWalkChina,chinaHeight,chinaPeople],
    ["Lin",CHINA_WORLD.artisan,0,1,2.5,canWalkChina,chinaHeight,chinaPeople],
    ["Wen",CHINA_WORLD.musician,-1,0,2.5,canWalkChina,chinaHeight,chinaPeople],
    ["Shu",CHINA_WORLD.keeper,-1,0,2.5,canWalkChina,chinaHeight,chinaPeople],
  ] as const) {
    it(`keeps ${name} solid, in interaction range, and permits retreat at 4 FPS`, () => {
      const p={x:npc.x-dx*3,y:0,z:npc.z-dz*3};
      p.y=height(p.x,p.z);
      const actors=people.map(other => ({...other,y:height(other.x,other.z)}));
      expect(free(p.x,p.z)).toBe(true);
      for(let frame=0;frame<20;frame++) {
        moveDistrictPlayer(p,dx,dz,6,0.25,actors,free,height);
        expect(free(p.x,p.z)).toBe(true);
        expect(p.y).toBeCloseTo(height(p.x,p.z),8);
        for(const other of actors) expect(Math.hypot(p.x-other.x,p.z-other.z)).toBeGreaterThanOrEqual(gap-1e-8);
      }
      const distance=Math.hypot(p.x-npc.x,p.z-npc.z);
      expect(distance).toBeLessThan(range);
      moveDistrictPlayer(p,-dx,-dz,6,0.25,actors,free,height);
      expect(Math.hypot(p.x-npc.x,p.z-npc.z)).toBeGreaterThan(distance+1);
    });
  }

  for(const [name,x,z,centre,amplitude,frequency,free,height,people] of [
    ["Japan passerby",1.8,-8,-8,7,0.12,canWalkJapan,flat,japanPeople],
    ["China river walker",25,-35,-35,10,0.10,canWalkChinaActor,chinaHeight,chinaPeople],
    ["China market walker",-15,22,24,4,0.14,canWalkChinaActor,chinaHeight,chinaPeople],
  ] as const) {
    it(`${name} stays on its authored route without crossing the player or scenery after a long blockage`, () => {
      const walker={x,y:height(x,z),z}, hero={x,y:height(x,centre+1),z:centre+1};
      const others=people.filter(p => p.x!==x || p.z!==z).map(p => ({...p,y:height(p.x,p.z)}));
      const actors=[walker,hero,...others], dt=0.2, maxSpeed=amplitude*frequency;
      let blocked=false, resumed=false, minZ=Infinity, maxZ=-Infinity;
      for(let frame=1;frame<=900;frame++) {
        if(frame===151) hero.x+=3;
        const before=walker.z;
        moveDistrictWalker(walker,centre+amplitude*Math.sin(frame*dt*frequency),maxSpeed*dt,actors,height,free);
        expect(Math.abs(walker.z-before)).toBeLessThanOrEqual(maxSpeed*dt+1e-8);
        expect(walker.z).toBeGreaterThanOrEqual(centre-amplitude-1e-8);
        expect(walker.z).toBeLessThanOrEqual(centre+amplitude+1e-8);
        expect(free(walker.x,walker.z)).toBe(true);
        for(const other of [hero,...others]) expect(Math.hypot(walker.x-other.x,walker.z-other.z)).toBeGreaterThanOrEqual(gap-1e-8);
        if(frame<150 && Math.abs(walker.z-before)<1e-8 && Math.abs(walker.z-hero.z)<gap+0.1) blocked=true;
        if(frame>151 && Math.abs(walker.z-before)>0.001) resumed=true;
        if(frame>300) { minZ=Math.min(minZ,walker.z); maxZ=Math.max(maxZ,walker.z); }
      }
      expect(blocked).toBe(true);
      expect(resumed).toBe(true);
      expect(minZ).toBeLessThan(centre-amplitude+0.05);
      expect(maxZ).toBeGreaterThan(centre+amplitude-0.05);
    });
  }
});
