import {expect,it}from "vitest";
import {Ray}from "@babylonjs/core/Culling/ray";
import {NullEngine,Scene,StandardMaterial,Vector3,VertexBuffer,type Mesh}from "../../src/babylon";
import {Group}from "../../src/app/config";
import {ForestWaterProps}from "../../src/missions/ForestWater";
import type {Materials}from "../../src/render/Materials";
import {groundHeight}from "../../src/world/groundHeight";
import {buildRidgeCollider}from "../../src/world/ridge";
import {makeWorld,v3}from "./harness";

function propsIn(scene:Scene){
 const material=new StandardMaterial('forest-test',scene);
 return new ForestWaterProps(scene,{get:()=>material}as unknown as Materials);
}
const waterNames=['forest_spring_water','forest_pool_water','forest_hillside_water'];
const highestVisual=(ray:Ray,meshes:Mesh[])=>meshes.filter(m=>m.isEnabled()).map(m=>ray.intersectsMesh(m)).filter(h=>h.hit).sort((a,b)=>a.distance-b.distance)[0];

it('restores only the selected shallow outlet and measures immersion above the actual ridge',()=>{
 const engine=new NullEngine(),scene=new Scene(engine),props=propsIn(scene);
 try{
  const points=[[-880,1914.5],[-890,1904],[-879,1904.5]]as const;
  for(let stage=0;stage<=7;stage++){
   props.sync({forestWaterStage:stage});
   const expected=[stage>=4,stage===4||stage===6,stage===5||stage===7];
   points.forEach(([x,z],i)=>{
    const feet=groundHeight(x,z),surface=props.surfaceYAt(x,z);
    expect(surface!==null,`stage ${stage}, outlet ${i}`).toBe(expected[i]);
    if(expected[i]){
     expect(props.depthAt(x,z,feet)).toBeGreaterThan(.16);
     expect(props.depthAt(x,z,feet)).toBeLessThan(.22);
     expect(props.depthAt(x,z,surface!+.01)).toBe(0);
     expect(props.depthAt(x,z,surface!-.07)).toBeCloseTo(.07,7);
    }else expect(props.depthAt(x,z,feet)).toBe(0);
   });
  }
  expect(props.surfaceYAt(-900,1910)).toBeNull();
  expect(props.surfaceYAt(Number.NaN,1904)).toBeNull();
  expect(props.depthAt(-890,1904,Number.NaN)).toBe(0);
 }finally{scene.dispose();engine.dispose();}
});

it('samples the actual rendered Float32 water triangles and keeps feet outside strip edges dry',()=>{
 const engine=new NullEngine(),scene=new Scene(engine),props=propsIn(scene);
 try{
  for(const stage of [6,7]){
   props.sync({forestWaterStage:stage});
   const waters=waterNames.map(name=>scene.getMeshByName(name)as Mesh);
   for(const mesh of waters.filter(m=>m.isEnabled())){
    mesh.computeWorldMatrix(true);const p=mesh.getVerticesData(VertexBuffer.PositionKind)!,indices=mesh.getIndices()!;
    for(let i=0;i<indices.length;i+=33){
     const ids=[indices[i]!*3,indices[i+1]!*3,indices[i+2]!*3];
     const x=ids.reduce((n,j)=>n+p[j]!,0)/3,z=ids.reduce((n,j)=>n+p[j+2]!,0)/3;
     const hit=highestVisual(new Ray(v3(x,40,z),v3(0,-1,0),40),waters);
     expect(hit?.pickedPoint).not.toBeNull();
     expect(props.surfaceYAt(x,z)).toBeCloseTo(hit!.pickedPoint!.y,5);
    }
   }
  }
  props.sync({forestWaterStage:6});
  // Bounds must include the uploaded Float32 edge, not the pre-upload double.
  expect(props.surfaceYAt(-868.5855712890625,1927.677734375)).not.toBeNull();
  expect(props.surfaceYAt(-888.69,1904)).toBeNull(); // wider pool ends at x=-888.7
  expect(props.surfaceYAt(-890,1902.99)).toBeNull();
  const bed=scene.getMeshByName('forest_channel_bed')!;
  const hit=new Ray(v3(-890,40,1904),v3(0,-1,0),40).intersectsMesh(bed);
  expect(hit.hit).toBe(true);
  // The wide bed quad can cross a ridge triangle edge; it must still remain
  // flush within 5 mm, rather than sitting on the former raised .14 m bed.
  expect(Math.abs(hit.pickedPoint!.y-groundHeight(-890,1904)-.003)).toBeLessThan(.005);
 }finally{scene.dispose();engine.dispose();}
});

it('matches native sluice/log collision to visual meshes and removes/restores logs immediately',async()=>{
 const w=await makeWorld((_c,scene)=>buildRidgeCollider(scene)),base=w.physics.engine.getBodies().length,props=propsIn(w.scene);
 try{
  props.sync({forestWaterStage:2});
  expect(w.physics.engine.getBodies()).toHaveLength(base+4);
  const gate=w.scene.getMeshByName('forest_sluice_gate')as Mesh,gy=groundHeight(-869,1928);
  const gateRay=new Ray(v3(-870.2,gy+.55,1928),v3(1,0,0),.8),gateVisual=gateRay.intersectsMesh(gate);
  expect(gateVisual.hit).toBe(true);
  const gateHit=w.physics.raycast(gateRay.origin,gateRay.origin.add(gateRay.direction.scale(gateRay.length)),Group.STATIC);
  expect(gateHit?.body?.transformNode).toBe(gate);
  expect(Vector3.Distance(gateHit!.hitPointWorld,gateVisual.pickedPoint!)).toBeLessThan(.002);
  const logs=Array.from({length:3},(_,i)=>w.scene.getMeshByName(`forest_water_log_${i}`)as Mesh);
  const oldBodies=logs.map(m=>m.physicsBody!);
  for(const log of logs){
   const ray=new Ray(log.position.add(v3(0,2,0)),v3(0,-1,0),4),visual=highestVisual(ray,logs);
   expect(visual?.hit).toBe(true);
   const hit=w.physics.raycast(ray.origin,ray.origin.add(ray.direction.scale(ray.length)),Group.STATIC);
   expect(hit?.body?.transformNode.name).toMatch(/^forest_water_log_/);
   expect(Vector3.Distance(hit!.hitPointWorld,visual.pickedPoint!)).toBeLessThan(.002);
  }
  props.sync({forestWaterStage:3});
  expect(oldBodies.every(b=>b.isDisposed)).toBe(true);
  expect(w.physics.engine.getBodies()).toHaveLength(base+1);
  for(const log of logs){
   const hit=w.physics.raycast(log.position.add(v3(0,2,0)),log.position.add(v3(0,-2,0)),Group.STATIC);
   expect(hit?.body?.transformNode.name).toBe('ridge_collider');
   expect(hit!.hitPointWorld.y).toBeCloseTo(groundHeight(log.position.x,log.position.z),2);
  }
  props.sync({forestWaterStage:0});
  expect(w.physics.engine.getBodies()).toHaveLength(base+4);
  for(let i=0;i<logs.length;i++)expect(logs[i]!.physicsBody).not.toBe(oldBodies[i]);
  for(let i=0;i<20;i++)props.sync({forestWaterStage:0});
  expect(w.physics.engine.getBodies()).toHaveLength(base+4);
  const log=logs[0]!,hit=w.physics.raycast(log.position.add(v3(0,2,0)),log.position.add(v3(0,-2,0)),Group.STATIC);
  expect(hit?.body?.transformNode.name).toMatch(/^forest_water_log_/);
  props.dispose();props.dispose();props.sync({forestWaterStage:0});
  expect(w.physics.engine.getBodies()).toHaveLength(base);
  expect(w.scene.meshes.some(m=>m.name.startsWith('forest_'))).toBe(false);
  expect(props.surfaceYAt(-890,1904)).toBeNull();
 }finally{props.dispose();w.scene.dispose();}
});
