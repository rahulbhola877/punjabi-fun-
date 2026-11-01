import {Vector3}from '../babylon';
import {JAPAN_BUILDINGS,JAPAN_GARDEN}from './japanMap';
import {CHINA_BUILDINGS}from './chinaMap';
import {NEON_BUILDINGS}from './neonMap';
import {SPACE_SOLIDS}from './spaceMap';
type Box={x:number;z:number;w:number;d:number;h:number};
const boxes:Record<string,readonly Box[]>={japan:[...JAPAN_BUILDINGS,{x:(JAPAN_GARDEN.x0+JAPAN_GARDEN.x1)/2,z:(JAPAN_GARDEN.z0+JAPAN_GARDEN.z1)/2,w:JAPAN_GARDEN.x1-JAPAN_GARDEN.x0,d:JAPAN_GARDEN.z1-JAPAN_GARDEN.z0,h:7}],china:CHINA_BUILDINGS,neon:NEON_BUILDINGS,space:SPACE_SOLIDS.map(p=>({...p,h:6.5}))};

/** Sweep the follow-camera segment against authored building footprints.
 * This is constant small work, independent of decorative mesh/triangle count. */
export function districtCameraEye(id:string,target:Vector3,desired:Vector3):Vector3 {
 const delta=desired.subtract(target);let nearest=1;
 for(const box of boxes[id]??[]) {
  let near=0,far=1;
  for(const [origin,direction,min,max]of [[target.x,delta.x,box.x-box.w/2-.25,box.x+box.w/2+.25],[target.y,delta.y,-.1,box.h+.2],[target.z,delta.z,box.z-box.d/2-.25,box.z+box.d/2+.25]]) {
   if(Math.abs(direction!)<.00001){if(origin!<min!||origin!>max!){near=2;break;}continue;}
   const a=(min!-origin!)/direction!,b=(max!-origin!)/direction!;near=Math.max(near,Math.min(a,b));far=Math.min(far,Math.max(a,b));if(near>far)break;
  }
  if(near<=far&&near>0&&near<nearest)nearest=near;
 }
 return nearest<1?target.add(delta.scale(Math.max(0.08,nearest-0.3/Math.max(.1,delta.length())))):desired;
}
