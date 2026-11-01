import { Color3, DynamicTexture, Mesh, StandardMaterial, VertexData, type Scene, type TransformNode, type Vector3 } from "../babylon";

/** One shared soft ground-shadow draw for moving actors. Fixed architecture
 * uses the cached sun depth map; walking/jumping never dirties that map.
 * These are deliberately approximate contact silhouettes, not wall shadows. */
export function districtContactShadows(scene: Scene, roots: readonly TransformNode[], direction: Vector3, height: (x:number,z:number)=>number): void {
  if(!roots.length) return;
  const texture=new DynamicTexture("district-contact-alpha",{width:128,height:128},scene,false);
  const ctx=texture.getContext() as CanvasRenderingContext2D;
  ctx.clearRect(0,0,128,128);
  const gradient=ctx.createRadialGradient(64,65,8,64,65,58);
  gradient.addColorStop(0,"rgba(19,24,27,.34)");gradient.addColorStop(0.5,"rgba(19,24,27,.23)");gradient.addColorStop(1,"rgba(19,24,27,0)");
  ctx.fillStyle=gradient;ctx.fillRect(0,0,128,128);texture.hasAlpha=true;texture.update(false);
  const material=new StandardMaterial("district-contact-shadow",scene);
  material.disableLighting=true;material.diffuseColor=Color3.Black();material.emissiveColor=Color3.White();material.diffuseTexture=texture;material.emissiveTexture=texture;
  material.useAlphaFromDiffuseTexture=true;material.backFaceCulling=false;material.disableDepthWrite=true;
  const mesh=new Mesh("district-moving-contact-shadows",scene), data=new VertexData(),positions:number[]=[],uvs:number[]=[],indices:number[]=[];
  for(let i=0;i<roots.length;i++) {positions.push(...Array(12).fill(0));uvs.push(0,0,1,0,1,1,0,1);indices.push(i*4,i*4+1,i*4+2,i*4,i*4+2,i*4+3);}
  data.positions=positions;data.uvs=uvs;data.indices=indices;data.applyToMesh(mesh,true);mesh.material=material;mesh.isPickable=false;
  const length=Math.max(0.01,Math.hypot(direction.x,direction.z)),dx=direction.x/length,dz=direction.z/length;
  const update=()=>{
    roots.forEach((root,i)=>{
      const p=root.getAbsolutePosition(),ground=height(p.x,p.z),jump=Math.max(0,p.y-ground);
      const width=0.48+Math.min(jump,2)*0.08,extent=0.65+length/Math.max(0.2,-direction.y)*0.65;
      const cx=p.x+dx*(extent-0.35),cz=p.z+dz*(extent-0.35);
      for(let corner=0;corner<4;corner++) {
        const a=(corner===0||corner===3?-1:1)*width,b=(corner<2?-1:1)*extent;
        const x=cx+dz*a+dx*b,z=cz-dx*a+dz*b,offset=i*12+corner*3;
        positions[offset]=x;positions[offset+1]=height(x,z)+0.022;positions[offset+2]=z;
      }
    });
    mesh.updateVerticesData("position",positions,true);
  };
  update();const observer=scene.onBeforeRenderObservable.add(update);
  mesh.onDisposeObservable.addOnce(()=>scene.onBeforeRenderObservable.remove(observer));
}
