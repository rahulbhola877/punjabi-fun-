import type { ColliderBox } from "../physics/Physics";

interface Roof extends ColliderBox { c:number; s:number; cp:number; sp:number; keys:number[] }
/** Static solid cover, indexed once with the same ownership as world collision.
 * A vertical column intersects the actual yaw/pitch box, not its larger AABB.
 * No physics query, scene traversal or allocation is needed per raindrop. */
export class RainShelter {
  private cells=new Map<number,Set<Roof>>();
  private owners=new Map<object,Roof[]>();
  add(owner:object,boxes:readonly ColliderBox[]):void {
    this.remove(owner);
    const roofs:Roof[]=[];
    for(const box of boxes){
      // Thin walls, rails, trunks and posts do not form an overhead roof.
      if(box.sx<1.2||box.sz<1.2)continue;
      const c=Math.cos(box.rotY),s=Math.sin(box.rotY),cp=Math.cos(box.rotX??0),sp=Math.sin(box.rotX??0);
      const roof:Roof={...box,c,s,cp,sp,keys:[]};
      const ez=Math.abs(cp)*box.sz/2+Math.abs(sp)*box.sy/2;
      const rx=Math.abs(c)*box.sx/2+Math.abs(s)*ez,rz=Math.abs(s)*box.sx/2+Math.abs(c)*ez;
      for(let x=Math.floor((box.cx-rx)/8);x<=Math.floor((box.cx+rx)/8);x++)for(let z=Math.floor((box.cz-rz)/8);z<=Math.floor((box.cz+rz)/8);z++){
        const key=(x+32768)*65536+z+32768;let cell=this.cells.get(key);if(!cell){cell=new Set();this.cells.set(key,cell);}cell.add(roof);roof.keys.push(key);
      }
      roofs.push(roof);
    }
    this.owners.set(owner,roofs);
  }
  remove(owner:object):void {
    for(const roof of this.owners.get(owner)??[])for(const key of roof.keys){const cell=this.cells.get(key)!;cell.delete(roof);if(!cell.size)this.cells.delete(key);}
    this.owners.delete(owner);
  }
  clear():void {this.cells.clear();this.owners.clear();}
  /** Highest solid surface at this column, or -Infinity in the open. */
  heightAt(x:number,z:number):number {
    let top=-Infinity;
    const cell=this.cells.get((Math.floor(x/8)+32768)*65536+Math.floor(z/8)+32768);if(!cell)return top;
    for(const r of cell){
      const dx=x-r.cx,dz=z-r.cz,lx=r.c*dx-r.s*dz,lz=r.s*dx+r.c*dz;
      if(Math.abs(lx)>r.sx/2)continue;
      // Inverse rotation of a world-vertical line, parameter t = worldY-cy.
      let lo=-Infinity,hi=Infinity;
      const ay=r.cp,by=r.sp*lz,az=-r.sp,bz=r.cp*lz;
      if(Math.abs(ay)<1e-8){if(Math.abs(by)>r.sy/2)continue;}else{const a=(-r.sy/2-by)/ay,b=(r.sy/2-by)/ay;lo=Math.max(lo,Math.min(a,b));hi=Math.min(hi,Math.max(a,b));}
      if(Math.abs(az)<1e-8){if(Math.abs(bz)>r.sz/2)continue;}else{const a=(-r.sz/2-bz)/az,b=(r.sz/2-bz)/az;lo=Math.max(lo,Math.min(a,b));hi=Math.min(hi,Math.max(a,b));}
      if(lo<=hi)top=Math.max(top,r.cy+hi);
    }
    return top;
  }
}
