import {Mesh,StandardMaterial,Vector3,VertexData,type AbstractMesh,type Scene} from "../babylon";

interface Part { source:Mesh; indices:Uint32Array; }
interface Cell { key:string; parts:Part[]; min:Vector3; max:Vector3; backFace:boolean; cullBack:boolean; orientation:number|null; }

/** Index immutable opaque scenery spatially; upload depth silhouettes only
 * around the shadow box. Colour geometry and cutout foliage stay untouched. */
export class StaticShadowCells {
  private fallback:AbstractMesh[]=[];
  private cells:Cell[]=[];
  private batches=new Map<Cell,Mesh>();
  private materials=new Map<string,StandardMaterial>();
  get casters():AbstractMesh[]{return [...this.fallback,...this.batches.values()];}

  constructor(private scene:Scene,sources:readonly AbstractMesh[],cellSize=40){
    const cells=new Map<string,Cell&{builders:Map<Mesh,number[]>}>(),point=Vector3.Zero();
    for(const source of sources){
      const material=source.material;
      if(!(source instanceof Mesh)||source.skeleton||source.hasThinInstances||source.instances.length||!material||material.needAlphaTesting()||material.needAlphaBlendingForMesh(source)||material.getClassName()==="MultiMaterial"){
        this.fallback.push(source);continue;
      }
      const p=source.getVerticesData("position"),indices=source.getIndices(),matrix=source.computeWorldMatrix(true);
      if(!p||!indices||!source.isVerticesDataPresent("normal")){this.fallback.push(source);continue;}
      for(let i=0;i<indices.length;i+=3){
        const a=indices[i]!,b=indices[i+1]!,c=indices[i+2]!;
        Vector3.TransformCoordinatesFromFloatsToRef((p[a*3]!+p[b*3]!+p[c*3]!)/3,(p[a*3+1]!+p[b*3+1]!+p[c*3+1]!)/3,(p[a*3+2]!+p[b*3+2]!+p[c*3+2]!)/3,matrix,point);
        const key=`${Math.floor(point.x/cellSize)},${Math.floor(point.z/cellSize)}|${material.backFaceCulling}|${material.cullBackFaces}|${material.sideOrientation}`;
        let cell=cells.get(key);
        if(!cell){cell={key,parts:[],builders:new Map(),min:new Vector3(Infinity,Infinity,Infinity),max:new Vector3(-Infinity,-Infinity,-Infinity),backFace:material.backFaceCulling,cullBack:material.cullBackFaces,orientation:material.sideOrientation};cells.set(key,cell);}
        let list=cell.builders.get(source);if(!list){list=[];cell.builders.set(source,list);}list.push(a,b,c);
        for(const index of [a,b,c]){Vector3.TransformCoordinatesFromFloatsToRef(p[index*3]!,p[index*3+1]!,p[index*3+2]!,matrix,point);cell.min.minimizeInPlace(point);cell.max.maximizeInPlace(point);}
      }
    }
    for(const cell of cells.values()){
      for(const [source,indices]of cell.builders)cell.parts.push({source,indices:new Uint32Array(indices)});
      cell.builders.clear();this.cells.push(cell);
    }
  }

  select(point:Vector3,radius:number):AbstractMesh[]{
    const selected:AbstractMesh[]=[...this.fallback];
    for(const cell of this.cells){
      const dx=Math.max(cell.min.x-point.x,0,point.x-cell.max.x),dy=Math.max(cell.min.y-point.y,0,point.y-cell.max.y),dz=Math.max(cell.min.z-point.z,0,point.z-cell.max.z),d=dx*dx+dy*dy+dz*dz;
      let mesh=this.batches.get(cell);
      if(d>=(radius+24)**2){if(mesh){mesh.dispose();this.batches.delete(cell);}continue;}
      if(d>=radius*radius)continue;
      if(!mesh){mesh=this.upload(cell);this.batches.set(cell,mesh);}
      selected.push(mesh);
    }
    return selected;
  }

  private upload(cell:Cell):Mesh{
    const positions:number[]=[],normals:number[]=[],indices:number[]=[],vertices=new Map<string,number>(),position=Vector3.Zero(),normal=Vector3.Zero();
    for(const {source,indices:triangles}of cell.parts){
      // Only position/normal data matter to an opaque depth pass. Preserve
      // separate face normals because shadow normal bias uses them.
      const p=source.getVerticesData("position")!,n=source.getVerticesData("normal")!,matrix=source.computeWorldMatrix(true),flip=matrix.determinant()<0,remap=new Map<number,number>();
      for(let i=0;i<triangles.length;i++){
        const index=triangles[flip?(i%3===1?i+1:i%3===2?i-1:i):i]!;
        const mapped=remap.get(index);if(mapped!==undefined){indices.push(mapped);continue;}
        Vector3.TransformCoordinatesFromFloatsToRef(p[index*3]!,p[index*3+1]!,p[index*3+2]!,matrix,position);
        Vector3.TransformNormalFromFloatsToRef(n[index*3]!,n[index*3+1]!,n[index*3+2]!,matrix,normal);
        const key=`${position.x},${position.y},${position.z}|${normal.x},${normal.y},${normal.z}`;
        let v=vertices.get(key);
        if(v===undefined){v=positions.length/3;vertices.set(key,v);positions.push(position.x,position.y,position.z);normals.push(normal.x,normal.y,normal.z);}
        remap.set(index,v);indices.push(v);
      }
    }
    const materialKey=`${cell.backFace}|${cell.cullBack}|${cell.orientation}`;
    let material=this.materials.get(materialKey);
    if(!material){material=new StandardMaterial("static-shadow-depth",this.scene);material.disableLighting=true;material.backFaceCulling=cell.backFace;material.cullBackFaces=cell.cullBack;material.sideOrientation=cell.orientation;this.materials.set(materialKey,material);}
    const mesh=new Mesh(`static-shadow-cell:${cell.key}`,this.scene),data=new VertexData();
    data.positions=positions;data.normals=normals;data.indices=indices;data.applyToMesh(mesh);
    mesh.material=material;mesh.layerMask=0;mesh.metadata={shadowDepthOnly:true};mesh.isPickable=false;mesh.freezeWorldMatrix();return mesh;
  }

  dispose():void{for(const m of this.batches.values())m.dispose();for(const m of this.materials.values())m.dispose();this.batches.clear();this.materials.clear();this.cells=[];this.fallback=[];}
}
