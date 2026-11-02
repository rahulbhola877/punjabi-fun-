import {expect,it}from "vitest";
import {MeshBuilder,NullEngine,PointLight,Scene,Vector3}from "../src/babylon";
import {outsideInteriorLight}from "../src/render/InteriorLights";

it("removes a finite interior light from distant static batches while retaining nearby scenery and moving actors",()=>{
 const e=new NullEngine(),s=new Scene(e);
 try{
  const l=new PointLight('interior',new Vector3(0,3,0),s);l.range=11;
  const near=MeshBuilder.CreateBox('inside',{size:2},s),far=MeshBuilder.CreateBox('far',{size:2},s),actor=MeshBuilder.CreateBox('actor',{size:2},s);
  far.position.x=40;actor.position.x=40;for(const m of [near,far,actor])m.computeWorldMatrix(true);
  l.excludedMeshes=[near,far].filter(m=>outsideInteriorLight(l,m));
  expect(near.lightSources).toContain(l);expect(far.lightSources).not.toContain(l);expect(actor.lightSources).toContain(l);
  actor.position.x=1;actor.computeWorldMatrix(true);expect(actor.lightSources).toContain(l);
 }finally{s.dispose();e.dispose();}
});
