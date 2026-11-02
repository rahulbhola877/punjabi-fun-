import {expect,it}from "vitest";
import {punjabBroadleafTemplate}from "../src/world/punjabTrees";

it("keeps young street neem within facade clearance and complete species trees grounded/opaque",()=>{
 const young=punjabBroadleafTemplate('neem',1,true),mature=punjabBroadleafTemplate('neem',1);
 const points=[...young.bark.positions,...young.leaves.positions];
 const radius=Math.max(...points.filter((_,i)=>i%3===0).map((x,i)=>Math.hypot(x,points[i*3+2]!)));
 expect(radius*1.06).toBeLessThan(1.2);
 expect(Math.max(...points.filter((_,i)=>i%3===1))).toBeLessThan(4.1);
 expect(Math.max(...mature.leaves.positions.filter((_,i)=>i%3===1))).toBeGreaterThan(5);
 for(const kind of ['neem','shisham','kikar','peepal','mango','poplar','kinnow']as const){
  const tree=punjabBroadleafTemplate(kind,2),parts=[tree.bark,tree.leaves],p=parts.flatMap(g=>g.positions);
  expect(Math.min(...p.filter((_,i)=>i%3===1))).toBeCloseTo(0,5);
  expect(parts.reduce((n,g)=>n+g.indices.length/3,0)).toBeLessThan(650);
  for(const g of parts){expect(g.indices.every(i=>i>=0&&i<g.vertexCount)).toBe(true);expect(g.colors.filter((_,i)=>i%4===3).every(a=>a===1)).toBe(true);}
 }
 const poplar=punjabBroadleafTemplate('poplar',0);expect(Math.max(...poplar.leaves.positions.filter((_,i)=>i%3===1))).toBeGreaterThan(10);
 const citrus=punjabBroadleafTemplate('kinnow',0);expect(Math.max(...citrus.leaves.positions.filter((_,i)=>i%3===1))).toBeLessThan(3.6);
});
