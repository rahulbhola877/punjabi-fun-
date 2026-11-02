import type {AbstractMesh,PointLight}from "../babylon";

/** A finite point light contributes nothing beyond range. Excluding static
 * batches outside that sphere also removes their point-light shader work.
 * Dynamic actors stay eligible as they move through the lit interior. */
export function outsideInteriorLight(light:PointLight,mesh:AbstractMesh):boolean {
  const b=mesh.getBoundingInfo().boundingBox,min=b.minimumWorld,max=b.maximumWorld,p=light.position;
  const x=Math.max(min.x-p.x,0,p.x-max.x),y=Math.max(min.y-p.y,0,p.y-max.y),z=Math.max(min.z-p.z,0,p.z-max.z);
  return x*x+y*y+z*z>light.range*light.range;
}
