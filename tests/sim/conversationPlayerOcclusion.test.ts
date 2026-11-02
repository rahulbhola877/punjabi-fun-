import {expect,it}from "vitest";
import {StandardMaterial,Vector3}from "../../src/babylon";
import {Player}from "../../src/characters/Player";
import {PLAYER_LOOKS}from "../../src/characters/appearances";
import type {Input}from "../../src/input/Input";
import {Group,FIXED_DT}from "../../src/app/config";
import {isOtherCinematicFace,playerHeadCinematicEye}from "../../src/camera/CinematicPlayerClearance";
import {makeWorld,v3}from "./harness";

async function fixture(){
 const w=await makeWorld(),input={axis:()=>0,isDown:()=>false,wasPressed:()=>false,moveMagnitude:0,touchMode:false}as unknown as Input;
 const player=new Player(w.scene,input);
 player.spawn({...PLAYER_LOOKS[0]!.look,headwear:'turban'},new StandardMaterial('player',w.scene),v3(10.21017853747731,.13,22.602516548640967),0);
 w.physics.step(FIXED_DT);
 return{w,player};
}

it('native character-controller PLAYER membership blocks another face while STATIC-only rays miss it',async()=>{
 const {w,player}=await fixture();
 try{
  const p=player.feet,a=p.add(v3(2,1.1,0)),b=p.add(v3(-2,1.1,0));
  expect(player.cc.shape.filterMembershipMask).toBe(Group.PLAYER);
  expect(w.physics.raycast(a,b,Group.STATIC)).toBeNull();
  const hit=w.physics.raycast(a,b,Group.STATIC|Group.PLAYER);
  expect(hit?.body?.shape).toBe(player.cc.shape);
  expect(isOtherCinematicFace(a,p)).toBe(true);
  expect(player.human.mesh.isEnabled()).toBe(true);
 }finally{w.scene.dispose();}
});

it('rejects the observed Gurnam position-2 head obstruction and the turban volume above the capsule',async()=>{
 const {w,player}=await fixture();
 try{
  const p=player.feet,face=v3(12.3,1.55,21.6),eye=v3(9.901519097222222,1.7997468171296296,22.59949363425926);
  expect(w.physics.raycast(face,eye,Group.STATIC)).toBeNull();
  const clear=playerHeadCinematicEye(face,eye,p,player.cc.footOffset*2);
  expect(Vector3.Distance(face,clear)).toBeLessThan(Vector3.Distance(face,eye)*.8);
  // A native capsule stops at standing height, but hair/turban pixels can
  // still hide the speaker above it. Require a real CC miss and head guard.
  const high=player.cc.footOffset*2+.1,a=p.add(v3(2,high,0)),b=p.add(v3(-2,high,0));
  expect(w.physics.raycast(a,b,Group.PLAYER)).toBeNull();
  expect(Vector3.Distance(a,playerHeadCinematicEye(a,b,p,player.cc.footOffset*2))).toBeLessThan(3);
  expect(player.human.mesh.isEnabled()).toBe(true);
 }finally{w.scene.dispose();}
});

it('retains player-face samples and unobstructed speaker eyes without moving or hiding the player',async()=>{
 const {w,player}=await fixture();
 try{
  const p=player.feet,eye=p.add(v3(-3,1.8,0)),height=player.cc.footOffset*2;
  for(const dx of[-.18,0,.18]){
   const ownFace=p.add(v3(dx,1.55,0));
   expect(isOtherCinematicFace(ownFace,p)).toBe(false);
   expect(playerHeadCinematicEye(ownFace,eye,p,height)).toBe(eye);
  }
  const face=p.add(v3(2,1.55,0)),clearEye=p.add(v3(4,1.8,0));
  expect(playerHeadCinematicEye(face,clearEye,p,height)).toBe(clearEye);
  expect(player.feet.equalsWithEpsilon(p)).toBe(true);
  expect(player.human.mesh.isEnabled()).toBe(true);
 }finally{w.scene.dispose();}
});
