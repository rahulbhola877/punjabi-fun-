import {Mesh,StandardMaterial,VertexData,type AbstractMesh,type Scene} from "../babylon";

/** Opaque depth silhouettes share a draw across materials, but stay in small
 * spatial cells so a distant roof cannot keep a whole town in the shadow map.
 * Alpha-tested foliage keeps its original material and UVs. Colour meshes,
 * colliders and moving casters are never modified. */
export class StaticShadowCells {
  readonly casters:AbstractMesh[]=[];
  private batches:Mesh[]=[];
  private materials:StandardMaterial[]=[];

  constructor(scene:Scene,sources:readonly AbstractMesh[],cellSize=40){
    type Cell={positions:number[];normals:number[];indices:number[];vertices:Map<string,number>;backFace:boolean;cullBack:boolean;orientation:number|null};
    const cells=new Map<string,Cell>();
    for(const source of sources){
      const material=source.material;
      if(!(source instanceof Mesh)||source.skeleton||source.hasThinInstances||source.instances.length||!material||material.needAlphaTesting()||material.needAlphaBlendingForMesh(source)||material.getClassName()==="MultiMaterial"){
        this.casters.push(source);continue;
      }
      const data=VertexData.ExtractFromMesh(source,true,true);
      if(!data.positions||!data.normals||!data.indices){this.casters.push(source);continue;}
      data.transform(source.computeWorldMatrix(true));
      const p=data.positions,n=data.normals;
      for(let i=0;i<data.indices.length;i+=3){
        const a=data.indices[i]!,b=data.indices[i+1]!,c=data.indices[i+2]!;
        const x=(p[a*3]!+p[b*3]!+p[c*3]!)/3,z=(p[a*3+2]!+p[b*3+2]!+p[c*3+2]!)/3;
        const key=`${Math.floor(x/cellSize)},${Math.floor(z/cellSize)}|${material.backFaceCulling}|${material.cullBackFaces}|${material.sideOrientation}`;
        let cell=cells.get(key);
        if(!cell){cell={positions:[],normals:[],indices:[],vertices:new Map(),backFace:material.backFaceCulling,cullBack:material.cullBackFaces,orientation:material.sideOrientation};cells.set(key,cell);}
        for(const index of [a,b,c]){
          const vertexKey=`${source.uniqueId}:${index}`;let v=cell.vertices.get(vertexKey);
          if(v===undefined){v=cell.positions.length/3;cell.vertices.set(vertexKey,v);for(let k=0;k<3;k++){cell.positions.push(p[index*3+k]!);cell.normals.push(n[index*3+k]!);}}
          cell.indices.push(v);
        }
      }
    }
    const materials=new Map<string,StandardMaterial>();
    for(const [key,cell]of cells){
      const materialKey=`${cell.backFace}|${cell.cullBack}|${cell.orientation}`;
      let material=materials.get(materialKey);
      if(!material){material=new StandardMaterial("static-shadow-depth",scene);material.disableLighting=true;material.backFaceCulling=cell.backFace;material.cullBackFaces=cell.cullBack;material.sideOrientation=cell.orientation;materials.set(materialKey,material);this.materials.push(material);}
      const mesh=new Mesh(`static-shadow-cell:${key}`,scene),data=new VertexData();
      data.positions=cell.positions;data.normals=cell.normals;data.indices=cell.indices;data.applyToMesh(mesh);
      mesh.material=material;mesh.layerMask=0;mesh.isPickable=false;mesh.freezeWorldMatrix();
      this.batches.push(mesh);this.casters.push(mesh);
    }
  }

  dispose():void{for(const m of this.batches)m.dispose();for(const m of this.materials)m.dispose();this.batches=[];this.materials=[];this.casters.length=0;}
}
