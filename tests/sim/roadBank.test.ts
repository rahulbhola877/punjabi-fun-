import {expect,it}from "vitest";
import {TransformNode,Vector3}from "../../src/babylon";
import {Vehicle}from "../../src/vehicles/Vehicle";
import {SPECS}from "../../src/vehicles/specs";
import {FIXED_DT}from "../../src/app/config";
import {makeWorld,v3}from "./harness";

it("settles onto the bank of a road instead of correcting it toward world level",async()=>{
  const bank=.15,w=await makeWorld(c=>c.add(0,2,0,80,.4,80,0,bank));
  const model={root:new TransformNode('car-visual',w.scene),steer:new TransformNode('steer',w.scene),wheels:SPECS.car.wheels.map(()=>new TransformNode('wheel',w.scene)),meshes:[],paintable:[]};
  const v=new Vehicle('banked-car','car',w.scene,w.physics,model,v3(0,3,0),Math.PI/2,'silver');
  try{
    for(let i=0;i<300;i++){v.fixedUpdate(FIXED_DT);w.physics.step(FIXED_DT);v.postStep(FIXED_DT);}
    const normal=v3(0,Math.cos(bank),Math.sin(bank)),right=v.dir(v3(1,0,0)),fwd=v.dir(v3(0,0,1));
    const residual={right:Vector3.Dot(normal,right),forward:Vector3.Dot(normal,fwd),grounded:v.grounded};
    process.stdout.write('banked road residual '+JSON.stringify(residual)+'\n');
    expect(v.grounded).toBe(true);expect(Math.abs(residual.right)).toBeLessThan(.035);expect(Math.abs(residual.forward)).toBeLessThan(.035);
  }finally{w.scene.dispose();}
});
