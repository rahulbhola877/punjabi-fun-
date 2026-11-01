import { Mesh, VertexData, type Material, type Scene } from "../babylon";

/** A roof's section gives the street its silhouette: a deep straight gable
 * for the timber lane, lifted tiled eaves for the riverside shop houses. */
export function districtRoof(scene:Scene,name:string,x:number,y:number,z:number,w:number,d:number,material:Material,lifted=false):Mesh {
  const p:number[]=[],uv:number[]=[],idx:number[]=[],nx=12,nz=4;
  for(let j=0;j<=nz;j++)for(let i=0;i<=nx;i++) {
    const u=i/nx*2-1,v=j/nz*2-1,edge=Math.abs(u),ridge=lifted?1.45:1.2;
    const rise=ridge*(1-edge)+(lifted?Math.pow(edge,6)*0.55+Math.pow(Math.abs(v),6)*0.16:0);
    p.push(x+u*w/2,y+rise,z+v*d/2);uv.push(u*w/3,v*d/3);
    if(i<nx&&j<nz){const a=j*(nx+1)+i;idx.push(a,a+nx+1,a+1,a+1,a+nx+1,a+nx+2);}
  }
  const data=new VertexData(),normals:number[]=[];VertexData.ComputeNormals(p,idx,normals);data.positions=p;data.normals=normals;data.indices=idx;data.uvs=uv;
  const roof=new Mesh(name,scene);data.applyToMesh(roof);roof.material=material;roof.isPickable=false;roof.metadata={districtSilhouette:true};return roof;
}
