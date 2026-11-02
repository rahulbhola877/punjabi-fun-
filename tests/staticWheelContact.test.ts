import {expect,it}from "vitest";
import {Matrix,PhysicsMotionType,Vector3,type PhysicsBody,type PhysicsRaycastResult}from "../src/babylon";
import {StaticWheelContact}from "../src/vehicles/StaticWheelContact";

function support(type=PhysicsMotionType.STATIC){
 const matrix=Matrix.Identity();let disposed=false,motion=type;
 const body={get isDisposed(){return disposed;},numInstances:0,getMotionType:()=>motion,transformNode:{getWorldMatrix:()=>matrix}}as unknown as PhysicsBody;
 return{body,matrix,dispose:()=>disposed=true,dynamic:()=>motion=PhysicsMotionType.DYNAMIC};
}
const hit=(body:PhysicsBody,point=new Vector3(0,0,0),normal=Vector3.Up())=>({body,hitPointWorld:point,hitNormalWorld:normal})as PhysicsRaycastResult;

it("reprojects a stationary static contact and periodically rechecks the real collider",()=>{
 const c=new StaticWheelContact(),b=support();let calls=0;
 const cast=()=>{calls++;return hit(b.body);};
 for(let i=0;i<7;i++){
  const result=c.query(new Vector3(0,1+i*0.001,0),new Vector3(0,-1,0),true,cast)!;
  expect(result.hitPointWorld.y).toBeCloseTo(0,8);
 }
 expect(calls).toBe(2);
});

it("recasts for movement, changed/disposed support, driven wheels and dynamic props",()=>{
 const b=support(),c=new StaticWheelContact(),from=new Vector3(0,1,0),to=new Vector3(0,-1,0);let calls=0;
 c.query(from,to,true,()=>hit(b.body));
 expect(c.query(from.add(new Vector3(0.001,0,0)),to.add(new Vector3(0.001,0,0)),true,()=>{calls++;return null;})).toBeNull();
 c.query(from,to,true,()=>hit(b.body));b.matrix.setTranslationFromFloats(0,1,0);c.query(from,to,true,()=>{calls++;return hit(b.body);});
 b.dispose();expect(c.query(from,to,true,()=>{calls++;return null;})).toBeNull();
 const dynamic=support(PhysicsMotionType.DYNAMIC);
 for(let i=0;i<3;i++)c.query(from,to,true,()=>{calls++;return hit(dynamic.body);});
 for(let i=0;i<3;i++)c.query(from,to,false,()=>{calls++;return hit(dynamic.body);});
 expect(calls).toBe(9);
});

it("preserves a sloped plane while a parked suspension moves vertically",()=>{
 const c=new StaticWheelContact(),b=support(),normal=new Vector3(-0.1,1,0).normalize();let calls=0;
 const cast=()=>{calls++;return hit(b.body,Vector3.Zero(),normal);};
 c.query(new Vector3(0,1,0),new Vector3(0,-1,0),true,cast);
 const r=c.query(new Vector3(0.00005,1.02,0),new Vector3(0.00005,-1,0),true,cast)!;
 expect(r.hitPointWorld.y).toBeCloseTo(r.hitPointWorld.x*0.1,8);expect(calls).toBe(1);
});
