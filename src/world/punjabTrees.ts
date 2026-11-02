import {Matrix,Quaternion,Vector3}from "../babylon";
import {GeoBuilder}from "../render/GeoBuilder";
import {lowpolyTreeTemplate}from "./lowpolyNature";
import type {Kit}from "./Kit";

export type PunjabTreeSpecies="neem"|"shisham"|"kikar"|"peepal"|"mango"|"safeda"|"poplar"|"kinnow"|"pine";
type Broadleaf=Exclude<PunjabTreeSpecies,"safeda"|"pine">;
const profiles:Record<Broadleaf,readonly[number,number,number,number,number,number]>={
 neem:[1.25,1.12,1.2,.87,.98,.82],shisham:[1.1,1.2,1.05,.78,.92,.77],
 kikar:[1.6,.72,1.45,.85,.91,.72],peepal:[1.8,1.45,1.7,.81,.97,.84],
 mango:[1.65,.9,1.5,.69,.88,.72],poplar:[.42,2.15,.42,.91,1,.82],
 kinnow:[.75,.56,.75,.65,.87,.68],
};
const cache=new Map<string,{bark:GeoBuilder;leaves:GeoBuilder}>();
/** Owner-authored connected trunk/branch/crown geometry, with consistent whole
 * tree proportions and restrained species palettes. No alpha cards or detached
 * crown balls; the tall narrow safeda and tiered pine keep their own templates. */
export function punjabBroadleafTemplate(kind:Broadleaf,variant:number,young=false):{bark:GeoBuilder;leaves:GeoBuilder}{
 const key=`${kind}:${variant%3}:${young}`,previous=cache.get(key);if(previous)return previous;
 const [x,y,z,r,g,b]=profiles[kind],source=lowpolyTreeTemplate(variant),scale=young?Matrix.Scaling(.6,.82,.6):Matrix.Scaling(x,y,z);
 const tree={bark:new GeoBuilder(),leaves:new GeoBuilder()};tree.bark.appendTransformed(source.bark,scale);tree.leaves.appendTransformed(source.leaves,scale);
 for(let i=0;i<tree.leaves.colors.length;i+=4){tree.leaves.colors[i]!*=r;tree.leaves.colors[i+1]!*=g;tree.leaves.colors[i+2]!*=b;}
 if(kind==='kinnow'){
  // Modest fruit clusters sit inside the dense low crown, not on sprites.
  for(let i=0;i<4;i++){const a=i*Math.PI*.5+variant*.7;tree.leaves.ellipsoid(Math.cos(a)*.65,1.65+(i%2)*.24,Math.sin(a)*.65,.085,.09,.085,5,3,[.95,.39,.045]);}
 }
 cache.set(key,tree);return tree;
}

export function punjabBroadleaf(kit:Kit,kind:Broadleaf,x:number,y:number,z:number,scale:number,yaw:number,young=false):void {
 const variant=Math.floor(Math.abs(x*.37+z*.61))%3,tree=punjabBroadleafTemplate(kind,variant,young);
 kit.frame(x,z,0,y);
 const matrix=Matrix.Compose(new Vector3(scale,scale,scale),Quaternion.RotationYawPitchRoll(yaw,0,0),new Vector3(x,y,z)),batch=kit.g('lowpolyNature');
 batch.appendTransformed(tree.bark,matrix);batch.appendTransformed(tree.leaves,matrix);
 const radius=(kind==='peepal'?.42:kind==='kinnow'?.16:.24)*scale;
 kit.colliders.add(x,y+1.1,z,radius*2,2.2,radius*2);
}
