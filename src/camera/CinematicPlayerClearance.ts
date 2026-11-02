import {Vector3}from "../babylon";

/** Face samples within the player's shoulder width belong to the player. */
export function isOtherCinematicFace(target:Vector3,feet:Vector3):boolean {
  return Math.hypot(target.x-feet.x,target.z-feet.z)>.55;
}

/** Hair/turbans rise above the collision capsule. A conservative head sphere
 * supplies the same obstruction signal as scenery to the existing shot fitter. */
export function playerHeadCinematicEye(target:Vector3,eye:Vector3,feet:Vector3,height:number):Vector3 {
  if(!isOtherCinematicFace(target,feet))return eye;
  const radius=.4*height/1.7,head=feet.add(new Vector3(0,height*.925,0));
  const delta=eye.subtract(target),length=delta.length(),offset=target.subtract(head);
  if(length<.01)return eye;
  const direction=delta.scale(1/length),b=Vector3.Dot(offset,direction);
  const disc=b*b-offset.lengthSquared()+radius*radius;
  if(disc<0)return eye;
  const root=Math.sqrt(disc),enter=-b-root,exit=-b+root;
  return exit>0&&enter<length?target.add(direction.scale(Math.max(.15,enter-.25))):eye;
}
