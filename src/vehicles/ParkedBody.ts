import {Quaternion,Vector3,type PhysicsBody}from "../babylon";
import type {Physics}from "../physics/Physics";

/** Distant settled vehicles remain dynamic colliders with native wake-on-contact.
 * Unlike wheel-ray reuse, sleeping skips suspension/assist forces entirely. */
export class ParkedBody {
  private settled=0;
  private position=Vector3.Zero();
  private rotation=Quaternion.Identity();
  private hasPose=false;
  sleeping=false;
  constructor(private physics:Physics,private body:PhysicsBody){}
  update(dt:number,eligible:boolean):boolean {
    if(this.sleeping){
      if(eligible&&this.physics.isBodySleeping(this.body))return true;
      this.wake();return false;
    }
    if(!eligible){this.settled=0;this.hasPose=false;return false;}
    const node=this.body.transformNode,q=node.rotationQuaternion!;
    const stationary=this.hasPose&&Vector3.DistanceSquared(this.position,node.position)<1e-8&&1-Math.abs(Quaternion.Dot(this.rotation,q))<1e-8;
    this.position.copyFrom(node.position);this.rotation.copyFrom(q);this.hasPose=true;
    this.settled=stationary?this.settled+dt:0;
    if(this.settled>=2&&this.physics.sleepBody(this.body)){this.sleeping=true;return true;}
    return false;
  }
  wake():void {this.settled=0;this.hasPose=false;if(this.sleeping)this.physics.wakeBody(this.body);this.sleeping=false;}
}
