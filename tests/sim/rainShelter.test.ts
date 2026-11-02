import {expect,it}from "vitest";
import {RainShelter}from "../../src/world/RainShelter";
import {StaticColliderBuilder}from "../../src/physics/Physics";
import {Group}from "../../src/app/config";
import {makeWorld,v3}from "./harness";

it("matches real yawed/sloped roof collision and releases streamed cover",async()=>{
  const boxes=new StaticColliderBuilder();boxes.add(0,4,0,10,.2,8,.4,.2);
  const shelter=new RainShelter();shelter.add(boxes,boxes.boxes);
  const w=await makeWorld(c=>c.add(0,4,0,10,.2,8,.4,.2));
  let covered=0,open=0;
  try{
    for(let x=-6;x<=6;x+=2)for(let z=-6;z<=6;z+=2){
      const hit=w.physics.raycast(v3(x,12,z),v3(x,1,z),Group.STATIC),top=shelter.heightAt(x,z);
      if(hit){expect(top).toBeCloseTo(hit.hitPointWorld.y,4);covered++;}
      else{expect(top).toBe(-Infinity);open++;}
    }
    expect(covered).toBeGreaterThan(10);expect(open).toBeGreaterThan(10);
    shelter.remove(boxes);expect(shelter.heightAt(0,0)).toBe(-Infinity);
  }finally{w.scene.dispose();}
});

it("keeps doorways and courtyards open while covering interiors and overlaps",()=>{
  const roofs=new StaticColliderBuilder();roofs.add(0,3,0,8,.2,6);roofs.add(1,6,1,3,.2,3);
  roofs.add(12,2,0,.2,4,6); // a wall alone is not a roof
  const shelter=new RainShelter();shelter.add(roofs,roofs.boxes);
  expect(shelter.heightAt(-2,0)).toBeCloseTo(3.1);expect(shelter.heightAt(1,1)).toBeCloseTo(6.1);
  expect(shelter.heightAt(0,4)).toBe(-Infinity);expect(shelter.heightAt(12,0)).toBe(-Infinity);
  shelter.clear();expect(shelter.heightAt(1,1)).toBe(-Infinity);
});
