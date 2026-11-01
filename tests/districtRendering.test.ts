import {afterEach,expect,it,vi} from "vitest";
import {MeshBuilder,NullEngine,Scene,StandardMaterial,TransformNode,UniversalCamera,Vector3} from "../src/babylon";
import {batchShadowCasters} from "../src/render/DistrictShadowBatch";
import {visibleCinematicEye} from "../src/camera/CinematicOcclusion";
import {CinematicDirector,interactionShots} from "../src/camera/CinematicDirector";
import {PursuitMotion} from "../src/camera/PursuitMotion";
import type {Vehicle} from "../src/vehicles/Vehicle";
import {KitHuman} from "../src/characters/KitHuman";
import {skinnedDistanceDetail} from "../src/render/SkinnedDistanceDetail";
import {districtCameraEye}from '../src/alternate/DistrictCamera';

class Element extends EventTarget {hidden=false;dataset:Record<string,string>={};className="";textContent="";append():void{}setAttribute():void{}remove():void{}}
afterEach(()=>vi.unstubAllGlobals());

it("keeps follow cameras outside each destination's house footprints while allowing roof clearance",()=>{
 for(const [id,target,eye,limit]of [
  ['japan',new Vector3(0,1.45,-15),new Vector3(12,3,-15),6.25],
  ['china',new Vector3(41,1.45,-51),new Vector3(55,3,-51),45.75],
  ['neon',new Vector3(0,1.45,-17),new Vector3(14,3,-17),9.25],
  ['space',new Vector3(0,1.45,-22),new Vector3(20,3,-22),13.25],
 ] as const)expect(districtCameraEye(id,target,eye).x).toBeLessThan(limit);
 const above=new Vector3(12,20,-15);expect(districtCameraEye('japan',new Vector3(0,1.45,-15),above)).toBe(above);
});

it("retains live skin weights and the near body while reducing distant character geometry",()=>{
 const engine=new NullEngine(),scene=new Scene(engine),human=new KitHuman(scene,"detail",{archetype:"male",outfit:"street_casual"},new StandardMaterial("skin",scene));
 try {
  const near=human.mesh.getTotalIndices(),lod=skinnedDistanceDetail(human.mesh)!;
  expect(lod).not.toBeNull();expect(lod.getTotalIndices()).toBeLessThan(near*0.9);expect(human.mesh.getTotalIndices()).toBe(near);expect(lod.skeleton).toBe(human.skeleton);expect(lod.parent).toBe(human.mesh.parent);
  const weights=lod.getVerticesData("matricesWeights")!;for(let i=0;i<weights.length;i+=4)expect(weights[i]!+weights[i+1]!+weights[i+2]!+weights[i+3]!).toBeCloseTo(1,5);
  const sourceBounds=human.mesh.getBoundingInfo().boundingBox,lodBounds=lod.getBoundingInfo().boundingBox;
  expect(Vector3.Distance(sourceBounds.minimum,lodBounds.minimum)).toBeLessThan(0.13);expect(Vector3.Distance(sourceBounds.maximum,lodBounds.maximum)).toBeLessThan(0.13);
 }finally{human.dispose();scene.dispose();engine.dispose();}
});

it("bakes depth silhouettes in world space without mutating or showing source geometry twice",()=>{
 const engine=new NullEngine(),scene=new Scene(engine);
 try {
  const parent=new TransformNode("house",scene);parent.position.set(10,0,6);parent.scaling.x=-1;
  const a=MeshBuilder.CreateBox("roof",{size:2},scene);a.parent=parent;a.position.x=2;a.material=new StandardMaterial("tile",scene);
  const source=Array.from(a.getVerticesData("position")!),batch=batchShadowCasters(scene,[a])!;
  expect(batch.layerMask).toBe(0);expect(batch.getTotalIndices()).toBe(a.getTotalIndices());expect(batch.skeleton).toBeNull();
  expect(batch.getBoundingInfo().boundingBox.minimumWorld.x).toBeCloseTo(7);expect(batch.getBoundingInfo().boundingBox.maximumWorld.z).toBeCloseTo(7);
  expect(a.isDisposed()).toBe(false);expect(Array.from(a.getVerticesData("position")!)).toEqual(source);expect(a.material!.name).toBe("tile");
 }finally{scene.dispose();engine.dispose();}
});

it("sees non-collider decorative pillars and falls back to an unobstructed speaker shot",async()=>{
 const engine=new NullEngine(),scene=new Scene(engine),camera=new UniversalCamera("camera",new Vector3(0,3,-8),scene);
 vi.stubGlobal("document",Object.assign(new EventTarget(),{createElement:()=>new Element(),hidden:false}));vi.stubGlobal("window",new EventTarget());vi.stubGlobal("navigator",{getGamepads:()=>[]});
 const pillar=MeshBuilder.CreateBox("world_decorative_pillar",{width:0.9,height:4,depth:0.9},scene);pillar.position.y=2;pillar.isPickable=false;pillar.material=new StandardMaterial("paint",scene);pillar.computeWorldMatrix(true);
 const director=new CinematicDirector(new Element() as unknown as HTMLElement,camera,(at,eye)=>visibleCinematicEye(scene,at,eye));
 try {
  expect(visibleCinematicEye(scene,new Vector3(0,1.5,2),new Vector3(0,1.5,-3)).z).toBeGreaterThan(0);
  const done=director.play(interactionShots(-2,0,0,2,0,0,"Talk"));
  const toFace=new Vector3(2,1.47,0).subtract(camera.position).normalize();
  expect(Vector3.Dot(camera.getDirection(Vector3.Forward()),toFace)).toBeGreaterThan(0.995);
  const eye=camera.position.clone();window.dispatchEvent(new Event("blur"));director.update(0.25);expect(camera.position.equalsWithEpsilon(eye)).toBe(true);expect(director.advancing).toBe(false);
  window.dispatchEvent(new Event("focus"));director.update(0.25);expect(director.advancing).toBe(true);director.finish();await done;
 }finally{director.dispose();scene.dispose();engine.dispose();}
});

it("stages real pursuit actors in bounded steps and stops rather than crossing an obstacle",()=>{
 const actor=(x:number,z:number,yaw=0)=>{
  const a={position:new Vector3(x,0,z),yaw,forwardSpeed:4,cinematicAdvance(distance:number,heading:number){this.yaw=heading;this.position.addInPlace(new Vector3(Math.sin(heading)*distance,0,Math.cos(heading)*distance));}};
  return a as unknown as Vehicle;
 };
 const player=actor(0,0),patrol=actor(0,-5),motion=new PursuitMotion(player,patrol,(v,d,yaw)=>v.position.z+Math.cos(yaw)*d<=0.5);
 motion.update(5);expect(player.position.z).toBeCloseTo(0.4);expect(patrol.position.z).toBeCloseTo(-4.6);
 for(let i=0;i<20;i++)motion.update(0.1);
 expect(player.position.z).toBeLessThanOrEqual(0.5);expect(player.position.z).toBeGreaterThan(0.4);expect(patrol.position.z).toBeLessThanOrEqual(0.5);
});
