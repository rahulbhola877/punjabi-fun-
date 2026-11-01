import { Mesh, VertexData } from "../babylon";

/** Cluster tiny body triangles only beyond conversation distance. Palette,
 * normal hemisphere and bone-influence boundaries remain separate; averaged
 * weights keep the original live animation rather than a rigid impostor. */
export function skinnedDistanceDetail(source:Mesh,distance=26,cell=0.07):Mesh|null {
  if(!source.skeleton||source.morphTargetManager||!source.getIndices())return null;
  const input=VertexData.ExtractFromMesh(source,true,true),p=input.positions,n=input.normals,c=input.colors,mi=input.matricesIndices,mw=input.matricesWeights;
  if(!p||!n||!c||!mi||!mw)return null;
  const groups=new Map<string,number>(),count:number[]=[],positions:number[]=[],normals:number[]=[],colors:number[]=[],bones:number[]=[],weights:number[]=[],remap:number[]=[];
  for(let i=0;i<p.length/3;i++) {
    const j=i*3,k=i*4;
    const key=[Math.round(p[j]!/cell),Math.round(p[j+1]!/cell),Math.round(p[j+2]!/cell),...Array.from(n.slice(j,j+3),v=>v>0.5?1:v<-.5?-1:0),...Array.from(c.slice(k,k+3),v=>Math.round(v*16)),...mi.slice(k,k+4),...Array.from(mw.slice(k,k+4),v=>Math.round(v*8))].join(',');
    let id=groups.get(key);
    if(id===undefined){id=count.length;groups.set(key,id);count.push(0);positions.push(0,0,0);normals.push(0,0,0);colors.push(0,0,0,0);weights.push(0,0,0,0);bones.push(...mi.slice(k,k+4));}
    remap.push(id);count[id]++;
    for(let a=0;a<3;a++){positions[id*3+a]!+=p[j+a]!;normals[id*3+a]!+=n[j+a]!;}
    for(let a=0;a<4;a++){colors[id*4+a]!+=c[k+a]!;weights[id*4+a]!+=mw[k+a]!;}
  }
  for(let id=0;id<count.length;id++) {
    const length=Math.hypot(normals[id*3]!,normals[id*3+1]!,normals[id*3+2]!)||1;
    for(let a=0;a<3;a++){positions[id*3+a]!/=count[id]!;normals[id*3+a]!/=length;}
    const sum=weights.slice(id*4,id*4+4).reduce((a,b)=>a+b,0)||1;
    for(let a=0;a<4;a++){colors[id*4+a]!/=count[id]!;weights[id*4+a]!/=sum;}
  }
  const indices:number[]=[],seen=new Set<string>();
  for(let i=0;i<input.indices!.length;i+=3) {
    const a=remap[input.indices![i]!]!,b=remap[input.indices![i+1]!]!,c=remap[input.indices![i+2]!]!;if(a===b||b===c||a===c)continue;
    const key=a<b&&a<c?`${a},${b},${c}`:b<c?`${b},${c},${a}`:`${c},${a},${b}`;if(seen.has(key))continue;seen.add(key);indices.push(a,b,c);
  }
  if(indices.length>=input.indices!.length*0.9)return null;
  const data=new VertexData(),lod=new Mesh(`${source.name}_distance`,source.getScene());data.positions=positions;data.normals=normals;data.colors=colors;data.matricesIndices=bones;data.matricesWeights=weights;data.indices=indices;data.applyToMesh(lod);
  lod.skeleton=source.skeleton;lod.numBoneInfluencers=source.numBoneInfluencers;lod.material=source.material;lod.parent=source.parent;lod.position.copyFrom(source.position);lod.scaling.copyFrom(source.scaling);lod.rotation.copyFrom(source.rotation);lod.rotationQuaternion=source.rotationQuaternion?.clone()??null;lod.sideOrientation=source.sideOrientation;lod.isPickable=false;lod.receiveShadows=source.receiveShadows;
  source.addLODLevel(distance,lod);return lod;
}
