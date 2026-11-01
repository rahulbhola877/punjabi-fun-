import { Vector3 } from "../babylon";
import type { Vehicle } from "../vehicles/Vehicle";

/** Bounded staging on the real pursuit bodies. Only these two actors advance;
 * mission timers, rewards, police heat/catching and the wider simulation stay
 * paused. Sweeps stop at scenery, people or other vehicles. Skip keeps the
 * last committed pose and velocity; it never rewinds or jumps to an endpoint. */
export class PursuitMotion {
  private speed:number;
  private patrolSpeed:number;
  constructor(private player:Vehicle,private patrol:Vehicle,private clear:(vehicle:Vehicle,distance:number,yaw:number)=>boolean) {
    this.speed=Math.max(2.5,Math.min(7,Math.abs(player.forwardSpeed)));
    this.patrolSpeed=Math.max(2.5,Math.min(7,Math.abs(patrol.forwardSpeed)));
  }
  update(dt:number):void {
    let remaining=Math.min(0.1,Math.max(0,dt));
    while(remaining>0.0001) {
      const h=Math.min(1/60,remaining);remaining-=h;
      for(const [vehicle,speed]of [[this.player,this.speed],[this.patrol,this.patrolSpeed]] as const) {
        let yaw=vehicle.yaw;
        if(vehicle===this.patrol) {
          const p=this.player.position,q=vehicle.position,desired=Math.atan2(p.x-q.x,p.z-q.z),delta=Math.atan2(Math.sin(desired-yaw),Math.cos(desired-yaw));
          yaw+=Math.max(-h*0.6,Math.min(h*0.6,delta));
        }
        const distance=speed*h;
        vehicle.cinematicAdvance(this.clear(vehicle,distance,yaw)?distance:0,yaw,h);
      }
    }
  }
  get midpoint():Vector3 {return Vector3.Lerp(this.player.position,this.patrol.position,0.5).add(new Vector3(0,1,0));}
}
