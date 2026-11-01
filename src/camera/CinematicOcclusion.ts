import { Ray } from "@babylonjs/core/Culling/ray";
import { Vector3, type Scene } from "../babylon";

/** Decorative world geometry can block a face without having a collider.
 * Test its actual triangles (not the whole spatial batch's bounding box). */
export function visibleCinematicEye(scene: Scene, target: Vector3, eye: Vector3, worldOnly=true): Vector3 {
  const delta=eye.subtract(target),length=delta.length();
  if(length<0.01) return eye;
  const direction=delta.scale(1/length);
  const hit=scene.pickWithRay(new Ray(target,direction,length),mesh=>(worldOnly?mesh.name.startsWith("world_"):mesh.isEnabled()&&mesh.isVisible&&mesh.layerMask!==0&&!mesh.skeleton)&&!!mesh.material&&mesh.material.alpha>=1&&!mesh.material.needAlphaBlendingForMesh(mesh),false);
  return hit?.hit&&hit.distance<length ? target.add(direction.scale(Math.max(0.15,hit.distance-0.25))) : eye;
}
