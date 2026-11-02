import {expect,it,vi}from "vitest";
import {Vector3}from "../src/babylon";
import {selectInteraction}from "../src/app/selectInteraction";

const player=Vector3.Zero();
function action(id:string,x:number,z:number,radius=2){return{id,pos:new Vector3(x,0,z),radius,run:vi.fn()};}

it('valid delivery wins the reported negative bell score regardless of candidate order',()=>{
 const bell=action('bell_neighbour',1,0),bike=action('vehicle_bicycle',0,.05),delivery=action('deliver',0,0,99);
 for(const candidates of [[bell,bike,delivery],[delivery,bell,bike],[bike,delivery,bell]])expect(selectInteraction(candidates,player,0)).toBe(delivery);
 selectInteraction([bell,bike,delivery],player,0)!.run();
 expect(delivery.run).toHaveBeenCalledOnce();expect(bell.run).not.toHaveBeenCalled();expect(bike.run).not.toHaveBeenCalled();
});

it('passenger drop-off uses the same explicit completion priority and preserves stable completion order',()=>{
 const bell=action('bell_neighbour',0,.01),drop=Object.assign(action('deliver',0,0,99),{label:'Drop your passenger here'}),other=Object.assign(action('deliver',0,0,99),{label:'Hand the tiffin over'});
 expect(selectInteraction([bell,drop],player,0)).toBe(drop);
 expect(selectInteraction([bell,other,drop],player,0)).toBe(other);
});

it('does not promote a delivery outside its valid radius or with an invalid distance',()=>{
 const bell=action('bell_neighbour',1,0),far=action('deliver',5,0,1),invalid={...action('deliver',0,0),dist:()=>NaN};
 expect(selectInteraction([far,invalid,bell],player,0)).toBe(bell);
 expect(selectInteraction([far,invalid],player,0)).toBeNull();
});

it('retains bell preference over a reachable bicycle outline when no completion is eligible',()=>{
 const bell=action('bell_neighbour',1,0),bike={...action('vehicle_bicycle',5,0),dist:()=>.05};
 expect(selectInteraction([bike,bell],player,0)).toBe(bell);
 selectInteraction([bike,bell],player,0)!.run();expect(bell.run).toHaveBeenCalledOnce();expect(bike.run).not.toHaveBeenCalled();
 expect(selectInteraction([bike,{...bell,radius:.5}],player,0)).toBe(bike);
});

it('preserves ordinary facing/chat scoring, custom reach and stable ties',()=>{
 const front=action('shop_front',0,1),back=action('shop_back',0,-1),chat=action('chat_person',0,.5);
 expect(selectInteraction([back,chat,front],player,0)).toBe(front);
 const copy=action('shop_copy',0,1);expect(selectInteraction([front,copy],player,0)).toBe(front);
 const delivery={...action('deliver',20,0),dist:()=>.1};expect(selectInteraction([front,delivery],player,0)).toBe(delivery);
});
