import { PhysicsMotionType, Vector3, type PhysicsRaycastResult, type PhysicsBody } from "../babylon";

type Contact = Pick<PhysicsRaycastResult,"hitPointWorld"|"hitNormalWorld"|"body"|"bodyIndex">;

/** Short-lived support-plane reuse for effectively stationary parked wheels.
 * Forces still run every fixed step. Moving/driven wheels and dynamic support
 * always query Havok. A projected contact may drift at most 0.1 mm before a
 * fresh query, and even an unchanged static contact is rechecked after 5 uses.
 */
export class StaticWheelContact {
  private body:PhysicsBody|null=null;
  private anchor=Vector3.Zero();
  private normal=Vector3.Zero();
  private projected=Vector3.Zero();
  private delta=Vector3.Zero();
  private matrixFlag=-1;
  private uses=0;
  private result:Contact={hitPointWorld:this.projected,hitNormalWorld:this.normal};

  invalidate():void {this.body=null;}
  get validStaticSupport():boolean {
    const b=this.body;return !!b&&!b.isDisposed&&b.numInstances===0&&b.getMotionType()===PhysicsMotionType.STATIC&&b.transformNode.getWorldMatrix().updateFlag===this.matrixFlag;
  }

  query(from:Vector3,to:Vector3,allow:boolean,cast:()=>PhysicsRaycastResult|null):Contact|null {
    const body=this.body;
    if(allow&&body&&!body.isDisposed&&body.numInstances===0&&this.uses<5&&body.getMotionType()===PhysicsMotionType.STATIC&&body.transformNode.getWorldMatrix().updateFlag===this.matrixFlag){
      to.subtractToRef(from,this.delta);
      const denominator=Vector3.Dot(this.delta,this.normal);
      const t=((this.anchor.x-from.x)*this.normal.x+(this.anchor.y-from.y)*this.normal.y+(this.anchor.z-from.z)*this.normal.z)/denominator;
      if(Math.abs(denominator)>1e-6&&t>=0&&t<=1){
        this.projected.copyFrom(from).addInPlaceFromFloats(this.delta.x*t,this.delta.y*t,this.delta.z*t);
        if(Vector3.DistanceSquared(this.projected,this.anchor)<1e-8){this.uses++;return this.result;}
      }
    }
    this.body=null;
    const hit=cast();
    if(allow&&hit?.body&&!hit.body.isDisposed&&hit.body.numInstances===0&&hit.body.getMotionType()===PhysicsMotionType.STATIC&&hit.hitNormalWorld.y>0.3){
      this.body=hit.body;this.anchor.copyFrom(hit.hitPointWorld);this.normal.copyFrom(hit.hitNormalWorld);this.projected.copyFrom(this.anchor);
      this.matrixFlag=hit.body.transformNode.getWorldMatrix().updateFlag;this.uses=0;this.result.body=hit.body;
    }
    return hit;
  }
}
