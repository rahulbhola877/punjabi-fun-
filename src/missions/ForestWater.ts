import { MeshBuilder, PhysicsBody, PhysicsMotionType, PhysicsShapeMesh, Vector3, type Mesh, type Scene } from "../babylon";
import { Group } from "../app/config";
import { GeoBuilder, rgb } from "../render/GeoBuilder";
import type { Materials } from "../render/Materials";
import { groundHeight } from "../world/groundHeight";
import { FOREST_CHANNEL_TRUNK, FOREST_CHANNEL_POOL, FOREST_CHANNEL_HILLSIDE, FOREST_CHANNEL_POOL_BED } from "../world/forestChannelLayout";

/** A one-off repair, persisted in the existing numeric save dictionary. */
export const FOREST_RANGER = { x: -895, z: 1900 } as const;
export const FOREST_CHANNEL = { x: -883, z: 1909 } as const;
export const FOREST_BLOCKAGE = { x: -874, z: 1918 } as const;
export const FOREST_GATE = { x: -867, z: 1928 } as const;
const KEY = "forestWaterStage";
const REVIEW_DAY = "forestWaterReviewDay";
/** 0 available; 1 inspect; 2 clear; 3 choose; 4/5 report pool/hillside; 6/7 completed. */
export function forestWaterStage(home: Record<string, number>): number {
  const n = home[KEY];
  return Number.isInteger(n) && n! >= 0 && n! <= 7 ? n! : 0;
}
export function forestWaterActive(home: Record<string, number>): boolean {
  const stage = forestWaterStage(home);
  return stage >= 1 && stage <= 5;
}
export function advanceForestWater(home: Record<string, number>, from: number, to: number): boolean {
  const allowed = (from === 0 && to === 1) || (from === 1 && to === 2) || (from === 2 && to === 3)
    || (from === 3 && (to === 4 || to === 5)) || (from === 4 && to === 6) || (from === 5 && to === 7);
  if (!allowed || forestWaterStage(home) !== from) return false;
  home[KEY] = to;
  return true;
}

/** Record the report day in the same checkpoint as the original reward. */
export function recordForestWaterReport(home: Record<string, number>, day: number): void {
  if ((forestWaterStage(home) === 6 || forestWaterStage(home) === 7) && Number.isInteger(day) && day >= 0) home[REVIEW_DAY] = day;
}

/** Completed older saves without a report day can review immediately. */
export function forestWaterCanReview(home: Record<string, number>, day: number): boolean {
  const stage = forestWaterStage(home), last = home[REVIEW_DAY];
  if ((stage !== 6 && stage !== 7) || !Number.isInteger(day) || day < 0) return false;
  return last === undefined || (Number.isInteger(last) && last >= 0 && day > last);
}

/** Switch only after the report day, at most once per day; no reward is paid. */
export function switchForestWaterOutlet(home: Record<string, number>, day: number): boolean {
  if (!forestWaterCanReview(home, day)) return false;
  home[KEY] = forestWaterStage(home) === 6 ? 7 : 6;
  home[REVIEW_DAY] = day;
  return true;
}

/** Physical evidence of the repair. Two separate outlets retain the player's choice on reload. */
export class ForestWaterProps {
  private obstruction: Array<{mesh:Mesh;contact:{body:PhysicsBody;shape:PhysicsShapeMesh}|null}> = [];
  private pool: Mesh[] = [];
  private hillside: Mesh[] = [];
  private meshes:Mesh[]=[];
  private surfaces:Array<{mesh:Mesh;positions:Float32Array;indices:number[]}>=[];
  private gateContact:{body:PhysicsBody;shape:PhysicsShapeMesh}|null=null;
  private disposed=false;
  private bounds={minX:Infinity,maxX:-Infinity,minZ:Infinity,maxZ:-Infinity};
  constructor(private scene: Scene, mats: Materials) {
    // The channel lies beside the walking trail; all surfaces sample the ridge,
    // and short segments follow its actual triangles instead of hovering on a slope.
    const trunk = FOREST_CHANNEL_TRUNK, poolBranch = FOREST_CHANNEL_POOL, hillsideBranch = FOREST_CHANNEL_HILLSIDE;
    const bed = new GeoBuilder(), banks = new GeoBuilder();
    const stream = new GeoBuilder(), pool = new GeoBuilder(), hillside = new GeoBuilder();
    const strip = (g: GeoBuilder, path: ReadonlyArray<readonly [number, number]>, width: number, offset: number, lift: number, color: ReturnType<typeof rgb>) => {
      for (let k = 1; k < path.length; k++) {
        const [ax, az] = path[k - 1]!, [bx, bz] = path[k]!;
        const dx = bx - ax, dz = bz - az, length = Math.hypot(dx, dz), nx = -dz / length, nz = dx / length;
        const point = (t: number, side: number) => {
          const x = ax + dx * t + nx * (offset + side * width / 2), z = az + dz * t + nz * (offset + side * width / 2);
          return new Vector3(x, groundHeight(x, z) + lift, z);
        };
        const count = Math.ceil(length / 0.8);
        for (let i = 0; i < count; i++) { const a = i / count, b = (i + 1) / count; g.quad(point(a, -1), point(b, -1), point(b, 1), point(a, 1), color); }
      }
    };
    for (const path of [trunk, poolBranch, hillsideBranch]) {
      // The physical ridge supports the feet. Keep its decorative bed flush,
      // rather than drawing a raised bed beneath a fictitiously deep volume.
      strip(bed, path, 1.45, 0, 0.003, rgb("#665b46"));
      for (const side of [-0.82, 0.82]) strip(banks, path, 0.25, side, 0.18, rgb("#9a8e73"));
    }
    strip(stream, trunk, 1.05, 0, 0.19, rgb("#a6d6d0"));
    strip(pool, poolBranch, 1.05, 0, 0.19, rgb("#a6d6d0"));
    strip(bed, FOREST_CHANNEL_POOL_BED, 3.0, 0, 0.003, rgb("#665b46"));
    strip(pool, FOREST_CHANNEL_POOL_BED, 2.6, 0, 0.19, rgb("#a6d6d0"));
    strip(hillside, hillsideBranch, 1.05, 0, 0.19, rgb("#a6d6d0"));
    for (const [g, name, material] of [[bed, "forest_channel_bed", "dirt"], [banks, "forest_channel_banks", "concrete"]] as const) {
      const mesh = g.toMesh(name, scene, mats.get(material)); mesh.isPickable = false;this.meshes.push(mesh);
    }
    const commonWater = stream.toMesh("forest_spring_water", scene, mats.get("water")); commonWater.isPickable = false;
    const poolWater = pool.toMesh("forest_pool_water", scene, mats.get("water")); poolWater.isPickable = false;
    const hillWater = hillside.toMesh("forest_hillside_water", scene, mats.get("water")); hillWater.isPickable = false;
    this.pool = [commonWater, poolWater]; this.hillside = [hillWater];
    for(const [mesh,g]of [[commonWater,stream],[poolWater,pool],[hillWater,hillside]]as const){
      this.meshes.push(mesh);
      // Babylon uploads Float32 positions: sample those same triangles, including
      // the exact strip ends and wider pool, rather than a radius around a path.
      const positions=new Float32Array(g.positions);
      this.surfaces.push({mesh,positions,indices:g.indices});
      for(let i=0;i<positions.length;i+=3){this.bounds.minX=Math.min(this.bounds.minX,positions[i]!);this.bounds.maxX=Math.max(this.bounds.maxX,positions[i]!);this.bounds.minZ=Math.min(this.bounds.minZ,positions[i+2]!);this.bounds.maxZ=Math.max(this.bounds.maxZ,positions[i+2]!);}
    }
    // A small sluice frame at the head gives the gate interaction a physical object.
    const gateY = groundHeight(-869, 1928);
    const gate = new GeoBuilder(), timber = rgb("#6c5135"), iron = rgb("#68716a");
    gate.box(-869.8, gateY + 0.55, 1928, 0.18, 1.1, 0.18, timber);
    gate.box(-868.2, gateY + 0.55, 1928, 0.18, 1.1, 0.18, timber);
    gate.box(-869, gateY + 1.08, 1928, 1.8, 0.16, 0.2, timber);
    gate.box(-869, gateY + 0.65, 1928, 0.12, 0.75, 0.12, iron);
    const gateMesh = gate.toMesh("forest_sluice_gate", scene, mats.get("wood")); gateMesh.isPickable = false;
    this.meshes.push(gateMesh);this.gateContact=this.contact(gateMesh);
    for (let i = 0; i < 3; i++) {
      const x = -876 + (i - 1) * 0.38, z = 1919 + i * 0.28;
      const log = MeshBuilder.CreateCylinder(`forest_water_log_${i}`, { height: 2.1 - i * 0.2, diameter: 0.3, tessellation: 8 }, scene);
      log.position.set(x, groundHeight(x, z) + 0.23 + i * 0.15, z);
      log.rotation.set(Math.PI / 2, 0.3 + i * 0.65, 0); log.material = mats.get("tunyardBark"); log.isPickable = false;
      this.meshes.push(log);this.obstruction.push({mesh:log,contact:this.contact(log)});
    }
    this.sync({});
    scene.onDisposeObservable.addOnce(()=>this.dispose());
  }

  private contact(mesh:Mesh):{body:PhysicsBody;shape:PhysicsShapeMesh}|null {
    if(!this.scene.getPhysicsEngine())return null;
    // Resolve Euler rotation and the world pose before native body creation.
    mesh.computeWorldMatrix(true);
    const shape=new PhysicsShapeMesh(mesh,this.scene);
    shape.filterMembershipMask=Group.STATIC;
    shape.material={friction:.8,restitution:0};
    const body=new PhysicsBody(mesh,PhysicsMotionType.STATIC,false,this.scene);
    body.shape=shape;
    return{body,shape};
  }

  sync(home: Record<string, number>): void {
    if(this.disposed)return;
    const s = forestWaterStage(home);
    for (const log of this.obstruction){
      log.mesh.setEnabled(s<3);
      if(s<3&&!log.contact)log.contact=this.contact(log.mesh);
      else if(s>=3&&log.contact){log.contact.body.dispose();log.contact.shape.dispose();log.contact=null;}
    }
    for (const m of this.pool) m.setEnabled(s === 4 || s === 6);
    if (s === 5 || s === 7) this.pool[0]!.setEnabled(true);
    for (const m of this.hillside) m.setEnabled(s === 5 || s === 7);
  }

  /** Highest enabled water triangle, or null outside the chosen outlet. */
  surfaceYAt(x:number,z:number):number|null {
    if(this.disposed||!Number.isFinite(x+z))return null;
    if(x<this.bounds.minX||x>this.bounds.maxX||z<this.bounds.minZ||z>this.bounds.maxZ)return null;
    let top=-Infinity;
    for(const {mesh,positions:p,indices}of this.surfaces){
      if(!mesh.isEnabled())continue;
      for(let i=0;i<indices.length;i+=3){
        const a=indices[i]!*3,b=indices[i+1]!*3,c=indices[i+2]!*3;
        const ax=p[a]!,az=p[a+2]!,bx=p[b]!,bz=p[b+2]!,cx=p[c]!,cz=p[c+2]!;
        const denominator=(bz-cz)*(ax-cx)+(cx-bx)*(az-cz);
        if(Math.abs(denominator)<1e-12)continue;
        const u=((bz-cz)*(x-cx)+(cx-bx)*(z-cz))/denominator;
        const v=((cz-az)*(x-cx)+(ax-cx)*(z-cz))/denominator,w=1-u-v;
        if(u>=-1e-8&&v>=-1e-8&&w>=-1e-8)top=Math.max(top,u*p[a+1]!+v*p[b+1]!+w*p[c+1]!);
      }
    }
    return top===-Infinity?null:top;
  }

  /** Foot immersion in the actual visible shallow stream; never a swim volume. */
  depthAt(x:number,z:number,feetY:number):number {
    if(!Number.isFinite(feetY))return 0;
    const surface=this.surfaceYAt(x,z);
    return surface===null?0:Math.max(0,surface-feetY);
  }

  dispose():void {
    if(this.disposed)return;this.disposed=true;
    for(const log of this.obstruction){log.contact?.body.dispose();log.contact?.shape.dispose();log.contact=null;}
    this.gateContact?.body.dispose();this.gateContact?.shape.dispose();this.gateContact=null;
    for(const mesh of this.meshes)mesh.dispose();
    this.meshes.length=0;this.surfaces.length=0;
  }
}
