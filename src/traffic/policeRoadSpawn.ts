import {laneOffset}from "./AIDriver";
import type {NavGraph}from "../world/nav";

interface Point {x:number;z:number}
/** Reinforcement vehicles must join the drivable network, not a pedestrian's
 * open field point. Prefer behind the camera; visible-side spawns stay farther
 * away. A caller rejects occupied lanes before any vehicle is created. */
export function policeRoadSpawn(graph:NavGraph,player:Point,camera:{pos:Point;fwd:Point},free:(x:number,z:number)=>boolean):{x:number;z:number;yaw:number}|null{
 const goal=graph.nearest(player.x,player.z,n=>n.kind==="road");
 const candidates=graph.nodes.filter(n=>{
  if(n.kind!=="road"||!n.road||n.road.kind==="track"||!n.links.length)return false;
  const d=Math.hypot(n.x-player.x,n.z-player.z),ahead=((n.x-camera.pos.x)*camera.fwd.x+(n.z-camera.pos.z)*camera.fwd.z)/Math.max(1,d);
  return d>=70&&d<=180&&(ahead<.25||d>110);
 }).map(n=>{const d=Math.hypot(n.x-player.x,n.z-player.z),ahead=((n.x-camera.pos.x)*camera.fwd.x+(n.z-camera.pos.z)*camera.fwd.z)/Math.max(1,d);return{n,score:(ahead<.25?0:1000)+Math.abs(d-90)};}).sort((a,b)=>a.score-b.score);
 for(const {n}of candidates.slice(0,16)){
  const path=graph.path(n.id,goal);if(path.length<2)continue;
  const next=graph.nodes[path[1]!]!,dx=next.x-n.x,dz=next.z-n.z,d=Math.hypot(dx,dz);if(d<.01)continue;
  const offset=laneOffset(n),x=n.x-dz/d*offset,z=n.z+dx/d*offset;
  if(free(x,z))return{x,z,yaw:Math.atan2(dx,dz)};
 }
 return null;
}
