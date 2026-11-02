import {expect,it}from "vitest";
import {MeshBuilder,NullEngine,Scene,StandardMaterial,Texture,TransformNode}from "../src/babylon";
import {StaticShadowCells}from "../src/render/StaticShadowCells";

it("groups opaque materials spatially, preserving world silhouettes and cutout casters",()=>{
 const engine=new NullEngine(),scene=new Scene(engine);
 try{
  const parent=new TransformNode('mirrored',scene);parent.position.x=10;parent.scaling.x=-1;
  const sources=[0,2,100].map((x,i)=>{const m=MeshBuilder.CreateBox('box'+i,{size:2},scene);m.position.set(x,0,10);m.material=new StandardMaterial('paint'+i,scene);return m;});sources[0]!.parent=parent;
  const cutout=MeshBuilder.CreatePlane('leaves',{},scene),leaves=new StandardMaterial('leaves',scene);leaves.diffuseTexture=new Texture(null,scene);leaves.diffuseTexture.hasAlpha=true;cutout.material=leaves;
  const depth=new StaticShadowCells(scene,[...sources,cutout]);
  expect(depth.casters).toContain(cutout);
  const cells=depth.casters.filter(m=>m!==cutout);expect(cells.length).toBeLessThan(sources.length);
  expect(cells.reduce((n,m)=>n+m.getTotalIndices(),0)).toBe(sources.reduce((n,m)=>n+m.getTotalIndices(),0));
  expect(Math.min(...cells.map(m=>m.getBoundingInfo().boundingBox.minimumWorld.x))).toBeCloseTo(1);
  expect(cells.every(m=>m.layerMask===0&&!m.isPickable)).toBe(true);
  const meshes=scene.meshes.length;depth.dispose();expect(scene.meshes.length).toBe(meshes-cells.length);expect(sources.every(m=>!m.isDisposed())).toBe(true);expect(cutout.isDisposed()).toBe(false);
 }finally{scene.dispose();engine.dispose();}
});
