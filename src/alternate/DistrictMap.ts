import { canWalkChina, CHINA_WORLD } from "./chinaMap";
import { canWalkJapan, JAPAN_WORLD, JAPAN_POND, JAPAN_PARK } from "./japanMap";
import { canWalkNeon, NEON_WORLD, NEON_BEACONS, NEON_FOX } from "./neonMap";
import { canWalkSpace, SPACE_WORLD } from "./spaceMap";
import { canWalkPixel, PIXEL_WORLD, isPixelWater } from "./pixelMap";

type Layout={name:string;minX:number;maxX:number;minZ:number;maxZ:number;walk:(x:number,z:number)=>boolean;water?:(x:number,z:number)=>boolean;points:Array<{x:number;z:number;name:string}>};
const at=(p:{x:number;z:number},name:string)=>({...p,name});
export function districtMapLayout(id:string):Layout {
  switch(id) {
    case "china": return {...CHINA_WORLD,name:"Lantern Harbor",walk:canWalkChina,water:(x,z)=>Math.abs(x)<9&&Math.abs(z-2)>6&&Math.abs(z-48)>6,points:[at(CHINA_WORLD.portal,"Return"),at(CHINA_WORLD.host,"Mei"),at(CHINA_WORLD.artisan,"Workshop"),{x:-25,z:25,name:"Market"}]};
    case "japan": return {...JAPAN_WORLD,name:"Sakura Street",walk:canWalkJapan,water:(x,z)=>((x-JAPAN_POND.x)/JAPAN_POND.rx)**2+((z-JAPAN_POND.z)/JAPAN_POND.rz)**2<1,points:[at(JAPAN_WORLD.portal,"Return"),at(JAPAN_WORLD.shopkeeper,"Aiko · Tea"),at(JAPAN_WORLD.resident,"Ken"),at(JAPAN_POND,"Koi pond"),{x:JAPAN_PARK.cameraX,z:JAPAN_PARK.cameraZ,name:"Sakura Park"}]};
    case "neon": return {...NEON_WORLD,name:"Neon Quay",walk:canWalkNeon,points:[at(NEON_WORLD.portal,"Return"),at(NEON_FOX,"Fox"),...NEON_BEACONS.map((p,i)=>at(p,`Signal ${i+1}`))]};
    case "space": return {...SPACE_WORLD,name:"Chand Outpost",walk:canWalkSpace,points:[at(SPACE_WORLD.portal,"Return"),at(SPACE_WORLD.pilot,"Pilot"),at(SPACE_WORLD.rover,"Rover"),at(SPACE_WORLD.relay,"Relay"),at(SPACE_WORLD.sample,"Crater sample")]};
    default:return {name:"Lantern Valley",minX:0,maxX:PIXEL_WORLD.width,minZ:0,maxZ:PIXEL_WORLD.height,walk:canWalkPixel,water:(x,z)=>isPixelWater(Math.floor(x),Math.floor(z)),points:[{x:PIXEL_WORLD.portal.x,z:PIXEL_WORLD.portal.y,name:"Return"},{x:PIXEL_WORLD.shrine.x,z:PIXEL_WORLD.shrine.y,name:"Shrine"}]};
  }
}

/** Uses the same authored collision footprints as play. North is up in 3D;
 * Pixel's screen coordinates are retained so its map matches the 2D view. */
export function drawDistrictMap(canvas:HTMLCanvasElement,id:string,x:number,z:number):void {
  const l=districtMapLayout(id),c=canvas.getContext("2d")!;canvas.width=600;canvas.height=360;
  const pad=24,w=552,h=312,spanX=l.maxX-l.minX,spanZ=l.maxZ-l.minZ;
  const px=(x:number)=>pad+(x-l.minX)/spanX*w,pz=(z:number)=>pad+(id==="pixel"?(z-l.minZ)/spanZ:1-(z-l.minZ)/spanZ)*h;
  c.fillStyle="#14232a";c.fillRect(0,0,600,360);
  for(let row=0;row<78;row++)for(let col=0;col<138;col++) {
    const wx=l.minX+(col+0.5)/138*spanX,wz=l.minZ+(row+0.5)/78*spanZ;
    c.fillStyle=l.water?.(wx,wz)?"#297d8a":l.walk(wx,wz)?"#b8b9a1":"#4c6260";
    c.fillRect(px(wx)-2,pz(wz)-2,4.5,4.5);
  }
  c.font="bold 12px system-ui";c.textBaseline="bottom";
  for(const p of l.points) {c.fillStyle=p.name==="Return"?"#80e4ff":"#fff6d9";c.beginPath();c.arc(px(p.x),pz(p.z),4,0,Math.PI*2);c.fill();c.strokeStyle="#14232a";c.lineWidth=3;c.strokeText(p.name,Math.min(510,px(p.x)+7),pz(p.z)-4);c.fillText(p.name,Math.min(510,px(p.x)+7),pz(p.z)-4);}
  c.fillStyle="#ffca4b";c.beginPath();c.arc(px(x),pz(z),6,0,Math.PI*2);c.fill();c.strokeStyle="#14232a";c.lineWidth=2;c.stroke();
  c.fillStyle="#fff";c.fillText("You",px(x)+9,pz(z)+15);c.fillText(id==="pixel"?"Screen up":"N ↑",555,20);
}
