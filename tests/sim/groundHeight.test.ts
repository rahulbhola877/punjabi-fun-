import {expect,it}from "vitest";
import {makeWorld,v3}from "./harness";
import {Group}from "../../src/app/config";
import {buildTerrainCollider}from "../../src/world/terrainCollider";
import {orchardCollider}from "../../src/world/orchard";
import {buildRidgeCollider}from "../../src/world/ridge";
import {groundHeight}from "../../src/world/groundHeight";

it("places weather/planting on the actual hill, orchard and ridge triangles",async()=>{
 const w=await makeWorld((_c,s)=>{buildTerrainCollider(s);orchardCollider(s);buildRidgeCollider(s);});
 try{
  const points=[[1262.7,641.9],[1388.3,658.7],[1301.3,419.7],[1446.5,447.3],[362.7,1351.3],[502.6,1367.2],[-782.3,1906.1],[-472.2,1909.7]];
  let error=0;
  for(const [x,z]of points){const y=groundHeight(x!,z!),hit=w.physics.raycast(v3(x!,80,z!),v3(x!,-5,z!),Group.STATIC);expect(hit,`${x},${z}`).not.toBeNull();error=Math.max(error,Math.abs(y-hit!.hitPointWorld.y));}
  // Havok's long rays at kilometre-scale coordinates quantize hit points.
  expect(error).toBeLessThan(.002);process.stdout.write('terrain ray maximum error metres '+error+'\n');
 }finally{w.scene.dispose();}
});
