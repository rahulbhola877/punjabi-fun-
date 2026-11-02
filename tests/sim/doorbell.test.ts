import {expect,it}from "vitest";
import {StandardMaterial,Vector3}from "../../src/babylon";
import {Doorbell,type DoorbellHost}from "../../src/crowds/Doorbell";
import type {Crowd,Resident}from "../../src/crowds/Crowd";
import type {Materials}from "../../src/render/Materials";
import {HOUSE_BELLS,houseToWorld}from "../../src/world/openHouses";
import {HOME_ID}from "../../src/world/home";
import {makeWorld,v3}from "./harness";

async function fixture(){
 const w=await makeWorld(),baseBodies=w.physics.engine.getBodies().length,material=new StandardMaterial('bell-test',w.scene);
 const unrelated={id:'ordinary-neighbour',pos:v3(0,0,0)}as Resident,residents=[unrelated],rings:Vector3[]=[],dialogues:string[]=[];
 let player=v3(0,0,0),hour=9;
 const crowd={residents,spawn:(d:{id:string;name:string;x:number;z:number})=>{
  const r={id:d.id,name:d.name,pos:v3(d.x,0,d.z),vel:Vector3.Zero(),anim:{play:()=>undefined},brain:()=>undefined}as unknown as Resident;
  residents.push(r);return r;
 },remove:(r:Resident)=>{const i=residents.indexOf(r);if(i>=0)residents.splice(i,1);},say:()=>undefined}as unknown as Crowd;
 const bells=new Doorbell({scene:w.scene,mats:{get:()=>material}as unknown as Materials,crowd,playerPos:()=>player,hour:()=>hour,
  ring:p=>rings.push(p.clone()),toast:()=>undefined,greet:()=>undefined,say:()=>null,
  dialogue:async(_who,text)=>{dialogues.push(text);return'leave';},
 }as DoorbellHost);
 return{w,bells,residents,unrelated,rings,dialogues,baseBodies,at:(h:typeof HOUSE_BELLS[number])=>{const p=houseToWorld(h,h.gateU,2.2);player=v3(p.x,0,p.z);return player;},hour:(h:number)=>{hour=h;}};
}

it('keeps adjacent bells available during an answer, rings repeatedly, and preserves unrelated residents',async()=>{
 const f=await fixture(),houses=HOUSE_BELLS.filter(h=>!h.walkIn).slice(0,3);
 try{
  const nativeBodies=f.w.physics.engine.getBodies().length;
  expect(nativeBodies).toBeGreaterThan(f.baseBodies);
  for(const h of HOUSE_BELLS)expect(f.bells.ringInteractions(f.at(h)).some(it=>it.id===`bell_${h.id}`),h.id).toBe(true);
  expect(f.bells.ringInteractions(v3(4000,0,4000))).toEqual([]);
  for(const h of houses){
   const prompt=f.bells.ringInteractions(f.at(h)).find(it=>it.id===`bell_${h.id}`);
   expect(prompt,h.id).toBeDefined();prompt!.run();
   expect(f.bells.state?.house).toBe(h.id);f.bells.update(2.1);
   expect(f.bells.state?.stage).toBe('declined');
   expect(f.residents.filter(r=>r.id.startsWith('bell_'))).toHaveLength(1);
   expect(f.residents).toContain(f.unrelated);
  }
  expect(f.rings).toHaveLength(3);
  const h=houses.at(-1)!,person=f.bells.state?.person;
  f.bells.ring(h);expect(f.rings).toHaveLength(3); // same-house debounce
  f.bells.update(1);f.bells.ring(h);expect(f.rings).toHaveLength(4);
  expect(f.bells.state?.person).toBe(person); // no duplicate/restarted answerer
  f.bells.update(8.1);expect(f.bells.busy).toBe(false);
  f.bells.ring(h);f.bells.update(2.1);expect(f.rings).toHaveLength(5);
  expect(f.residents.filter(r=>r.id.startsWith('bell_'))).toHaveLength(1);
  expect(f.residents).toContain(f.unrelated);
  expect(f.w.physics.engine.getBodies()).toHaveLength(nativeBodies);
  f.bells.dispose();expect(f.w.physics.engine.getBodies()).toHaveLength(f.baseBodies);
 }finally{f.bells.dispose();f.w.scene.dispose();}
});

it('preserves known-family invitations and contextual night answers while allowing the next neighbour',async()=>{
 const f=await fixture(),home=HOUSE_BELLS.find(h=>h.id===HOME_ID)!,other=HOUSE_BELLS.find(h=>!h.walkIn)!;
 try{
  f.at(home);f.bells.ring(home);f.bells.update(2.1);expect(f.bells.state?.stage).toBe('opening');
  f.bells.update(1.1);expect(f.bells.state?.stage).toBe('coming');
  const visitor=f.residents.find(r=>r.id===f.bells.state?.person)!,gate=houseToWorld(home,home.gateU,-.75);
  visitor.pos.set(gate.x,0,gate.z);f.bells.update(.1);await Promise.resolve();
  expect(f.dialogues).toHaveLength(1);expect(f.bells.state?.stage).toBe('closing');
  f.hour(23);f.at(other);f.bells.ring(other);f.bells.update(2.1);
  expect(f.bells.state?.house).toBe(other.id);expect(f.bells.state?.stage).toBe('night');
  expect(f.residents).toContain(f.unrelated);
 }finally{f.bells.dispose();f.w.scene.dispose();}
});
