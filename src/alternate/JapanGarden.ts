import { clearWater } from "../render/ClearWater";
import { districtSurface } from "../render/DistrictLook";
import { Mesh, MeshBuilder, Scene, VertexData, type PBRMaterial } from "../babylon";
import { JAPAN_POND } from "./japanMap";
import { addTunyardKoi } from "./TunyardKoi";
import { koiPose } from "./koiMotion";

/** A compact Japanese-inspired garden, with a raised koi pond and a dry bed. */
export function buildJapanGarden(scene: Scene): { koiCount: number; feed: () => void; update: (dt: number) => void } {
  const material = (name: string, color: string): PBRMaterial => districtSurface(scene,name,color,/Sand|Moss|Leaf/i.test(name)?"earth":/Fence/i.test(name)?"wood":"stone");
  const sand = material("gardenSand", "#99917d"), stone = material("gardenStone", "#716f63"), darkStone = districtSurface(scene,"pondBed","#a4b197","earth");
  const green = material("gardenMoss", "#708b6c"), wood = material("gardenFence", "#8d7a5c"), leaf = material("lilyLeaf", "#6d946b");
  const water = clearWater(scene,"koiWater",{x:JAPAN_POND.x,z:JAPAN_POND.z,rx:JAPAN_POND.rx*0.94,rz:JAPAN_POND.rz*0.94,ellipse:true});
  const box = (name: string, x: number, y: number, z: number, w: number, h: number, d: number, m: import("../babylon").Material) => {
    const mesh = MeshBuilder.CreateBox(name, { width: w, height: h, depth: d }, scene); mesh.position.set(x, y, z); mesh.material = m; return mesh;
  };
  const cylinder = (name: string, x: number, y: number, z: number, w: number, h: number, d: number, m: import("../babylon").Material) => {
    const mesh = MeshBuilder.CreateCylinder(name, { diameter: 1, height: h, tessellation: 32 }, scene); mesh.position.set(x, y, z); mesh.scaling.x = w; mesh.scaling.z = d; mesh.material = m; return mesh;
  };
  // The sand is a decorative surface; the player's collision stays on the
  // same level street ground around the pond.
  // A cut-out shore leaves real depth below the water instead of putting a
  // pale slab underneath the fish. Its outer boundary remains the garden lot.
  const shoreP:number[]=[],shoreI:number[]=[],segments=64,{x,z,rx,rz}=JAPAN_POND;
  for(let ring=0;ring<3;ring++)for(let i=0;i<segments;i++) {
    const a=i*Math.PI*2/segments,c=Math.cos(a),s=Math.sin(a),ripple=1+0.018*Math.sin(a*7)+0.012*Math.cos(a*11);
    const t=Math.min(Math.abs(c)<0.0001?Infinity:c>0?(16.05-x)/c:(5.55-x)/c,Math.abs(s)<0.0001?Infinity:s>0?(33.15-z)/s:(21.65-z)/s);
    shoreP.push(ring===2?x+c*t:x+c*rx*(ring===0?1.01:1.22)*ripple,ring===0?-0.08:ring===1?0.045:0.03,ring===2?z+s*t:z+s*rz*(ring===0?1.01:1.22)*ripple);
    if(ring<2){const n=(i+1)%segments,b=ring*segments;shoreI.push(b+i,b+segments+i,b+n,b+n,b+segments+i,b+segments+n);}
  }
  const shore=new Mesh("gardenShore",scene),shoreData=new VertexData(),shoreN:number[]=[];VertexData.ComputeNormals(shoreP,shoreI,shoreN);
  shoreData.positions=shoreP;shoreData.normals=shoreN;shoreData.indices=shoreI;shoreData.applyToMesh(shore);shore.material=sand;sand.backFaceCulling=false;
  // Raked furrows are confined to the dry strip behind the water.
  for (let z = 22.1; z <= 32.6; z += 0.33) box("sandFurrow", 15.0, 0.038, z, 1.45, 0.012, 0.045, stone);
  // A simple timber garden screen gives the space a quiet back edge.
  for (let z = 22; z <= 33; z += 1.1) box("gardenPost", 16.25, 0.55, z, 0.11, 1.1, 0.11, wood);
  for (const y of [0.35, 0.8]) box("gardenRail", 16.25, y, 27.5, 0.09, 0.09, 11.1, wood);
  box("gardenBoundary",16.5,0.85,27.4,0.24,1.7,11.5,sand);
  box("gardenBoundaryCap",16.5,1.76,27.4,0.55,0.13,11.8,wood);

  cylinder("pondBed", x, -0.13, z, rx * 2.04, 0.03, rz * 2.04, darkStone);
  const surface=MeshBuilder.CreateDisc("pondWater",{radius:1,tessellation:64},scene);surface.rotation.x=-Math.PI/2;surface.scaling.set(rx*0.94,rz*0.94,1);surface.position.set(x,0.08,z);surface.material=water;
  for(let i=0;i<22;i++) {
    const a=i*2.399, r=0.3+(i%5)*0.12;
    const pebble=MeshBuilder.CreateSphere("submergedGardenStone",{diameter:0.12+(i%3)*0.04,segments:6},scene);
    pebble.position.set(x+Math.cos(a)*rx*r,-0.095,z+Math.sin(a)*rz*r); pebble.scaling.y=0.3; pebble.material=stone;
  }
  for (let i = 0; i < 18; i++) {
    const a = i * Math.PI * 2 / 18, px = x + Math.cos(a) * rx * 0.98, pz = z + Math.sin(a) * rz * 0.98;
    const s = 0.4 + (i % 3) * 0.08;
    const rock = MeshBuilder.CreateSphere("pondEdgeStone", { diameter: s, segments: 6 }, scene);
    rock.position.set(px, 0.09, pz); rock.scaling.set(1.2, 0.65, 0.9); rock.material = i % 3 === 0 ? darkStone : stone;
  }
  for (const [lx, lz, radius] of [[11.5, 26.1, 0.35], [12.4, 28.1, 0.28], [9.5, 28.6, 0.24]] as const) {
    cylinder("lilyPad", lx, 0.093, lz, radius * 2, 0.012, radius * 1.6, leaf);
  }
  for (const [sx, sz] of [[6.5, 23], [6.7, 24.2], [6.5, 25.4], [6.4, 29], [6.7, 30.2], [7.2, 31.3]] as const) {
    cylinder("steppingStone", sx, 0.045, sz, 0.7, 0.06, 0.55, stone);
  }
  // Grounded moss islands and low, arcing iris leaves frame the shore. A
  // single leaf mesh replaces floating topiary balls and their detached shade.
  const lp:number[]=[],li:number[]=[],lc:number[]=[];
  for(const [sx,sz]of [[14.7,23.3],[14.4,31.8],[7.6,31.8],[13.9,25.4],[8.6,24.5]] as const) {
    const moss=MeshBuilder.CreateSphere("gardenMossPatch",{diameter:1,segments:6},scene);moss.position.set(sx,0.038,sz);moss.scaling.set(1.15,0.09,0.82);moss.material=green;
    for(let i=0;i<13;i++) {
      const a=i*2.399,dx=Math.cos(a),dz=Math.sin(a),length=0.35+(i%4)*0.12,width=0.035;
      const b=lp.length/3;lp.push(sx-dz*width,0.04,sz+dx*width,sx+dz*width,0.04,sz-dx*width,sx+dx*length*0.3,0.3+(i%3)*0.08,sz+dz*length*0.3,sx+dx*length,0.12,sz+dz*length);
      li.push(b,b+1,b+2,b+1,b+3,b+2);for(let j=0;j<4;j++)lc.push(0.75+(i%3)*0.07,0.9+(i%3)*0.04,0.72,1);
    }
  }
  const foliage=new Mesh("gardenIrisLeaves",scene),foliageData=new VertexData(),ln:number[]=[];VertexData.ComputeNormals(lp,li,ln);foliageData.positions=lp;foliageData.normals=ln;foliageData.indices=li;foliageData.colors=lc;foliageData.applyToMesh(foliage);foliage.material=green;green.backFaceCulling=false;
  const pellets = Array.from({ length: 5 }, (_, i) => {
    const dot = MeshBuilder.CreateSphere("koiFeed", { diameter: 0.08, segments: 5 }, scene);
    dot.position.set(x - 2.1 + (i % 3) * 0.3, 0.10, z - 0.35 + Math.floor(i / 3) * 0.4); dot.material = wood; dot.setEnabled(false); return dot;
  });
  // Original Tunyard koi have an articulated middle and tail. Their +Z head
  // follows the tangent; the delayed tail turn creates a lateral swim wave.
  const fish = [0, 1, 2].map((i) => addTunyardKoi(scene, i === 1 ? "ogon" : "kohaku", x, 0.15, z, i === 2 ? 0.9 : 1));
  let feedTime = 0, swimTime = 0, feedBlend = 0;
  const garden = {
    koiCount: fish.length,
    feed: () => { feedTime = 5; pellets.forEach((p) => p.setEnabled(true)); },
    update: (dt: number) => {
      const step = Math.max(0, Math.min(dt, 0.1)); swimTime += step;
      if (feedTime > 0) { feedTime = Math.max(0, feedTime - step); if (feedTime === 0) pellets.forEach((p) => p.setEnabled(false)); }
      feedBlend += ((feedTime > 0 ? 1 : 0) - feedBlend) * Math.min(1, step * 1.2);
      for (let i = 0; i < fish.length; i++) {
        const f = fish[i]!, p = koiPose(swimTime, i, feedBlend);
        f.root.position.set(p.x, 0.015 + Math.sin(swimTime * 1.1 + i) * 0.008, p.z);
        f.root.rotation.y = p.yaw;
        f.mid.rotation.y = p.tail * 0.45;
        f.tail.rotation.y = Math.sin(swimTime * 2.2 + i * 1.1 - 0.8) * 0.24;
      }
    },
  };
  garden.update(0);
  return garden;
}
