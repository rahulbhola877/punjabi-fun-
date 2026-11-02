import {terrainGrid,type TerrainGrid}from "./hillTerrain";
import {ORCHARD,ORCHARD_STEP,orchardHeight}from "./orchardTerrain";
import {RIDGE_BOUNDS,ridgeHeight}from "./ridgeTerrain";
import {inOuterCore,inOuterExtent,outerHeight}from "./outerTerrain";

/** The diagonal is 00→11, exactly as drawn and used by PhysicsShapeMesh. */
function sample(t:TerrainGrid,x:number,z:number):number|null {
 const u=(x-t.x0)/t.step,v=(z-t.z0)/t.step;
 if(u<0||v<0||u>t.nx-1||v>t.nz-1)return null;
 const i=Math.min(t.nx-2,Math.floor(u)),j=Math.min(t.nz-2,Math.floor(v)),fx=u-i,fz=v-j,a=j*t.nx+i;
 const h00=t.y[a]!,h10=t.y[a+1]!,h01=t.y[a+t.nx]!,h11=t.y[a+t.nx+1]!;
 return fx>=fz?h00*(1-fx)+h10*(fx-fz)+h11*fz:h00*(1-fz)+h11*fx+h01*(fz-fx);
}
let orchard:TerrainGrid|null=null;
function orchardGrid():TerrainGrid {
 if(orchard)return orchard;
 const nx=(ORCHARD.x1-ORCHARD.x0)/ORCHARD_STEP+1,nz=(ORCHARD.z1-ORCHARD.z0)/ORCHARD_STEP+1,y=new Float32Array(nx*nz);
 for(let j=0;j<nz;j++)for(let i=0;i<nx;i++)y[j*nx+i]=orchardHeight(ORCHARD.x0+i*ORCHARD_STEP,ORCHARD.z0+j*ORCHARD_STEP);
 return orchard={x0:ORCHARD.x0,z0:ORCHARD.z0,nx,nz,step:ORCHARD_STEP,y};
}
/** Ground surface for planting/weather, including between grid vertices. */
export function groundHeight(x:number,z:number):number {
 if(!inOuterCore(x,z)&&inOuterExtent(x,z))return outerHeight(x,z);
 if(x>=ORCHARD.x0&&x<=ORCHARD.x1&&z>=ORCHARD.z0&&z<=ORCHARD.z1)return sample(orchardGrid(),x,z)!;
 if(x>=RIDGE_BOUNDS.x0&&x<=RIDGE_BOUNDS.x1&&z>=RIDGE_BOUNDS.z0&&z<=RIDGE_BOUNDS.z1)return ridgeHeight(x,z);
 return sample(terrainGrid(),x,z)??0;
}
