import type {Vector3} from "../babylon";

interface InteractionCandidate {
  id:string;
  pos:{x:number;z:number};
  radius:number;
  dist?:(point:Vector3)=>number;
}

/** Completion actions are supplied only when their mission/ride is eligible.
 * Resolve them explicitly before proximity preferences for optional actions. */
export function selectInteraction<T extends InteractionCandidate>(candidates:readonly T[],player:Vector3,yaw:number):T|null {
  const fx=Math.sin(yaw),fz=Math.cos(yaw);
  let best:T|null=null,bestScore=Infinity;
  for(const candidate of candidates){
    const dx=candidate.pos.x-player.x,dz=candidate.pos.z-player.z;
    const centreDistance=Math.hypot(dx,dz);
    const distance=candidate.dist?candidate.dist(player):centreDistance;
    if(!Number.isFinite(distance)||distance>candidate.radius)continue;
    // Mission/tiffin handovers and passenger drop-offs all use this action ID.
    // A bell may have a negative proximity score; it must never steal a valid completion.
    if(candidate.id==="deliver")return candidate;
    // Custom reach measures an outline, not the direction vector length.
    // Dividing direction by a tiny outline distance can otherwise boost a bike
    // ahead of the intended gate prompt by more than the full facing range.
    const facing=centreDistance>.01?(dx*fx+dz*fz)/centreDistance:1;
    const score=distance-facing*.6+(candidate.id.startsWith("chat_")?1:0)-(candidate.id.startsWith("bell_")?2.5:0);
    if(score<bestScore){bestScore=score;best=candidate;}
  }
  return best;
}
