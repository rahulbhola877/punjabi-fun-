import {expect,it}from "vitest";
import {PhysicsMotionType,TransformNode,Vector3}from "../../src/babylon";
import {Vehicle}from "../../src/vehicles/Vehicle";
import {SPECS}from "../../src/vehicles/specs";
import {FIXED_DT}from "../../src/app/config";
import type {StaticColliderBuilder}from "../../src/physics/Physics";
import {makeWorld,v3}from "./harness";

async function fixture(sleep=true,count=1){
 let support:StaticColliderBuilder;const w=await makeWorld(c=>support=c);
 const vehicles=Array.from({length:count},(_,i)=>{
  const model={root:new TransformNode('car-visual'+i,w.scene),steer:new TransformNode('steer',w.scene),wheels:SPECS.car.wheels.map(()=>new TransformNode('wheel',w.scene)),meshes:[],paintable:[]};
  const v=new Vehicle('parked'+i,'car',w.scene,w.physics,model,v3(i%5*10,.05,Math.floor(i/5)*10),0,'silver');v.allowParkedSleep=sleep;return v;
 });const v=vehicles[0]!;
 let casts=0;const cast=w.physics.raycast.bind(w.physics);w.physics.raycast=(...args)=>{casts++;return cast(...args);};
 const tick=(n:number)=>{for(let i=0;i<n;i++){for(const v of vehicles)v.fixedUpdate(FIXED_DT);w.physics.step(FIXED_DT);for(const v of vehicles)v.postStep(FIXED_DT);}};
 return{w,v,vehicles,tick,casts:()=>casts,removeSupport:()=>support!.dispose()};
}

it("natively sleeps a settled dynamic car without drifting and wakes on an external impulse",async()=>{
 const benchmark=process.env.PARKED_SLEEP_BENCH==='1',a=await fixture(false,benchmark?20:1),b=await fixture(true,benchmark?20:1);
 try{
  a.tick(600);b.tick(600);
  expect(b.v.parked.sleeping).toBe(true);expect(b.w.physics.isBodySleeping(b.v.body)).toBe(true);
  expect(b.v.body.getMotionType()).toBe(PhysicsMotionType.DYNAMIC);
  const first=b.v.position.clone(),ca=a.casts(),cb=b.casts();a.tick(600);b.tick(600);
  expect(b.casts()-cb).toBe(0);expect(a.casts()-ca).toBeGreaterThan(100);
  expect(Vector3.Distance(a.v.position,b.v.position)).toBeLessThan(.002);expect(Vector3.Distance(first,b.v.position)).toBeLessThan(.0001);
  const oracle={cars:b.vehicles.length,awakeCasts:a.casts()-ca,sleepingCasts:b.casts()-cb,poseError:Vector3.Distance(first,a.v.position)};
  expect(b.vehicles.every(v=>v.parked.sleeping&&b.w.physics.isBodySleeping(v.body))).toBe(true);
  if(benchmark){const trials=[];for(let i=0;i<3;i++){const row:Record<string,number>={};for(const [label,f]of i%2?[['sleeping',b],['awakeCached',a]]as const:[['awakeCached',a],['sleeping',b]]as const){const start=process.cpuUsage();f.tick(1200);const cpu=process.cpuUsage(start);row[label]=(cpu.user+cpu.system)/1000;}trials.push(row);}process.stdout.write('native20car CPU milliseconds, alternating order '+JSON.stringify(trials)+'\n');}
  b.v.body.applyImpulse(v3(500,0,0),b.v.position);b.tick(3);
  expect(b.v.parked.sleeping).toBe(false);expect(b.v.position.x-first.x).toBeGreaterThan(.005);
  process.stdout.write('native parked sleep '+JSON.stringify({...oracle,wokeFromImpulse:true})+'\n');
 }finally{a.w.scene.dispose();b.w.scene.dispose();}
});

it("keeps collision active so another driven vehicle wakes the sleeping car",async()=>{
 const f=await fixture();
 const model={root:new TransformNode('other-car',f.w.scene),steer:new TransformNode('steer',f.w.scene),wheels:SPECS.car.wheels.map(()=>new TransformNode('wheel',f.w.scene)),meshes:[],paintable:[]};
 const other=new Vehicle('other','car',f.w.scene,f.w.physics,model,v3(-8,.05,0),Math.PI/2,'silver');
 try{
  f.tick(600);expect(f.v.parked.sleeping).toBe(true);other.hasDriver=true;other.controls={throttle:1,steer:0,handbrake:false};
  for(let i=0;i<150;i++){f.v.fixedUpdate(FIXED_DT);other.fixedUpdate(FIXED_DT);f.w.physics.step(FIXED_DT);f.v.postStep(FIXED_DT);other.postStep(FIXED_DT);}
  expect(f.v.parked.sleeping).toBe(false);expect(Math.abs(f.v.position.x)).toBeGreaterThan(.1);
 }finally{f.w.scene.dispose();}
});

it("initializes recovery interpolation at the corrected hill height",async()=>{
 const f=await fixture(false);
 try{f.v.placeAt(v3(1300,0,420),0);f.v.syncVisual(0);expect(f.v.position.y).toBeGreaterThan(1);expect(f.v.model.root.position.y).toBeCloseTo(f.v.node.position.y,6);}
 finally{f.w.scene.dispose();}
});

it("wakes for a driver, proximity, changed wet conditions and disposed support",async()=>{
 const f=await fixture();
 try{
  f.tick(600);expect(f.v.parked.sleeping).toBe(true);
  f.v.hasDriver=true;f.v.controls={throttle:1,steer:0,handbrake:false};f.tick(1);expect(f.v.parked.sleeping).toBe(false);
  f.v.hasDriver=false;f.v.controls={throttle:0,steer:0,handbrake:true};f.tick(600);expect(f.v.parked.sleeping).toBe(true);
  f.v.allowParkedSleep=false;f.tick(1);expect(f.v.parked.sleeping).toBe(false);
  f.v.allowParkedSleep=true;f.tick(600);expect(f.v.parked.sleeping).toBe(true);
  f.v.wetGrip=.9;f.tick(1);expect(f.v.parked.sleeping).toBe(false);
  f.v.wetGrip=1;f.tick(600);expect(f.v.parked.sleeping).toBe(true);
  const y=f.v.position.y;f.removeSupport();f.tick(30);expect(f.v.parked.sleeping).toBe(false);expect(f.v.position.y).toBeLessThan(y-.2);
 }finally{f.w.scene.dispose();}
});
