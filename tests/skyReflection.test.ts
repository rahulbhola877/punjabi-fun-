import {expect,it}from "vitest";
import {skyReflectionFaces}from "../src/render/waterSky";

it("puts blue sky on +Y, ground on -Y and keeps horizon edges continuous",()=>{
 const size=33,faces=skyReflectionFaces(size),pixel=(face:number,x:number,y:number)=>Array.from(faces[face]!.slice((y*size+x)*4,(y*size+x)*4+3));
 const up=pixel(2,16,16),down=pixel(3,16,16);
 expect(up[2]!-up[0]!).toBeGreaterThan(60);expect(down[1]!-down[2]!).toBeGreaterThan(4);
 for(const side of [0,1,4,5])for(const [face,y]of [[2,0],[3,32]]){
  const a=pixel(side,16,y!),b=pixel(face!,16,0);expect(Math.max(...a.map((c,i)=>Math.abs(c-b[i]!)))).toBeLessThan(5);
 }
});
