import {expect,it}from "vitest";
import {TransformNode,Vector3}from "../../src/babylon";
import {makeWorld,v3}from "./harness";
import {Vehicle}from "../../src/vehicles/Vehicle";
import {FIXED_DT}from "../../src/app/config";
import type {VehicleModel}from "../../src/vehicles/models";
import type {StaticWheelContact}from "../../src/vehicles/StaticWheelContact";

async function fixture(uncached=false){
 const w=await makeWorld(),root=new TransformNode('visual',w.scene),steer=new TransformNode('steer',w.scene);
 const model:VehicleModel={root,steer,wheels:Array.from({length:4},()=>new TransformNode('wheel',w.scene)),meshes:[],paintable:[]};
 const v=new Vehicle('parked','car',w.scene,w.physics,model,v3(0,.05,0),0,'mint');let casts=0,last:unknown;
 const cast=w.physics.raycast.bind(w.physics);w.physics.raycast=(...args)=>{casts++;const h=cast(...args);last=h?{body:!!h.body,index:h.bodyIndex,motion:h.body?.getMotionType(),normal:h.hitNormalWorld.y,matrix:h.body?.transformNode.getWorldMatrix().updateFlag}:null;return h;};
 if(uncached)for(const wheel of (v as unknown as{wheels:Array<{support:StaticWheelContact}>}).wheels)wheel.support.query=(_from,_to,_allow,query)=>query();
 const tick=(n:number)=>{for(let i=0;i<n;i++){v.fixedUpdate(FIXED_DT);w.physics.step(FIXED_DT);v.postStep(FIXED_DT);v.syncVisual(1);}};
 return{w,v,tick,casts:()=>casts,diagnostic:()=>({last,grounded:v.grounded,linear:v.body.getLinearVelocity().asArray(),angular:v.body.getAngularVelocity().asArray(),support:(v as unknown as{wheels:Array<{support:unknown}>}).wheels.map(x=>{const s=x.support as{uses:number;body:unknown;matrixFlag:number};return{uses:s.uses,body:!!s.body,matrixFlag:s.matrixFlag};})})};
}

it('reduces native parked queries while matching continuously queried suspension',async()=>{
 const a=await fixture(true),b=await fixture();
 try{
  a.tick(240);b.tick(240);const a0=a.casts(),b0=b.casts();a.tick(120);b.tick(120);
  process.stdout.write('parked-support native evidence '+JSON.stringify({uncachedCasts:a.casts()-a0,cachedCasts:b.casts()-b0,positionError:Vector3.Distance(a.v.position,b.v.position)})+'\n');
  expect(b.casts()-b0,JSON.stringify(b.diagnostic())).toBeLessThan((a.casts()-a0)*.5);
  expect(Vector3.Distance(a.v.position,b.v.position)).toBeLessThan(.002);
  expect(Math.abs(a.v.yaw-b.v.yaw)).toBeLessThan(.01);
 }finally{a.w.scene.dispose();b.w.scene.dispose();}
});

it('casts every driven step and responds immediately to an external push',async()=>{
 const f=await fixture();
 try{
  f.tick(240);f.v.body.applyImpulse(v3(500,0,0),f.v.position);let start=f.casts();f.tick(3);
  expect(f.casts()-start).toBe(12);expect(Math.abs(f.v.position.x)).toBeGreaterThan(.005);
  f.v.hasDriver=true;f.v.controls={throttle:1,steer:0,handbrake:false};start=f.casts();f.tick(120);
  expect(f.casts()-start).toBe(480);expect(f.v.position.z).toBeGreaterThan(2);
 }finally{f.w.scene.dispose();}
});
