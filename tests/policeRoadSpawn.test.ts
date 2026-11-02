import {expect,it}from "vitest";
import {NavGraph}from "../src/world/nav";
import {patrolOnDrivableRoad,policeRoadSpawn}from "../src/traffic/policeRoadSpawn";

it("joins a free connected lane behind the player, excluding field and dirt-track nodes",()=>{
 const g=new NavGraph(),road={id:'test',x0:-300,x1:300,z0:-7,z1:7,kind:'highway' as const,name:'Road'};
 const ids=[-100,-50,0,120].map(x=>{const id=g.add(x,0,'road');g.nodes[id]!.road=road;return id;});for(let i=1;i<ids.length;i++)g.link(ids[i-1]!,ids[i]!);
 const field=g.add(-90,20,'road');g.link(field,ids[2]!);
 const track=g.add(-90,-30,'road');g.nodes[track]!.road={...road,kind:'track'};g.link(track,ids[2]!);
 const p={x:0,z:0},cam={pos:{x:-8,z:0},fwd:{x:1,z:0}};
 expect(patrolOnDrivableRoad(g,{x:-100,z:3.4})).toBe(true);
 expect(patrolOnDrivableRoad(g,{x:-90,z:20})).toBe(false);
 expect(patrolOnDrivableRoad(g,{x:-152,z:-256})).toBe(false);
 expect(policeRoadSpawn(g,p,cam,()=>true)).toEqual({x:-100,z:3.4,yaw:Math.PI/2});
 const next=policeRoadSpawn(g,p,cam,x=>x>0)!;expect(next.x).toBe(120);expect(next.z).toBe(-3.4);
 expect(policeRoadSpawn(g,p,cam,()=>false)).toBeNull();
});

it("does not select a disconnected road merely because it is nearby",()=>{
 const g=new NavGraph(),goal=g.add(0,0,'road'),a=g.add(-90,0,'road'),b=g.add(-120,0,'road');
 const road={id:'isolated',x0:-150,x1:-70,z0:-5,z1:5,kind:'road' as const,name:'Isolated road'};g.nodes[a]!.road=road;g.nodes[b]!.road=road;g.link(a,b);
 expect(goal).toBe(0);expect(policeRoadSpawn(g,{x:0,z:0},{pos:{x:0,z:0},fwd:{x:1,z:0}},()=>true)).toBeNull();
});
