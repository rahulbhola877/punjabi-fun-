import {expect,it}from "vitest";
import {DirectionalLight,MeshBuilder,NullEngine,Scene,StandardMaterial,Texture,TransformNode,Vector3,type AbstractMesh}from "../src/babylon";
import {StaticShadowCells}from "../src/render/StaticShadowCells";
import {World}from "../src/world/World";
import type {Physics}from "../src/physics/Physics";

it("groups opaque materials spatially, preserving world silhouettes and cutout casters",()=>{
 const engine=new NullEngine(),scene=new Scene(engine);
 try{
  const parent=new TransformNode('mirrored',scene);parent.position.x=10;parent.scaling.x=-1;
  const sources=[0,2,100].map((x,i)=>{const m=MeshBuilder.CreateBox('box'+i,{size:2},scene);m.position.set(x,0,10);m.material=new StandardMaterial('paint'+i,scene);return m;});sources[0]!.parent=parent;
  const cutout=MeshBuilder.CreatePlane('leaves',{},scene),leaves=new StandardMaterial('leaves',scene);leaves.diffuseTexture=new Texture(null,scene);leaves.diffuseTexture.hasAlpha=true;cutout.material=leaves;
  const depth=new StaticShadowCells(scene,[...sources,cutout]);
  depth.select(new Vector3(45,0,10),120);expect(depth.casters).toContain(cutout);
  const cells=depth.casters.filter(m=>m!==cutout);expect(cells.length).toBeLessThan(sources.length);
  expect(cells.reduce((n,m)=>n+m.getTotalIndices(),0)).toBe(sources.reduce((n,m)=>n+m.getTotalIndices(),0));
  expect(Math.min(...cells.map(m=>m.getBoundingInfo().boundingBox.minimumWorld.x))).toBeCloseTo(1);
  expect(cells.every(m=>m.layerMask===0&&!m.isPickable)).toBe(true);
  depth.select(new Vector3(1000,0,10),50);expect(depth.casters).toEqual([cutout]);
  depth.select(new Vector3(45,0,10),120);
  const meshes=scene.meshes.length;depth.dispose();expect(scene.meshes.length).toBe(meshes-cells.length);expect(sources.every(m=>!m.isDisposed())).toBe(true);expect(cutout.isDisposed()).toBe(false);
 }finally{scene.dispose();engine.dispose();}
});

it("releases depth storage when shadows are disabled and rebuilds it on quality changes",()=>{
 const engine=new NullEngine(),scene=new Scene(engine),world=new World(scene,{}as Physics);
 try{
  world.sun=new DirectionalLight('sun',new Vector3(0,-1,0),scene);
  const source=MeshBuilder.CreateBox('wall',{},scene);source.material=new StandardMaterial('plaster',scene);
  (world as unknown as{staticSourceCasters:AbstractMesh[]}).staticSourceCasters=[source];
  const initial=scene.meshes.length;world.setShadowQuality('low');world.followShadows(Vector3.Zero());
  expect(scene.meshes.length).toBeGreaterThan(initial);expect(world.shadows!.getShadowMap()!.renderList).not.toContain(source);
  world.setShadowQuality('off');expect(scene.meshes.length).toBe(initial);expect(source.isDisposed()).toBe(false);
  world.setShadowQuality('high');world.followShadows(Vector3.Zero());expect(world.shadows!.getShadowMap()!.renderList!.length).toBeGreaterThan(0);
  world.setShadowQuality('off');expect(scene.meshes.length).toBe(initial);
 }finally{scene.dispose();engine.dispose();}
});
