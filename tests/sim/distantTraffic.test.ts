import {expect,it}from "vitest";
import {StandardMaterial,TransformNode,Vector3}from "../../src/babylon";
import {Vehicle}from "../../src/vehicles/Vehicle";
import {SPECS}from "../../src/vehicles/specs";
import {AIDriver}from "../../src/traffic/AIDriver";
import {Traffic,type TrafficHost,type TrafficCar}from "../../src/traffic/Traffic";
import {TrafficDecisionClock}from "../../src/traffic/TrafficDecisionClock";
import {NavGraph}from "../../src/world/nav";
import {Rng}from "../../src/render/textures";
import {FIXED_DT}from "../../src/app/config";
import {makeWorld,v3}from "./harness";

async function fixture(always=false){
 const w=await makeWorld(),graph=new NavGraph();
 const road={id:'fixture',kind:'road' as const,name:'Road',x0:-10,x1:90,z0:-10,z1:90};
 const ids=[[0,0],[0,40],[0,80],[40,80],[80,80]].map(([x,z])=>{const i=graph.add(x!,z!,'road');graph.nodes[i]!.road=road;return i;});for(let i=1;i<ids.length;i++)graph.link(ids[i-1]!,ids[i]!);
 const model={root:new TransformNode('car-visual',w.scene),steer:new TransformNode('steer',w.scene),wheels:SPECS.car.wheels.map(()=>new TransformNode('wheel',w.scene)),meshes:[],paintable:[]};
 const v=new Vehicle('civilian','car',w.scene,w.physics,model,v3(2,.05,0),0,'silver');
 for(let i=0;i<120;i++){v.fixedUpdate(FIXED_DT);w.physics.step(FIXED_DT);v.postStep(FIXED_DT);}
 v.hasDriver=true;const ai=new AIDriver(v,graph,new Rng(123));ai.follow(ids);
 let decisions=0,signals=0,elapsed=0,player=v3(150,0,-20);
 const update=ai.update.bind(ai);ai.update=dt=>{decisions++;elapsed+=dt;update(dt);};
 const host={playerPos:()=>player,playerDriving:()=>null,camera:()=>({pos:player,fwd:v3(0,0,1)}),obstacles:()=>[],honk:()=>{},signal:()=>{signals++;return Infinity;},despawnVehicle:()=>{throw Error('Unexpected release');}}as unknown as TrafficHost;
 const traffic=new Traffic(host,graph,w.scene,new StandardMaterial('fixture',w.scene));traffic.target=traffic.autoTarget=traffic.patrolTarget=0;
 const clock=new TrafficDecisionClock();if(always)clock.advance=dt=>dt;
 const car:TrafficCar={v,ai,decisions:clock,driver:null,anim:null,mood:'calm',angryT:0,police:false,patrol:false,honker:false,hornT:Infinity};traffic.cars.push(car);
 return{w,v,ai,car,traffic,step:()=>{traffic.fixedUpdate(FIXED_DT);v.fixedUpdate(FIXED_DT);w.physics.step(FIXED_DT);v.postStep(FIXED_DT);},counts:()=>({decisions,signals,elapsed}),near:()=>{player=v.position.clone();}};
}

it("cuts distant decisions on a native turn route while retaining 60 Hz physics and immediate near/hazard decisions",async()=>{
 const a=await fixture(true),b=await fixture();let maxSeparation=0;
 try{
  for(let i=0;i<900;i++){a.step();b.step();maxSeparation=Math.max(maxSeparation,Vector3.Distance(a.v.position,b.v.position));}
  const before=b.counts(),baseline=a.counts();
  process.stdout.write('distant traffic native '+JSON.stringify({baseline,far:before,maxSeparation,position:b.v.position.asArray()})+'\n');
  expect(before.decisions).toBeLessThan(baseline.decisions*.4);expect(before.signals).toBe(before.decisions);
  expect(Math.abs(before.elapsed-baseline.elapsed)).toBeLessThan(.051);
  expect(maxSeparation).toBeLessThan(1);expect(b.v.position.z).toBeGreaterThan(65);expect(b.v.position.x).toBeGreaterThan(30);expect(b.v.grounded).toBe(true);
  b.near();for(let i=0;i<6;i++)b.step();expect(b.counts().decisions-before.decisions).toBe(6);
  b.car.ai.clearAhead=0;const start=b.counts().decisions;b.step();expect(b.counts().decisions-start).toBe(1);
 }finally{a.w.scene.dispose();b.w.scene.dispose();}
});
